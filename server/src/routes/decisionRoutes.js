const express = require("express");
const mongoose = require("mongoose");

const Decision = require("../models/Decision");
const Task = require("../models/Task");
const Discussion = require("../models/Discussion");
const Project = require("../models/Project");
const Workspace = require("../models/Workspace");
const authMiddleware = require("../middleware/authMiddleware");
const { recordProjectEvent } = require("../services/projectEvents");
const { createDecisionRecord } = require("../services/projectRecords");
const { clearCrossScopeTask } = require("../utils/scopedTaskReference");

const router = express.Router();
router.use(authMiddleware);

const validId = (value) => typeof value === "string" && mongoose.isValidObjectId(value);
const objectBody = (body) => body && typeof body === "object" && !Array.isArray(body);

async function getAccessibleProject(workspaceId, projectId, userId) {
  if (!validId(workspaceId) || !validId(projectId)) return { status: 400, message: "Valid workspace and project IDs are required." };
  const workspace = await Workspace.findOne({ _id: workspaceId, "members.user": userId }).select("_id");
  if (!workspace) return { status: 404, message: "Workspace not found or access denied." };
  const project = await Project.findOne({ _id: projectId, workspace: workspace._id }).select("_id name");
  if (!project) return { status: 404, message: "Project not found in this workspace." };
  return { workspace, project };
}

async function resolveReferences({ linkedTask, taskId, discussionId, discussionMessageId }, scope) {
  if (linkedTask !== null && linkedTask !== undefined && linkedTask !== "" && !validId(linkedTask)) {
    return { error: { status: 400, message: "Invalid linked task ID." } };
  }
  if (taskId !== null && taskId !== undefined && taskId !== "" && !validId(taskId)) {
    return { error: { status: 400, message: "Invalid task ID." } };
  }
  if (linkedTask && taskId && String(linkedTask) !== String(taskId)) {
    return { error: { status: 400, message: "Linked task and task ID must refer to the same task." } };
  }
  let task = null;
  const taskReference = linkedTask || taskId;
  if (taskReference !== null && taskReference !== undefined && taskReference !== "") {
    if (!validId(taskReference)) return { error: { status: 400, message: "Invalid linked task ID." } };
    task = await Task.findOne({ _id: taskReference, workspace: scope.workspace._id, project: scope.project._id }).select("_id");
    if (!task) return { error: { status: 400, message: "The linked task must belong to this project and workspace." } };
  }
  let discussion = null;
  if (discussionId !== null && discussionId !== undefined && discussionId !== "") {
    if (!validId(discussionId)) return { error: { status: 400, message: "Invalid discussion ID." } };
    discussion = await Discussion.findOne({ _id: discussionId, workspace: scope.workspace._id, project: scope.project._id }).select("_id messages._id messages.author");
    if (!discussion) return { error: { status: 400, message: "The discussion must belong to this project and workspace." } };
  }
  if (discussionMessageId !== null && discussionMessageId !== undefined && discussionMessageId !== "") {
    if (!validId(discussionMessageId)) return { error: { status: 400, message: "Invalid source message ID." } };
    if (!discussion || !discussion.messages.id(discussionMessageId)) return { error: { status: 400, message: "The source message must belong to the selected discussion and project." } };
  }
  return { task, discussion, discussionMessageId: discussionMessageId || null };
}

const populated = async (query) => {
  const result = await query
    .populate("linkedTask", "title status priority dueDate workspace project")
    .populate("discussionId", "title")
    .populate("projectRef", "name");
  const decisions = Array.isArray(result) ? result : [result];
  decisions.filter(Boolean).forEach((decision) => clearCrossScopeTask(decision, { workspaceField: "workspace", projectField: "projectRef" }));
  return result;
};

router.get("/", async (req, res) => {
  try {
    const { workspaceId, projectId } = req.query;
    const scope = await getAccessibleProject(workspaceId, projectId, req.user._id);
    if (scope.status) return res.status(scope.status).json({ message: scope.message });
    const decisions = await populated(Decision.find({ workspace: scope.workspace._id, projectRef: scope.project._id, deletedAt: null }).sort({ updatedAt: -1 }));
    return res.status(200).json(decisions);
  } catch (error) {
    console.error("Fetch decisions error:", error);
    return res.status(500).json({ message: "Failed to fetch decisions." });
  }
});

router.get("/trash", async (req, res) => {
  try {
    const scope = await getAccessibleProject(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.status) return res.status(scope.status).json({ message: scope.message });
    const decisions = await populated(Decision.find({ workspace: scope.workspace._id, projectRef: scope.project._id, deletedAt: { $ne: null } }).sort({ deletedAt: -1 }));
    return res.status(200).json(decisions);
  } catch (error) {
    console.error("Fetch deleted decisions error:", error);
    return res.status(500).json({ message: "Failed to fetch deleted decisions." });
  }
});

