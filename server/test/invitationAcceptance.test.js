const assert = require("node:assert/strict");
const test = require("node:test");
const { acceptInvitation } = require("../src/services/invitationAcceptance");

function fixture({ failMembership = false } = {}) {
  const invitation = { _id: "invite", workspace: "workspace", tokenHash: "hash", email: "member@example.com", expiresAt: new Date("2030-01-01"), acceptedAt: null, revokedAt: null, acceptanceClaim: null, acceptanceClaimExpiresAt: null };
  const workspace = { _id: "workspace", members: [] };
  const WorkspaceInvitation = {
    async findOneAndUpdate(filter, update) {
      if (invitation.tokenHash !== filter.tokenHash || invitation.email !== filter.email || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= filter.expiresAt.$gt) return null;
      const available = invitation.acceptanceClaim === null || invitation.acceptanceClaimExpiresAt <= filter.$or[1].acceptanceClaimExpiresAt.$lte;
      if (!available) return null;
      Object.assign(invitation, update.$set);
      return { ...invitation, workspace: invitation.workspace };
    },
    async exists(filter) {
      if (filter.tokenHash !== invitation.tokenHash) return false;
      if (filter.acceptedAt?.$ne !== undefined) return Boolean(invitation.acceptedAt);
      if (filter.revokedAt?.$ne !== undefined) return Boolean(invitation.revokedAt);
      if (filter.expiresAt?.$lte) return !invitation.acceptedAt && invitation.expiresAt <= filter.expiresAt.$lte;
      return !invitation.acceptedAt && invitation.acceptanceClaimExpiresAt > filter.acceptanceClaimExpiresAt.$gt;
    },
    async updateOne(filter, update) {
      if (filter._id !== invitation._id || (filter.acceptanceClaim && filter.acceptanceClaim !== invitation.acceptanceClaim)) return { modifiedCount: 0 };
      Object.assign(invitation, update.$set); return { modifiedCount: 1 };
    },
  };
  const Workspace = {
    async findOneAndUpdate() {
      if (failMembership) throw new Error("temporary write failure");
      if (workspace.members.some((member) => member.user === "user")) return null;
      workspace.members.push({ user: "user", role: "Member" }); return workspace;
    },
    async exists() { return workspace.members.some((member) => member.user === "user"); },
    async findOne() { return workspace.members.some((member) => member.user === "user") ? workspace : null; },
  };
  return { models: { Workspace, WorkspaceInvitation }, invitation, workspace };
}

const params = { tokenHash: "hash", email: "member@example.com", userId: "user", now: new Date("2029-01-01") };

test("only one concurrent request claims and accepts an invitation", async () => {
  const state = fixture();
  const [first, second] = await Promise.all([
    acceptInvitation(state.models, params), acceptInvitation(state.models, params),
  ]);
  assert.equal([first, second].filter((item) => item.status === "accepted").length, 1);
  assert.notEqual([first, second].find((item) => item.status !== "accepted").status, "accepted");
  assert.equal(state.workspace.members.length, 1);
  assert.equal(state.invitation.acceptedBy, "user");
});

test("repeated acceptance is rejected and membership is not duplicated", async () => {
  const state = fixture();
  assert.equal((await acceptInvitation(state.models, params)).status, "accepted");
  assert.equal((await acceptInvitation(state.models, params)).status, "used");
  assert.equal(state.workspace.members.length, 1);
});

test("expired and email-mismatched invitations are rejected", async () => {
  const expired = fixture();
  assert.equal((await acceptInvitation(expired.models, { ...params, now: new Date("2031-01-01") })).status, "expired");
  const mismatch = fixture();
  assert.equal((await acceptInvitation(mismatch.models, { ...params, email: "other@example.com" })).status, "invalid");
});

test("revoked invitations cannot be claimed", async () => {
  const state = fixture();
  state.invitation.revokedAt = new Date("2028-01-01");
  assert.equal((await acceptInvitation(state.models, params)).status, "revoked");
  assert.equal(state.workspace.members.length, 0);
});

test("failed membership write releases the claim so a retry can succeed", async () => {
  const state = fixture({ failMembership: true });
  await assert.rejects(acceptInvitation(state.models, params), /temporary write failure/);
  assert.equal(state.invitation.acceptanceClaim, null);
  state.models.Workspace.findOneAndUpdate = async () => {
    state.workspace.members.push({ user: "user", role: "Member" }); return state.workspace;
  };
  assert.equal((await acceptInvitation(state.models, params)).status, "accepted");
  assert.equal(state.workspace.members.length, 1);
});
