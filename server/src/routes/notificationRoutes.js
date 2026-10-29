const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Discussion = require("../models/Discussion");
const Decision = require("../models/Decision");
const authMiddleware = require("../middleware/authMiddleware");
const { canReadNotification } = require("../utils/notificationScope");
const { buildNotificationFilters, getNextNotificationCursor, NOTIFICATION_LIST_FIELDS } = require("../utils/notificationQueries");

const router = express.Router();
router.use(authMiddleware);
const validId = (id) => mongoose.isObjectIdOrHexString(id);

async function accessibleScope(userId) {
  const workspaces = await Workspace.find({ "members.user": userId }).select("_id").lean();
  const workspaceIds = workspaces.map((workspace) => workspace._id);
  const projects = workspaceIds.length ? await Project.find({ workspace: { $in: workspaceIds } }).select("_id").lean() : [];
  return { workspaceIds, projectIds: projects.map((project) => project._id) };
}

async function validResourceIds(scope, userId) {
  const recipientScope = { recipient: userId, workspace: { $in: scope.workspaceIds }, project: { $in: scope.projectIds } };
  const [taskIds, discussionIds, decisionIds] = await Promise.all([
    Notification.distinct("entityId", { ...recipientScope, entityType: "task" }),
    Notification.distinct("entityId", { ...recipientScope, entityType: "discussion" }),
    Notification.distinct("entityId", { ...recipientScope, entityType: "decision" }),
  ]);
  const [tasks, discussions, decisions] = await Promise.all([
    Task.find({ _id: { $in: taskIds }, workspace: { $in: scope.workspaceIds }, project: { $in: scope.projectIds } }).select("_id workspace project").lean(),
    Discussion.find({ _id: { $in: discussionIds }, workspace: { $in: scope.workspaceIds }, project: { $in: scope.projectIds } }).select("_id workspace project").lean(),
    Decision.find({ _id: { $in: decisionIds }, workspace: { $in: scope.workspaceIds }, projectRef: { $in: scope.projectIds }, deletedAt: null }).select("_id workspace projectRef").lean(),
  ]);
  const groupByScope = (items, projectField) => {
    const groups = new Map();
    for (const item of items) {
      const workspace = String(item.workspace);
      const project = String(item[projectField]);
      const key = `${workspace}:${project}`;
      if (!groups.has(key)) groups.set(key, { workspace: item.workspace, project: item[projectField], ids: [] });
      groups.get(key).ids.push(item._id);
    }
    return [...groups.values()];
  };
  return {
    task: tasks.map((item) => item._id),
    discussion: discussions.map((item) => item._id),
    decision: decisions.map((item) => item._id),
    scopes: {
      task: groupByScope(tasks, "project"),
      discussion: groupByScope(discussions, "project"),
      decision: groupByScope(decisions, "projectRef"),
    },
  };
}

router.get("/", async (req, res) => {
  try {
    const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ message: "Limit must be between 1 and 50." });
    const scope = await accessibleScope(req.user._id);
    const entityIds = await validResourceIds(scope, req.user._id);
    let cursor = null;
    if (req.query.before) {
      if (!validId(req.query.before)) return res.status(400).json({ message: "Invalid pagination cursor." });
      const base = buildNotificationFilters({ recipientId: req.user._id, ...scope, resourceIds: entityIds });
      cursor = await Notification.findOne({ ...base.cursor, _id: req.query.before }).select("createdAt");
      if (!cursor) return res.status(400).json({ message: "Pagination cursor is unavailable." });
    }
    const filters = buildNotificationFilters({ recipientId: req.user._id, ...scope, resourceIds: entityIds, beforeCursor: cursor });
    const notifications = await Notification.find(filters.list).sort({ createdAt: -1, _id: -1 }).limit(limit).select(NOTIFICATION_LIST_FIELDS).lean();
    const unreadCount = await Notification.countDocuments(filters.unread);
    const [workspaces, projects] = await Promise.all([
      Workspace.find({ _id: { $in: scope.workspaceIds } }).select("name").lean(),
      Project.find({ _id: { $in: scope.projectIds } }).select("name").lean(),
    ]);
    const workspaceNames = new Map(workspaces.map((item) => [String(item._id), item.name]));
    const projectNames = new Map(projects.map((item) => [String(item._id), item.name]));
    const data = notifications.filter((item) => canReadNotification(item, {
      recipientId: req.user._id,
      workspaceIds: scope.workspaceIds,
      projectIds: scope.projectIds,
      resourceIds: entityIds,
    })).map((item) => ({ ...item, workspaceName: workspaceNames.get(String(item.workspace)) || "Workspace", projectName: projectNames.get(String(item.project)) || "Project" }));
    return res.json({ data, unreadCount, nextCursor: getNextNotificationCursor(data, limit) });
  } catch { return res.status(500).json({ message: "Failed to fetch notifications." }); }
});

router.patch("/read-all", async (req, res) => {
  try {
    const scope = await accessibleScope(req.user._id);
    const entityIds = await validResourceIds(scope, req.user._id);
    const filters = buildNotificationFilters({ recipientId: req.user._id, ...scope, resourceIds: entityIds });
    const result = await Notification.updateMany(filters.unread, { $set: { readAt: new Date() } });
    return res.json({ modifiedCount: result.modifiedCount });
  } catch { return res.status(500).json({ message: "Failed to mark notifications as read." }); }
});

router.patch("/:id/read", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid notification ID." });
    const scope = await accessibleScope(req.user._id);
    const entityIds = await validResourceIds(scope, req.user._id);
    const filters = buildNotificationFilters({ recipientId: req.user._id, ...scope, resourceIds: entityIds });
    const notification = await Notification.findOneAndUpdate(filters.markRead(req.params.id), { $set: { readAt: new Date() } }, { returnDocument: "after" }).select("type title message workspace project entityType entityId readAt createdAt");
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    return res.json({ data: notification });
  } catch { return res.status(500).json({ message: "Failed to mark notification as read." }); }
});

module.exports = router;
