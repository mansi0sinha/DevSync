
const express = require("express");
const mongoose = require("mongoose");

const Task = require("../models/Task");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// All task endpoints require a valid login.
router.use(authMiddleware);

const isValidId = (id) => mongoose.isValidObjectId(id);

const getWorkspaceMembership = async (workspaceId, userId) => {
  return Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  });
};

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

// GET /api/tasks
// Optional query params: workspaceId, projectId
router.get("/", async (req, res) => {
  try {
    const { workspaceId, projectId } = req.query;
    let allowedWorkspaceIds;

    if (workspaceId && !isValidId(workspaceId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID.",
      });
    }

    if (projectId && !isValidId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID.",
      });
    }

    if (workspaceId) {
      const workspace = await getWorkspaceMembership(
        workspaceId,
        req.user._id
      );

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: "Workspace not found or access denied.",
        });
      }

      allowedWorkspaceIds = [workspace._id];
    } else if (projectId) {
      const project = await Project.findById(projectId);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found.",
        });
      }

      const workspace = await getWorkspaceMembership(
        project.workspace,
        req.user._id
      );

      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: "Project not found or access denied.",
        });
      }

      allowedWorkspaceIds = [workspace._id];
    } else {
      const workspaces = await Workspace.find({
        "members.user": req.user._id,
      }).select("_id");

      allowedWorkspaceIds = workspaces.map(
        (workspace) => workspace._id
      );
    }

    const filter = {
      workspace: { $in: allowedWorkspaceIds },
    };

    if (projectId) {
      filter.project = projectId;
    }

    const tasks = await Task.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tasks.length,
      data: tasks,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch tasks.");
  }
});

// POST /api/tasks
// Requires: title, workspaceId, projectId
router.post("/", async (req, res) => {
  try {
    const {
      title,
      description,
      status,
      priority,
      dueDate,
      workspaceId,
      projectId,
    } = req.body;

    if (!workspaceId || !projectId) {
      return res.status(400).json({
        success: false,
        message: "Workspace ID and project ID are required.",
      });
    }

    if (!isValidId(workspaceId) || !isValidId(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID or project ID.",
      });
    }

    const workspace = await getWorkspaceMembership(
      workspaceId,
      req.user._id
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Workspace not found or access denied.",
      });
    }

    const project = await Project.findOne({
      _id: projectId,
      workspace: workspace._id,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found in this workspace.",
      });
    }

    const task = await Task.create({
      title,
      description,
      status,
      priority,
      dueDate,
      workspace: workspace._id,
      project: project._id,
      createdBy: req.user._id,
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

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const workspace = await getWorkspaceMembership(
      task.workspace,
      req.user._id
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied.",
      });
    }

    // Only update task content. Ownership and scope cannot be changed here.
    const allowedFields = [
      "title",
      "description",
      "status",
      "priority",
      "dueDate",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    const updatedTask = await Task.findOneAndUpdate(
      {
        _id: task._id,
        workspace: workspace._id,
      },
      { $set: updates },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied.",
      });
    }

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

    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found.",
      });
    }

    const workspace = await getWorkspaceMembership(
      task.workspace,
      req.user._id
    );

    if (!workspace) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied.",
      });
    }

    const deletedTask = await Task.findOneAndDelete({
      _id: task._id,
      workspace: workspace._id,
    });

    if (!deletedTask) {
      return res.status(404).json({
        success: false,
        message: "Task not found or access denied.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Task deleted successfully.",
      data: deletedTask,
    });
  } catch (error) {
    return handleError(res, error, "Failed to delete task.");
  }
});

module.exports = router;
