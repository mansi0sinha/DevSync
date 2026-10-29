import assert from "node:assert/strict";
import test from "node:test";
import { getActivityState, getDecisionCount } from "./dashboardData.js";

test("decision count reads the scoped API array and returns zero for a real empty response", () => {
  assert.equal(getDecisionCount([{ _id: "d1" }, { _id: "d2" }]), 2);
  assert.equal(getDecisionCount({ data: [] }), 0);
  assert.equal(getDecisionCount({}), 0);
});

test("recent activity separates loading, errors, empty results, and populated results", () => {
  assert.equal(getActivityState({ loading: true, error: "", items: [] }), "loading");
  assert.equal(getActivityState({ loading: false, error: "Unavailable", items: [] }), "error");
  assert.equal(getActivityState({ loading: false, error: "", items: [] }), "empty");
  assert.equal(getActivityState({ loading: false, error: "", items: [{ _id: "a1" }] }), "ready");
});
