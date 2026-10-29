import assert from "node:assert/strict";
import test from "node:test";
import { getNotificationDestination } from "./notificationNavigation.js";

test("notification destinations carry workspace, project, and entity identity to the right page", () => {
  assert.deepEqual(getNotificationDestination({ entityType: "task", entityId: "t1", workspace: "w1", project: "p1" }), { page: "board", storageKey: "devsync_task_focus", workspaceId: "w1", projectId: "p1", entityId: "t1" });
  assert.equal(getNotificationDestination({ entityType: "decision", entityId: "d1", workspace: "w1", project: "p1" }).page, "decisions");
  assert.equal(getNotificationDestination({ entityType: "discussion", entityId: "d1", workspace: "w1", project: "p1" }).page, "discussion");
});

test("notification destinations reject missing or unsupported resource identity", () => {
  assert.equal(getNotificationDestination({ entityType: "task", entityId: "t1", workspace: "w1" }), null);
  assert.equal(getNotificationDestination({ entityType: "unknown", entityId: "x", workspace: "w1", project: "p1" }), null);
});
