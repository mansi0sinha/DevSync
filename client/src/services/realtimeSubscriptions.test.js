import assert from "node:assert/strict";
import test from "node:test";
import { createRealtimeSubscriptions } from "./realtimeSubscriptions.js";

function fakeSocket() {
  const handlers = new Map();
  return {
    handlers,
    on(name, callback) { if (!handlers.has(name)) handlers.set(name, new Set()); handlers.get(name).add(callback); },
    off(name, callback) { handlers.get(name)?.delete(callback); },
    emit(name, value) { for (const callback of handlers.get(name) || []) callback(value); },
  };
}

test("realtime resubscription detaches old handlers and cleanup removes notification listeners", () => {
  const registry = createRealtimeSubscriptions();
  const values = [];
  const unsubscribe = registry.subscribe("notification:new", (payload) => values.push(payload.notificationId));
  const first = fakeSocket();
  registry.attach(first);
  first.emit("notification:new", { notificationId: "one" });
  const second = fakeSocket();
  registry.attach(second);
  first.emit("notification:new", { notificationId: "stale" });
  second.emit("notification:new", { notificationId: "two" });
  unsubscribe();
  second.emit("notification:new", { notificationId: "after-cleanup" });
  assert.deepEqual(values, ["one", "two"]);
  assert.equal(second.handlers.get("notification:new").size, 0);
});
