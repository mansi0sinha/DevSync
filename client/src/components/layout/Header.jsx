
import { useEffect, useState } from "react";
import ThemeToggle from "../ui/ThemeToggle";
import { Search, PanelLeft, Menu } from "lucide-react";
import { getRealtimeStatus, subscribeRealtime, subscribeRealtimeStatus } from "../../services/realtime";
import NotificationPanel from "./NotificationPanel";

const pageTitles = {
  dashboard: "Overview",
  discussion: "Discussion",
  board: "Task Board",
  decisions: "Decision Log",
  settings: "Settings",
  activity: "Activity",
  search: "Search",
};

export default function Header({ activePage = "dashboard", onNavigate, onOpenNotification, onToggleNavigation, mobileNavOpen = false, mobileNavToggleRef }) {
  const [realtimeStatus, setRealtimeStatus] = useState(getRealtimeStatus());
  const [onlineCount, setOnlineCount] = useState(0);

  useEffect(() => {
    const unsubscribeStatus = subscribeRealtimeStatus((nextStatus) => {
      setRealtimeStatus(nextStatus);
      if (nextStatus !== "connected") setOnlineCount(0);
    });
    const unsubscribePresence = subscribeRealtime("project:presence", (presence) => {
      setOnlineCount(Array.isArray(presence?.users) ? presence.users.length : 0);
    });
    return () => {
      unsubscribeStatus();
      unsubscribePresence();
    };
  }, []);

  const connectionLabel = realtimeStatus === "connected"
    ? `Connected${onlineCount ? ` · ${onlineCount} online` : ""}`
    : realtimeStatus === "reconnecting" ? "Reconnecting" : "Disconnected";

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-surface px-3 sm:px-6">
      {/* Current page */}
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button ref={mobileNavToggleRef} id="mobile-navigation-toggle" type="button" onClick={onToggleNavigation} aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobileNavOpen} aria-controls="primary-sidebar" className="inline-flex shrink-0 rounded-md p-2 text-muted hover:bg-hover hover:text-text md:hidden"><Menu size={20}/></button>
        <PanelLeft
          size={18}
          strokeWidth={1.8}
          className="hidden shrink-0 text-muted md:block"
        />

        <div className="hidden h-5 w-px bg-line md:block" />

        <div className="flex min-w-0 items-center gap-2 text-sm">
          <span className="hidden text-muted md:inline">Workspace</span>
          <span className="hidden text-muted md:inline">/</span>

          <span className="truncate font-semibold text-text">
            {pageTitles[activePage] || "Overview"}
          </span>
        </div>
      </div>

      {/* Header actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <div className="inline-flex items-center gap-1.5 text-[11px] text-muted" role="status" aria-live="polite" title={`Realtime ${connectionLabel}`}>
          <span className={`h-2 w-2 rounded-full ${realtimeStatus === "connected" ? "bg-acc" : realtimeStatus === "reconnecting" ? "bg-amb" : "bg-muted"}`} />
          <span className="hidden sm:inline">{connectionLabel}</span>
        </div>
        {/* Search */}
        <button
          type="button"
          onClick={() => onNavigate?.("search")}
          aria-label="Search"
          title="Search"
          className="rounded-md p-2 text-muted transition-colors hover:bg-hover hover:text-text"
        >
          <Search size={19} strokeWidth={1.8} />
        </button>

        {/* Notifications */}
        <NotificationPanel onOpenNotification={onOpenNotification} />

        <div className="mx-1 hidden h-5 w-px bg-line sm:block" />

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
