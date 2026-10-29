const mongoose = require("mongoose");

function validateRuntimeConfig(env = process.env) {
  const production = env.NODE_ENV === "production";
  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer from 1 to 65535.");
  }
  if (typeof env.MONGODB_URI !== "string" || !env.MONGODB_URI.trim()) {
    throw new Error("MONGODB_URI is required. Configure a mongodb:// or mongodb+srv:// connection string.");
  }
  if (env.MONGODB_URI !== env.MONGODB_URI.trim() || !/^mongodb(?:\+srv)?:\/\//i.test(env.MONGODB_URI)) {
    throw new Error("MONGODB_URI must be configured with a mongodb:// or mongodb+srv:// URI.");
  }
  try {
    // Use the MongoDB driver's parser. WHATWG URL rejects valid comma-separated
    // seed lists supported by mongodb:// connection strings.
    new mongoose.mongo.MongoClient(env.MONGODB_URI);
  } catch {
    throw new Error("MONGODB_URI is malformed. Check the MongoDB URI syntax and percent-encode reserved characters in credentials.");
  }
  if (typeof env.JWT_SECRET !== "string" || !env.JWT_SECRET.trim()) {
    throw new Error("JWT_SECRET must be configured before the API can start.");
  }
  if (production && (env.JWT_SECRET.trim().length < 32 || /replace-with|change-me|secret-key/i.test(env.JWT_SECRET))) {
    throw new Error("Production JWT_SECRET must be a non-placeholder secret of at least 32 characters.");
  }
  if (env.DEVSYNC_UPLOAD_MAX_FILE_BYTES !== undefined) {
    const uploadLimit = Number(env.DEVSYNC_UPLOAD_MAX_FILE_BYTES);
    if (!Number.isSafeInteger(uploadLimit) || uploadLimit < 1 || uploadLimit > 50 * 1024 * 1024) {
      throw new Error("DEVSYNC_UPLOAD_MAX_FILE_BYTES must be an integer from 1 to 52428800.");
    }
  }
  return true;
}

module.exports = { validateRuntimeConfig };
