const express = require("express");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");
const taskRoutes = require("./routes/taskRoutes");
const discussionRoutes = require("./routes/discussionRoutes");
const app = express();
const PORT = process.env.PORT || 5000;
const uploadRoutes = require("./routes/uploadRoutes");
const path = require("path");
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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
