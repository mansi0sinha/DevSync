const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 5;
const MAX_REQUEST_BYTES = MAX_FILE_BYTES * MAX_FILES + 64 * 1024;
const WORKSPACE_USER_QUOTA_BYTES = 100 * 1024 * 1024;

function parseUploadContentLength(value) {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return { status: 400, error: "A valid Content-Length header is required." };
  const bytes = Number(value);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return { status: 400, error: "A valid Content-Length header is required." };
  if (bytes > MAX_REQUEST_BYTES) return { status: 413, error: "Upload request exceeds the 25 MB limit." };
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
  MAX_FILES,
  MAX_REQUEST_BYTES,
  WORKSPACE_USER_QUOTA_BYTES,
  hasQuotaCapacity,
  parseUploadContentLength,
};
