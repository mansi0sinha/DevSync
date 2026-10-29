const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const test = require("node:test");
const Activity = require("../src/models/Activity");
const Notification = require("../src/models/Notification");
const Workspace = require("../src/models/Workspace");
const Project = require("../src/models/Project");
const { recordProjectEvent } = require("../src/services/projectEvents");

test("project events notify only eligible recipients and deduplicate repeated event deliveries", async (t) => {
  const ids = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const [actorId, recipientId, outsideId, projectId] = ids;
  const workspaceId = new mongoose.Types.ObjectId();
  const entityId = new mongoose.Types.ObjectId();
  const original = { workspaceFindOne: Workspace.findOne, projectFindOne: Project.findOne, activityExists: Activity.exists, activityCreate: Activity.create, notificationExists: Notification.exists, notificationCreate: Notification.create };
  const activityKeys = new Set();
  const notificationKeys = new Set();
  const savedNotifications = [];
  let activityCreates = 0;
  let notificationCreates = 0;
  const emitted = [];

  Workspace.findOne = () => ({ select: async () => ({ members: [{ user: actorId }, { user: recipientId }] }) });
  Project.findOne = () => ({ select: async () => ({ _id: projectId }) });
  Activity.exists = async ({ eventKey }) => activityKeys.has(eventKey);
  Activity.create = async (event) => { activityCreates += 1; activityKeys.add(event.eventKey); return event; };
  Notification.exists = async ({ eventKey }) => notificationKeys.has(eventKey);
  Notification.create = async (event) => {
    notificationCreates += 1;
    notificationKeys.add(event.eventKey);
    const notification = { ...event, _id: new mongoose.Types.ObjectId() };
    savedNotifications.push(notification);
    return notification;
  };
  t.after(() => {
    Workspace.findOne = original.workspaceFindOne; Project.findOne = original.projectFindOne;
    Activity.exists = original.activityExists; Activity.create = original.activityCreate;
    Notification.exists = original.notificationExists; Notification.create = original.notificationCreate;
  });

  const event = {
    actorId, workspaceId, projectId, action: "task.assigned", summary: "Assigned task: API",
    entityType: "task", entityId, eventKey: "assignment:event-1",
    notifications: [
      { recipient: actorId, type: "task.assigned", title: "You were assigned a task", message: "API", eventKey: "event-1" },
      { recipient: recipientId, type: "task.assigned", title: "You were assigned a task", message: "API", eventKey: "event-1" },
      { recipient: outsideId, type: "task.assigned", title: "You were assigned a task", message: "API", eventKey: "event-1" },
    ],
  };
  const io = { to: (room) => ({ emit: (name, payload) => emitted.push({ room, name, payload }) }) };

  assert.equal(await recordProjectEvent({ ...event, io }), true);
  assert.equal(await recordProjectEvent({ ...event, io }), true);
  assert.equal(activityCreates, 1);
  assert.equal(notificationCreates, 1);
  assert.equal(savedNotifications[0].recipient.toString(), recipientId.toString());
  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].name, "notification:new");
  assert.deepEqual(Object.keys(emitted[0].payload), ["notificationId"]);
});
