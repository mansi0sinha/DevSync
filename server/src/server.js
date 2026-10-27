const express = require("express");
const cors = require("cors");
require("dotenv").config();
const app = express();
const PORT = process.env.PORT || 5000;
const connectDB = require("./config/db");
const taskRoutes = require("./routes/taskRoutes");
const discussionRoutes = require("./routes/discussionRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const decisionRoutes = require("./routes/decisionRoutes");
const path = require("path");
const workspaceRoutes = require("./routes/workspaceRoutes");
app.use(cors({ origin: "http://localhost:5173" }));
const authRoutes = require("./routes/authRoutes");
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use(express.json());
app.use("/api/workspaces", workspaceRoutes);
// Home route
app.get("/", (req, res) => {
  res.json({
    message: "Welcome to the DevSync API!",
    status: "running",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "DevSync server is healthy",
  });
});

// Task routes
app.use("/api/tasks", taskRoutes);
app.use("/api/discussions", discussionRoutes);
app.use("/api/uploads", uploadRoutes);
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
);
app.use("/api/decisions", decisionRoutes);
// Connect to MongoDB, then start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DevSync API running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
