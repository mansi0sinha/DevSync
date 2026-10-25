const express = require("express");
const mongoose = require("mongoose");
const Decision = require("../models/Decision");

const router = express.Router();

// GET /api/decisions
// Fetch active decisions (exclude Recycle Bin items).
router.get("/", async (req, res) => {
  try {
    const decisions = await Decision.find({ deletedAt: null })
      .sort({ updatedAt: -1 });

    res.status(200).json(decisions);
  } catch (error) {
    console.error("Fetch decisions error:", error);
    res.status(500).json({ message: "Failed to fetch decisions." });
  }
});

// GET /api/decisions/trash
// Fetch decisions in the Recycle Bin.
router.get("/trash", async (req, res) => {
  try {
    const decisions = await Decision.find({
      deletedAt: { $ne: null },
    }).sort({ deletedAt: -1 });

    res.status(200).json(decisions);
  } catch (error) {
    console.error("Fetch deleted decisions error:", error);
    res.status(500).json({ message: "Failed to fetch deleted decisions." });
  }
});

// POST /api/decisions
// Create a standalone decision.
router.post("/", async (req, res) => {
  try {
    const {
      title,
      summary,
      context = "",
      project = "Platform",
      taskId = "",
      discussionId = null,
      createdBy = "Unknown",
    } = req.body;

    if (!title?.trim() || !summary?.trim()) {
      return res.status(400).json({
        message: "Decision title and summary are required.",
      });
    }

    if (
      discussionId &&
      !mongoose.Types.ObjectId.isValid(discussionId)
    ) {
      return res.status(400).json({
        message: "Invalid discussion ID.",
      });
    }

    const decision = await Decision.create({
      title,
      summary,
      context,
      project,
      taskId,
      discussionId,
      createdBy,
    });

    res.status(201).json(decision);
  } catch (error) {
    console.error("Create decision error:", error);
    res.status(500).json({ message: "Failed to create decision." });
  }
});

// PATCH /api/decisions/:id/status
// Change lifecycle status.
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { lifecycleStatus } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid decision ID." });
    }

    const allowedStatuses = ["Accepted", "Superseded", "Archived"];

    if (!allowedStatuses.includes(lifecycleStatus)) {
      return res.status(400).json({
        message: "Status must be Accepted, Superseded, or Archived.",
      });
    }

    const decision = await Decision.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { lifecycleStatus } },
      { returnDocument: "after", runValidators: true }
    );

    if (!decision) {
      return res.status(404).json({
        message: "Decision not found or is in the Recycle Bin.",
      });
    }

    res.status(200).json(decision);
  } catch (error) {
    console.error("Update decision status error:", error);
    res.status(500).json({ message: "Failed to update decision status." });
  }
});

// PATCH /api/decisions/:id/supersede
// Mark an older decision as Superseded by a replacement decision.
router.patch("/:id/supersede", async (req, res) => {
  try {
    const { id } = req.params;
    const { replacementDecisionId } = req.body;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(replacementDecisionId)
    ) {
      return res.status(400).json({
        message: "Valid original and replacement decision IDs are required.",
      });
    }

    if (id === replacementDecisionId) {
      return res.status(400).json({
        message: "A decision cannot supersede itself.",
      });
    }

    const replacement = await Decision.findOne({
      _id: replacementDecisionId,
      deletedAt: null,
    });

    if (!replacement) {
      return res.status(404).json({
        message: "Replacement decision not found.",
      });
    }

    const original = await Decision.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          lifecycleStatus: "Superseded",
          supersededBy: replacement._id,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!original) {
      return res.status(404).json({
        message: "Original decision not found.",
      });
    }

    res.status(200).json(original);
  } catch (error) {
    console.error("Supersede decision error:", error);
    res.status(500).json({ message: "Failed to supersede decision." });
  }
});

// DELETE /api/decisions/:id
// Soft-delete: move decision to Recycle Bin.
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid decision ID." });
    }

    const decision = await Decision.findOneAndUpdate(
      { _id: id, deletedAt: null },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: req.body?.deletedBy || "Unknown",
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!decision) {
      return res.status(404).json({
        message: "Decision not found or already deleted.",
      });
    }

    res.status(200).json({
      message: "Decision moved to the Recycle Bin.",
      decision,
    });
  } catch (error) {
    console.error("Move decision to trash error:", error);
    res.status(500).json({ message: "Failed to delete decision." });
  }
});

// POST /api/decisions/:id/restore
// Restore a decision from Recycle Bin.
router.post("/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid decision ID." });
    }

    const decision = await Decision.findOneAndUpdate(
      { _id: id, deletedAt: { $ne: null } },
      {
        $set: {
          deletedAt: null,
          deletedBy: null,
        },
      },
      { returnDocument: "after", runValidators: true }
    );

    if (!decision) {
      return res.status(404).json({
        message: "Deleted decision not found.",
      });
    }

    res.status(200).json({
      message: "Decision restored successfully.",
      decision,
    });
  } catch (error) {
    console.error("Restore decision error:", error);
    res.status(500).json({ message: "Failed to restore decision." });
  }
});

module.exports = router;
