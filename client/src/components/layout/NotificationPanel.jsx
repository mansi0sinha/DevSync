import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { notificationAPI } from "../../services/api";
import { subscribeRealtime } from "../../services/realtime";
import { getNotificationDisplay, getNotificationPanelState, mergeNotificationPage } from "../../services/notificationPanelState.js";

export default function NotificationPanel({ onOpenNotification }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  const cursorRef = useRef(null);
  const requestVersionRef = useRef(0);

  const load = useCallback(async (append = false) => {
    const requestVersion = ++requestVersionRef.current;
    setLoading(true);
    setError("");
    try {
      const result = await notificationAPI.getAll(append && cursorRef.current ? { before: cursorRef.current } : {});
      if (requestVersion !== requestVersionRef.current) return;
      const rows = Array.isArray(result.data) ? result.data : [];
      setItems((current) => mergeNotificationPage(current, rows, append));
      setUnreadCount(Number.isInteger(result.unreadCount) ? result.unreadCount : 0);
      cursorRef.current = typeof result.nextCursor === "string" ? result.nextCursor : null;
      setNextCursor(cursorRef.current);
    } catch (cause) {
      if (requestVersion === requestVersionRef.current) setError(cause.message || "Could not load notifications.");
    } finally {
      if (requestVersion === requestVersionRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    function dismiss(event) {
      if (event.type === "keydown" && event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
      if (event.type === "pointerdown" && !panelRef.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", dismiss);
    };
  }, [open]);

  useEffect(() => subscribeRealtime("notification:new", () => { void load(); }), [load]);
  useEffect(() => subscribeRealtime("realtime:resync", () => { void load(); }), [load]);

  async function markOne(item) {
    if (item.readAt) return true;
    try {
      const result = await notificationAPI.markRead(item._id);
      setItems((current) => current.map((row) => String(row._id) === String(item._id)
        ? { ...row, ...(result.data || {}), workspaceName: row.workspaceName, projectName: row.projectName }
        : row));
      setUnreadCount((count) => Math.max(0, count - 1));
      return true;
    } catch (cause) {
      setError(cause.message || "This notification is no longer available. Refresh the list.");
      return false;
    }
  }

  async function markAll() {
    try {
      await notificationAPI.markAllRead();
      const now = new Date().toISOString();
      setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt || now })));
      setUnreadCount(0);
    } catch (cause) {
      setError(cause.message || "Could not update notifications.");
    }
  }

  async function navigate(item) {
    try {
      await onOpenNotification?.(item);
      setOpen(false);
    } catch (cause) {
      setError(cause.message || "This item is no longer available to your account.");
    }
  }

  const panelState = getNotificationPanelState({ loading, error, items });
  const unread = unreadCount;

  return <div className="relative" ref={panelRef}>
    <button ref={triggerRef} type="button" onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} aria-controls="notification-panel" title="Notifications" className="relative inline-flex rounded-md p-2 text-muted hover:bg-hover hover:text-text">
      <Bell size={19} strokeWidth={1.8} />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amb px-1 text-center text-[10px] font-bold leading-4 text-onAmb">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <section id="notification-panel" aria-label="Notifications" className="fixed right-3 top-16 z-60 w-[calc(100vw-1.5rem)] max-w-96 overflow-hidden rounded-xl border border-line bg-surface shadow-xl md:absolute md:right-0 md:top-11 md:w-96">
      <header className="flex items-center justify-between border-b border-line px-4 py-3"><div><h2 className="font-semibold">Notifications</h2><p className="text-xs text-muted">{unread ? `${unread} unread` : "All caught up"}</p></div><div className="flex gap-1"><button type="button" onClick={() => void load()} aria-label="Refresh notifications" className="rounded p-2 text-muted hover:bg-hover"><RefreshCw size={15} /></button><button type="button" disabled={!unread} onClick={() => void markAll()} aria-label="Mark all as read" className="rounded p-2 text-muted hover:bg-hover disabled:opacity-40"><CheckCheck size={16} /></button></div></header>
      {error && items.length > 0 && <p role="alert" className="mx-3 mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">{error}<button type="button" className="ml-2 underline" onClick={() => void load()}>Retry</button></p>}
      <div className="max-h-[min(65dvh,28rem)] overflow-y-auto overscroll-contain">
        {panelState === "loading" ? <p className="p-6 text-center text-sm text-muted" role="status">Loading notifications…</p>
          : panelState === "error" ? <div className="p-6 text-center"><p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p><button type="button" onClick={() => void load()} className="mt-3 text-sm font-medium text-acc underline">Retry</button></div>
            : panelState === "empty" ? <p className="p-6 text-center text-sm text-muted">You’re all caught up.</p>
              : items.map((item) => {
                const display = getNotificationDisplay(item);
                return <article key={item._id} className={`border-b border-line p-3 last:border-0 ${item.readAt ? "" : "bg-hover/60"}`}><button type="button" onClick={async () => { if (await markOne(item)) await navigate(item); }} className="w-full text-left"><span className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-acc"}`} /><span className="min-w-0 flex-1"><span className="block wrap-break-word text-sm font-semibold text-text">{display.title}</span><span className="mt-0.5 block wrap-break-word text-sm text-muted">{display.message}</span><span className="mt-1 block wrap-break-word text-[11px] text-muted">{item.workspaceName || "Workspace"} / {item.projectName || "Project"} · {display.timestamp}</span></span></span></button></article>;
              })}
        {panelState === "ready" && nextCursor && <button type="button" disabled={loading} onClick={() => void load(true)} className="w-full border-t border-line p-3 text-sm font-medium text-acc disabled:opacity-50">{loading ? "Loading…" : "Load older notifications"}</button>}
      </div>
    </section>}
  </div>;
}
