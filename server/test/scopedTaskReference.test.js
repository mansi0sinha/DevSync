const assert = require("node:assert/strict");
const test = require("node:test");
const mongoose = require("mongoose");
const { clearCrossScopeTask, taskMatchesParentScope } = require("../src/utils/scopedTaskReference");

const workspaceA = "64a000000000000000000001";
const workspaceB = "64b000000000000000000001";
const projectA = "64a000000000000000000002";
const projectB = "64b000000000000000000002";

test("same-scope populated task references remain available", () => {
  const parent = { workspace: workspaceA, project: projectA, linkedTask: { _id: "task-a", workspace: workspaceA, project: projectA, title: "Allowed" } };
  assert.equal(taskMatchesParentScope(parent.linkedTask, parent), true);
  assert.equal(clearCrossScopeTask(parent), parent);
  assert.equal(parent.linkedTask.title, "Allowed");
});

test("discussion and decision references to another project or workspace are cleared", () => {
  const cases = [
    { workspace: workspaceB, project: projectA, title: "Other workspace" },
    { workspace: workspaceA, project: projectB, title: "Other project" },
  ];
  for (const task of cases) {
    const discussion = { workspace: workspaceA, project: projectA, linkedTask: task };
    clearCrossScopeTask(discussion);
    assert.equal(discussion.linkedTask, null);

    const decision = { workspace: workspaceA, projectRef: { _id: projectA }, linkedTask: task };
    clearCrossScopeTask(decision, { workspaceField: "workspace", projectField: "projectRef" });
    assert.equal(decision.linkedTask, null);
  }
});

test("missing or malformed populated task scope is not exposed", () => {
  const parent = { workspace: workspaceA, project: projectA, linkedTask: { _id: "legacy-task", title: "Unscoped" } };
  clearCrossScopeTask(parent);
  assert.equal(parent.linkedTask, null);
  assert.equal(taskMatchesParentScope(null, parent), false);
});

test("MongoDB ObjectId references compare without exposing mismatched tasks", () => {
  const workspace = new mongoose.Types.ObjectId(workspaceA);
  const project = new mongoose.Types.ObjectId(projectA);
  const task = { workspace, project, title: "Allowed" };
  assert.equal(taskMatchesParentScope(task, { workspace, project }), true);

  const mismatch = { workspace: new mongoose.Types.ObjectId(workspaceB), project, title: "Private" };
  const parent = { workspace, project, linkedTask: mismatch };
  clearCrossScopeTask(parent);
  assert.equal(parent.linkedTask, null);
});
