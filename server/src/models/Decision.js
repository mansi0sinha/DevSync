
const mongoose = require("mongoose");

const decisionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Decision title is required"],
      trim: true,
      maxlength: [200, "Decision title cannot exceed 200 characters"],
    },

    summary: {
      type: String,
      required: [true, "Decision summary is required"],
      trim: true,
      maxlength: [5000, "Decision summary cannot exceed 5000 characters"],
    },

    context: {
      type: String,
      trim: true,
      default: "",
      maxlength: [5000, "Decision context cannot exceed 5000 characters"],
    },

    project: {
      type: String,
      required: true,
      trim: true,
      default: "Platform",
      maxlength: [100, "Project name cannot exceed 100 characters"],
    },

    taskId: {
      type: String,
      trim: true,
      default: "",
    },

    // Discussion that originally led to this decision.
    discussionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discussion",
      default: null,
    },

    lifecycleStatus: {
      type: String,
      enum: ["Accepted", "Superseded", "Archived"],
      default: "Accepted",
      index: true,
    },

    // Reference to the decision that replaces this one.
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Decision",
      default: null,
    },

    // Recycle Bin metadata. Null means the decision is not deleted.
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },

    deletedBy: {
      type: String,
      trim: true,
      default: null,
    },

    createdBy: {
      type: String,
      trim: true,
      default: "Unknown",
    },
  },
  { timestamps: true }
);

// Helps retrieve active decisions newest first.
decisionSchema.index({ deletedAt: 1, updatedAt: -1 });

// Export model
module.exports =
  mongoose.models.Decision ||
  mongoose.model("Decision", decisionSchema);
