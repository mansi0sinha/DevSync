
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

    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    projectRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // Legacy task ID — preserved for existing decisions.
    taskId: {
      type: String,
      trim: true,
      default: "",
    },

    // Actual Task document linked to this decision.
    linkedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },

    // Discussion that originally led to this decision.
    discussionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discussion",
      default: null,
    },

    discussionMessageId: {
      type: mongoose.Schema.Types.ObjectId,
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
    aiSuggestionId: { type: mongoose.Schema.Types.ObjectId, ref: "AISuggestion", default: null },
    aiSuggestionItemKey: { type: String, default: null, maxlength: 40 },
  },
  {
    timestamps: true,
  }
);

// Helps retrieve active decisions newest first.
decisionSchema.index({ workspace: 1, projectRef: 1, deletedAt: 1, updatedAt: -1 });
decisionSchema.index(
  { workspace: 1, projectRef: 1, discussionMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { discussionMessageId: { $type: "objectId" } },
  }
);
decisionSchema.index({ aiSuggestionId: 1, aiSuggestionItemKey: 1 }, {
  unique: true,
  partialFilterExpression: { aiSuggestionId: { $type: "objectId" } },
});

// Export model
module.exports =
  mongoose.models.Decision ||
  mongoose.model("Decision", decisionSchema);
