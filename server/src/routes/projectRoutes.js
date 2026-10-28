
const express = require("express");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const Workspace = require("../models/Workspace");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Helper: find a workspace where the current user is a member.
async function getWorkspaceMembership(workspaceId, userId) {
  if (!mongoose.isObjectIdOrHexString(workspaceId)) {
    return { error: "invalid" };
  }

  const workspace = await Workspace.findById(workspaceId);

  if (!workspace) {
    return { error: "not_found" };
  }

  const membership = workspace.members.find(
    (member) => member.user.toString() === userId.toString()
  );

  if (!membership) {
    return { error: "forbidden" };
  }

  return { workspace, membership };
}

// POST /api/workspaces/:workspaceId/projects
// Create a project inside a workspace.
router.post("/workspaces/:workspaceId/projects", authMiddleware, async (req, res) => {
  try {
    const { workspaceId } = req.params;
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({ success: false, message: "A valid request body is required." });
    }
    const { name, description } = req.body;

    const result = await getWorkspaceMembership(workspaceId, req.user._id);

    if (result.error === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    if (result.error === "not_found") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (result.error === "forbidden") {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace.",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required.",
      });
    }

    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Project name must be between 2 and 100 characters.",
      });
    }

    if (description !== undefined &&
        (typeof description !== "string" || description.trim().length > 1000)) {
      return res.status(400).json({
        success: false,
        message: "Description must be a string of at most 1000 characters.",
      });
    }

    const project = await Project.create({
      name: name.trim(),
      description: description?.trim() || "",
      workspace: result.workspace._id,
      createdBy: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully.",
      project,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A project with this name already exists in this workspace.",
      });
    }

    console.error("Project creation error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while creating project.",
    });
  }
});

// GET /api/workspaces/:workspaceId/projects
// List projects only if the current user belongs to the workspace.
router.get("/workspaces/:workspaceId/projects", authMiddleware, async (req, res) => {
  try {
    const result = await getWorkspaceMembership(
      req.params.workspaceId,
      req.user._id
    );

    if (result.error === "invalid") {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    if (result.error === "not_found") {
      return res.status(404).json({
        success: false,
        message: "Workspace not found.",
      });
    }

    if (result.error === "forbidden") {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this workspace.",
      });
    }

    const projects = await Project.find({
      workspace: result.workspace._id,
    })
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error("Project listing error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching projects.",
    });
  }
});

module.exports = router;
