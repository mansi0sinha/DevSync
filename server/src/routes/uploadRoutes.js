
const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const router = express.Router();

const uploadDirectory = path.join(__dirname, "../../uploads");

if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/plain",
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, `${crypto.randomUUID()}${extension}`);
  },
});

const upload = multer({
  storage,

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },

  fileFilter: (req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(
        new Error("Only JPG, PNG, WebP, PDF, and TXT files are allowed.")
      );
    }

    callback(null, true);
  },
});

router.post("/", (req, res) => {
  upload.array("files", 5)(req, res, (error) => {
    if (error) {
      if (req.files?.length) {
        req.files.forEach((file) => {
          fs.unlink(file.path, () => {});
        });
      }

      if (error instanceof multer.MulterError) {
        const message =
          error.code === "LIMIT_FILE_SIZE"
            ? "Each file must be 5 MB or smaller."
            : error.code === "LIMIT_FILE_COUNT"
              ? "You can upload at most 5 files at once."
              : error.message;

        return res.status(400).json({
          success: false,
          message,
        });
      }

      return res.status(400).json({
        success: false,
        message: error.message || "File upload failed.",
      });
    }

    const files = (req.files || []).map((file) => ({
      originalName: file.originalname,
      filename: file.filename,
      url: `/uploads/${file.filename}`,
      mimetype: file.mimetype,
      size: file.size,
    }));

    return res.status(201).json({
      success: true,
      count: files.length,
      data: files,
    });
  });
});

module.exports = router;