router.post("/", async (req, res) => {
  try {
    if (!objectBody(req.body)) return res.status(400).json({ message: "A valid request body is required." });
    const { title, summary, context = "", taskId = "", linkedTask = null, discussionId = null, discussionMessageId = null, workspaceId, projectId } = req.body;
    if (typeof title !== "string" || !title.trim() || typeof summary !== "string" || !summary.trim()) return res.status(400).json({ message: "Decision title and summary are required." });
    if (title.length > 200 || summary.length > 5000 || typeof context !== "string" || context.length > 5000 || typeof taskId !== "string" || taskId.length > 100) return res.status(400).json({ message: "Decision fields are invalid or too long." });
    const scope = await getAccessibleProject(workspaceId, projectId, req.user._id);
    if (scope.status) return res.status(scope.status).json({ message: scope.message });
    const references = await resolveReferences({ linkedTask, taskId, discussionId, discussionMessageId }, scope);
    if (references.error) return res.status(references.error.status).json({ message: references.error.message });
    if (references.discussionMessageId) {
      const existing = await Decision.findOne({
        workspace: scope.workspace._id,
        projectRef: scope.project._id,
        discussionMessageId: references.discussionMessageId,
      }).select("_id");
      if (existing) return res.status(409).json({ message: "This discussion message has already been recorded as a decision.", decisionId: String(existing._id) });
    }
    const decision = await createDecisionRecord({
      scope,
      actorName: req.user.name || req.user.email,
      fields: { title: title.trim(), summary: summary.trim(), context: context.trim() },
      task: references.task,
      discussion: references.discussion,
      discussionMessageId: references.discussionMessageId,
    });
    const linkedTaskRecord = references.task?._id ? await Task.findById(references.task._id).select("assignee") : null;
    const sourceAuthor = references.discussionMessageId ? references.discussion?.messages.id(references.discussionMessageId)?.author : null;
    await recordProjectEvent({
      io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id, projectId: scope.project._id,
      action: "decision.created", summary: `Recorded decision: ${decision.title}`,
      entityType: "decision", entityId: decision._id, eventKey: `decision.created:${decision._id}`,
      notifications: [linkedTaskRecord?.assignee, sourceAuthor].filter(Boolean).map((recipient) => ({
        recipient, type: "decision.recorded", title: "A project decision was recorded", message: decision.title, eventKey: String(decision._id),
      })),
    });
    return res.status(201).json(await populated(Decision.findById(decision._id)));
  } catch (error) {
    console.error("Create decision error:", error);
    if (error.code === 11000) return res.status(409).json({ message: "This discussion message has already been recorded as a decision." });
    if (error.name === "ValidationError" || error.name === "CastError") return res.status(400).json({ message: error.message });
    return res.status(500).json({ message: "Failed to create decision." });
  }
});

async function findOwnedDecision(id, userId, includeDeleted = true) {
  if (!validId(id)) return { status: 400, message: "Invalid decision ID." };
  const decision = await Decision.findById(id);
  if (!decision || (!includeDeleted && decision.deletedAt)) return { status: 404, message: "Decision not found." };
  const workspace = await Workspace.findOne({ _id: decision.workspace, "members.user": userId }).select("_id");
  if (!workspace) return { status: 404, message: "Decision not found or access denied." };
  const project = await Project.findOne({ _id: decision.projectRef, workspace: workspace._id }).select("_id");
  if (!project) return { status: 404, message: "Decision not found or its project is unavailable." };
  return { decision, workspace, project };
}

router.patch("/:id/status", async (req, res) => {
  try {
    if (!objectBody(req.body) || !["Accepted", "Superseded", "Archived"].includes(req.body.lifecycleStatus)) return res.status(400).json({ message: "Status must be Accepted, Superseded, or Archived." });
    const access = await findOwnedDecision(req.params.id, req.user._id, false);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const previousStatus = access.decision.lifecycleStatus;
    const result = await populated(Decision.findOneAndUpdate({ _id: access.decision._id, workspace: access.workspace._id, projectRef: access.project._id, deletedAt: null }, { $set: { lifecycleStatus: req.body.lifecycleStatus } }, { returnDocument: "after", runValidators: true }));
    if (result && previousStatus !== result.lifecycleStatus) await recordProjectEvent({
      io: req.app.get("io"), actorId: req.user._id, workspaceId: access.workspace._id, projectId: access.project._id,
      action: "decision.status_changed", summary: `Changed decision status: ${result.title}`,
      entityType: "decision", entityId: result._id, eventKey: `decision.status:${result._id}:${result.updatedAt?.getTime() || Date.now()}`,
    });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Update decision status error:", error);
    return res.status(500).json({ message: "Failed to update decision status." });
  }
});

