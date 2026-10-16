import { useState } from "react";
import {
  UserRound,
  Building2,
  Bell,
  ShieldCheck,
  Palette,
  Save,
  Check,
} from "lucide-react";
import Button from "../components/ui/Button";

const settingsSections = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: ShieldCheck },
];

function Settings() {
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);

  const [profile, setProfile] = useState({
    name: "Your Name",
    username: "developer",
    email: "you@example.com",
    bio: "Building software and solving problems.",
  });

  const [workspace, setWorkspace] = useState({
    name: "My Workspace",
    description: "A space for engineering collaboration.",
  });

  const [notifications, setNotifications] = useState({
    discussions: true,
    taskUpdates: true,
    decisions: true,
    weeklySummary: false,
  });

  function updateProfile(event) {
    const { name, value } = event.target;
    setProfile((current) => ({ ...current, [name]: value }));
    setSaved(false);
  }

  function updateWorkspace(event) {
    const { name, value } = event.target;
    setWorkspace((current) => ({ ...current, [name]: value }));
    setSaved(false);
  }

  function toggleNotification(key) {
    setNotifications((current) => ({
      ...current,
      [key]: !current[key],
    }));
    setSaved(false);
  }

  function handleSave(event) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2500);
  }

  const fieldClass =
    "mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc";

  function renderSection() {
    switch (activeSection) {
      case "profile":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">Profile</h2>
              <p className="mt-1 text-sm text-muted">
                Manage the personal information shown to your team.
              </p>
            </div>

            <div className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-bg p-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-hover text-lg font-semibold text-text">
                {profile.name.trim().charAt(0).toUpperCase() || "U"}
              </div>
              <div>
                <p className="font-semibold text-text">{profile.name || "Your Name"}</p>
                <p className="mt-1 text-sm text-muted">@{profile.username || "username"}</p>
                <p className="mt-1 text-xs text-muted">Profile preview</p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-text">
                Full name
                <input
                  name="name"
                  value={profile.name}
                  onChange={updateProfile}
                  className={fieldClass}
                  placeholder="Enter your name"
                />
              </label>

              <label className="text-sm font-medium text-text">
                Username
                <input
                  name="username"
                  value={profile.username}
                  onChange={updateProfile}
                  className={fieldClass}
                  placeholder="Choose a username"
                />
              </label>

              <label className="text-sm font-medium text-text sm:col-span-2">
                Email address
                <input
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={updateProfile}
                  className={fieldClass}
                  placeholder="you@example.com"
                />
              </label>

              <label className="text-sm font-medium text-text sm:col-span-2">
                Short bio
                <textarea
                  name="bio"
                  value={profile.bio}
                  onChange={updateProfile}
                  rows={3}
                  maxLength={160}
                  className={`${fieldClass} resize-y`}
                  placeholder="Tell your team a little about yourself"
                />
                <span className="mt-1 block text-right text-xs font-normal text-muted">
                  {profile.bio.length}/160
                </span>
              </label>
            </div>
          </>
        );

      case "workspace":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">Workspace</h2>
              <p className="mt-1 text-sm text-muted">
                Configure the shared space where your team works.
              </p>
            </div>

            <div className="space-y-5">
              <label className="block text-sm font-medium text-text">
                Workspace name
                <input
                  name="name"
                  value={workspace.name}
                  onChange={updateWorkspace}
                  className={fieldClass}
                  placeholder="My Workspace"
                />
              </label>

              <label className="block text-sm font-medium text-text">
                Description
                <textarea
                  name="description"
                  value={workspace.description}
                  onChange={updateWorkspace}
                  rows={3}
                  className={`${fieldClass} resize-y`}
                  placeholder="What is this workspace for?"
                />
              </label>

              <div className="rounded-lg border border-line bg-bg p-4">
                <p className="text-sm font-semibold text-text">Workspace plan</p>
                <p className="mt-1 text-sm text-muted">
                  Free plan · Local demo
                </p>
                <p className="mt-3 text-xs leading-5 text-muted">
                  Workspace details are currently stored in this page's state.
                  Persistent team settings will require a backend.
                </p>
              </div>
            </div>
          </>
        );

      case "notifications":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">Notifications</h2>
              <p className="mt-1 text-sm text-muted">
                Choose which workspace updates you want to receive.
              </p>
            </div>

            <div className="divide-y divide-line">
              {[
                {
                  key: "discussions",
                  title: "Discussion messages",
                  description: "When someone posts in a team discussion.",
                },
                {
                  key: "taskUpdates",
                  title: "Task updates",
                  description: "When tasks are created or their status changes.",
                },
                {
                  key: "decisions",
                  title: "Decision updates",
                  description: "When a team decision is recorded or updated.",
                },
                {
                  key: "weeklySummary",
                  title: "Weekly summary",
                  description: "A summary of activity across your workspace.",
                },
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-text">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {item.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={notifications[item.key]}
                    aria-label={item.title}
                    onClick={() => toggleNotification(item.key)}
                    className={`relative h-6 w-11 shrink-0 rounded-full border border-line ${
                      notifications[item.key] ? "bg-acc" : "bg-hover"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full ${
                        notifications[item.key]
                          ? "left-[22px] bg-onAcc"
                          : "left-0.5 bg-muted"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </>
        );

      case "appearance":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">Appearance</h2>
              <p className="mt-1 text-sm text-muted">
                Customize how DevSync looks on your screen.
              </p>
            </div>

            <div className="rounded-xl border border-line bg-bg p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-hover">
                  <Palette size={19} className="text-muted" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-text">Color theme</p>
                  <p className="mt-1 text-sm text-muted">
                    Switch between light and dark mode using the theme button in the top bar.
                  </p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-muted">
              Theme selection currently applies to the running app. Saving your preference between sessions can be added later.
            </p>
          </>
        );

      case "security":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">Security</h2>
              <p className="mt-1 text-sm text-muted">
                Account security options for your workspace.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-bg p-4">
                <p className="text-sm font-semibold text-text">Authentication</p>
                <p className="mt-1 text-sm text-muted">
                  Sign-in and session management will be configured when authentication is added.
                </p>
              </div>
              <div className="rounded-xl border border-line bg-bg p-4">
                <p className="text-sm font-semibold text-text">Active sessions</p>
                <p className="mt-1 text-sm text-muted">
                  Session information is not available in this frontend-only demo.
                </p>
              </div>
            </div>
          </>
        );

      default:
        return null;
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
          Workspace configuration
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-text">
          Settings
        </h1>
        <p className="mt-2 text-sm text-muted">
          Manage your profile and customize your DevSync workspace.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="rounded-xl border border-line bg-surface p-2">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  setSaved(false);
                }}
                className={`mb-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${
                  active
                    ? "bg-hover font-semibold text-text"
                    : "text-muted hover:bg-hover hover:text-text"
                }`}
              >
                <Icon size={17} strokeWidth={1.8} />
                {section.label}
              </button>
            );
          })}
        </nav>

        <form
          onSubmit={handleSave}
          className="overflow-hidden rounded-xl border border-line bg-surface"
        >
          <div className="p-5 sm:p-7">
            {renderSection()}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg px-5 py-4 sm:px-7">
            <p className="text-xs text-muted">
              Changes are local to this demo.
            </p>

            <Button type="submit" size="md">
              {saved ? <Check size={16} /> : <Save size={16} />}
              {saved ? "Saved" : "Save changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings;
