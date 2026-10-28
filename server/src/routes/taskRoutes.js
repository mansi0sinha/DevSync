
const express = require("express");
const mongoose = require("mongoose");

const Task = require("../models/Task");
const Decision = require("../models/Decision");
const Discussion = require("../models/Discussion");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/authMiddleware");
const { emitProjectEvent } = require("../realtime");
const { recordProjectEvent } = require("../services/projectEvents");
const { createTaskRecord } = require("../services/projectRecords");
const { parsePullRequestUrl } = require("../utils/githubPullRequest");

const router = express.Router();

// All task endpoints require a valid login.
router.use(authMiddleware);

const isValidId = (id) => mongoose.isObjectIdOrHexString(id);
const validStatuses = ["todo", "in-progress", "in-review", "done"];
const validPriorities = ["low", "medium", "high"];

async function getAuthorizedScope(workspaceId, projectId, userId) {
  if (!isValidId(workspaceId) || !isValidId(projectId)) return { error: "invalid" };

  const workspace = await Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  });
  if (!workspace) return { error: "workspace" };

  const project = await Project.findOne({ _id: projectId, workspace: workspace._id });
  if (!project) return { error: "project" };
  return { workspace, project };
}

function sendScopeError(res, error) {
  if (error === "invalid") return res.status(400).json({ success: false, message: "Valid workspace and project IDs are required." });
  if (error === "workspace") return res.status(404).json({ success: false, message: "Workspace not found or access denied." });
  if (error === "project") return res.status(404).json({ success: false, message: "Project not found in this workspace." });
  return false;
}

function populatedTask(query) {
  return query.populate("assignee", "name email avatar")
    .populate("comments.author", "name email avatar");
}

async function emitPullRequestTaskUpdate(req, task, scope, action, summary, eventSuffix) {
  const updatedTask = await populatedTask(Task.findById(task._id));
  await emitProjectEvent(req.app.get("io"), { workspaceId: scope.workspace._id, projectId: scope.project._id }, "task:updated", { task: updatedTask });
  await recordProjectEvent({
    io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id,
    projectId: scope.project._id, action, summary, entityType: "task", entityId: task._id,
    eventKey: `task:${eventSuffix}:${task._id}:${Date.now()}`,
    notifications: task.assignee ? [{ recipient: task.assignee, type: action, title: summary, message: task.title, eventKey: `${eventSuffix}:${Date.now()}` }] : [],
  });
  return updatedTask;
}

async function findDuplicatePullRequest(parsed, taskId) {
  return Task.findOne({
    _id: { $ne: taskId },
    pullRequests: { $elemMatch: { repositoryKey: parsed.repositoryKey, number: parsed.number } },
  }).select("_id");
}

router.post("/:id/github-prs", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid task ID." });
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).some((key) => key !== "url")) return res.status(400).json({ success: false, message: "A pull request URL is required." });
    const parsed = parsePullRequestUrl(req.body.url);
    if (!parsed) return res.status(400).json({ success: false, message: "Enter a valid HTTPS GitHub pull request URL." });
    const scope = await getAuthorizedScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const task = await Task.findOne({ _id: req.params.id, workspace: scope.workspace._id, project: scope.project._id });
    if (!task) return res.status(404).json({ success: false, message: "Task not found in the selected project." });
    if (task.pullRequests.some((entry) => entry.repositoryKey === parsed.repositoryKey && entry.number === parsed.number)) return res.status(409).json({ success: false, message: "This pull request is already linked to the task." });
    if (await findDuplicatePullRequest(parsed, task._id)) return res.status(409).json({ success: false, message: "This pull request is already linked to another task." });
    if (task.pullRequests.length >= 20) return res.status(409).json({ success: false, message: "This task has reached its pull request limit." });
    const added = await Task.updateOne({
      _id: task._id,
      workspace: scope.workspace._id,
      project: scope.project._id,
      "pullRequests.19": { $exists: false },
      pullRequests: { $not: { $elemMatch: { repositoryKey: parsed.repositoryKey, number: parsed.number } } },
    }, { $push: { pullRequests: { ...parsed, title: "", state: "unknown", draft: false, linkedBy: req.user._id, linkedAt: new Date() } } }, { runValidators: true });
    if (!added.modifiedCount) return res.status(409).json({ success: false, message: "This pull request is already linked or the task reached its pull request limit." });
    const updatedTask = await emitPullRequestTaskUpdate(req, task, scope, "github.pr_linked", `Linked GitHub PR #${parsed.number}`, "github-pr-linked");
    return res.status(201).json({ success: true, data: updatedTask });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "This pull request is already linked to another task." });
    return handleError(res, error, "Failed to link GitHub pull request.");
  }
});

