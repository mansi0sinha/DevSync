function requestErrorMiddleware(error, _req, res, next) {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON request body." });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body is too large." });
  }
  return next(error);
}

module.exports = requestErrorMiddleware;
