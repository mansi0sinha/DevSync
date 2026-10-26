
const express = require("express");
const mongoose = require("mongoose");
const Discussion = require("../models/Discussion");
const Task = require("../models/Task");

const router = express.Router();

// Populate task details while keeping legacy taskId values intact.
function populateLinkedTask(query) {
  return query.populate({
    path: "linkedTask",
    select: "title status priority dueDate",
  });
}

// GET all discussions
router.get("/", async (req, res) => {
  try {
    const discussions = await populateLinkedTask(
      Discussion.find()
    ).sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: discussions.length,
      data: discussions,
    });
  } catch (error) {
    console.error("Fetch discussions error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to fetch discussions",
    });
  }
});

// POST create a discussion with its first message
router.post("/", async (req, res) => {
  try {
    const { title, project, taskId, linkedTask, message } = req.body;

    if (
      typeof title !== "string" ||
      !title.trim() ||
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Discussion title and first message are required",
      });
    }

    let taskReference = null;

    // Validate and verify the selected Task document.
    if (linkedTask) {
      if (!mongoose.isValidObjectId(linkedTask)) {
        return res.status(400).json({
          success: false,
          message: "Invalid linked task ID",
        });
      }

      const task = await Task.findById(linkedTask).select("_id");

      if (!task) {
        return res.status(404).json({
          success: false,
          message: "The selected task was not found",
        });
      }

      taskReference = task._id;
    }

    const discussion = await Discussion.create({
      title: title.trim(),
      project:
        typeof project === "string" && project.trim()
          ? project.trim()
          : "Platform",

      // Keep compatibility with existing discussions.
      taskId:
        typeof taskId === "string" ? taskId.trim() : "",

      linkedTask: taskReference,
      status: "Open",
      messages: [
        {
          author: "Mansi Sinha",
          initials: "MS",
          text: message.trim(),
          attachments: [],
        },
      ],
    });

    const populatedDiscussion = await populateLinkedTask(
      Discussion.findById(discussion._id)
    );

    res.status(201).json({
      success: true,
      message: "Discussion created successfully",
      data: populatedDiscussion,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Create discussion error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to create discussion",
    });
  }
});

// POST add a message with optional attachments
router.post("/:id/messages", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discussion ID",
      });
    }

    const {
      text = "",
      author = "Mansi Sinha",
      initials = "MS",
      attachments = [],
    } = req.body;

    if (typeof text !== "string") {
      return res.status(400).json({
        success: false,
        message: "Message text must be a string",
      });
    }

    if (!Array.isArray(attachments) || attachments.length > 5) {
      return res.status(400).json({
        success: false,
        message: "Attachments must be an array containing at most 5 files",
      });
    }

    if (!text.trim() && attachments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Write a message or attach a file",
      });
    }

    const discussion = await Discussion.findById(req.params.id);

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: "Discussion not found",
      });
    }

    discussion.messages.push({
      text: text.trim(),
      author,
      initials,
      attachments,
    });

    await discussion.save();

    const populatedDiscussion = await populateLinkedTask(
      Discussion.findById(discussion._id)
    );

    res.status(201).json({
      success: true,
      message: "Message added successfully",
      data: populatedDiscussion,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Add message error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to add message",
    });
  }
});

// PUT update discussion status or decision
router.put("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discussion ID",
      });
    }

    const { status, decision } = req.body;
    const updates = {};

    if (status !== undefined) {
      if (!["Open", "Resolved"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Status must be Open or Resolved",
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
          typeof decision.summary !== "string" ||
          !decision.summary.trim()
        ) {
          return res.status(400).json({
            success: false,
            message: "Decision title and summary are required",
          });
        }

        if (
          decision.context !== undefined &&
          typeof decision.context !== "string"
        ) {
          return res.status(400).json({
            success: false,
            message: "Decision context must be a string",
          });
        }

        updates.decision = {
          title: decision.title.trim(),
          summary: decision.summary.trim(),
          context:
            typeof decision.context === "string"
              ? decision.context.trim()
              : "",
        };

        updates.status = "Resolved";
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide a status or decision to update",
      });
    }

    const discussion = await Discussion.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!discussion) {
      return res.status(404).json({
        success: false,
        message: "Discussion not found",
      });
    }

    const populatedDiscussion = await populateLinkedTask(
      Discussion.findById(discussion._id)
    );

    res.status(200).json({
      success: true,
      message: "Discussion updated successfully",
      data: populatedDiscussion,
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("Update discussion error:", error.message);

    res.status(500).json({
      success: false,
      message: "Failed to update discussion",
    });
  }
});

module.exports = router;