router.put("/:id/github-prs/:pullRequestId", async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.pullRequestId)) return res.status(400).json({ success: false, message: "Invalid task or pull request ID." });
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || Object.keys(req.body).some((key) => key !== "url")) return res.status(400).json({ success: false, message: "A pull request URL is required." });
    const parsed = parsePullRequestUrl(req.body.url);
    if (!parsed) return res.status(400).json({ success: false, message: "Enter a valid HTTPS GitHub pull request URL." });
    const scope = await getAuthorizedScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const task = await Task.findOne({ _id: req.params.id, workspace: scope.workspace._id, project: scope.project._id });
    if (!task) return res.status(404).json({ success: false, message: "Task not found in the selected project." });
    const link = task.pullRequests.id(req.params.pullRequestId);
    if (!link) return res.status(404).json({ success: false, message: "Pull request link not found." });
    const duplicateInTask = task.pullRequests.some((entry) => String(entry._id) !== req.params.pullRequestId && entry.repositoryKey === parsed.repositoryKey && entry.number === parsed.number);
    if (duplicateInTask || await findDuplicatePullRequest(parsed, task._id)) return res.status(409).json({ success: false, message: "This pull request is already linked to a task." });
    Object.assign(link, parsed, { title: "", state: "unknown", draft: false, lastWebhookAt: null, lastDeliveryId: null, linkedBy: req.user._id, linkedAt: new Date() });
    await task.save();
    const updatedTask = await emitPullRequestTaskUpdate(req, task, scope, "github.pr_linked", `Updated GitHub PR link to #${parsed.number}`, "github-pr-updated");
    return res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "This pull request is already linked to another task." });
    return handleError(res, error, "Failed to update GitHub pull request link.");
  }
});

router.delete("/:id/github-prs/:pullRequestId", async (req, res) => {
  try {
    if (!isValidId(req.params.id) || !isValidId(req.params.pullRequestId)) return res.status(400).json({ success: false, message: "Invalid task or pull request ID." });
    const scope = await getAuthorizedScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const task = await Task.findOne({ _id: req.params.id, workspace: scope.workspace._id, project: scope.project._id });
    if (!task) return res.status(404).json({ success: false, message: "Task not found in the selected project." });
    const link = task.pullRequests.id(req.params.pullRequestId);
    if (!link) return res.status(404).json({ success: false, message: "Pull request link not found." });
    const number = link.number;
    link.deleteOne();
    await task.save();
    const updatedTask = await emitPullRequestTaskUpdate(req, task, scope, "github.pr_unlinked", `Unlinked GitHub PR #${number}`, "github-pr-unlinked");
    return res.status(200).json({ success: true, data: updatedTask });
  } catch (error) {
    return handleError(res, error, "Failed to remove GitHub pull request link.");
  }
});

async function resolveAssignee(assignee, workspace) {
  if (assignee === undefined || assignee === null || assignee === "") return { value: null };
  if (typeof assignee !== "string" || !isValidId(assignee)) return { error: "Assignee must be a valid workspace member." };
  const isMember = workspace.members.some((member) => String(member.user).toLowerCase() === assignee.toLowerCase());
  if (!isMember) return { error: "Assignee must belong to the selected workspace." };
  return { value: assignee };
}

function validateTaskFields(body, requireTitle = false) {
  if (requireTitle && (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120)) {
    return "Task title must be between 1 and 120 characters.";
  }
  if (body.title !== undefined && (typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 120)) return "Task title must be between 1 and 120 characters.";
  if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 2000)) return "Task description must be 2000 characters or fewer.";
  if (body.status !== undefined && !validStatuses.includes(body.status)) return "Invalid task status.";
  if (body.priority !== undefined && !validPriorities.includes(body.priority)) return "Invalid task priority.";
  if (body.dueDate !== undefined && body.dueDate !== null && body.dueDate !== "" && Number.isNaN(new Date(body.dueDate).getTime())) return "Invalid due date.";
  return "";
}

