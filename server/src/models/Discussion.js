
const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    mimetype: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const messageSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (attachments) => attachments.length <= 5,
        message: "A message can have at most 5 attachments.",
      },
    },
  },
  { timestamps: true }
);

const decisionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      maxlength: 200,
      default: "",
    },
    summary: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    context: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: "",
    },
    lifecycleStatus: {
      type: String,
      enum: ["Accepted", "Superseded", "Archived"],
      default: "Accepted",
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discussion",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const discussionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Discussion title is required."],
      trim: true,
      maxlength: 200,
    },
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    linkedTask: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      default: null,
    },
    status: {
      type: String,
      enum: ["Open", "Resolved"],
      default: "Open",
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
    decision: {
      type: decisionSchema,
      default: null,
    },
  },
  { timestamps: true }
);

discussionSchema.index({ workspace: 1, project: 1, createdAt: -1 });

module.exports = mongoose.model("Discussion", discussionSchema);
