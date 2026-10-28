const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
  actorType: { type: String, enum: ["user", "system"], default: "user", index: true },
  action: { type: String, required: true, maxlength: 60 },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  entityType: { type: String, enum: ["task", "discussion", "decision"], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  summary: { type: String, required: true, trim: true, maxlength: 240 },
  eventKey: { type: String, required: true, maxlength: 180 },
}, { timestamps: { createdAt: true, updatedAt: false } });

activitySchema.index({ workspace: 1, project: 1, createdAt: -1, _id: -1 });
activitySchema.index({ eventKey: 1 }, { unique: true });
module.exports = mongoose.models.Activity || mongoose.model("Activity", activitySchema);
