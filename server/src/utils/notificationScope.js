function notificationEntityFilter(ids) {
  const branches = [];
  for (const entityType of ["task", "discussion", "decision"]) {
    for (const scope of ids.scopes?.[entityType] || []) {
      branches.push({ entityType, workspace: scope.workspace, project: scope.project, entityId: { $in: scope.ids } });
    }
  }
  return { $or: branches };
}

function canReadNotification(notification, { recipientId, workspaceIds, projectIds, resourceIds }) {
  return String(notification.recipient) === String(recipientId) &&
    workspaceIds.some((id) => String(id) === String(notification.workspace)) &&
    projectIds.some((id) => String(id) === String(notification.project)) &&
    (resourceIds.scopes?.[notification.entityType] || []).some((scope) =>
      String(scope.workspace) === String(notification.workspace) &&
      String(scope.project) === String(notification.project) &&
      scope.ids.some((id) => String(id) === String(notification.entityId))
    );
}

module.exports = { notificationEntityFilter, canReadNotification };