const handleError = (res, error, fallbackMessage) => {
  if (
    error.name === "ValidationError" ||
    error.name === "CastError"
  ) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  console.error(fallbackMessage, error);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

// GET /api/tasks?workspaceId=...&projectId=...
router.get("/", async (req, res) => {
  try {
    const { workspaceId, projectId } = req.query;
    const scope = await getAuthorizedScope(workspaceId, projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);

    const tasks = await populatedTask(Task.find({
      workspace: scope.workspace._id,
      project: scope.project._id,
    }).sort({ createdAt: -1 }));

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch tasks.");
  }
});

// GET /api/tasks/:id/context?workspaceId=...&projectId=...
router.get("/:id/context", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid task ID." });
    const scope = await getAuthorizedScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const task = await Task.findOne({ _id: req.params.id, workspace: scope.workspace._id, project: scope.project._id }).select("_id title");
    if (!task) return res.status(404).json({ success: false, message: "Task not found in the selected project." });

    const [decisions, discussions] = await Promise.all([
      Decision.find({ workspace: scope.workspace._id, projectRef: scope.project._id, $or: [{ linkedTask: task._id }, { taskId: String(task._id) }], deletedAt: null })
        .select("_id title discussionId discussionMessageId createdAt")
        .populate("discussionId", "title workspace project messages._id"),
      Discussion.find({ workspace: scope.workspace._id, project: scope.project._id, linkedTask: task._id })
        .select("_id title createdAt"),
    ]);
    const scopedDecisions = decisions.filter((decision) =>
      (!decision.discussionId || (
        String(decision.discussionId.workspace) === String(scope.workspace._id) &&
        String(decision.discussionId.project) === String(scope.project._id)
      )) && (!decision.discussionMessageId || decision.discussionId?.messages?.some((message) => String(message._id) === String(decision.discussionMessageId)))
    );
    return res.status(200).json({
      success: true,
      data: {
        task: { id: String(task._id), title: task.title },
        decisions: scopedDecisions.map((decision) => ({
          id: String(decision._id),
          title: decision.title,
          discussionId: decision.discussionId ? String(decision.discussionId._id) : null,
          discussionTitle: decision.discussionId?.title || null,
          discussionMessageId: decision.discussionMessageId ? String(decision.discussionMessageId) : null,
        })),
        discussions: discussions.map((discussion) => ({ id: String(discussion._id), title: discussion.title })),
      },
    });
  } catch (error) {
    return handleError(res, error, "Failed to load task context.");
  }
});

// POST /api/tasks
// Requires: title, workspaceId, projectId
router.post("/", async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: "A valid request body is required." });
    }
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      assignee,
      workspaceId,
      projectId,
    } = req.body;

    const scope = await getAuthorizedScope(workspaceId, projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const validationError = validateTaskFields(req.body, true);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    const assigneeResult = await resolveAssignee(assignee, scope.workspace);
    if (assigneeResult.error) return res.status(400).json({ success: false, message: assigneeResult.error });

    const created = await createTaskRecord({
      scope,
      actorId: req.user._id,
      fields: { title, description, status, priority, dueDate: dueDate || null, assignee: assigneeResult.value },
    });
    const task = await populatedTask(Task.findById(created._id));
    await emitProjectEvent(req.app.get("io"), {
      workspaceId: scope.workspace._id,
      projectId: scope.project._id,
    }, "task:created", { task });
    await recordProjectEvent({
      io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id,
      projectId: scope.project._id, action: "task.created", summary: `Created task: ${created.title}`,
      entityType: "task", entityId: created._id, eventKey: `task.created:${created._id}`,
      notifications: created.assignee ? [{ recipient: created.assignee, type: "task.assigned", title: "You were assigned a task", message: created.title, eventKey: String(created._id) }] : [],
    });

    return res.status(201).json({
      success: true,
      data: task,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create task.");
  }
});

