const mongoose = require("mongoose");
const Activity = require("../models/Activity");
const Notification = require("../models/Notification");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const { notificationRoom } = require("../realtime");

async function recordProjectEvent({ io, actorId = null, systemEvent = false, workspaceId, projectId, action, summary, entityType, entityId, eventKey, notifications = [] }) {
  try {
    if ((!systemEvent && !mongoose.isObjectIdOrHexString(actorId)) || (systemEvent && actorId) || !mongoose.isObjectIdOrHexString(workspaceId) ||
        !mongoose.isObjectIdOrHexString(projectId) || !mongoose.isObjectIdOrHexString(entityId)) return false;
    const workspaceQuery = systemEvent ? { _id: workspaceId } : { _id: workspaceId, "members.user": actorId };
    const workspace = await Workspace.findOne(workspaceQuery).select("members.user");
    const project = workspace && await Project.findOne({ _id: projectId, workspace: workspaceId }).select("_id");
    if (!workspace || !project) return false;

    const activityKey = `${workspaceId}:${projectId}:${eventKey || `${action}:${entityId}:${Date.now()}`}`;
    if (!(await Activity.exists({ eventKey: activityKey }))) {
      try {
        await Activity.create({ actor: actorId || null, actorType: systemEvent ? "system" : "user", workspace: workspaceId, project: projectId, action, summary, entityType, entityId, eventKey: activityKey });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    const memberIds = new Set(workspace.members.map((member) => String(member.user)));
    for (const item of notifications) {
      const recipientId = String(item.recipient || "");
      if (!mongoose.isObjectIdOrHexString(recipientId) || (!systemEvent && recipientId === String(actorId)) || !memberIds.has(recipientId)) continue;
      try {
        const notificationEventKey = `${item.type}:${entityId}:${item.eventKey || activityKey}`;
        if (await Notification.exists({ recipient: recipientId, eventKey: notificationEventKey })) continue;
        const notification = await Notification.create({
          recipient: recipientId, actor: actorId || null, type: item.type, title: item.title, message: item.message,
          workspace: workspaceId, project: projectId, entityType, entityId,
          eventKey: notificationEventKey,
        });
        // Send only a wake-up identifier over sockets. The authenticated list
        // route rechecks current membership and resource existence before
        // returning any notification content.
        io?.to(notificationRoom(recipientId)).emit("notification:new", { notificationId: String(notification._id) });
      } catch (error) {
        if (error.code !== 11000) throw error;
      }
    }
    return true;
  } catch (error) {
    // Activity and notifications are best effort after the primary write succeeds.
    console.error("Project event persistence failed.", { action: typeof action === "string" ? action : "unknown", code: error?.code || "unknown", name: error?.name || "Error" });
    return false;
  }
}

module.exports = { recordProjectEvent };
