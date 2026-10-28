const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const mongoose = require("mongoose");

const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const Discussion = require("../models/Discussion");
const Upload = require("../models/Upload");
const UploadQuota = require("../models/UploadQuota");
const authMiddleware = require("../middleware/authMiddleware");
const { createRateLimiter } = require("../utils/rateLimiter");
const { MAX_FILE_BYTES, MAX_FILES, WORKSPACE_USER_QUOTA_BYTES, parseUploadContentLength } = require("../utils/uploadPolicy");

const router = express.Router();
router.use(authMiddleware);

const uploadDirectory = path.resolve(process.env.DEVSYNC_UPLOAD_DIRECTORY || path.join(__dirname, "../../uploads"));
if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedTypes = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "text/plain": ".txt",
};
const uploadRateLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000, keyGenerator: (req) => String(req.user._id) });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${allowedTypes[file.mimetype] || ".bin"}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 2, parts: MAX_FILES + 2, fieldSize: 256, fieldNameSize: 64 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes[file.mimetype]) return callback(new Error("Only JPG, PNG, WebP, PDF, and TXT files are allowed."));
    callback(null, true);
  },
});

async function removeFiles(files = []) {
  await Promise.all(files.filter((file) => file?.path).map((file) => fs.promises.unlink(file.path).catch((error) => {
    if (error.code !== "ENOENT") throw error;
  })));
}

async function resolveProject(workspaceId, projectId, userId) {
  if (!mongoose.isObjectIdOrHexString(workspaceId) || !mongoose.isObjectIdOrHexString(projectId)) return null;
  const workspace = await Workspace.findOne({ _id: workspaceId, "members.user": userId }).select("_id");
  if (!workspace) return null;
  const project = await Project.findOne({ _id: projectId, workspace: workspace._id }).select("_id");
  return project ? { workspace, project } : null;
}

async function hasValidContent(file) {
  const handle = await fs.promises.open(file.path, "r");
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    switch (file.mimetype) {
      case "image/jpeg": return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
      case "image/png": return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case "image/webp": return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
      case "application/pdf": return bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-";
      case "text/plain": return !bytes.includes(0);
      default: return false;
    }
  } finally {
    await handle.close();
  }
}

async function reserveQuota(workspaceId, userId, bytes) {
  const filter = {
    workspace: workspaceId,
    user: userId,
    $expr: {
      $lte: [
        { $add: [{ $ifNull: ["$usedBytes", 0] }, { $ifNull: ["$reservedBytes", 0] }, bytes] },
        WORKSPACE_USER_QUOTA_BYTES,
      ],
    },
  };
  const reserveExisting = () => UploadQuota.findOneAndUpdate(filter, { $inc: { reservedBytes: bytes } }, { new: true });
  if (await reserveExisting()) return true;
  try {
    await UploadQuota.create({ workspace: workspaceId, user: userId, usedBytes: 0, reservedBytes: bytes });
    return true;
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Boolean(await reserveExisting());
  }
}

async function settleQuota(workspaceId, userId, reservedBytes, usedBytes = 0) {
  const quota = await UploadQuota.findOneAndUpdate(
    { workspace: workspaceId, user: userId, reservedBytes: { $gte: reservedBytes } },
    { $inc: { reservedBytes: -reservedBytes, usedBytes } },
    { new: true }
  );
  if (!quota) throw new Error("Upload quota reservation could not be settled.");
}

router.post("/", uploadRateLimit, async (req, res) => {
  if (!req.is("multipart/form-data")) return res.status(400).json({ success: false, message: "Expected a multipart file upload." });
  const length = parseUploadContentLength(req.get("content-length"));
  if (length.error) return res.status(length.status).json({ success: false, message: length.error });

  // Scope is carried in the query so authorization completes before Multer can write a file.
  const scope = await resolveProject(req.query.workspaceId, req.query.projectId, req.user._id);
  if (!scope) return res.status(404).json({ success: false, message: "Workspace or project not found or access denied." });

  let reserved = false;
  try {
    reserved = await reserveQuota(scope.workspace._id, req.user._id, length.bytes);
    if (!reserved) return res.status(413).json({ success: false, message: "Workspace storage quota is full." });
    req.uploadScope = scope;
    req.uploadReservationBytes = length.bytes;
    upload.array("files", MAX_FILES)(req, res, async (error) => {
      try {
      const files = req.files || [];
      if (error) {
        await removeFiles(files).catch((cleanupError) => console.error("Failed to remove rejected upload files:", cleanupError.message));
        await settleQuota(scope.workspace._id, req.user._id, length.bytes).catch((quotaError) => console.error("Upload quota release failed:", quotaError.message));
        const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
          ? "Each file must be 5 MB or smaller."
          : error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT"
            ? "You can upload at most 5 files at once."
            : error.message || "File upload failed.";
        return res.status(400).json({ success: false, message });
      }
      if ((req.body?.workspaceId && String(req.body.workspaceId) !== String(scope.workspace._id)) ||
          (req.body?.projectId && String(req.body.projectId) !== String(scope.project._id))) {
        await removeFiles(files);
        await settleQuota(scope.workspace._id, req.user._id, length.bytes);
        return res.status(400).json({ success: false, message: "Multipart workspace/project fields must match the authorized upload scope." });
      }
      if (!files.length) {
        await settleQuota(scope.workspace._id, req.user._id, length.bytes);
        return res.status(400).json({ success: false, message: "Select at least one supported file." });
      }
      await persistUploads(req, res, files);
      } catch (callbackError) {
        await removeFiles(req.files || []).catch(() => {});
        await settleQuota(scope.workspace._id, req.user._id, length.bytes).catch(() => {});
        console.error("Upload processing failed:", callbackError.message);
        if (!res.headersSent) res.status(500).json({ success: false, message: "File upload failed." });
      }
    });
  } catch (error) {
    if (reserved) await settleQuota(scope.workspace._id, req.user._id, length.bytes).catch((quotaError) => console.error("Upload quota release failed:", quotaError.message));
    console.error("Upload authorization or quota check failed:", error.message);
    return res.status(500).json({ success: false, message: "File upload could not be started." });
  }
});

