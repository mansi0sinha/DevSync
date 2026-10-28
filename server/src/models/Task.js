
const mongoose = require("mongoose");

const taskCommentSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      required: true,
      maxlength: [2000, "Comment cannot exceed 2000 characters"],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const pullRequestSchema = new mongoose.Schema({
  url: { type: String, required: true, maxlength: 2048 },
  owner: { type: String, required: true, maxlength: 39 },
  repository: { type: String, required: true, maxlength: 100 },
  repositoryKey: { type: String, required: true, lowercase: true, maxlength: 140 },
  number: { type: Number, required: true, min: 1 },
  title: { type: String, default: "", maxlength: 256 },
  state: { type: String, enum: ["unknown", "open", "closed", "merged"], default: "unknown" },
  draft: { type: Boolean, default: false },
  linkedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  linkedAt: { type: Date, default: Date.now },
  lastWebhookAt: { type: Date, default: null },
  lastDeliveryId: { type: String, default: null, maxlength: 128 },
}, { timestamps: true });

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [120, "Title cannot exceed 120 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      default: "",
    },

    status: {
      type: String,
      enum: ["todo", "in-progress", "in-review", "done"],
      default: "todo",
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },

    dueDate: {
      type: Date,
      default: null,
    },

    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    comments: {
      type: [taskCommentSchema],
      default: [],
      validate: {
        validator: (comments) => comments.length <= 200,
        message: "A task cannot have more than 200 comments.",
      },
    },

    pullRequests: {
      type: [pullRequestSchema],
      default: [],
      validate: { validator: (pullRequests) => pullRequests.length <= 20 && new Set(pullRequests.map((item) => `${item.repositoryKey}:${item.number}`)).size === pullRequests.length, message: "A task can link at most 20 unique pull requests." },
    },

    // Workspace that owns this task
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },

    // Project this task belongs to
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // User who created the task
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    aiSuggestionId: { type: mongoose.Schema.Types.ObjectId, ref: "AISuggestion", default: null },
    aiSuggestionItemKey: { type: String, default: null, maxlength: 40 },
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ aiSuggestionId: 1, aiSuggestionItemKey: 1 }, {
  unique: true,
  partialFilterExpression: { aiSuggestionId: { $type: "objectId" } },
});
taskSchema.index({ "pullRequests.repositoryKey": 1, "pullRequests.number": 1 }, {
  unique: true,
  partialFilterExpression: { "pullRequests.repositoryKey": { $type: "string" } },
});

// Reuse the existing model during development
module.exports =
  mongoose.models.Task || mongoose.model("Task", taskSchema);
