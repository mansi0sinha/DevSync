const LOCAL_CLIENT_ORIGIN = "http://localhost:5173";

function resolveClientOrigin(configuredOrigin, isProduction) {
  const value = configuredOrigin?.trim() || (isProduction ? "" : LOCAL_CLIENT_ORIGIN);
  if (!value) {
    throw new Error("CLIENT_ORIGIN must be set to the deployed frontend origin in production.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("CLIENT_ORIGIN must be a single absolute HTTP(S) origin.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("CLIENT_ORIGIN must be a single HTTP(S) origin without credentials, path, query, or fragment.");
  }
  if (isProduction && url.protocol !== "https:") {
    throw new Error("CLIENT_ORIGIN must use HTTPS in production.");
  }

  return url.origin;
}

module.exports = { resolveClientOrigin };