// PUT /api/tasks/:id
router.put("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID.",
      });
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ success: false, message: "A valid request body is required." });
    const scope = await getAuthorizedScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const validationError = validateTaskFields(req.body);
    if (validationError) return res.status(400).json({ success: false, message: validationError });

    const updates = {};
    for (const field of ["title", "description", "status", "priority", "dueDate"]) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) updates[field] = field === "dueDate" && req.body[field] === "" ? null : req.body[field];
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "assignee")) {
      const assigneeResult = await resolveAssignee(req.body.assignee, scope.workspace);
      if (assigneeResult.error) return res.status(400).json({ success: false, message: assigneeResult.error });
      updates.assignee = assigneeResult.value;
    }
    if (Object.keys(updates).length === 0) return res.status(400).json({ success: false, message: "No editable task fields were provided." });

    const taskScope = { _id: req.params.id, workspace: scope.workspace._id, project: scope.project._id };
    const previous = await Task.findOne(taskScope).select("title status priority description assignee");
    if (!previous) return res.status(404).json({ success: false, message: "Task not found in the selected project." });

    const updated = await Task.findOneAndUpdate(taskScope, { $set: updates }, { new: true, runValidators: true });
    if (!updated) return res.status(404).json({ success: false, message: "Task not found in the selected project." });
    const updatedTask = await populatedTask(Task.findById(updated._id));
    await emitProjectEvent(req.app.get("io"), {
      workspaceId: scope.workspace._id,
      projectId: scope.project._id,
    }, "task:updated", { task: updatedTask });
    const assignmentChanged = Object.prototype.hasOwnProperty.call(updates, "assignee") && String(previous.assignee || "") !== String(updated.assignee || "");
    const materialChanged = ["title", "description", "status", "priority", "dueDate"].some((field) => Object.prototype.hasOwnProperty.call(updates, field));
    const statusChanged = Object.prototype.hasOwnProperty.call(updates, "status") && previous.status !== updated.status;
    const notificationRecipients = [];
    if (assignmentChanged) {
      if (updated.assignee) notificationRecipients.push({ recipient: updated.assignee, type: "task.assigned", title: "You were assigned a task" });
      if (previous.assignee) notificationRecipients.push({ recipient: previous.assignee, type: "task.unassigned", title: "Task assignment changed" });
    } else if (materialChanged && updated.assignee) {
      notificationRecipients.push({ recipient: updated.assignee, type: statusChanged ? "task.status_changed" : "task.updated", title: statusChanged ? "Task status changed" : "Task details changed" });
    }
    await recordProjectEvent({
      io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id,
      projectId: scope.project._id, action: statusChanged ? "task.status_changed" : "task.updated",
      summary: `${statusChanged ? "Changed status of" : "Updated"} task: ${updated.title}`,
      entityType: "task", entityId: updated._id, eventKey: `task.updated:${updated._id}:${updated.updatedAt?.getTime() || Date.now()}`,
      notifications: notificationRecipients.map((item) => ({ ...item, message: updated.title, eventKey: String(updated.updatedAt?.getTime() || Date.now()) })),
    });

    return res.status(200).json({
      success: true,
      message: "Task updated successfully.",
      data: updatedTask,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update task.");
  }
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid task ID.",
      });
    }
    const scope = await getAuthorizedScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const deletedTask = await Task.findOneAndDelete({
      _id: req.params.id,
      workspace: scope.workspace._id,
      project: scope.project._id,
    });

    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied.",
      });
    }

    await emitProjectEvent(req.app.get("io"), {
      workspaceId: scope.workspace._id,
      projectId: scope.project._id,
    }, "task:deleted", { taskId: String(deletedTask._id) });
    await recordProjectEvent({
      io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id,
      projectId: scope.project._id, action: "task.deleted", summary: `Deleted task: ${deletedTask.title}`,
      entityType: "task", entityId: deletedTask._id, eventKey: `task.deleted:${deletedTask._id}`,
      notifications: deletedTask.assignee ? [{ recipient: deletedTask.assignee, type: "task.deleted", title: "An assigned task was deleted", message: deletedTask.title, eventKey: String(deletedTask.updatedAt?.getTime() || Date.now()) }] : [],
    });

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully.",
      data: deletedTask,
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete task.");
  }
});

// POST /api/tasks/:id/comments?workspaceId=...&projectId=...
router.post("/:id/comments", async (req, res) => {
  try {
    if (!isValidId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid task ID." });
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) || typeof req.body.text !== "string") {
      return res.status(400).json({ success: false, message: "Comment text is required." });
    }
    const text = req.body.text.trim();
    if (!text || text.length > 2000) return res.status(400).json({ success: false, message: "Comment must be between 1 and 2000 characters." });

    const scope = await getAuthorizedScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.error) return sendScopeError(res, scope.error);
    const task = await Task.findOne({ _id: req.params.id, workspace: scope.workspace._id, project: scope.project._id });
    if (!task) return res.status(404).json({ success: false, message: "Task not found in the selected project." });
    if (task.comments.length >= 200) return res.status(409).json({ success: false, message: "This task has reached its comment limit." });

    task.comments.push({ author: req.user._id, text });
    const comment = task.comments[task.comments.length - 1];
    await task.save();
    const updatedTask = await populatedTask(Task.findById(task._id));
    await emitProjectEvent(req.app.get("io"), {
      workspaceId: scope.workspace._id,
      projectId: scope.project._id,
    }, "task:updated", { task: updatedTask });
    await recordProjectEvent({
      io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id,
      projectId: scope.project._id, action: "task.comment_added", summary: `Commented on task: ${task.title}`,
      entityType: "task", entityId: task._id, eventKey: `task.comment:${comment._id}`,
      notifications: task.assignee ? [{ recipient: task.assignee, type: "task.comment", title: "New comment on an assigned task", message: task.title, eventKey: String(comment._id) }] : [],
    });
    return res.status(201).json({ success: true, message: "Comment added.", data: updatedTask });
  } catch (error) {
    return handleError(res, error, "Failed to add task comment.");
  }
});

module.exports = router;
