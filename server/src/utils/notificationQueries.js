const { notificationEntityFilter } = require("./notificationScope");
const NOTIFICATION_LIST_FIELDS = "recipient type title message workspace project entityType entityId readAt createdAt";

function buildNotificationFilters({ recipientId, workspaceIds, projectIds, resourceIds, beforeCursor }) {
  const base = {
    recipient: recipientId,
    workspace: { $in: workspaceIds },
    project: { $in: projectIds },
    ...notificationEntityFilter(resourceIds),
  };
  let list = { ...base };
  const unread = { ...base, readAt: null };
  if (beforeCursor) {
    list = { $and: [base, { $or: [
      { createdAt: { $lt: beforeCursor.createdAt } },
      { createdAt: beforeCursor.createdAt, _id: { $lt: beforeCursor._id } },
    ] }] };
  }
  return {
    list,
    unread,
    cursor: { ...base },
    markRead: (notificationId) => ({ ...base, _id: notificationId }),
  };
}

function getNextNotificationCursor(items, limit) {
  return items.length === limit ? String(items[items.length - 1]._id) : null;
}

module.exports = { buildNotificationFilters, getNextNotificationCursor, NOTIFICATION_LIST_FIELDS };
