
import { useState } from "react";
import {
  UserRound,
  Building2,
  Bell,
  ShieldCheck,
  Palette,
  Save,
  Check,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
} from "lucide-react";
import Button from "../components/ui/Button";
import { useTheme } from "../components/ui/ThemeContext";

const DEFAULT_PROFILE = {
  name: "Your Name",
  username: "developer",
  email: "you@example.com",
  bio: "Building software and solving problems.",
};

const DEFAULT_WORKSPACE = {
  name: "My Workspace",
  description: "A space for engineering collaboration.",
};

const DEFAULT_NOTIFICATIONS = {
  discussions: true,
  taskUpdates: true,
  decisions: true,
  weeklySummary: false,
};

const DEFAULT_THEME = "light";

const sections = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "workspace", label: "Workspace", icon: Building2 },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "security", label: "Security", icon: ShieldCheck },
];

function readStored(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? { ...fallback, ...JSON.parse(value) } : fallback;
  } catch {
    return fallback;
  }
}

function Settings() {
  const [activeSection, setActiveSection] = useState("profile");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const { theme, setTheme } = useTheme();

  const [profile, setProfile] = useState(() =>
    readStored("devsync-profile", DEFAULT_PROFILE)
  );

  const [workspace, setWorkspace] = useState(() =>
    readStored("devsync-workspace", DEFAULT_WORKSPACE)
  );

  const [notifications, setNotifications] = useState(() =>
    readStored("devsync-notifications", DEFAULT_NOTIFICATIONS)
  );

  function markChanged() {
    setSaved(false);
    setSaveError("");
  }

  function updateProfile(event) {
    const { name, value } = event.target;

    setProfile((current) => ({ ...current, [name]: value }));
    markChanged();
  }

  function updateWorkspace(event) {
    const { name, value } = event.target;

    setWorkspace((current) => ({ ...current, [name]: value }));
    markChanged();
  }

  function toggleNotification(key) {
    setNotifications((current) => ({
      ...current,
      [key]: !current[key],
    }));
    markChanged();
  }

  function changeTheme(nextTheme) {
    setTheme(nextTheme);
    setSaved(false);
    setSaveError("");
  }

  function handleSave(event) {
    event.preventDefault();
    setSaveError("");

    if (!profile.name.trim()) {
      setSaveError("Please enter your full name.");
      setActiveSection("profile");
      return;
    }

    if (!/^[a-zA-Z0-9_-]{3,25}$/.test(profile.username)) {
      setSaveError(
        "Username must be 3–25 characters using letters, numbers, underscores, or hyphens."
      );
      setActiveSection("profile");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      setSaveError("Please enter a valid email address.");
      setActiveSection("profile");
      return;
    }

    if (!workspace.name.trim()) {
      setSaveError("Please enter a workspace name.");
      setActiveSection("workspace");
      return;
    }

    try {
      localStorage.setItem("devsync-profile", JSON.stringify(profile));
      localStorage.setItem("devsync-workspace", JSON.stringify(workspace));
      localStorage.setItem(
        "devsync-notifications",
        JSON.stringify(notifications)
      );
      localStorage.setItem("devsync-theme", theme);

      setSaved(true);
    } catch {
      setSaveError(
        "Your browser could not save these settings. Check your storage permissions."
      );
      setSaved(false);
    }
  }

  function resetSettings() {
    setProfile({ ...DEFAULT_PROFILE });
    setWorkspace({ ...DEFAULT_WORKSPACE });
    setNotifications({ ...DEFAULT_NOTIFICATIONS });
    setTheme(DEFAULT_THEME);
    setSaved(false);
    setSaveError("");
  }

  const fieldClass =
    "mt-2 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc";

  const notificationOptions = [
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
  ];

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
              <div className="min-w-0">
                <p className="truncate font-semibold text-text">
                  {profile.name || "Your Name"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  @{profile.username || "username"}
                </p>
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
                  maxLength={80}
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
                  maxLength={25}
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
                  placeholder="Tell your team about yourself"
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
                Configure your shared engineering workspace.
              </p>
            </div>

            <div className="space-y-5">
              <label className="block text-sm font-medium text-text">
                Workspace name
                <input
                  name="name"
                  value={workspace.name}
                  onChange={updateWorkspace}
                  maxLength={80}
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
                  maxLength={300}
                  className={`${fieldClass} resize-y`}
                  placeholder="What is this workspace for?"
                />
              </label>

              <div className="rounded-lg border border-line bg-bg p-4">
                <p className="text-sm font-semibold text-text">
                  Workspace plan
                </p>
                <p className="mt-1 text-sm text-muted">Free plan · Demo</p>
                <p className="mt-3 text-xs leading-5 text-muted">
                  Workspace preferences are saved in this browser. Team
                  membership and billing require a backend.
                </p>
              </div>
            </div>
          </>
        );

      case "notifications":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">
                Notifications
              </h2>
              <p className="mt-1 text-sm text-muted">
                Choose which updates you want to enable in your preferences.
              </p>
            </div>

            <div className="divide-y divide-line">
              {notificationOptions.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-text">
                      {item.title}
                    </p>
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
                          ? "left-5.5 bg-onAcc"
                          : "left-0.5 bg-muted"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>

            <p className="mt-4 text-xs text-muted">
              These are saved preferences only. Email and push delivery will
              be connected when notification services are added.
            </p>
          </>
        );

      case "appearance":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">Appearance</h2>
              <p className="mt-1 text-sm text-muted">
                Choose how DevSync looks on this device.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  id: "light",
                  label: "Light",
                  description: "Bright workspace",
                  icon: Sun,
                },
                {
                  id: "dark",
                  label: "Dark",
                  description: "Low-light workspace",
                  icon: Moon,
                },
                {
                  id: "system",
                  label: "System",
                  description: "Follow your device",
                  icon: Monitor,
                },
              ].map((option) => {
                const Icon = option.icon;
                const selected = theme === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => changeTheme(option.id)}
                    className={`rounded-xl border p-4 text-left ${
                      selected
                        ? "border-acc bg-accSoft"
                        : "border-line bg-bg hover:bg-hover"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <Icon size={20} className="text-text" />
                      {selected && <Check size={17} className="text-acc" />}
                    </div>
                    <p className="mt-4 text-sm font-semibold text-text">
                      {option.label}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-xl border border-line bg-bg p-4">
              <p className="text-sm font-semibold text-text">
                Theme preview
              </p>
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface p-3">
                <div className="h-8 w-1 rounded-full bg-acc" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text">
                    Engineering workspace
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Your selected theme applies immediately.
                  </p>
                </div>
                <span className="rounded-md bg-accSoft px-2 py-1 text-xs font-medium text-acc">
                  Active
                </span>
              </div>
            </div>
          </>
        );

      case "security":
        return (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-text">Security</h2>
              <p className="mt-1 text-sm text-muted">
                Account security controls will be connected with authentication.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-bg p-4">
                <p className="text-sm font-semibold text-text">
                  Authentication
                </p>
                <p className="mt-1 text-sm text-muted">
                  Login, password changes, and session protection are not
                  available until the backend authentication system is built.
                </p>
                <span className="mt-3 inline-flex rounded-md border border-line px-2 py-1 text-xs text-muted">
                  Not configured
                </span>
              </div>

              <div className="rounded-xl border border-line bg-bg p-4">
                <p className="text-sm font-semibold text-text">
                  Active sessions
                </p>
                <p className="mt-1 text-sm text-muted">
                  There are no server-managed sessions in this frontend demo.
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
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;

            return (
              <button
                key={section.id}
                type="button"
                onClick={() => {
                  setActiveSection(section.id);
                  setSaved(false);
                  setSaveError("");
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
          <div className="p-5 sm:p-7">{renderSection()}</div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-bg px-5 py-4 sm:px-7">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <p className="text-xs text-muted">
                Saved locally in this browser.
              </p>
              {saved && (
                <span className="flex items-center gap-1 text-xs font-medium text-acc">
                  <Check size={14} /> Saved
                </span>
              )}
              {saveError && (
                <p role="alert" className="text-xs text-red-600">
                  {saveError}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={resetSettings}
              >
                <RotateCcw size={15} />
                Reset
              </Button>
              <Button type="submit" size="md">
                <Save size={16} />
                Save changes
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Settings;
