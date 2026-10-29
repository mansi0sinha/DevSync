const assert = require("node:assert/strict");
const test = require("node:test");
const { canAssignTask, canChangeTaskStatus, isWorkspaceAdmin } = require("../src/utils/taskWorkflow");

const workspace = { createdBy: "owner", members: [{ user: "owner", role: "Admin" }, { user: "admin", role: "Admin" }, { user: "member", role: "Member" }] };

test("workspace creator receives existing Admin permissions and admins have scoped access", () => {
  assert.equal(isWorkspaceAdmin(workspace, "owner"), true);
  assert.equal(isWorkspaceAdmin(workspace, "admin"), true);
  assert.equal(isWorkspaceAdmin(workspace, "member"), false);
});

test("a creator who was demoted to Member no longer has Admin permissions", () => {
  const demoted = { createdBy: "owner", members: [{ user: "owner", role: "Member" }, { user: "admin", role: "Admin" }] };
  assert.equal(isWorkspaceAdmin(demoted, "owner"), false);
  assert.equal(isWorkspaceAdmin(demoted, "admin"), true);
});

test("task lifecycle permits assignee start, review, and requested-change return only", () => {
  const can = (current, next, actor = "assignee") => canChangeTaskStatus({ current, next, assigneeId: "assignee", actorId: actor, workspace });
  assert.equal(can("todo", "in-progress"), true);
  assert.equal(can("in-progress", "in-review"), true);
  assert.equal(can("in-review", "in-progress"), true);
  assert.equal(can("in-review", "done"), false);
  assert.equal(can("todo", "done"), false);
  assert.equal(can("todo", "in-progress", "member"), false);
  assert.equal(can("in-review", "in-progress", "admin"), true);
});

test("only task creators and workspace admins may assign or reassign", () => {
  assert.equal(canAssignTask({ actorId: "creator", taskCreatorId: "creator", workspace }), true);
  assert.equal(canAssignTask({ actorId: "admin", taskCreatorId: "creator", workspace }), true);
  assert.equal(canAssignTask({ actorId: "member", taskCreatorId: "creator", workspace }), false);
});
