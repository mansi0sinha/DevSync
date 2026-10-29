export const NETWORK_ERROR_MESSAGE = "We couldn't connect to DevSync. Check your connection and try again.";

const messages = {
  INVALID_CREDENTIALS: "Email or password is incorrect. Please check your details and try again.",
  DUPLICATE_ACCOUNT: "An account with this email already exists. Sign in or use a different email.",
  RATE_LIMITED: "Too many attempts. Please wait a little and try again.",
  DATABASE_UNAVAILABLE: "DevSync's database connection was interrupted. Please try again shortly.",
  SERVER_ERROR: "DevSync is having trouble right now. Please try again shortly.",
  UNEXPECTED_RESPONSE: "DevSync returned an unexpected response. Please try again.",
};

export class ApiError extends Error {
  constructor({ code, message, status = 0, fields = {} }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

function safeServerMessage(value, fallback) {
  if (typeof value !== "string" || !value.trim() || value.length > 240) return fallback;
  if (/\bat\s+.+\(.+:\d+:\d+\)|Mongo(?:Network|Server|Error|DB)|ECONNRESET|mongodb(?:\+srv)?:\/\//i.test(value)) return fallback;
  return value.trim();
}

export function normalizeNetworkError(error) {
  if (error instanceof ApiError) return error;
  if (error?.name === "TypeError" || error?.name === "AbortError" || !error) {
    return new ApiError({ code: "NETWORK_ERROR", message: NETWORK_ERROR_MESSAGE });
  }
  return new ApiError({ code: "UNEXPECTED_ERROR", message: "Something unexpected happened. Please try again." });
}

export function normalizeResponseError(status, payload, { invalidJson = false } = {}) {
  const responseCode = typeof payload?.code === "string" ? payload.code : "";
  const fields = payload?.fields && typeof payload.fields === "object" && !Array.isArray(payload.fields) ? payload.fields : {};

  if (status === 401 && responseCode === "INVALID_CREDENTIALS") {
    return new ApiError({ code: responseCode, status, message: messages.INVALID_CREDENTIALS });
  }
  if (status === 409 && responseCode === "DUPLICATE_ACCOUNT") {
    return new ApiError({ code: responseCode, status, message: safeServerMessage(payload?.message, messages.DUPLICATE_ACCOUNT), fields });
  }
  if (status === 400 && responseCode === "VALIDATION_ERROR") {
    return new ApiError({ code: responseCode, status, message: safeServerMessage(payload?.message, "Check the highlighted fields and try again."), fields });
  }
  if (status === 503 && responseCode === "DATABASE_UNAVAILABLE") {
    return new ApiError({ code: responseCode, status, message: messages.DATABASE_UNAVAILABLE });
  }
  if (status === 429 || responseCode === "RATE_LIMITED") {
    return new ApiError({ code: "RATE_LIMITED", status, message: messages.RATE_LIMITED });
  }
  if (status >= 500) {
    return new ApiError({ code: "SERVER_ERROR", status, message: messages.SERVER_ERROR });
  }
  if (invalidJson || !payload || typeof payload !== "object" || Array.isArray(payload)) {
    return new ApiError({ code: "UNEXPECTED_RESPONSE", status, message: messages.UNEXPECTED_RESPONSE });
  }
  return new ApiError({
    code: responseCode || "REQUEST_ERROR",
    status,
    message: safeServerMessage(payload.message, "Your request could not be completed. Please check your details and try again."),
    fields,
  });
}

export function normalizeUnexpectedResponse(status = 0) {
  return new ApiError({ code: "UNEXPECTED_RESPONSE", status, message: messages.UNEXPECTED_RESPONSE });
}
