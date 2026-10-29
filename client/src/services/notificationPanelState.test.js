import assert from "node:assert/strict";
import test from "node:test";
import { getNotificationDisplay, getNotificationPanelState, mergeNotificationPage } from "./notificationPanelState.js";

test("notification panel distinguishes loading, errors, empty, and populated data", () => {
  assert.equal(getNotificationPanelState({ loading: true, error: "", items: [] }), "loading");
  assert.equal(getNotificationPanelState({ loading: false, error: "offline", items: [] }), "error");
  assert.equal(getNotificationPanelState({ loading: false, error: "", items: [] }), "empty");
  assert.equal(getNotificationPanelState({ loading: false, error: "", items: [{ _id: "n1" }] }), "ready");
});

test("older notification pages append without duplicating existing rows", () => {
  const current = [{ _id: "n1" }, { _id: "n2" }];
  assert.deepEqual(mergeNotificationPage(current, [{ _id: "n2" }, { _id: "n3" }], true), [{ _id: "n1" }, { _id: "n2" }, { _id: "n3" }]);
  assert.deepEqual(mergeNotificationPage(current, [{ _id: "fresh" }], false), [{ _id: "fresh" }]);
});

test("notification content has readable fallbacks and safe timestamps", () => {
  assert.deepEqual(getNotificationDisplay({ type: "task.assigned", title: " ", message: "   ", createdAt: "invalid" }), {
    title: "Task assigned", message: "Open the related item for details.", timestamp: "Time unavailable",
  });
  assert.equal(getNotificationDisplay({ title: "Actual title", message: "Actual message", createdAt: "2026-01-01T00:00:00Z" }).title, "Actual title");
});
