require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { createServer } = require("http");
const { Server } = require("socket.io");
const app = express();
const PORT = process.env.PORT || 5000;
const { validateRuntimeConfig } = require("./config/runtime");
const { connectDB } = require("./config/db");
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
const githubWebhookRoutes = require("./routes/githubWebhookRoutes");
const { attachRealtime } = require("./realtime");
const { startGitHubWebhookWorker } = require("./services/githubWebhookProcessor");
const { resolveClientOrigin } = require("./config/clientOrigin");
validateRuntimeConfig(process.env);
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
app.use("/api/workspaces", workspaceRoutes);
app.use("/api", projectRoutes);
// Home route
app.get("/", (req, res) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({ success: false, status: "unavailable", message: "DevSync API is waiting for its database connection." });
  }
  res.json({
    message: "Welcome to the DevSync API!",
    status: "running",
  });
});

// Health check
app.get("/api/health", (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ success: ready, status: ready ? "healthy" : "unavailable", message: ready ? "DevSync API and database are healthy." : "DevSync database is unavailable." });
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

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received; shutting down DevSync API.`);
  if (httpServer.listening) {
    await new Promise((resolve) => httpServer.close(resolve));
    await new Promise((resolve) => io.close(resolve));
  }
  await mongoose.disconnect().catch(() => {});
}

process.once("SIGINT", () => { void shutdown("SIGINT").finally(() => { process.exitCode = 0; }); });
process.once("SIGTERM", () => { void shutdown("SIGTERM").finally(() => { process.exitCode = 0; }); });

// Do not listen until MongoDB is ready. connectDB retries transient startup failures;
// after its bounded attempts, fail once with a sanitized diagnostic for nodemon/operator.
connectDB()
  .then(() => {
    if (shuttingDown) return mongoose.disconnect();
    startGitHubWebhookWorker(io);
    httpServer.once("error", (error) => {
      console.error(`DevSync API could not start listening on the configured port (${error.code || "server error"}).`);
      process.exitCode = 1;
      void shutdown("startup error");
    });
    httpServer.listen(PORT, () => {
      console.log(`DevSync API running at http://localhost:${PORT}`);
    });
  })
  .catch(async (error) => {
    console.error(`DevSync API startup aborted: ${error.code === "MONGODB_STARTUP_FAILED" ? error.message : "database initialization failed; verify server configuration and MongoDB availability."}`);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
