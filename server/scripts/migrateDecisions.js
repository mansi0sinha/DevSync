require("dotenv").config();

const mongoose = require("mongoose");
const Discussion = require("../src/models/Discussion");
const Decision = require("../src/models/Decision");
const Project = require("../src/models/Project");
const Task = require("../src/models/Task");

const applyChanges = process.argv.includes("--apply");

async function migrateDecisions() {
  try {
    if (!process.env.MONGODB_URI) throw new Error("missing-uri");
    await mongoose.connect(process.env.MONGODB_URI);
    const discussions = await Discussion.find({ decision: { $exists: true, $ne: null } })
      .select("_id workspace project linkedTask decision.title decision.summary decision.context")
      .lean();
    const rows = [];

    for (const discussion of discussions) {
      if (!mongoose.isObjectIdOrHexString(discussion.workspace) || !mongoose.isObjectIdOrHexString(discussion.project)) {
        rows.push({ discussionId: String(discussion._id), action: "conflict/manual review", reason: "discussion workspace/project ID is invalid" });
        continue;
      }
      const project = await Project.findOne({ _id: discussion.project, workspace: discussion.workspace }).select("_id name").lean();
      if (!project) {
        rows.push({ discussionId: String(discussion._id), action: "skip/manual review", reason: "project does not belong to discussion workspace" });
        continue;
      }
      const existing = await Decision.find({ discussionId: discussion._id }).select("_id").limit(2).lean();
      if (existing.length > 1) {
        rows.push({ discussionId: String(discussion._id), action: "conflict/manual review", reason: "multiple decisions already reference this discussion" });
        continue;
      }
      if (existing.length === 1) {
        rows.push({ discussionId: String(discussion._id), action: "skip/already migrated", decisionId: String(existing[0]._id) });
        continue;
      }
      if (typeof discussion.decision?.title !== "string" || !discussion.decision.title.trim() || typeof discussion.decision?.summary !== "string" || !discussion.decision.summary.trim()) {
        rows.push({ discussionId: String(discussion._id), action: "skip/manual review", reason: "embedded decision title or summary is invalid" });
        continue;
      }
      let linkedTask = null;
      if (discussion.linkedTask) {
        if (!mongoose.isObjectIdOrHexString(discussion.linkedTask)) {
          rows.push({ discussionId: String(discussion._id), action: "conflict/manual review", reason: "linked task ID is invalid" });
          continue;
        }
        linkedTask = await Task.findOne({ _id: discussion.linkedTask, workspace: discussion.workspace, project: project._id }).select("_id").lean();
        if (!linkedTask) {
          rows.push({ discussionId: String(discussion._id), action: "conflict/manual review", reason: "linked task does not belong to discussion project/workspace" });
          continue;
        }
      }
      const data = {
        title: discussion.decision.title.trim(),
        summary: discussion.decision.summary.trim(),
        context: typeof discussion.decision.context === "string" ? discussion.decision.context.trim() : "",
        project: project.name,
        workspace: discussion.workspace,
        projectRef: project._id,
        taskId: linkedTask ? String(linkedTask._id) : "",
        linkedTask: linkedTask?._id || null,
        discussionId: discussion._id,
        lifecycleStatus: "Accepted",
        createdBy: "Unknown",
        deletedAt: null,
      };
      if (applyChanges) {
        // The script processes sequentially and rechecks before insert. A unique index is not present in the existing schema.
        const unchangedDiscussion = await Discussion.exists({
          _id: discussion._id,
          workspace: discussion.workspace,
          project: project._id,
          linkedTask: discussion.linkedTask || null,
          "decision.title": discussion.decision.title,
          "decision.summary": discussion.decision.summary,
        });
        if (!unchangedDiscussion) {
          rows.push({ discussionId: String(discussion._id), action: "conflict/manual review", reason: "discussion changed during migration" });
          continue;
        }
        const raced = await Decision.find({ discussionId: discussion._id }).select("_id").limit(2).lean();
        if (raced.length) {
          rows.push({ discussionId: String(discussion._id), action: raced.length > 1 ? "conflict/manual review" : "skip/already migrated", decisionId: String(raced[0]._id) });
          continue;
        }
        const inserted = await Decision.create(data);
        rows.push({ discussionId: String(discussion._id), decisionId: String(inserted._id), action: "inserted" });
      } else {
        rows.push({ discussionId: String(discussion._id), action: "would insert", workspaceId: String(discussion.workspace), projectRef: String(project._id) });
      }
    }

    const counts = rows.reduce((result, row) => {
      result[row.action] = (result[row.action] || 0) + 1;
      return result;
    }, {});
    console.log(JSON.stringify({ mode: applyChanges ? "apply" : "dry-run", counts, records: rows }, null, 2));
  } catch {
    console.error("Embedded decision migration could not complete; connection and credential details are suppressed.");
    process.exitCode = 1;
  } finally {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  }
}

migrateDecisions();
