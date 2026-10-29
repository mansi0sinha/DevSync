const { canAdministerWorkspace } = require("./workspacePermissions");

function isWorkspaceAdmin(workspace, userId) {
  return canAdministerWorkspace(workspace, userId);
}

function canChangeTaskStatus({ current, next, assigneeId, actorId, workspace, allowAdminReviewReturn = true }) {
  const isAssignee = String(assigneeId || "") === String(actorId || "");
  const isAdmin = isWorkspaceAdmin(workspace, actorId);
  if (current === "todo" && next === "in-progress" && isAssignee) return true;
  if (current === "in-progress" && next === "in-review" && isAssignee) return true;
  if (current === "in-review" && next === "in-progress" && (isAssignee || (allowAdminReviewReturn && isAdmin))) return true;
  return false;
}

function canAssignTask({ actorId, taskCreatorId, workspace }) {
  return isWorkspaceAdmin(workspace, actorId) || String(taskCreatorId || "") === String(actorId || "");
}

module.exports = { isWorkspaceAdmin, canChangeTaskStatus, canAssignTask };
