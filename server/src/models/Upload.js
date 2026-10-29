const mongoose = require("mongoose");
const { MAX_FILE_BYTES } = require("../utils/uploadPolicy");

const uploadSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true, unique: true, immutable: true },
    originalName: { type: String, required: true, trim: true, maxlength: 255 },
    mimetype: { type: String, required: true, enum: ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"] },
    size: { type: Number, required: true, min: 0, max: MAX_FILE_BYTES },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);

uploadSchema.index({ workspace: 1, project: 1, createdAt: -1 });

module.exports = mongoose.models.Upload || mongoose.model("Upload", uploadSchema);
