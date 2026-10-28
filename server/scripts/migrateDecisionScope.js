require("dotenv").config();

const mongoose = require("mongoose");
const Decision = require("../src/models/Decision");
const Discussion = require("../src/models/Discussion");
const Task = require("../src/models/Task");
const Project = require("../src/models/Project");

const applyChanges = process.argv.includes("--apply");
const validId = (value) => value && mongoose.isObjectIdOrHexString(value);
const unchangedField = (document, key) => ({
  [key]: document[key] === undefined ? { $exists: false } : document[key],
});

async function projectScope(projectId) {
  if (!validId(projectId)) return null;
  const project = await Project.findById(projectId).select("_id workspace").lean();
  return project ? { workspace: project.workspace, project: project._id } : null;
}

function sameScope(left, right) {
  return left && right && String(left.workspace) === String(right.workspace) && String(left.project) === String(right.project);
}

async function inspectDecision(decision) {
  const evidence = [];
  const conflicts = [];

  if (decision.discussionId) {
    const discussion = validId(decision.discussionId)
      ? await Discussion.findById(decision.discussionId).select("workspace project").lean()
      : null;
    if (!validId(decision.discussionId)) conflicts.push("referenced discussion ID is invalid");
    else if (!discussion) conflicts.push("referenced discussion is missing");
    else {
      const scope = await projectScope(discussion.project);
      if (!scope || String(scope.workspace) !== String(discussion.workspace)) conflicts.push("discussion project/workspace relationship is inconsistent");
      else evidence.push({ source: "discussion", ...scope });
    }
  }

  const taskId = decision.linkedTask || (validId(decision.taskId) ? decision.taskId : null);
  if (decision.linkedTask && validId(decision.taskId) && String(decision.linkedTask) !== String(decision.taskId)) {
    conflicts.push("linkedTask and legacy taskId disagree");
  }
  if (taskId) {
    const task = validId(taskId) ? await Task.findById(taskId).select("workspace project").lean() : null;
    if (!validId(taskId)) conflicts.push("referenced task ID is invalid");
    else if (!task) conflicts.push("referenced task is missing");
    else {
      const scope = await projectScope(task.project);
      if (!scope || String(scope.workspace) !== String(task.workspace)) conflicts.push("task project/workspace relationship is inconsistent");
      else evidence.push({ source: "task", ...scope });
    }
  }

  if (decision.projectRef) {
    const scope = await projectScope(decision.projectRef);
    if (!scope) conflicts.push("existing projectRef is missing");
    else evidence.push({ source: "existing projectRef", ...scope });
  }
  if (decision.taskId && !validId(decision.taskId)) {
    conflicts.push("legacy task ID is not a verifiable ObjectId");
  }

  const uniqueEvidence = [];
  for (const item of evidence) {
    if (!uniqueEvidence.some((prior) => sameScope(prior, item))) uniqueEvidence.push(item);
  }
  if (uniqueEvidence.length > 1) conflicts.push("discussion, task, or existing project scopes disagree");

  let inferred = uniqueEvidence[0] || null;
  if (!inferred && decision.project) {
    const matches = await Project.find({ name: decision.project }).select("_id workspace").lean();
    if (matches.length === 1) inferred = { source: "unique project name", workspace: matches[0].workspace, project: matches[0]._id };
    else if (matches.length > 1) conflicts.push("project name matches multiple projects");
  }

  if (inferred && decision.workspace && String(decision.workspace) !== String(inferred.workspace)) conflicts.push("existing workspace conflicts with inferred project");
  if (inferred && decision.projectRef && String(decision.projectRef) !== String(inferred.project)) conflicts.push("existing projectRef conflicts with inferred scope");

  const scopedPair = inferred && {
    workspace: decision.workspace || inferred.workspace,
    project: decision.projectRef || inferred.project,
  };
  if (scopedPair && String((await projectScope(scopedPair.project))?.workspace) !== String(scopedPair.workspace)) {
    conflicts.push("final workspace/project pair is invalid");
  }

  if (scopedPair && decision.linkedTask) {
    const validTask = await Task.exists({ _id: decision.linkedTask, workspace: scopedPair.workspace, project: scopedPair.project });
    if (!validTask) conflicts.push("linked task does not belong to final scope");
  }
  if (scopedPair && decision.discussionId) {
    const validDiscussion = await Discussion.exists({ _id: decision.discussionId, workspace: scopedPair.workspace, project: scopedPair.project });
    if (!validDiscussion) conflicts.push("discussion does not belong to final scope");
  }

  if (conflicts.length) return { action: "conflict/manual review", reasons: [...new Set(conflicts)] };
  if (!scopedPair) return { action: "skip/manual review", reasons: ["no unambiguous project/workspace scope"] };
  const set = {};
  if (!decision.workspace) set.workspace = scopedPair.workspace;
  if (!decision.projectRef) set.projectRef = scopedPair.project;
  if (!Object.keys(set).length) return { action: "already scoped", reasons: [] };
  return { action: "update", source: inferred.source, set, reasons: [] };
}

async function migrateDecisionScope() {
  try {
    if (!process.env.MONGODB_URI) throw new Error("missing-uri");
    await mongoose.connect(process.env.MONGODB_URI);
    const decisions = await Decision.find({}).select("_id workspace projectRef discussionId linkedTask taskId project").lean();
    const rows = [];
    for (const decision of decisions) {
      const plan = await inspectDecision(decision);
      rows.push({ decisionId: String(decision._id), ...plan });
      if (applyChanges && plan.action === "update") {
        const unchanged = ["workspace", "projectRef", "discussionId", "linkedTask", "taskId", "project"]
          .reduce((filter, key) => Object.assign(filter, unchangedField(decision, key)), { _id: decision._id });
        const result = await Decision.updateOne(
          unchanged,
          { $set: plan.set }
        );
        if (result.modifiedCount !== 1) {
          rows[rows.length - 1] = { decisionId: String(decision._id), action: "conflict/manual review", reasons: ["scope changed during migration; no update applied"] };
        } else {
          rows[rows.length - 1].action = "updated";
        }
      }
    }
    const counts = rows.reduce((result, row) => {
      result[row.action] = (result[row.action] || 0) + 1;
      return result;
    }, {});
    console.log(JSON.stringify({ mode: applyChanges ? "apply" : "dry-run", counts, records: rows }, null, 2));
  } catch {
    console.error("Decision scope migration could not complete; connection and credential details are suppressed.");
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  }
}

migrateDecisionScope();
