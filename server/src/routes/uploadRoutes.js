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
const { MAX_FILE_BYTES, MAX_FILES, WORKSPACE_USER_QUOTA_BYTES, parseUploadContentLength, getUploadType, getSupportedUploadFormats, hasValidUploadSignature } = require("../utils/uploadPolicy");

const router = express.Router();
router.use(authMiddleware);

const uploadDirectory = path.resolve(process.env.DEVSYNC_UPLOAD_DIRECTORY || path.join(__dirname, "../../uploads"));
if (!fs.existsSync(uploadDirectory)) fs.mkdirSync(uploadDirectory, { recursive: true });

const uploadRateLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000, keyGenerator: (req) => String(req.user._id) });

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDirectory),
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}${file.detectedSuffix}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES, files: MAX_FILES, fields: 2, parts: MAX_FILES + 2, fieldSize: 256, fieldNameSize: 64 },
  fileFilter: (_req, file, callback) => {
    const rule = getUploadType(file.originalname, file.mimetype);
    if (!rule) {
      const error = new Error("Only JPG, PNG, WebP, PDF, and TXT files are allowed.");
      error.code = "UNSUPPORTED_FILE_TYPE";
      return callback(error);
    }
    file.detectedMimetype = rule.mimetype;
    file.detectedSuffix = rule.suffix;
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
    return hasValidUploadSignature(file.detectedMimetype, bytes);
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
  const reserveExisting = () => UploadQuota.findOneAndUpdate(filter, { $inc: { reservedBytes: bytes } }, { returnDocument: "after" });
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
    { returnDocument: "after" }
  );
  if (!quota) throw new Error("Upload quota reservation could not be settled.");
}

router.get("/config", (_req, res) => res.json({ maxFileBytes: MAX_FILE_BYTES, maxFiles: MAX_FILES, formats: getSupportedUploadFormats() }));

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
          ? `Each file must be ${Math.ceil(MAX_FILE_BYTES / (1024 * 1024))} MB or smaller.`
          : error instanceof multer.MulterError && error.code === "LIMIT_FILE_COUNT"
            ? "You can upload at most 5 files at once."
            : error.code === "UNSUPPORTED_FILE_TYPE"
              ? "Only JPG, PNG, WebP, PDF, and TXT files are allowed."
              : "File storage is unavailable. Please try again.";
        const status = error.code === "UNSUPPORTED_FILE_TYPE" ? 415 : error.code === "LIMIT_FILE_SIZE" ? 413 : error.code === "LIMIT_FILE_COUNT" ? 400 : 500;
        const malformedForm = !(error instanceof multer.MulterError) && /multipart|form boundary|unexpected end/i.test(error.message || "");
        return res.status(malformedForm ? 400 : status === 415 ? 400 : status).json({ success: false, message: malformedForm ? "The multipart upload is incomplete or malformed." : message });
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
        console.error("Upload processing failed.");
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
        mimetype: file.detectedMimetype,
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
