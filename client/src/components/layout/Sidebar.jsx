
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Columns3,
  GitMerge,
  Settings,
  ChevronsUpDown,
  Plus,
  ChevronRight,
} from "lucide-react";

const navigation = [
  { name: "Overview", icon: LayoutDashboard, id: "dashboard" },
  { name: "Discussion", icon: MessageSquare, id: "discussion" },
  { name: "Board", icon: Columns3, id: "board" },
  { name: "Decisions", icon: GitMerge, id: "decisions" },
];

export default function Sidebar({
  activePage = "dashboard",
  onNavigate,
}) {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(
        document.documentElement.classList.contains("dark")
      );
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <aside className="m-3 flex h-[calc(100vh-24px)] w-64 shrink-0 flex-col overflow-hidden rounded-xl border border-line bg-side">
      {/* Brand */}
      <div className="flex h-19 shrink-0 items-center gap-3 border-b border-line px-5">
        <img
          src={
            isDark
              ? "/devsync-mark-light.svg"
              : "/devsync-mark-light.svg"
          }
          alt="DevSync logo"
          className="h-10 w-10 shrink-0 object-contain"
        />

        <span className="text-lg font-bold tracking-tight text-text">
          DevSync
        </span>
      </div>

      {/* Workspace selector */}
      <div className="shrink-0 p-3">
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface p-2.5 text-left transition-colors hover:bg-hover"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line bg-hover text-sm font-semibold text-text">
            W
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">
              My Workspace
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Free workspace
            </p>
          </div>

          <ChevronsUpDown
            size={15}
            strokeWidth={1.8}
            className="shrink-0 text-muted"
          />
        </button>
      </div>

      {/* Scrollable navigation */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
          Workspace
        </p>

        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate?.(item.id)}
                aria-current={isActive ? "page" : undefined}
                className={`group flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? "bg-hover font-semibold text-text"
                    : "text-muted hover:bg-hover hover:text-text"
                }`}
              >
                <Icon
                  size={18}
                  strokeWidth={1.8}
                  className={
                    isActive
                      ? "text-acc"
                      : "text-muted group-hover:text-text"
                  }
                />

                <span className="flex-1">{item.name}</span>

                {isActive && (
                  <ChevronRight
                    size={15}
                    strokeWidth={1.8}
                    className="text-muted"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Projects */}
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between px-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">
              Projects
            </p>

            <button
              type="button"
              aria-label="Add project"
              title="Add project"
              className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-text"
            >
              <Plus size={16} strokeWidth={1.8} />
            </button>
          </div>

          <div className="rounded-lg border border-dashed border-faint px-3 py-4">
            <p className="text-sm font-medium text-text">
              No projects yet
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Create a project to organize your team's tasks and decisions.
            </p>
          </div>
        </div>
      </div>

      {/* Fixed bottom section */}
      <div className="shrink-0 border-t border-line p-3">
        {/* Settings */}
        <button
          type="button"
          onClick={() => onNavigate?.("settings")}
          aria-current={activePage === "settings" ? "page" : undefined}
          className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
            activePage === "settings"
              ? "bg-hover font-semibold text-text"
              : "text-muted hover:bg-hover hover:text-text"
          }`}
        >
          <Settings
            size={18}
            strokeWidth={1.8}
            className={
              activePage === "settings" ? "text-acc" : ""
            }
          />
          <span>Settings</span>
        </button>

        {/* Account */}
        <div className="mt-2 flex items-center gap-3 rounded-lg border border-line bg-surface p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-hover font-mono text-xs font-medium text-text">
            U
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-text">
              Your Account
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Developer
            </p>
          </div>

          <ChevronsUpDown
            size={14}
            strokeWidth={1.8}
            className="shrink-0 text-muted"
          />
        </div>
      </div>
    </aside>
  );
}
