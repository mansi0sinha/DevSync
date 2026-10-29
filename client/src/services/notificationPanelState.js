const fallbackTitles = {
  "task.assigned": "Task assigned",
  "task.unassigned": "Task assignment changed",
  "task.status_changed": "Task status changed",
  "task.completed": "Task completed",
  "task.comment": "New task comment",
  "discussion.message": "New discussion message",
  "decision.recorded": "Decision recorded",
  "decision.superseded": "Decision superseded",
};

export function getNotificationPanelState({ loading, error, items }) {
  if (loading && items.length === 0) return "loading";
  if (error && items.length === 0) return "error";
  return items.length ? "ready" : "empty";
}

export function mergeNotificationPage(current, incoming, append) {
  if (!append) return incoming;
  const seen = new Set(current.map((item) => String(item._id)));
  return [...current, ...incoming.filter((item) => !seen.has(String(item._id)))];
}

export function getNotificationDisplay(item) {
  const title = typeof item?.title === "string" && item.title.trim()
    ? item.title.trim()
    : fallbackTitles[item?.type] || "Workspace notification";
  const message = typeof item?.message === "string" && item.message.trim()
    ? item.message.trim()
    : "Open the related item for details.";
  const timestamp = new Date(item?.createdAt);
  return { title, message, timestamp: Number.isNaN(timestamp.getTime()) ? "Time unavailable" : timestamp.toLocaleString() };
}
