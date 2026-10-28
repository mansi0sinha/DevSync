import { useState } from "react";
import { ArrowRight, Building2, Link2, Mail, X } from "lucide-react";
import Button from "../ui/Button";
import ThemeToggle from "../ui/ThemeToggle";

const fieldClass = "w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc";

function ErrorMessage({ children }) {
  if (!children) return null;
  return <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{children}</div>;
}

export function WorkspaceOnboarding({ user, onCreateWorkspace, onJoinWorkspace, onLogout }) {
  const [mode, setMode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "create") await onCreateWorkspace({ name: name.trim(), description: description.trim() });
      else await onJoinWorkspace(token.trim());
    } catch (failure) {
      setError(failure.message || "Could not complete this workspace action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-bg px-5 py-10 text-text">
      <ThemeToggle className="absolute right-4 top-4" />
      <section className="w-full max-w-3xl rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-9">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Signed in as {user?.name || user?.email}</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">Set up your workspace</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted">Create a workspace for your team or join one using an invitation token from its administrator.</p>
          </div>
          <button type="button" onClick={onLogout} className="rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-hover hover:text-text">Log out</button>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2">
          <button type="button" onClick={() => { setMode("create"); setError(""); }} className={`rounded-xl border p-5 text-left transition-colors ${mode === "create" ? "border-acc bg-accSoft" : "border-line bg-bg hover:bg-hover"}`}>
            <Building2 size={20} className="text-acc" />
            <h2 className="mt-3 font-semibold">Create Workspace</h2>
            <p className="mt-1 text-sm text-muted">Start a new team space. You will be its Admin.</p>
          </button>
          <button type="button" onClick={() => { setMode("join"); setError(""); }} className={`rounded-xl border p-5 text-left transition-colors ${mode === "join" ? "border-acc bg-accSoft" : "border-line bg-bg hover:bg-hover"}`}>
            <Link2 size={20} className="text-acc" />
            <h2 className="mt-3 font-semibold">Join Workspace</h2>
            <p className="mt-1 text-sm text-muted">Accept a valid invitation addressed to your account.</p>
          </button>
        </div>

        {mode && (
          <form onSubmit={submit} className="mt-5 space-y-4 rounded-xl border border-line bg-bg p-5">
            {mode === "create" ? (
              <>
                <div>
                  <label htmlFor="onboarding-workspace-name" className="mb-1.5 block text-sm font-medium">Workspace name</label>
                  <input id="onboarding-workspace-name" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required autoFocus />
                </div>
                <div>
                  <label htmlFor="onboarding-workspace-description" className="mb-1.5 block text-sm font-medium">Description <span className="font-normal text-muted">(optional)</span></label>
                  <textarea id="onboarding-workspace-description" className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={3} />
                </div>
              </>
            ) : (
              <div>
                <label htmlFor="workspace-invitation-token" className="mb-1.5 block text-sm font-medium">Invitation token</label>
                <input id="workspace-invitation-token" className={fieldClass} value={token} onChange={(event) => setToken(event.target.value)} minLength={32} maxLength={200} autoComplete="off" required autoFocus />
              </div>
            )}
            <ErrorMessage>{error}</ErrorMessage>
            <Button type="submit" loading={busy} disabled={busy}>
              {mode === "create" ? "Create workspace" : "Join workspace"} <ArrowRight size={15} />
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}

export function WorkspaceDialog({ type, workspace, onClose, onCreateWorkspace, onCreateProject, onJoinWorkspace, onInviteMember }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [invitationToken, setInvitationToken] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = {
    createWorkspace: "Create a workspace",
    createProject: `Create a project in ${workspace?.name || "this workspace"}`,
    join: "Join a workspace",
    invite: `Invite a member to ${workspace?.name || "this workspace"}`,
  }[type];

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (type === "createWorkspace") await onCreateWorkspace({ name: name.trim(), description: description.trim() });
      if (type === "createProject") await onCreateProject({ name: name.trim(), description: description.trim() });
      if (type === "join") await onJoinWorkspace(tokenInput.trim());
      if (type === "invite") {
        const result = await onInviteMember(email.trim());
        setInvitationToken(result.token);
        setExpiresAt(result.expiresAt);
        return;
      }
      onClose();
    } catch (failure) {
      setError(failure.message || "Could not complete this action.");
    } finally {
      setBusy(false);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(invitationToken);
      setCopied(true);
    } catch {
      setError("Clipboard access is unavailable. Select and copy the invitation token below.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="workspace-dialog-title" className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="workspace-dialog-title" className="text-lg font-semibold">{title}</h2>
            {type === "invite" && <p className="mt-1 text-sm text-muted">The invitation is valid for seven days and only the matching account can accept it.</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close dialog" className="rounded-md p-2 text-muted hover:bg-hover hover:text-text"><X size={18} /></button>
        </div>

        {invitationToken ? (
          <div className="space-y-4">
            <div role="status" className="rounded-lg border border-acc/30 bg-accSoft p-3 text-sm">Invitation created. Share this token with {email} before {new Date(expiresAt).toLocaleString()}.</div>
            <label className="block text-sm font-medium" htmlFor="generated-invitation-token">Invitation token</label>
            <input id="generated-invitation-token" className={fieldClass} value={invitationToken} readOnly onFocus={(event) => event.target.select()} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={copyToken}>{copied ? "Copied" : "Copy token"}</Button>
              <Button type="button" onClick={onClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {(type === "createWorkspace" || type === "createProject") && (
              <>
                <div>
                  <label htmlFor="workspace-dialog-name" className="mb-1.5 block text-sm font-medium">{type === "createWorkspace" ? "Workspace name" : "Project name"}</label>
                  <input id="workspace-dialog-name" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={type === "createWorkspace" ? 80 : 100} required autoFocus />
                </div>
                <div>
                  <label htmlFor="workspace-dialog-description" className="mb-1.5 block text-sm font-medium">Description <span className="font-normal text-muted">(optional)</span></label>
                  <textarea id="workspace-dialog-description" className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={type === "createWorkspace" ? 500 : 1000} rows={3} />
                </div>
              </>
            )}
            {type === "join" && (
              <div>
                <label htmlFor="workspace-dialog-token" className="mb-1.5 block text-sm font-medium">Invitation token</label>
                <input id="workspace-dialog-token" className={fieldClass} value={tokenInput} onChange={(event) => setTokenInput(event.target.value)} minLength={32} maxLength={200} autoComplete="off" required autoFocus />
              </div>
            )}
            {type === "invite" && (
              <div>
                <label htmlFor="workspace-dialog-email" className="mb-1.5 block text-sm font-medium">Invitee email</label>
                <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-3">
                  <Mail size={16} className="text-muted" />
                  <input id="workspace-dialog-email" type="email" className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required autoFocus />
                </div>
              </div>
            )}
            <ErrorMessage>{error}</ErrorMessage>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
              <Button type="submit" loading={busy} disabled={busy}>{type === "invite" ? "Create invitation" : type === "join" ? "Join workspace" : type === "createProject" ? "Create project" : "Create workspace"}</Button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