async function persistUploads(req, res, files) {
  const created = [];
  try {
    const { workspace: workspaceId, project: projectId } = req.uploadScope;
    for (const file of files) {
      if (!(await hasValidContent(file))) {
        await removeFiles(files);
        await settleQuota(workspaceId._id, req.user._id, req.uploadReservationBytes);
        return res.status(400).json({ success: false, message: "File contents do not match the declared file type." });
      }
    }
    for (const file of files) {
      const asset = await Upload.create({
        filename: file.filename,
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        workspace: workspaceId._id,
        project: projectId._id,
        uploadedBy: req.user._id,
      });
      created.push(asset);
    }
    const totalFileBytes = files.reduce((total, file) => total + file.size, 0);
    await settleQuota(workspaceId._id, req.user._id, req.uploadReservationBytes, totalFileBytes);
    return res.status(201).json({
      success: true,
      count: created.length,
      data: created.map((asset) => ({
        id: String(asset._id),
        uploadId: String(asset._id),
        originalName: asset.originalName,
        filename: asset.filename,
        url: `/api/uploads/file/${asset._id}`,
        mimetype: asset.mimetype,
        size: asset.size,
      })),
    });
  } catch (error) {
    try {
      await Upload.deleteMany({ _id: { $in: created.map((asset) => asset._id) } });
    } catch {
      console.error("Upload metadata cleanup failed; inaccessible orphan metadata may remain.");
    }
    await removeFiles(files).catch((cleanupError) => console.error("Upload file cleanup failed:", cleanupError.message));
    await settleQuota(req.uploadScope.workspace._id, req.user._id, req.uploadReservationBytes).catch((quotaError) => console.error("Upload quota release failed:", quotaError.message));
    console.error("Upload persistence failed:", error.message);
    return res.status(500).json({ success: false, message: "File upload failed." });
  }
}

router.get("/file/:uploadId", async (req, res) => {
  try {
    const { uploadId } = req.params;
    if (!mongoose.isObjectIdOrHexString(uploadId)) return res.status(400).json({ success: false, message: "Invalid attachment ID." });

    const asset = await Upload.findById(uploadId);
    if (!asset) return res.status(404).json({ success: false, message: "Attachment not found or access denied." });

    const workspace = await Workspace.findOne({ _id: asset.workspace, "members.user": req.user._id }).select("_id");
    if (!workspace) return res.status(404).json({ success: false, message: "Attachment not found or access denied." });
    const project = await Project.findOne({ _id: asset.project, workspace: workspace._id }).select("_id");
    if (!project) return res.status(404).json({ success: false, message: "Attachment not found or access denied." });

    const isAttached = await Discussion.exists({
      workspace: workspace._id,
      project: project._id,
      "messages.attachments.uploadId": asset._id,
    });
    if (!isAttached) return res.status(404).json({ success: false, message: "Attachment not found or access denied." });

    if (!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf|txt)$/i.test(asset.filename)) {
      return res.status(404).json({ success: false, message: "Attachment not found or access denied." });
    }
    const fullPath = path.resolve(uploadDirectory, asset.filename);
    if (!fullPath.startsWith(`${path.resolve(uploadDirectory)}${path.sep}`)) return res.status(404).json({ success: false, message: "Attachment not found or access denied." });
    res.set("X-Content-Type-Options", "nosniff");
    return res.sendFile(fullPath, (error) => {
      if (error && !res.headersSent) res.status(error.statusCode === 404 ? 404 : 500).json({ success: false, message: "Attachment could not be retrieved." });
    });
  } catch (error) {
    console.error("Attachment retrieval failed:", error.message);
    return res.status(500).json({ success: false, message: "Attachment could not be retrieved." });
  }
});

module.exports = router;
