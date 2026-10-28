const express = require("express");
const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);
const validId = (id) => mongoose.isObjectIdOrHexString(id);

async function scopeFor(req, res) {
  const { workspaceId, projectId } = req.query;
  if (!validId(workspaceId) || !validId(projectId)) {
    res.status(400).json({ message: "Valid workspace and project IDs are required." });
    return null;
  }
  const workspace = await Workspace.findOne({ _id: workspaceId, "members.user": req.user._id }).select("_id");
  if (!workspace) { res.status(404).json({ message: "Workspace not found or access denied." }); return null; }
  const project = await Project.findOne({ _id: projectId, workspace: workspace._id }).select("_id");
  if (!project) { res.status(404).json({ message: "Project not found in this workspace." }); return null; }
  return { workspace, project };
}

router.get("/", async (req, res) => {
  try {
    const scope = await scopeFor(req, res);
    if (!scope) return;
    const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ message: "Limit must be between 1 and 50." });
    const filter = { recipient: req.user._id, workspace: scope.workspace._id, project: scope.project._id };
    if (req.query.before) {
      if (!validId(req.query.before)) return res.status(400).json({ message: "Invalid pagination cursor." });
      const cursor = await Notification.findOne({ ...filter, _id: req.query.before }).select("createdAt");
      if (!cursor) return res.status(400).json({ message: "Pagination cursor is unavailable." });
      filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
    }
    const notifications = await Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit).select("type title message workspace project entityType entityId readAt createdAt").lean();
    return res.json({ data: notifications, nextCursor: notifications.length === limit ? String(notifications[notifications.length - 1]._id) : null });
  } catch { return res.status(500).json({ message: "Failed to fetch notifications." }); }
});

router.patch("/read-all", async (req, res) => {
  try {
    const scope = await scopeFor(req, res);
    if (!scope) return;
    const result = await Notification.updateMany({ recipient: req.user._id, workspace: scope.workspace._id, project: scope.project._id, readAt: null }, { $set: { readAt: new Date() } });
    return res.json({ modifiedCount: result.modifiedCount });
  } catch { return res.status(500).json({ message: "Failed to mark notifications as read." }); }
});

router.patch("/:id/read", async (req, res) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid notification ID." });
    const scope = await scopeFor(req, res);
    if (!scope) return;
    const notification = await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id, workspace: scope.workspace._id, project: scope.project._id }, { $set: { readAt: new Date() } }, { returnDocument: "after" }).select("type title message workspace project entityType entityId readAt createdAt");
    if (!notification) return res.status(404).json({ message: "Notification not found." });
    return res.json({ data: notification });
  } catch { return res.status(500).json({ message: "Failed to mark notification as read." }); }
});

module.exports = router;
