import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { notificationAPI } from "../../services/api";
import { subscribeRealtime } from "../../services/realtime";

export default function NotificationPanel({ workspaceId, projectId, onOpenTask, onOpenDecision, onOpenDiscussion }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const visibleItems = items.filter((item) => String(item.workspace) === String(workspaceId) && String(item.project) === String(projectId));
  const unread = visibleItems.filter((item) => !item.readAt).length;

  const load = useCallback(async () => {
    if (!workspaceId || !projectId) { setItems([]); return; }
    setLoading(true); setError("");
    try { const result = await notificationAPI.getAll(workspaceId, projectId); setItems(result.data || []); }
    catch (cause) { setError(cause.message || "Could not load notifications."); }
    finally { setLoading(false); }
  }, [workspaceId, projectId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  useEffect(() => subscribeRealtime("notification:new", (event) => {
    const item = event?.notification;
    if (String(item?.workspace) !== String(workspaceId) || String(item?.project) !== String(projectId)) return;
    setItems((current) => current.some((row) => String(row._id) === String(item._id)) ? current : [item, ...current].slice(0, 50));
  }), [workspaceId, projectId]);
  useEffect(() => subscribeRealtime("realtime:resync", (event) => {
    if (String(event?.workspaceId) === String(workspaceId) && String(event?.projectId) === String(projectId)) load();
  }), [load, workspaceId, projectId]);

  async function markOne(item) {
    if (item.readAt) return;
    try { const result = await notificationAPI.markRead(item._id, workspaceId, projectId); setItems((current) => current.map((row) => String(row._id) === String(item._id) ? (result.data || { ...row, readAt: new Date().toISOString() }) : row)); }
    catch (cause) { setError(cause.message || "Could not update notification."); }
  }
  async function markAll() {
    try { await notificationAPI.markAllRead(workspaceId, projectId); const now = new Date().toISOString(); setItems((current) => current.map((row) => ({ ...row, readAt: row.readAt || now }))); }
    catch (cause) { setError(cause.message || "Could not update notifications."); }
  }
  function navigate(item) {
    if (item.entityType === "task") onOpenTask?.(String(item.entityId));
    if (item.entityType === "decision") onOpenDecision?.(String(item.entityId));
    if (item.entityType === "discussion") onOpenDiscussion?.(String(item.entityId));
    setOpen(false);
  }

  return <div className="relative">
    <button type="button" onClick={() => { setOpen((value) => !value); if (!open) load(); }} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open} title="Notifications" className="relative inline-flex rounded-md p-2 text-muted hover:bg-hover hover:text-text">
      <Bell size={19} strokeWidth={1.8} />{unread > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amb px-1 text-center text-[10px] font-bold leading-4 text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <section aria-label="Notifications" className="absolute right-0 top-11 z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
      <header className="flex items-center justify-between border-b border-line px-4 py-3"><div><h2 className="font-semibold">Notifications</h2><p className="text-xs text-muted">{unread ? `${unread} unread` : "All caught up"}</p></div><div className="flex gap-1"><button type="button" onClick={load} aria-label="Refresh notifications" className="rounded p-2 text-muted hover:bg-hover"><RefreshCw size={15} /></button><button type="button" disabled={!unread} onClick={markAll} aria-label="Mark all as read" className="rounded p-2 text-muted hover:bg-hover disabled:opacity-40"><CheckCheck size={16} /></button></div></header>
      {error && <p role="alert" className="mx-3 mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-800 dark:bg-red-950 dark:text-red-200">{error}<button type="button" className="ml-2 underline" onClick={load}>Retry</button></p>}
      <div className="max-h-[min(65vh,28rem)] overflow-y-auto">
        {loading && visibleItems.length === 0 ? <p className="p-6 text-center text-sm text-muted">Loading notifications…</p> : visibleItems.length === 0 ? <p className="p-6 text-center text-sm text-muted">No notifications for this project yet.</p> : visibleItems.map((item) => <article key={item._id} className={`border-b border-line p-3 last:border-0 ${item.readAt ? "" : "bg-hover/60"}`}><button type="button" onClick={async () => { await markOne(item); navigate(item); }} className="w-full text-left"><span className="flex items-start gap-2"><span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-transparent" : "bg-acc"}`} /><span><span className="block text-sm font-semibold text-text">{item.title}</span><span className="mt-0.5 block text-sm text-muted">{item.message}</span><span className="mt-1 block text-[11px] text-muted">{new Date(item.createdAt).toLocaleString()}</span></span></span></button></article>)}
      </div>
    </section>}
  </div>;
}
