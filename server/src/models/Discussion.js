
const mongoose = require("mongoose");

// Attachment schema
const attachmentSchema = new mongoose.Schema(
  {
    originalName: {
      type: String,
      required: true,
      trim: true,
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
  { _id: false }
);

// Message schema
const messageSchema = new mongoose.Schema(
  {
    author: {
      type: String,
      required: true,
      trim: true,
    },
    initials: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      default: "",
      trim: true,
      maxlength: [5000, "Message cannot exceed 5000 characters"],
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// Decision schema
const decisionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: [200, "Decision title cannot exceed 200 characters"],
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, "Decision summary cannot exceed 5000 characters"],
    },
    context: {
      type: String,
      trim: true,
      default: "",
      maxlength: [5000, "Decision context cannot exceed 5000 characters"],
    },

    // Decision lifecycle
    lifecycleStatus: {
      type: String,
      enum: ["Accepted", "Superseded", "Archived"],
      default: "Accepted",
    },

    // Reference to the decision that replaced this one.
    // Uses a Discussion document ID because decisions are embedded
    // inside Discussion documents in our current architecture.
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discussion",
      default: null,
    },

    // Soft-delete / Recycle Bin information
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { _id: false }
);

// Discussion schema
const discussionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Discussion title is required"],
      trim: true,
      maxlength: [200, "Discussion title cannot exceed 200 characters"],
    },
    project: {
      type: String,
      required: true,
      trim: true,
      default: "Platform",
    },
    taskId: {
      type: String,
      trim: true,
      default: "",
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

// Export model
module.exports =
  mongoose.models.Discussion ||
  mongoose.model("Discussion", discussionSchema);
