
const express = require("express");
const mongoose = require("mongoose");

const Discussion = require("../models/Discussion");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const Task = require("../models/Task");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);

const isValidId = (id) => mongoose.isValidObjectId(id);

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

  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      message: "A record with these details already exists.",
    });
  }

  console.error(fallbackMessage, error);

  return res.status(500).json({
    success: false,
    message: fallbackMessage,
  });
};

const getWorkspaceMembership = (workspaceId, userId) =>
  Workspace.findOne({
    _id: workspaceId,
    "members.user": userId,
  });

const populateDiscussion = (query) =>
  query
    .populate("workspace", "name")
    .populate("project", "name workspace")
    .populate("createdBy", "name email avatar")
    .populate("messages.author", "name email avatar")
    .populate("linkedTask", "title status priority dueDate project workspace");

// Resolve and verify the requested project and workspace.
async function resolveProjectAccess(workspaceId, projectId, userId) {
  if (!workspaceId || !projectId) {
    return {
      error: {
        status: 400,
        message: "Workspace ID and project ID are required.",
      },
    };
  }

  if (!isValidId(workspaceId) || !isValidId(projectId)) {
    return {
      error: {
        status: 400,
        message: "Invalid workspace ID or project ID.",
      },
    };
  }

  const workspace = await getWorkspaceMembership(workspaceId, userId);

  if (!workspace) {
    return {
      error: {
        status: 404,
        message: "Workspace not found or access denied.",
      },
    };
  }

  const project = await Project.findOne({
    _id: projectId,
    workspace: workspace._id,
  });

  if (!project) {
    return {
      error: {
        status: 404,
        message: "Project not found in this workspace.",
      },
    };
  }

  return { workspace, project };
}

async function getAccessibleDiscussion(discussionId, userId) {
  const discussion = await Discussion.findById(discussionId);

  if (!discussion) {
    return { error: { status: 404, message: "Discussion not found." } };
  }

  const workspace = await getWorkspaceMembership(
    discussion.workspace,
    userId
  );

  if (!workspace) {
    return {
      error: {
        status: 404,
        message: "Discussion not found or access denied.",
      },
    };
  }

  return { discussion, workspace };
}

// GET /api/discussions?workspaceId=...&projectId=...
router.get("/", async (req, res) => {
  try {
    const { workspaceId, projectId } = req.query;
    let workspaceIds;

    if (workspaceId) {
      if (!isValidId(workspaceId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid workspace ID.",
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

      workspaceIds = [workspace._id];
    } else {
      const workspaces = await Workspace.find({
        "members.user": req.user._id,
      }).select("_id");

      workspaceIds = workspaces.map((workspace) => workspace._id);
    }

    const filter = { workspace: { $in: workspaceIds } };

    if (projectId) {
      if (!isValidId(projectId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid project ID.",
        });
      }

      const project = await Project.findOne({
        _id: projectId,
        workspace: { $in: workspaceIds },
      }).select("_id");

      if (!project) {
        return res.status(404).json({
          success: false,
          message: "Project not found or access denied.",
        });
      }

      filter.project = project._id;
    }

    const discussions = await populateDiscussion(
      Discussion.find(filter)
    ).sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: discussions.length,
      data: discussions,
    });
  } catch (error) {
    return handleError(res, error, "Failed to fetch discussions.");
  }
});

