
const express = require("express");
const mongoose = require("mongoose");
const Discussion = require("../models/Discussion");

const router = express.Router();

// GET all discussions
router.get("/", async (req, res) => {
  try {
    const discussions = await Discussion.find().sort({ updatedAt: -1 });

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
    const { title, project, taskId, message } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Discussion title and first message are required",
      });
    }

    const discussion = await Discussion.create({
      title: title.trim(),
      project: project?.trim() || "Platform",
      taskId: taskId?.trim() || "",
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

    res.status(201).json({
      success: true,
      message: "Discussion created successfully",
      data: discussion,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
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

    // A message must contain text or at least one attachment.
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

    res.status(201).json({
      success: true,
      message: "Message added successfully",
      data: discussion,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
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
        if (!decision.title?.trim() || !decision.summary?.trim()) {
          return res.status(400).json({
            success: false,
            message: "Decision title and summary are required",
          });
        }

        updates.decision = {
          title: decision.title.trim(),
          summary: decision.summary.trim(),
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

    res.status(200).json({
      success: true,
      message: "Discussion updated successfully",
      data: discussion,
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
