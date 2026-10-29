import { io } from "socket.io-client";
import { API_ORIGIN, getToken } from "./api";
import { createRealtimeSubscriptions } from "./realtimeSubscriptions.js";

let socket = null;
let status = "disconnected";
const subscriptions = createRealtimeSubscriptions();

function publishStatus(nextStatus) {
  status = nextStatus;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("devsync:realtime-status", { detail: status }));
  }
}

function publish(eventName, payload) {
  subscriptions.publish(eventName, payload);
}

export function subscribeRealtime(eventName, handler) {
  return subscriptions.subscribe(eventName, handler);
}

export function getRealtimeStatus() {
  return status;
}

export function subscribeRealtimeStatus(handler) {
  handler(status);
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event.detail);
  window.addEventListener("devsync:realtime-status", listener);
  return () => window.removeEventListener("devsync:realtime-status", listener);
}

export function connectRealtime({ workspaceId, projectId }) {
  disconnectRealtime();
  const token = getToken();
  if (!token || !workspaceId || !projectId) return () => {};

  publishStatus("reconnecting");
  const activeSocket = io(API_ORIGIN, {
    autoConnect: false,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    timeout: 10_000,
  });
  socket = activeSocket;
  subscriptions.attach(activeSocket);
  let joinedBefore = false;
  const scope = { workspaceId: String(workspaceId), projectId: String(projectId) };

  activeSocket.on("connect", () => {
    const reconnecting = joinedBefore;
    activeSocket.emit("project:join", scope, (response) => {
      if (socket !== activeSocket) return;
      if (!response?.ok) {
        publishStatus("disconnected");
        activeSocket.disconnect();
        return;
      }
      joinedBefore = true;
      publishStatus("connected");
      publish("realtime:project-ready", scope);
      if (reconnecting) publish("realtime:resync", scope);
    });
  });

  activeSocket.on("connect_error", (error) => {
    if (socket !== activeSocket) return;
    if (error.message === "Authentication failed.") {
      publishStatus("disconnected");
      activeSocket.disconnect();
      return;
    }
    publishStatus("reconnecting");
  });

  activeSocket.on("disconnect", (reason) => {
    if (socket !== activeSocket) return;
    publishStatus(reason === "io server disconnect" || reason === "io client disconnect" ? "disconnected" : "reconnecting");
  });

  activeSocket.on("project:access_revoked", () => {
    if (socket !== activeSocket) return;
    publishStatus("disconnected");
    activeSocket.disconnect();
  });

  activeSocket.connect();
  return () => {
    if (socket === activeSocket) disconnectRealtime();
  };
}

export function disconnectRealtime() {
  if (socket) {
    const oldSocket = socket;
    socket = null;
    subscriptions.detach(oldSocket);
    oldSocket.removeAllListeners();
    oldSocket.disconnect();
  }
  publishStatus("disconnected");
}
