const mongoose = require("mongoose");

const eventDataSchema = new mongoose.Schema({
  repositoryKey: { type: String, maxlength: 140 },
  owner: { type: String, maxlength: 39 },
  repository: { type: String, maxlength: 100 },
  number: { type: Number, min: 1 },
  action: { type: String, maxlength: 20 },
  state: { type: String, enum: ["open", "closed", "merged"] },
  title: { type: String, maxlength: 256 },
  draft: { type: Boolean },
  pullRequestUpdatedAt: { type: Date },
}, { _id: false });

const deliverySchema = new mongoose.Schema({
  deliveryId: { type: String, required: true, unique: true, maxlength: 128 },
  eventName: { type: String, required: true, maxlength: 40 },
  action: { type: String, default: "", maxlength: 40 },
  eventData: { type: eventDataSchema, default: null },
  status: { type: String, enum: ["pending", "processing", "processed", "ignored", "failed"], required: true, index: true },
  attempts: { type: Number, default: 0, min: 0, max: 5 },
  nextAttemptAt: { type: Date, default: null, index: true },
  processingAt: { type: Date, default: null },
  processedAt: { type: Date, default: null },
  matchedTask: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", default: null },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
  lastError: { type: String, default: "", maxlength: 80 },
}, { timestamps: true });

deliverySchema.index({ status: 1, nextAttemptAt: 1, processingAt: 1 });
module.exports = mongoose.models.GitHubWebhookDelivery || mongoose.model("GitHubWebhookDelivery", deliverySchema);
