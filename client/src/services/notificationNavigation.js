const DESTINATIONS = {
  task: { page: "board", storageKey: "devsync_task_focus" },
  decision: { page: "decisions", storageKey: "devsync_decision_focus" },
  discussion: { page: "discussion", storageKey: "devsync_discussion_focus" },
};

export function getNotificationDestination(item) {
  const destination = DESTINATIONS[item?.entityType];
  if (!destination || !item?.entityId || !item?.workspace || !item?.project) return null;
  return { ...destination, workspaceId: String(item.workspace), projectId: String(item.project), entityId: String(item.entityId) };
}
