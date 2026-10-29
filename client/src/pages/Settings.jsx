import { useEffect, useState } from "react";
import { Bell, Building2, Check, LogOut, Palette, Save, ShieldCheck, UserRound } from "lucide-react";
import Button from "../components/ui/Button";
import { useTheme } from "../components/ui/ThemeContext";
import { authAPI, workspaceAPI } from "../services/api";

const sections = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: ShieldCheck },
];

export default function Settings({ user, workspace, project, canManageWorkspace = false, onMemberRoleChange, onDeleteWorkspace, onDeleteProject, onUserUpdate, onLogout }) {
  const [active, setActive] = useState("profile");
  const [profile, setProfile] = useState({ name: user?.name || "", username: user?.username || "", bio: user?.bio || "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [members, setMembers] = useState([]);
  const [pendingInvitations, setPendingInvitations] = useState([]);
  const [membersState, setMembersState] = useState("loading");
  const [membersError, setMembersError] = useState("");
  const [roleBusy, setRoleBusy] = useState("");
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      if (!workspace?._id) { setMembers([]); setMembersState("empty"); return; }
      setMembersState("loading"); setMembersError("");
      try {
        const result = await workspaceAPI.getMemberManagement(workspace._id);
        if (!cancelled) { setMembers(result.members || []); setPendingInvitations(result.pendingInvitations || []); setMembersState("ready"); }
      } catch (cause) {
        if (!cancelled) { setMembersError(cause.message || "Workspace members could not be loaded."); setMembersState("error"); }
      }
    }
    loadMembers();
    return () => { cancelled = true; };
  }, [workspace?._id]);

  async function changeMemberRole(member, role) {
    const memberId = String(member.user?._id || "");
    if (!memberId || roleBusy || !onMemberRoleChange) return;
    setRoleBusy(memberId); setMembersError("");
    try {
      await onMemberRoleChange(memberId, role);
      const result = await workspaceAPI.getMemberManagement(workspace._id);
      setMembers(result.members || []); setPendingInvitations(result.pendingInvitations || []);
    } catch (cause) { setMembersError(cause.message || "Member role could not be updated."); }
    finally { setRoleBusy(""); }
  }

  async function revokeInvitation(invitationId) {
    setRoleBusy(`invite:${invitationId}`); setMembersError("");
    try {
      await workspaceAPI.revokeInvitation(workspace._id, invitationId);
      const result = await workspaceAPI.getMemberManagement(workspace._id);
      setMembers(result.members || []); setPendingInvitations(result.pendingInvitations || []);
    } catch (cause) { setMembersError(cause.message || "Invitation could not be revoked."); }
    finally { setRoleBusy(""); }
  }

  async function saveProfile(event) {
    event.preventDefault(); setBusy(true); setSaved(false); setError("");
    try {
      const result = await authAPI.updateProfile(profile);
      const updated = result.user || result.data?.user;
      if (!updated) throw new Error("The server did not return the updated profile.");
      setProfile({ name: updated.name || "", username: updated.username || "", bio: updated.bio || "" });
      onUserUpdate?.(updated); setSaved(true);
    } catch (cause) { setError(cause.message || "Profile could not be saved."); }
    finally { setBusy(false); }
  }

  const inputClass = "mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-acc";
  return <div className="mx-auto max-w-6xl">
    <div className="mb-7"><p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Account and workspace</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-sm text-muted">Manage your profile and preferences.</p></div>
    <div className="grid items-start gap-5 lg:grid-cols-[210px_minmax(0,1fr)]">
      <nav aria-label="Settings sections" className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-2 lg:block">{sections.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => { setActive(id); setError(""); setSaved(false); }} aria-current={active === id ? "page" : undefined} className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm ${active === id ? "bg-hover font-semibold" : "text-muted hover:bg-hover hover:text-text"}`}><Icon size={16}/>{label}</button>)}</nav>
      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        {active === "profile" && <form onSubmit={saveProfile} className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Profile</h2><p className="mt-1 text-sm text-muted">This information is saved to your account and shown to your team.</p><div className="my-6 flex items-center gap-3 rounded-xl border border-line bg-bg p-4"><div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-hover text-lg font-semibold">{user?.avatar ? <img src={user.avatar} alt="Profile" className="h-full w-full object-cover"/> : (profile.name || user?.email || "U").slice(0, 1).toUpperCase()}</div><div><p className="font-semibold">{profile.name || "Your name"}</p><p className="text-sm text-muted">{user?.email}</p><p className="mt-1 text-xs text-muted">Profile image upload is not available in the current upload API.</p></div></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Full name<input className={inputClass} name="name" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} minLength={2} maxLength={100} required/></label><label className="text-sm font-medium">Username<input className={inputClass} name="username" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} pattern="[a-zA-Z0-9_-]{3,25}" minLength={3} maxLength={25} required/></label><label className="text-sm font-medium sm:col-span-2">Email address<input className={`${inputClass} opacity-70`} value={user?.email || ""} readOnly aria-readonly="true"/><span className="mt-1 block text-xs font-normal text-muted">Email changes are not supported by this authentication flow.</span></label><label className="text-sm font-medium sm:col-span-2">Bio<textarea className={`${inputClass} resize-y`} rows={3} maxLength={160} value={profile.bio} onChange={(e) => setProfile({ ...profile, bio: e.target.value })}/></label></div><div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">{error ? <p role="alert" className="text-sm text-red-600">{error}</p> : saved ? <p role="status" className="flex items-center gap-1 text-sm text-acc"><Check size={15}/> Saved to your account</p> : <span/>}<Button type="submit" loading={busy} disabled={busy}><Save size={15}/> Save profile</Button></div></form>}
        {active === "workspace" && <div className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Workspace</h2><p className="mt-1 text-sm text-muted">Details for the workspace selected in the sidebar.</p><dl className="mt-6 divide-y divide-line rounded-xl border border-line">{[["Name", workspace?.name || "—"], ["Description", workspace?.description || "No description"], ["Your role", workspace?.members?.find((item) => String(item.user?._id || item.user) === String(user?._id || user?.id))?.role || "Member"], ["Selected project", project?.name || "No project selected"]].map(([label, value]) => <div key={label} className="grid gap-1 p-4 sm:grid-cols-[150px_1fr]"><dt className="text-sm text-muted">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>)}</dl><section className="mt-6 border-t border-line pt-5"><h3 className="font-semibold">Workspace members</h3><p className="mt-1 text-sm text-muted">Member access and roles for this workspace.</p>{membersState === "loading" ? <p role="status" className="mt-4 text-sm text-muted">Loading members…</p> : membersState === "error" ? <p role="alert" className="mt-4 text-sm text-red-600">{membersError}</p> : members.length ? <ul className="mt-3 divide-y divide-line rounded-lg border border-line">{members.map((member) => { const id = String(member.user?._id || ""); const label = member.user?.name || member.user?.email || "Workspace member"; return <li key={id} className="flex flex-wrap items-center justify-between gap-3 p-3"><span className="min-w-0"><span className="block truncate text-sm font-medium">{label}</span><span className="block truncate text-xs text-muted">{member.user?.email}</span></span>{canManageWorkspace ? <label className="text-xs text-muted">Role <select aria-label={`Role for ${label}`} value={member.role} disabled={roleBusy === id || id === String(user?._id || user?.id)} onChange={(event) => changeMemberRole(member, event.target.value)} className="ml-2 rounded border border-line bg-bg px-2 py-1 text-sm text-text"><option>Admin</option><option>Member</option></select></label> : <span className="rounded border border-line px-2 py-1 text-xs">{member.role}</span>}</li>; })}</ul> : <p className="mt-3 text-sm text-muted">No workspace members found.</p>}{canManageWorkspace && pendingInvitations.length > 0 && <div className="mt-5"><h4 className="text-sm font-semibold">Pending invitations</h4><ul className="mt-2 divide-y divide-line rounded-lg border border-line">{pendingInvitations.map((invite) => <li key={`${invite.email}:${invite.createdAt}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span>{invite.email}<span className="ml-2 text-xs text-muted">Expires {new Date(invite.expiresAt).toLocaleDateString()}</span></span><Button type="button" variant="secondary" disabled={roleBusy === `invite:${invite._id}`} onClick={() => revokeInvitation(invite._id)}>{roleBusy === `invite:${invite._id}` ? "Revoking…" : "Revoke"}</Button></li>)}</ul></div>}</section>{membersError && membersState !== "error" && <p role="alert" className="mt-3 text-sm text-red-600">{membersError}</p>}<p className="mt-4 text-xs text-muted">Workspace and project deletion is permanent and removes related tasks, discussions, decisions, uploads, and notifications.</p>{canManageWorkspace && <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4"><Button type="button" variant="danger" disabled={!workspace} onClick={() => { setDeleteTarget("workspace"); setDeleteConfirmation(""); setDeleteError(""); }}>Delete workspace</Button><Button type="button" variant="danger" disabled={!project} onClick={() => { setDeleteTarget("project"); setDeleteConfirmation(""); setDeleteError(""); }}>Delete project</Button></div>}{!canManageWorkspace && <p className="mt-4 text-sm text-muted">Only workspace Admins can delete this workspace or its projects.</p>}</div>}
        {active === "notifications" && <div className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Notifications</h2><p className="mt-1 text-sm text-muted">The bell menu shows notifications from workspaces and projects you can currently access. Open a notification to switch to its project; access is checked again before the item is opened.</p><div className="mt-6 rounded-xl border border-line bg-bg p-4"><div className="flex items-start gap-3"><Bell size={18} className="mt-0.5 text-acc"/><div><p className="text-sm font-medium">In-app notifications</p><p className="mt-1 text-sm text-muted">Notification preference controls are not supported by the server yet, so this page does not show settings that only change locally.</p></div></div></div></div>}
        {active === "appearance" && <div className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Appearance</h2><p className="mt-1 text-sm text-muted">Choose how DevSync looks on this device.</p><div className="mt-6 grid gap-3 sm:grid-cols-3">{[["light", "Light", "Bright surfaces"], ["dark", "Dark", "Low-light surfaces"], ["system", "System", "Follow device"]].map(([id, label, description]) => <button key={id} type="button" aria-pressed={theme === id} onClick={() => setTheme(id)} className={`rounded-xl border p-4 text-left ${theme === id ? "border-acc bg-accSoft" : "border-line bg-bg hover:bg-hover"}`}><span className="font-semibold">{label}</span><span className="mt-1 block text-xs text-muted">{description}</span></button>)}</div><p className="mt-4 text-xs text-muted">Theme preference is saved on this device and applies immediately.</p></div>}
        {active === "security" && <div className="p-5 sm:p-7"><h2 className="text-lg font-semibold">Security</h2><p className="mt-1 text-sm text-muted">Your account uses JWT authentication. Password changes and server-managed session lists are not part of the current API.</p><div className="mt-6 rounded-xl border border-line bg-bg p-4"><p className="font-medium">Signed in as</p><p className="mt-1 text-sm text-muted">{user?.email}</p><p className="mt-3 text-xs text-muted">Logging out clears this browser's saved session token.</p></div><Button type="button" variant="secondary" className="mt-4" onClick={onLogout}><LogOut size={15}/> Log out</Button></div>}
      </section>
    </div>
    {deleteTarget && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleteBusy) setDeleteTarget(null); }}><form role="alertdialog" aria-modal="true" aria-labelledby="delete-resource-title" onSubmit={async (event) => { event.preventDefault(); if (deleteBusy) return; setDeleteBusy(true); setDeleteError(""); try { if (deleteTarget === "workspace") await onDeleteWorkspace?.(deleteConfirmation); else await onDeleteProject?.(deleteConfirmation); } catch (cause) { setDeleteError(cause.message || "Deletion failed. You can retry safely."); } finally { setDeleteBusy(false); } }} className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-xl"><h2 id="delete-resource-title" className="text-lg font-semibold">Permanently delete {deleteTarget}?</h2><p className="mt-2 text-sm text-muted">{deleteTarget === "workspace" ? <>This deletes <strong>{workspace?.name}</strong> and all its projects, discussions, decisions, tasks, attachments, and notifications.</> : <>This deletes <strong>{project?.name}</strong> and its discussions, decisions, tasks, attachments, and notifications.</>} This action cannot be undone.</p><label htmlFor="delete-resource-confirm" className="mt-4 block text-sm font-medium">Type <span className="font-semibold">{deleteTarget === "workspace" ? workspace?.name : project?.name}</span> to confirm</label><input id="delete-resource-confirm" autoFocus value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className={inputClass} required/><p className="mt-2 text-xs text-muted">If cleanup fails partway through, the resource stays available for a safe retry.</p>{deleteError && <p role="alert" className="mt-3 text-sm text-red-600">{deleteError}</p>}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={deleteBusy} onClick={() => setDeleteTarget(null)}>Cancel</Button><Button type="submit" variant="danger" disabled={deleteBusy || deleteConfirmation !== (deleteTarget === "workspace" ? workspace?.name : project?.name)}>{deleteBusy ? "Deleting…" : "Delete permanently"}</Button></div></form></div>}
  </div>;
}
