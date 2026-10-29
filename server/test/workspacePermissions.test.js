const assert = require("node:assert/strict");
const test = require("node:test");
const { canAdministerWorkspace } = require("../src/utils/workspacePermissions");

const workspace = { createdBy: "creator", members: [{ user: "creator", role: "Admin" }, { user: "admin", role: "Admin" }, { user: "member", role: "Member" }] };

test("only current Admin membership authorizes workspace and project deletion", () => {
  assert.equal(canAdministerWorkspace(workspace, "creator"), true);
  assert.equal(canAdministerWorkspace(workspace, "admin"), true);
  assert.equal(canAdministerWorkspace(workspace, "member"), false);
  assert.equal(canAdministerWorkspace({ ...workspace, members: [{ user: "creator", role: "Member" }] }, "creator"), false);
});
