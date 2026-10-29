function canAdministerWorkspace(workspace, userId) {
  if (!workspace || !userId) return false;
  return workspace.members?.some((member) => String(member.user?._id || member.user) === String(userId) && member.role === "Admin") || false;
}

module.exports = { canAdministerWorkspace };
