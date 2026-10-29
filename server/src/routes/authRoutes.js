const authMiddleware = require("../middleware/authMiddleware");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createRateLimiter } = require("../utils/rateLimiter");
const { validateLoginBody, validateRegistrationBody } = require("../utils/authValidation");
const { diagnoseMongoError, isDatabaseUnavailableError } = require("../config/db");

const router = express.Router();
const registrationRateLimit = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
const loginRateLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

function sendDatabaseUnavailable(res) {
  return res.status(503).json({
    success: false,
    code: "DATABASE_UNAVAILABLE",
    message: "DevSync could not complete this request because the database connection was interrupted. Please try again shortly.",
  });
}

function logAuthFailure(operation, error) {
  if (isDatabaseUnavailableError(error)) {
    console.error(`${operation} failed: ${diagnoseMongoError(error)}`);
    return;
  }
  const type = /^[A-Za-z][A-Za-z0-9]*$/.test(error?.name || "") ? error.name : "Error";
  const code = /^[A-Za-z0-9_-]{1,40}$/.test(String(error?.code ?? "")) ? `, code=${error.code}` : "";
  const validationPaths = Object.keys(error?.errors || {}).filter((path) => /^[A-Za-z][A-Za-z0-9_.]{0,60}$/.test(path)).slice(0, 8);
  const validationDetails = validationPaths.length ? `, fields=${validationPaths.join(",")}` : "";
  console.error(`${operation} failed due to a server-side error (type=${type}${code}${validationDetails}).`);
}

// Generate JWT
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// POST /api/auth/register
router.post("/register", registrationRateLimit, async (req, res) => {
  try {
    const input = validateRegistrationBody(req.body);
    if (input.error) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: input.error, fields: input.fields || {} });
    const { name, email: normalizedEmail, password } = input.value;

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_ACCOUNT",
        message: "An account with this email already exists. Sign in or use a different email.",
        fields: { email: "An account with this email already exists." },
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        code: "DUPLICATE_ACCOUNT",
        message: "An account with this email already exists. Sign in or use a different email.",
        fields: { email: "An account with this email already exists." },
      });
    }

    if (isDatabaseUnavailableError(error)) {
      logAuthFailure("Registration request", error);
      return sendDatabaseUnavailable(res);
    }

    logAuthFailure("Registration request", error);

    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Server error during registration.",
    });
  }
});

// POST /api/auth/login
router.post("/login", loginRateLimit, async (req, res) => {
  try {
    const input = validateLoginBody(req.body);
    if (input.error) return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: input.error, fields: input.fields || {} });
    const { email: normalizedEmail, password } = input.value;

    // Password is excluded by default in the User model.
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect. Please check your details and try again.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect. Please check your details and try again.",
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      logAuthFailure("Login request", error);
      return sendDatabaseUnavailable(res);
    }
    logAuthFailure("Login request", error);

    return res.status(500).json({
      success: false,
      code: "SERVER_ERROR",
      message: "Server error during login.",
    });
  }
});
// GET /api/auth/me — Protected route
router.get("/me", authMiddleware, (req, res) => {
  return res.status(200).json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      username: req.user.username || "",
      bio: req.user.bio || "",
    },
  });
});

router.patch("/me", authMiddleware, async (req, res) => {
  try {
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) return res.status(400).json({ success: false, message: "A valid profile is required." });
    const updates = {};
    if (Object.hasOwn(req.body, "name")) {
      if (typeof req.body.name !== "string" || req.body.name.trim().length < 2 || req.body.name.trim().length > 100) return res.status(400).json({ success: false, message: "Name must be between 2 and 100 characters." });
      updates.name = req.body.name.trim();
    }
    if (Object.hasOwn(req.body, "username")) {
      if (typeof req.body.username !== "string" || !/^[a-zA-Z0-9_-]{3,25}$/.test(req.body.username)) return res.status(400).json({ success: false, message: "Username must be 3–25 characters using letters, numbers, underscores, or hyphens." });
      updates.username = req.body.username;
    }
    if (Object.hasOwn(req.body, "bio")) {
      if (typeof req.body.bio !== "string" || req.body.bio.length > 160) return res.status(400).json({ success: false, message: "Bio must be 160 characters or fewer." });
      updates.bio = req.body.bio.trim();
    }
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "No supported profile fields were supplied." });
    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: "after", runValidators: true }).select("name email avatar username bio");
    return res.json({ success: true, user });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      logAuthFailure("Profile update", error);
      return sendDatabaseUnavailable(res);
    }
    logAuthFailure("Profile update", error);
    return res.status(500).json({ success: false, code: "SERVER_ERROR", message: "Profile could not be updated." });
  }
});
module.exports = router;
