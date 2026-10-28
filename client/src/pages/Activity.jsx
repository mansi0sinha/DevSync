import { useCallback, useEffect, useState } from "react";
import { Activity as ActivityIcon, RefreshCw, ArrowUpRight } from "lucide-react";
import { activityAPI } from "../services/api";

function timestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();
}

export default function Activity({ workspaceId, projectId, onOpenTask, onOpenDecision, onOpenDiscussion }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (before = null, append = false) => {
    if (!workspaceId || !projectId) return;
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const result = await activityAPI.getAll(workspaceId, projectId, { before });
      const rows = result.data || [];
      setItems((current) => append ? [...current, ...rows] : rows);
      setCursor(result.nextCursor || null);
    } catch (cause) { setError(cause.message || "Could not load activity."); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [workspaceId, projectId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const open = (item) => {
    if (!item.relatedAvailable) return;
    if (item.entityType === "task") onOpenTask?.(String(item.entityId));
    if (item.entityType === "decision") onOpenDecision?.(String(item.entityId));
    if (item.entityType === "discussion") onOpenDiscussion?.(String(item.entityId));
  };

  return <section className="mx-auto w-full max-w-5xl space-y-5 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><ActivityIcon size={22} className="text-acc" />Activity</h1><p className="mt-1 text-sm text-muted">Recent changes in this project.</p></div>
      <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-hover"><RefreshCw size={15} />Refresh</button>
    </header>
    {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">{error}<button type="button" onClick={() => load()} className="ml-3 underline">Retry</button></div>}
    {loading ? <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">Loading project activity…</div> : items.length === 0 ? <div className="rounded-xl border border-line bg-surface p-8 text-center"><p className="font-medium">No activity yet</p><p className="mt-1 text-sm text-muted">Task, discussion, and decision changes will appear here.</p></div> : <div className="overflow-hidden rounded-xl border border-line bg-surface divide-y divide-line">
      {items.map((item) => <article key={item._id} className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0"><p className="text-sm text-text"><span className="font-semibold">{item.actorType === "system" ? "GitHub" : item.actor?.name || "A member"}</span> {item.summary}</p><p className="mt-1 text-xs text-muted">{timestamp(item.createdAt)}</p></div>
        {item.relatedAvailable && <button type="button" onClick={() => open(item)} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-acc hover:bg-hover">Open <ArrowUpRight size={14} /></button>}
      </article>)}
      {cursor && <div className="p-4 text-center"><button type="button" disabled={loadingMore} onClick={() => load(cursor, true)} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-hover disabled:opacity-50">{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </div>}
  </section>;
}
