
import ThemeToggle from "../ui/ThemeToggle";
import { Search, Bell, PanelLeft } from "lucide-react";

const pageTitles = {
  dashboard: "Overview",
  discussion: "Discussion",
  board: "Task Board",
  decisions: "Decision Log",
  settings: "Settings",
};

export default function Header({ activePage = "dashboard" }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-6">
      {/* Current page */}
      <div className="flex items-center gap-3">
        <PanelLeft
          size={18}
          strokeWidth={1.8}
          className="text-muted"
        />

        <div className="h-5 w-px bg-line" />

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">Workspace</span>
          <span className="text-muted">/</span>

          <span className="font-semibold text-text">
            {pageTitles[activePage] || "Overview"}
          </span>
        </div>
      </div>

      {/* Header actions */}
      <div className="flex items-center gap-4">
        {/* Search */}
        <button
          type="button"
          aria-label="Search"
          title="Search"
          className="rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-text"
        >
          <Search size={19} strokeWidth={1.8} />
        </button>

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          className="relative rounded-md p-1.5 text-muted transition-colors hover:bg-hover hover:text-text"
        >
          <Bell size={19} strokeWidth={1.8} />

          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-acc" />
        </button>

        <div className="mx-1 h-5 w-px bg-line" />

        {/* Light / dark mode toggle */}
        <ThemeToggle />

        {/* User avatar */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-hover text-xs font-semibold text-text"
          title="Your account"
          aria-label="Your account"
        >
          U
        </div>
      </div>
    </header>
  );
}
