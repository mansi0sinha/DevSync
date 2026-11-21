import { useState } from "react";
import { ArrowRight, Building2, Check, Link2, Mail, X } from "lucide-react";
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
  const displayName = user?.name || user?.email || "there";
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

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
    <main className="workspace-onboarding">
      <div className="workspace-decoration workspace-decoration-top" aria-hidden="true" />
      <div className="workspace-decoration workspace-decoration-bottom" aria-hidden="true" />
      <header className="workspace-topbar">
        <div className="workspace-wordmark" aria-label="DevSync">
          <img className="public-mark-light" src="/devsync-mark-light.svg" alt="" />
          <img className="public-mark-dark" src="/devsync-mark-dark.svg" alt="" />
          <span>DevSync</span>
        </div>
        <div className="workspace-account">
          <span className="workspace-avatar" aria-hidden="true">{initial}</span>
          <span className="workspace-signed-in">Signed in as {displayName}</span>
          <button type="button" onClick={onLogout} className="workspace-logout">Log out</button>
          <ThemeToggle className="workspace-theme-toggle" />
        </div>
      </header>

      <section className="workspace-onboarding-content">
        <p className="workspace-step"><span className="workspace-step-light">STEP 1 OF 2 · WORKSPACE</span><span className="workspace-step-dark">Step 1 of 2</span></p>
        <h1>Welcome, {displayName}. Let&apos;s set up your workspace</h1>
        <p className="workspace-intro">Create a workspace for your team, or join one with an invitation token.</p>

        <div className="workspace-choice-grid">
          <article className={`workspace-choice workspace-choice-primary ${mode === "create" ? "is-selected" : ""} ${mode === "join" ? "is-inactive" : ""}`}>
            {mode === "create" ? (
              <form onSubmit={submit} className="workspace-create-form">
                <div className="workspace-create-heading">
                  <span className="workspace-choice-icon workspace-create-icon"><Building2 size={24} aria-hidden="true" /></span>
                  <span><strong>Create Workspace</strong><small>Set up a new team space</small></span>
                </div>
                <div>
                  <label htmlFor="onboarding-workspace-name">Workspace name</label>
                  <input id="onboarding-workspace-name" className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required autoFocus />
                </div>
                <div>
                  <label htmlFor="onboarding-workspace-description">Description <span>(optional)</span></label>
                  <textarea id="onboarding-workspace-description" className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} rows={2} />
                </div>
                <ErrorMessage>{error}</ErrorMessage>
                <Button type="submit" loading={busy} disabled={busy} className="workspace-submit-button">Create workspace <ArrowRight size={16} /></Button>
              </form>
            ) : (
              <button type="button" aria-pressed={false} onClick={() => { setMode("create"); setError(""); }} className="workspace-create-select">
                <span className="workspace-choice-icon workspace-create-icon"><Building2 size={26} aria-hidden="true" /></span>
                <span className="workspace-choice-title">Create Workspace</span>
                <span className="workspace-choice-description">Start a new team space. You will be its Admin.</span>
                <span className="workspace-check-row"><Check size={17} aria-hidden="true" />Invite teammates</span>
                <span className="workspace-check-row"><Check size={17} aria-hidden="true" />Create projects and tasks</span>
                <span className="workspace-card-cta">Create workspace <ArrowRight size={17} aria-hidden="true" /></span>
              </button>
            )}
          </article>

          <article className={`workspace-choice workspace-choice-secondary ${mode === "join" ? "is-selected" : ""}`}>
            <button type="button" aria-pressed={mode === "join"} onClick={() => { setMode("join"); setError(""); }} className="workspace-join-select">
              <span className="workspace-choice-icon workspace-join-icon"><Link2 size={25} aria-hidden="true" /></span>
              <span className="workspace-choice-title">Join Workspace</span>
              <span className="workspace-choice-description">Accept a valid invitation addressed to your account.</span>
            </button>
            {mode === "join" ? (
              <form onSubmit={submit} className="workspace-join-form">
                <input aria-label="Invitation token" id="workspace-invitation-token" className="workspace-token-input" placeholder="Paste invitation token" value={token} onChange={(event) => setToken(event.target.value)} minLength={32} maxLength={200} autoComplete="off" required autoFocus />
                <button type="submit" className="workspace-join-button" disabled={busy}>{busy ? "Joining…" : "Join"}</button>
                <ErrorMessage>{error}</ErrorMessage>
              </form>
            ) : (
              <button type="button" onClick={() => { setMode("join"); setError(""); }} className="workspace-join-prompt">Enter invitation token <ArrowRight size={16} aria-hidden="true" /></button>
            )}
          </article>
        </div>

        <p className="workspace-footnote">Not sure? You can create or join more workspaces anytime.</p>
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
