const path = require("node:path");

const DEFAULT_MAX_FILE_BYTES = 5 * 1024 * 1024;
const configuredMaxFileBytes = Number(process.env.DEVSYNC_UPLOAD_MAX_FILE_BYTES);
const MAX_FILE_BYTES = Number.isSafeInteger(configuredMaxFileBytes) && configuredMaxFileBytes > 0 ? configuredMaxFileBytes : DEFAULT_MAX_FILE_BYTES;
const MAX_FILES = 5;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES * MAX_FILES + 64 * 1024;
const WORKSPACE_USER_QUOTA_BYTES = 100 * 1024 * 1024;
const FILE_TYPES = {
  ".jpg": { mimetype: "image/jpeg", suffix: ".jpg", accepted: ["image/jpeg", "application/octet-stream"] },
  ".jpeg": { mimetype: "image/jpeg", suffix: ".jpg", accepted: ["image/jpeg", "application/octet-stream"] },
  ".png": { mimetype: "image/png", suffix: ".png", accepted: ["image/png", "application/octet-stream"] },
  ".webp": { mimetype: "image/webp", suffix: ".webp", accepted: ["image/webp", "application/octet-stream"] },
  ".pdf": { mimetype: "application/pdf", suffix: ".pdf", accepted: ["application/pdf", "application/x-pdf", "application/octet-stream"] },
  ".txt": { mimetype: "text/plain", suffix: ".txt", accepted: ["text/plain", "application/octet-stream"] },
};
function getUploadType(originalName, mimetype) {
  const type = FILE_TYPES[path.extname(String(originalName || "").toLowerCase())];
  return type?.accepted.includes(mimetype) ? type : null;
}

function getSupportedUploadFormats() {
  return Object.keys(FILE_TYPES);
}

function hasValidUploadSignature(mimetype, bytes) {
  if (!Buffer.isBuffer(bytes)) return false;
  switch (mimetype) {
    case "image/jpeg": return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png": return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp": return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    case "application/pdf": return bytes.length >= 5 && bytes.toString("ascii", 0, 5) === "%PDF-";
    case "text/plain": return !bytes.includes(0);
    default: return false;
  }
}

function parseUploadContentLength(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return { status: 400, error: "A valid Content-Length header is required." };
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return { status: 400, error: "A valid Content-Length header is required." };
  if (bytes > MAX_REQUEST_BYTES) return { status: 413, error: `Upload request exceeds the ${Math.ceil(MAX_REQUEST_BYTES / (1024 * 1024))} MB limit.` };
  return { bytes };
}

function hasQuotaCapacity(usedBytes, reservedBytes, incomingBytes) {
  return Number.isSafeInteger(usedBytes) && usedBytes >= 0 &&
    Number.isSafeInteger(reservedBytes) && reservedBytes >= 0 &&
    Number.isSafeInteger(incomingBytes) && incomingBytes > 0 &&
    usedBytes + reservedBytes + incomingBytes <= WORKSPACE_USER_QUOTA_BYTES;
}

module.exports = {
  MAX_FILE_BYTES,
  DEFAULT_MAX_FILE_BYTES,
  getUploadType,
  getSupportedUploadFormats,
  hasValidUploadSignature,
  MAX_FILES,
  MAX_REQUEST_BYTES,
  WORKSPACE_USER_QUOTA_BYTES,
  hasQuotaCapacity,
  parseUploadContentLength,
};
