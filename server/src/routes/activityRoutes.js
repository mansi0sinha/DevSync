const express = require("express");
const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const Task = require("../models/Task");
const Decision = require("../models/Decision");
const Discussion = require("../models/Discussion");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);
const validId = (id) => mongoose.isObjectIdOrHexString(id);

router.get("/", async (req, res) => {
  try {
    const { workspaceId, projectId } = req.query;
    if (!validId(workspaceId) || !validId(projectId)) return res.status(400).json({ message: "Valid workspace and project IDs are required." });
    const workspace = await Workspace.findOne({ _id: workspaceId, "members.user": req.user._id }).select("_id");
    if (!workspace) return res.status(404).json({ message: "Workspace not found or access denied." });
    const project = await Project.findOne({ _id: projectId, workspace: workspace._id }).select("_id");
    if (!project) return res.status(404).json({ message: "Project not found in this workspace." });
    const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 50) return res.status(400).json({ message: "Limit must be between 1 and 50." });
    const filter = { workspace: workspace._id, project: project._id };
    if (req.query.before) {
      if (!validId(req.query.before)) return res.status(400).json({ message: "Invalid pagination cursor." });
      const cursor = await Activity.findOne({ ...filter, _id: req.query.before }).select("createdAt");
      if (!cursor) return res.status(400).json({ message: "Pagination cursor is unavailable." });
      filter.$or = [{ createdAt: { $lt: cursor.createdAt } }, { createdAt: cursor.createdAt, _id: { $lt: cursor._id } }];
    }
    const rows = await Activity.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit)
      .populate("actor", "name avatar").select("actor actorType action workspace project entityType entityId summary createdAt").lean();
    const idsByType = Object.fromEntries(["task", "decision", "discussion"].map((type) => [type, rows.filter((row) => row.entityType === type).map((row) => row.entityId)]));
    const [tasks, decisions, discussions] = await Promise.all([
      Task.find({ _id: { $in: idsByType.task }, workspace: workspace._id, project: project._id }).select("_id"),
      Decision.find({ _id: { $in: idsByType.decision }, workspace: workspace._id, projectRef: project._id, deletedAt: null }).select("_id"),
      Discussion.find({ _id: { $in: idsByType.discussion }, workspace: workspace._id, project: project._id }).select("_id"),
    ]);
    const available = new Set([...tasks, ...decisions, ...discussions].map((item) => String(item._id)));
    const data = rows.map((row) => ({ ...row, relatedAvailable: available.has(String(row.entityId)) }));
    return res.json({ data, nextCursor: rows.length === limit ? String(rows[rows.length - 1]._id) : null });
  } catch { return res.status(500).json({ message: "Failed to fetch project activity." }); }
});

module.exports = router;
