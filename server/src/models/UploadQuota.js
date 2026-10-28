const mongoose = require("mongoose");

const uploadQuotaSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  usedBytes: { type: Number, required: true, min: 0, default: 0 },
  reservedBytes: { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

uploadQuotaSchema.index({ workspace: 1, user: 1 }, { unique: true });

module.exports = mongoose.models.UploadQuota || mongoose.model("UploadQuota", uploadQuotaSchema);