router.patch("/:id/supersede", async (req, res) => {
  try {
    const replacementId = req.body?.replacementDecisionId;
    if (!validId(replacementId) || !validId(req.params.id)) return res.status(400).json({ message: "Valid original and replacement decision IDs are required." });
    if (String(req.params.id) === String(replacementId)) return res.status(400).json({ message: "A decision cannot supersede itself." });
    const original = await findOwnedDecision(req.params.id, req.user._id, false);
    if (original.status) return res.status(original.status).json({ message: original.message });
    const replacement = await Decision.findOne({ _id: replacementId, workspace: original.workspace._id, projectRef: original.decision.projectRef, deletedAt: null });
    if (!replacement) return res.status(404).json({ message: "Replacement decision not found in this project." });
    const updated = await populated(Decision.findOneAndUpdate({ _id: original.decision._id, workspace: original.workspace._id, projectRef: original.project._id, deletedAt: null }, { $set: { lifecycleStatus: "Superseded", supersededBy: replacement._id } }, { returnDocument: "after", runValidators: true }));
    if (updated) {
      const linkedTaskId = updated.linkedTask?._id || updated.linkedTask;
      const sourceDiscussionId = updated.discussionId?._id || updated.discussionId;
      const linkedTask = linkedTaskId ? await Task.findOne({ _id: linkedTaskId, workspace: original.workspace._id, project: original.project._id }).select("assignee") : null;
      const sourceDiscussion = sourceDiscussionId ? await Discussion.findOne({ _id: sourceDiscussionId, workspace: original.workspace._id, project: original.project._id }).select("messages._id messages.author") : null;
      const sourceAuthor = updated.discussionMessageId ? sourceDiscussion?.messages.id(updated.discussionMessageId)?.author : null;
      await recordProjectEvent({
        io: req.app.get("io"), actorId: req.user._id, workspaceId: original.workspace._id, projectId: original.project._id,
        action: "decision.superseded", summary: `Superseded decision: ${updated.title}`,
        entityType: "decision", entityId: updated._id, eventKey: `decision.superseded:${updated._id}:${replacement._id}`,
        notifications: [linkedTask?.assignee, sourceAuthor].filter(Boolean).map((recipient) => ({
          recipient, type: "decision.superseded", title: "A decision was superseded", message: updated.title, eventKey: String(replacement._id),
        })),
      });
    }
    return res.status(200).json(updated);
  } catch (error) {
    console.error("Supersede decision error:", error);
    return res.status(500).json({ message: "Failed to supersede decision." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const access = await findOwnedDecision(req.params.id, req.user._id, false);
    if (access.status) return res.status(access.status).json({ message: access.message });
    const updated = await populated(Decision.findOneAndUpdate({ _id: access.decision._id, workspace: access.workspace._id, projectRef: access.project._id, deletedAt: null }, { $set: { deletedAt: new Date(), deletedBy: req.user.name || req.user.email } }, { returnDocument: "after", runValidators: true }));
    if (updated) await recordProjectEvent({ io: req.app.get("io"), actorId: req.user._id, workspaceId: access.workspace._id, projectId: access.project._id, action: "decision.trashed", summary: `Moved decision to trash: ${updated.title}`, entityType: "decision", entityId: updated._id, eventKey: `decision.trashed:${updated._id}:${updated.updatedAt?.getTime() || Date.now()}` });
    return res.status(200).json({ message: "Decision moved to the Recycle Bin.", decision: updated });
  } catch (error) {
    console.error("Move decision to trash error:", error);
    return res.status(500).json({ message: "Failed to delete decision." });
  }
});

router.post("/:id/restore", async (req, res) => {
  try {
    const access = await findOwnedDecision(req.params.id, req.user._id, true);
    if (access.status) return res.status(access.status).json({ message: access.message });
    if (!access.decision.deletedAt) return res.status(404).json({ message: "Deleted decision not found." });
    const updated = await populated(Decision.findOneAndUpdate({ _id: access.decision._id, workspace: access.workspace._id, projectRef: access.project._id, deletedAt: { $ne: null } }, { $set: { deletedAt: null, deletedBy: null } }, { returnDocument: "after", runValidators: true }));
    if (updated) await recordProjectEvent({ io: req.app.get("io"), actorId: req.user._id, workspaceId: access.workspace._id, projectId: access.project._id, action: "decision.restored", summary: `Restored decision: ${updated.title}`, entityType: "decision", entityId: updated._id, eventKey: `decision.restored:${updated._id}:${updated.updatedAt?.getTime() || Date.now()}` });
    return res.status(200).json({ message: "Decision restored successfully.", decision: updated });
  } catch (error) {
    console.error("Restore decision error:", error);
    return res.status(500).json({ message: "Failed to restore decision." });
  }
});

module.exports = router;
