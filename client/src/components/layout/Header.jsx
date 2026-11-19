
import { useEffect, useRef, useState } from "react";
import ThemeToggle from "../ui/ThemeToggle";
import { Search, PanelLeft, Menu, LogOut } from "lucide-react";
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

export default function Header({ activePage = "dashboard", onNavigate, onOpenNotification, onToggleNavigation, mobileNavOpen = false, mobileNavToggleRef, user, onLogout }) {
  const [realtimeStatus, setRealtimeStatus] = useState(getRealtimeStatus());
  const [onlineCount, setOnlineCount] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef(null);

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

  useEffect(() => {
    function closeAccount(event) { if (!accountRef.current?.contains(event.target)) setAccountOpen(false); }
    function closeOnEscape(event) { if (event.key === "Escape") setAccountOpen(false); }
    document.addEventListener("mousedown", closeAccount); document.addEventListener("keydown", closeOnEscape);
    return () => { document.removeEventListener("mousedown", closeAccount); document.removeEventListener("keydown", closeOnEscape); };
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
        <div className="relative" ref={accountRef}>
          <button type="button" onClick={() => setAccountOpen((open) => !open)} aria-label="Open account menu" aria-expanded={accountOpen} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-hover text-xs font-semibold text-text outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc" title="Your account">{(user?.name || user?.email || "U").slice(0, 1).toUpperCase()}</button>
          {accountOpen && <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-line bg-surface p-2 shadow-lg"><div className="border-b border-line px-3 py-2"><p className="truncate text-sm font-semibold text-text">{user?.name || "Your account"}</p><p className="mt-0.5 truncate text-xs text-muted">{user?.email}</p></div><button type="button" onClick={onLogout} className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-hover hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc"><LogOut size={16}/>Log out</button></div>}
        </div>
      </div>
    </header>
  );
}
