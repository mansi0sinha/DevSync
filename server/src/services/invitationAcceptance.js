const crypto = require("crypto");

const CLAIM_MS = 60_000;

async function acceptInvitation({ Workspace, WorkspaceInvitation }, { tokenHash, email, userId, now = new Date() }) {
  const claim = crypto.randomBytes(24).toString("hex");
  const invitation = await WorkspaceInvitation.findOneAndUpdate({
    tokenHash,
    email,
    acceptedAt: null,
    revokedAt: null,
    expiresAt: { $gt: now },
    $or: [
      { acceptanceClaim: null },
      { acceptanceClaimExpiresAt: { $lte: now } },
    ],
  }, {
    $set: { acceptanceClaim: claim, acceptanceClaimExpiresAt: new Date(now.getTime() + CLAIM_MS) },
  }, { returnDocument: "after" });

  if (!invitation) {
    const used = await WorkspaceInvitation.exists({ tokenHash, acceptedAt: { $ne: null } });
    const revoked = await WorkspaceInvitation.exists({ tokenHash, revokedAt: { $ne: null } });
    const expired = await WorkspaceInvitation.exists({ tokenHash, acceptedAt: null, expiresAt: { $lte: now } });
    const claimed = await WorkspaceInvitation.exists({ tokenHash, acceptedAt: null, expiresAt: { $gt: now }, acceptanceClaimExpiresAt: { $gt: now } });
    return { status: used ? "used" : revoked ? "revoked" : expired ? "expired" : claimed ? "claimed" : "invalid" };
  }

  try {
    const workspace = await Workspace.findOneAndUpdate({
      _id: invitation.workspace,
      members: { $not: { $elemMatch: { user: userId } } },
    }, { $push: { members: { user: userId, role: "Member" } } }, {
      returnDocument: "after", runValidators: true,
    });
    const existingWorkspace = !workspace && await Workspace.findOne({ _id: invitation.workspace, "members.user": userId });
    const alreadyMember = Boolean(existingWorkspace);
    if (!workspace && !alreadyMember) {
      await WorkspaceInvitation.updateOne({ _id: invitation._id, acceptanceClaim: claim }, { $set: { acceptanceClaim: null, acceptanceClaimExpiresAt: null } });
      return { status: "workspace-missing" };
    }

    const finalized = await WorkspaceInvitation.updateOne({
      _id: invitation._id, acceptanceClaim: claim, acceptedAt: null, revokedAt: null, expiresAt: { $gt: now },
    }, { $set: { acceptedAt: now, acceptedBy: userId, acceptanceClaim: null, acceptanceClaimExpiresAt: null } });
    if (!finalized.modifiedCount) throw new Error("Invitation acceptance claim was lost before finalization.");
    return { status: alreadyMember ? "already-member" : "accepted", workspace: workspace || existingWorkspace };
  } catch (error) {
    // Membership writes are atomic and idempotent. Releasing this lease lets a
    // retry observe an existing membership and safely finish the invitation.
    await WorkspaceInvitation.updateOne({ _id: invitation._id, acceptanceClaim: claim, acceptedAt: null }, {
      $set: { acceptanceClaim: null, acceptanceClaimExpiresAt: null },
    }).catch(() => {});
    throw error;
  }
}

module.exports = { acceptInvitation, CLAIM_MS };
