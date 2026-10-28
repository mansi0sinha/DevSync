const mongoose = require("mongoose");

const workspaceInvitationSchema = new mongoose.Schema(
  {
    workspace: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true,
    },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

workspaceInvitationSchema.index({ workspace: 1, email: 1, acceptedAt: 1 });

module.exports = mongoose.models.WorkspaceInvitation || mongoose.model("WorkspaceInvitation", workspaceInvitationSchema);
