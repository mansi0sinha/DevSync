const authMiddleware = require("../middleware/authMiddleware");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { createRateLimiter } = require("../utils/rateLimiter");
const { validateLoginBody, validateRegistrationBody } = require("../utils/authValidation");

const router = express.Router();
const registrationRateLimit = createRateLimiter({ limit: 5, windowMs: 60 * 60 * 1000 });
const loginRateLimit = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

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
    if (input.error) return res.status(400).json({ success: false, message: input.error });
    const { name, email: normalizedEmail, password } = input.value;

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Unable to create an account with those details.",
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
    console.error("Registration error:", error.message);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Unable to create an account with those details.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error during registration.",
    });
  }
});

// POST /api/auth/login
router.post("/login", loginRateLimit, async (req, res) => {
  try {
    const input = validateLoginBody(req.body);
    if (input.error) return res.status(400).json({ success: false, message: input.error });
    const { email: normalizedEmail, password } = input.value;

    // Password is excluded by default in the User model.
    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
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
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
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
    },
  });
});
module.exports = router;
