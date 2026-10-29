function requestErrorMiddleware(error, _req, res, next) {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "Malformed JSON request body.", fields: { form: "Check the request format and try again." } });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ success: false, code: "REQUEST_TOO_LARGE", message: "Request body is too large." });
  }
  if (res.headersSent) return next(error);
  console.error("Unhandled API request error.");
  return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "The server could not complete the request." });
}

module.exports = requestErrorMiddleware;