// POST /api/discussions
// Body: { title, workspaceId, projectId, message, linkedTask? }
router.post("/", async (req, res) => {
  try {
    const {
      title,
      workspaceId,
      projectId,
      linkedTask,
      message,
    } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      title.trim().length > 200 ||
      typeof message !== "string" ||
      !message.trim() ||
      message.trim().length > 5000
    ) {
      return res.status(400).json({
        success: false,
        message:
          "A valid discussion title and first message are required.",
      });
    }

    const access = await resolveProjectAccess(
      workspaceId,
      projectId,
      req.user._id
    );

    if (access.error) {
      return res.status(access.error.status).json({
        success: false,
        message: access.error.message,
      });
    }

    let taskReference = null;

    if (linkedTask) {
      if (!isValidId(linkedTask)) {
        return res.status(400).json({
          success: false,
          message: "Invalid linked task ID.",
        });
      }

      const task = await Task.findOne({
        _id: linkedTask,
        workspace: access.workspace._id,
        project: access.project._id,
      }).select("_id");

      if (!task) {
        return res.status(400).json({
          success: false,
          message: "The linked task must belong to this project.",
        });
      }

      taskReference = task._id;
    }

    const discussion = await Discussion.create({
      title: title.trim(),
      workspace: access.workspace._id,
      project: access.project._id,
      createdBy: req.user._id,
      linkedTask: taskReference,
      status: "Open",
      messages: [
        {
          author: req.user._id,
          text: message.trim(),
          attachments: [],
        },
      ],
    });

    const result = await populateDiscussion(
      Discussion.findById(discussion._id)
    );

    return res.status(201).json({
      success: true,
      message: "Discussion created successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to create discussion.");
  }
});

// POST /api/discussions/:id/messages
router.post("/:id/messages", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discussion ID.",
      });
    }

    const access = await getAccessibleDiscussion(id, req.user._id);

    if (access.error) {
      return res.status(access.error.status).json({
        success: false,
        message: access.error.message,
      });
    }

    const { text = "", attachments = [] } = req.body;

    if (typeof text !== "string" || text.length > 5000) {
      return res.status(400).json({
        success: false,
        message: "Message text must be a string of at most 5000 characters.",
      });
    }

    if (!Array.isArray(attachments) || attachments.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Attach at most 5 files per message.",
      });
    }

    if (!text.trim() && attachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Write a message or attach a file.",
      });
    }

    access.discussion.messages.push({
      author: req.user._id,
      text: text.trim(),
      attachments,
    });

    await access.discussion.save();

    const result = await populateDiscussion(
      Discussion.findById(access.discussion._id)
    );

    return res.status(201).json({
      success: true,
      message: "Message added successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to add message.");
  }
});

// PUT /api/discussions/:id
// Body may contain status and/or decision.
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discussion ID.",
      });
    }

    const access = await getAccessibleDiscussion(id, req.user._id);

    if (access.error) {
      return res.status(access.error.status).json({
        success: false,
        message: access.error.message,
      });
    }

    const { status, decision } = req.body;
    const updates = {};

    if (status !== undefined) {
      if (!["Open", "Resolved"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be Open or Resolved.",
        });
      }

      updates.status = status;
    }

    if (decision !== undefined) {
      if (decision === null) {
        updates.decision = null;
      } else {
        if (
          !decision ||
          typeof decision.title !== "string" ||
          !decision.title.trim() ||
          decision.title.trim().length > 200 ||
          typeof decision.summary !== "string" ||
          !decision.summary.trim() ||
          decision.summary.trim().length > 5000
        ) {
          return res.status(400).json({
            success: false,
            message: "A valid decision title and summary are required.",
          });
        }

        if (
          decision.context !== undefined &&
          (typeof decision.context !== "string" ||
            decision.context.length > 5000)
        ) {
          return res.status(400).json({
            success: false,
            message: "Decision context must be at most 5000 characters.",
          });
        }

        updates.decision = {
          title: decision.title.trim(),
          summary: decision.summary.trim(),
          context:
            typeof decision.context === "string"
              ? decision.context.trim()
              : "",
          lifecycleStatus: "Accepted",
        };

        updates.status = "Resolved";
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a status or decision to update.",
      });
    }

    const updated = await Discussion.findOneAndUpdate(
      {
        _id: access.discussion._id,
        workspace: access.workspace._id,
      },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Discussion not found or access denied.",
      });
    }

    const result = await populateDiscussion(
      Discussion.findById(updated._id)
    );

    return res.status(200).json({
      success: true,
      message: "Discussion updated successfully.",
      data: result,
    });
  } catch (error) {
    return handleError(res, error, "Failed to update discussion.");
  }
});

module.exports = router;
