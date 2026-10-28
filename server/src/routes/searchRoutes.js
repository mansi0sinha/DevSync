const express = require("express");
const mongoose = require("mongoose");
const Task = require("../models/Task");
const Decision = require("../models/Decision");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
router.use(authMiddleware);
const statuses = ["todo", "in-progress", "in-review", "done"];
const priorities = ["low", "medium", "high"];
const decisionStatuses = ["Accepted", "Superseded", "Archived"];
const esc = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

router.get("/", async (req, res) => {
  try {
    const { workspaceId, projectId } = req.query;
    if (!mongoose.isObjectIdOrHexString(workspaceId) || !mongoose.isObjectIdOrHexString(projectId)) return res.status(400).json({ message: "Valid workspace and project IDs are required." });
    const workspace = await Workspace.findOne({ _id: workspaceId, "members.user": req.user._id }).select("_id members.user");
    if (!workspace) return res.status(404).json({ message: "Workspace not found or access denied." });
    const project = await Project.findOne({ _id: projectId, workspace: workspace._id }).select("_id");
    if (!project) return res.status(404).json({ message: "Project not found in this workspace." });
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (q.length > 120) return res.status(400).json({ message: "Search text must be 120 characters or fewer." });
    if (req.query.q !== undefined && typeof req.query.q !== "string") return res.status(400).json({ message: "Search text must be a string." });
    const { status, priority, assignee, lifecycleStatus } = req.query;
    if (status && !statuses.includes(status)) return res.status(400).json({ message: "Invalid task status filter." });
    if (priority && !priorities.includes(priority)) return res.status(400).json({ message: "Invalid task priority filter." });
    if (lifecycleStatus && !decisionStatuses.includes(lifecycleStatus)) return res.status(400).json({ message: "Invalid decision status filter." });
    if (assignee && (!mongoose.isObjectIdOrHexString(assignee) || !workspace.members.some((member) => String(member.user) === String(assignee)))) return res.status(400).json({ message: "Assignee must be a member of this workspace." });
    if (!q && !status && !priority && !assignee && !lifecycleStatus) return res.status(400).json({ message: "Enter search text or select a filter." });
    const rx = q ? new RegExp(esc(q), "i") : null;
    const taskQuery = { workspace: workspace._id, project: project._id };
    if (rx) taskQuery.$or = [{ title: rx }, { description: rx }];
    if (status) taskQuery.status = status;
    if (priority) taskQuery.priority = priority;
    if (assignee) taskQuery.assignee = assignee;
    const decisionQuery = { workspace: workspace._id, projectRef: project._id, deletedAt: null };
    if (rx) decisionQuery.$or = [{ title: rx }, { summary: rx }, { context: rx }];
    if (lifecycleStatus) decisionQuery.lifecycleStatus = lifecycleStatus;
    const [tasks, decisions] = await Promise.all([
      q || status || priority || assignee
        ? Task.find(taskQuery).sort({ updatedAt: -1 }).limit(25).select("title description status priority dueDate assignee project workspace updatedAt").populate("assignee", "name avatar").lean()
        : Promise.resolve([]),
      q || lifecycleStatus
        ? Decision.find(decisionQuery).sort({ updatedAt: -1 }).limit(25).select("title summary context lifecycleStatus linkedTask discussionId discussionMessageId projectRef workspace updatedAt").lean()
        : Promise.resolve([]),
    ]);
    return res.json({ tasks, decisions });
  } catch { return res.status(500).json({ message: "Search failed." }); }
});

module.exports = router;
