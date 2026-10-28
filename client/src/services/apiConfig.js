const LOCAL_API_BASE_URL = "http://localhost:5000/api";

export function resolveApiConfig({ configuredUrl, isProduction }) {
  const value = configuredUrl?.trim() || (isProduction ? "" : LOCAL_API_BASE_URL);
  if (!value) {
    throw new Error("VITE_API_BASE_URL must be set to the production API URL before building DevSync.");
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("VITE_API_BASE_URL must be an absolute HTTP(S) URL ending in /api.");
  }

  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, "") !== "/api") {
    throw new Error("VITE_API_BASE_URL must be an HTTP(S) origin followed by /api, without credentials, query, or fragment.");
  }
  if (isProduction && url.protocol !== "https:") {
    throw new Error("VITE_API_BASE_URL must use HTTPS in production.");
  }

  return { apiBaseUrl: `${url.origin}/api`, apiOrigin: url.origin };
}

