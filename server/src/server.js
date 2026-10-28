require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const app = express();
const PORT = process.env.PORT || 5000;
const connectDB = require("./config/db");
const taskRoutes = require("./routes/taskRoutes");
const discussionRoutes = require("./routes/discussionRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const decisionRoutes = require("./routes/decisionRoutes");
const workspaceRoutes = require("./routes/workspaceRoutes");
const projectRoutes = require("./routes/projectRoutes");
const authRoutes = require("./routes/authRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const activityRoutes = require("./routes/activityRoutes");
const searchRoutes = require("./routes/searchRoutes");
const aiSuggestionRoutes = require("./routes/aiSuggestionRoutes");
const githubWebhookRoutes = require("./routes/githubWebhookRoutes");
const { attachRealtime } = require("./realtime");
const { startGitHubWebhookWorker } = require("./services/githubWebhookProcessor");
const { resolveClientOrigin } = require("./config/clientOrigin");
const CLIENT_ORIGIN = resolveClientOrigin(process.env.CLIENT_ORIGIN, process.env.NODE_ENV === "production");
const corsOptions = { origin: CLIENT_ORIGIN, methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] };
app.use(cors(corsOptions));
// GitHub signature verification requires the exact request bytes; mount before JSON parsing.
app.use("/api/webhooks/github", githubWebhookRoutes);
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/ai-suggestions", aiSuggestionRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api", projectRoutes);
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
app.use("/api/decisions", decisionRoutes);
app.use(require("./middleware/requestErrorMiddleware"));
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
  maxHttpBufferSize: 1e6,
});
attachRealtime(io);
app.set("io", io);

// Connect to MongoDB, then start the existing REST and Socket.IO server.
connectDB()
  .then(() => {
    startGitHubWebhookWorker(io);
    httpServer.listen(PORT, () => {
      console.log(`DevSync API running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  });
