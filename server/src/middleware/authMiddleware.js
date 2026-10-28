
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");

async function authenticateToken(token) {
  if (typeof token !== "string" || !token || token.length > 8192) {
    throw new Error("Invalid authentication token.");
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  if (!decoded || !mongoose.isObjectIdOrHexString(decoded.userId)) {
    throw new Error("Invalid authentication token.");
  }
  const user = await User.findById(decoded.userId).select("-password");
  if (!user) throw new Error("Invalid authentication token.");
  return user;
}

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (typeof authHeader !== "string") {
      return res.status(401).json({
        success: false,
        message: "Access denied. Please log in.",
      });
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
      return res.status(401).json({ success: false, message: "Access denied. Please log in." });
    }

    req.user = await authenticateToken(parts[1]);
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

authMiddleware.authenticateToken = authenticateToken;

module.exports = authMiddleware;
