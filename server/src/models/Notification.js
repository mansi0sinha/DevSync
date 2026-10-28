const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  type: { type: String, required: true, maxlength: 60 },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 240 },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  entityType: { type: String, enum: ["task", "discussion", "decision"], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  eventKey: { type: String, required: true, maxlength: 180 },
  readAt: { type: Date, default: null, index: true },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, eventKey: 1 }, { unique: true });
notificationSchema.index({ recipient: 1, workspace: 1, project: 1, createdAt: -1 });
module.exports = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
