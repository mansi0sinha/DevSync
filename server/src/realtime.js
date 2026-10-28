const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Workspace = require("./models/Workspace");
const Project = require("./models/Project");
const authMiddleware = require("./middleware/authMiddleware");

const ROOM_PREFIX = "project:";
const USER_ROOM_PREFIX = "user:";
const JOIN_WINDOW_MS = 60_000;
const MAX_ROOM_EVENTS_PER_WINDOW = 20;

function validScope(workspaceId, projectId) {
  return mongoose.isObjectIdOrHexString(workspaceId) &&
    mongoose.isObjectIdOrHexString(projectId);
}

function roomName({ workspaceId, projectId }) {
  return `${ROOM_PREFIX}${workspaceId}:${projectId}`;
}

function notificationRoom(userId) {
  return `${USER_ROOM_PREFIX}${userId}`;
}

function acknowledge(callback, response) {
  if (typeof callback === "function") callback(response);
}

function allowRoomEvent(socket) {
  const now = Date.now();
  const current = socket.data.roomEventWindow;
  if (!current || now - current.startedAt >= JOIN_WINDOW_MS) {
    socket.data.roomEventWindow = { startedAt: now, count: 1 };
    return true;
  }
  current.count += 1;
  return current.count <= MAX_ROOM_EVENTS_PER_WINDOW;
}

async function authorizedSockets(io, scope) {
  const room = roomName(scope);
  const sockets = await io.in(room).fetchSockets();
  const [workspace, project] = await Promise.all([
    Workspace.findById(scope.workspaceId).select("members.user"),
    Project.findOne({ _id: scope.projectId, workspace: scope.workspaceId }).select("_id"),
  ]);
  const memberIds = new Set((workspace?.members || []).map((member) => String(member.user)));
  const authorized = [];

  for (const socket of sockets) {
    const socketScope = socket.data.projectScope;
    const scopeMatches = socketScope &&
      String(socketScope.workspaceId) === String(scope.workspaceId) &&
      String(socketScope.projectId) === String(scope.projectId);
    if (workspace && project && scopeMatches && memberIds.has(String(socket.data.userId))) {
      authorized.push(socket);
    } else {
      socket.emit("project:access_revoked", { message: "Project access is no longer available." });
      socket.disconnect(true);
    }
  }
  return authorized;
}

async function broadcastPresence(io, scope) {
  try {
    const sockets = await authorizedSockets(io, scope);
    const users = new Map();
    sockets.forEach((socket) => {
      const profile = socket.data.userProfile;
      if (profile) users.set(String(profile.id), profile);
    });
    const event = {
      workspaceId: String(scope.workspaceId),
      projectId: String(scope.projectId),
      users: Array.from(users.values()),
    };
    sockets.forEach((socket) => socket.emit("project:presence", event));
  } catch {
    // Presence is best effort and must not interrupt REST writes or connection cleanup.
  }
}

async function emitProjectEvent(io, scope, eventName, payload) {
  if (!io || !validScope(String(scope.workspaceId), String(scope.projectId))) return;
  try {
    const sockets = await authorizedSockets(io, {
      workspaceId: String(scope.workspaceId),
      projectId: String(scope.projectId),
    });
    const event = {
      ...payload,
      workspaceId: String(scope.workspaceId),
      projectId: String(scope.projectId),
    };
    sockets.forEach((socket) => socket.emit(eventName, event));
  } catch {
    // The persisted REST response remains successful if realtime delivery is unavailable.
  }
}

function attachRealtime(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const user = await authMiddleware.authenticateToken(token);
      socket.data.userId = String(user._id);
      socket.data.tokenExpiresAt = jwt.decode(token)?.exp || null;
      socket.data.userProfile = {
        id: String(user._id),
        name: user.name,
        avatar: user.avatar || "",
      };
      next();
    } catch {
      next(new Error("Authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    // The room is derived only from the authenticated socket identity.
    socket.join(notificationRoom(socket.data.userId));
    if (socket.data.tokenExpiresAt) {
      const expiryDelay = socket.data.tokenExpiresAt * 1000 - Date.now();
      socket.data.expiryTimer = setTimeout(() => {
        socket.emit("project:access_revoked", { message: "Authentication has expired." });
        socket.disconnect(true);
      }, Math.max(1, expiryDelay));
    }
    socket.on("project:join", async (payload, callback) => {
      if (!allowRoomEvent(socket)) {
        acknowledge(callback, { ok: false, message: "Too many room requests. Try again shortly." });
        return;
      }
      if (!payload || typeof payload !== "object" || Array.isArray(payload) ||
          Object.keys(payload).some((key) => !["workspaceId", "projectId"].includes(key)) ||
          !validScope(payload.workspaceId, payload.projectId)) {
        acknowledge(callback, { ok: false, message: "A valid workspace and project are required." });
        return;
      }

      const requestVersion = (socket.data.projectRequestVersion || 0) + 1;
      socket.data.projectRequestVersion = requestVersion;

      const previousScope = socket.data.projectScope;
      if (previousScope) {
        await socket.leave(roomName(previousScope));
        socket.data.projectScope = null;
        await broadcastPresence(io, previousScope);
      }

      try {
        const workspace = await Workspace.findOne({
          _id: payload.workspaceId,
          "members.user": socket.data.userId,
        }).select("_id");
        const project = workspace && await Project.findOne({
          _id: payload.projectId,
          workspace: workspace._id,
        }).select("_id");

        if (!socket.connected || socket.data.projectRequestVersion !== requestVersion) {
          acknowledge(callback, { ok: false, message: "Project selection changed." });
          return;
        }

        if (!workspace || !project) {
          acknowledge(callback, { ok: false, message: "Project access is unavailable." });
          return;
        }

        const scope = {
          workspaceId: String(workspace._id),
          projectId: String(project._id),
        };
        socket.data.projectScope = scope;
        await socket.join(roomName(scope));
        await broadcastPresence(io, scope);
        acknowledge(callback, { ok: true, workspaceId: scope.workspaceId, projectId: scope.projectId });
      } catch {
        if (socket.data.projectScope) await socket.leave(roomName(socket.data.projectScope));
        socket.data.projectScope = null;
        acknowledge(callback, { ok: false, message: "Project access could not be verified." });
      }
    });

    socket.on("project:leave", async (payload, callback) => {
      if (typeof payload === "function") {
        callback = payload;
        payload = {};
      }
      if (!allowRoomEvent(socket)) {
        acknowledge(callback, { ok: false, message: "Too many room requests. Try again shortly." });
        return;
      }
      if (payload && (typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length > 0)) {
        acknowledge(callback, { ok: false, message: "Invalid leave request." });
        return;
      }
      socket.data.projectRequestVersion = (socket.data.projectRequestVersion || 0) + 1;
      const scope = socket.data.projectScope;
      if (scope) {
        await socket.leave(roomName(scope));
        socket.data.projectScope = null;
        await broadcastPresence(io, scope);
      }
      acknowledge(callback, { ok: true });
    });

    socket.on("disconnecting", () => {
      socket.data.disconnectScope = socket.data.projectScope;
    });
    socket.on("disconnect", () => {
      clearTimeout(socket.data.expiryTimer);
      if (socket.data.disconnectScope) {
        void broadcastPresence(io, socket.data.disconnectScope);
      }
    });
  });
}

module.exports = { attachRealtime, emitProjectEvent, notificationRoom };
