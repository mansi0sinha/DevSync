import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity as ActivityIcon, RefreshCw } from "lucide-react";
import { activityAPI } from "../services/api";
import { ActivityList } from "../components/ActivityItem";

function groupActivity(items) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startWeek = startToday - 6 * 24 * 60 * 60 * 1000;
  const groups = { Today: [], "This week": [], Earlier: [] };
  items.forEach((item) => {
    const timestamp = new Date(item.createdAt).getTime();
    const group = !Number.isNaN(timestamp) && timestamp >= startToday ? "Today" : !Number.isNaN(timestamp) && timestamp >= startWeek ? "This week" : "Earlier";
    groups[group].push(item);
  });
  return Object.entries(groups).filter(([, rows]) => rows.length);
}

const filters = [
  { label: "All", type: "all" },
  { label: "Decisions", type: "decision" },
  { label: "Discussions", type: "discussion" },
  { label: "Tasks", type: "task" },
];

export default function Activity({ workspaceId, projectId, onOpenTask, onOpenDecision, onOpenDiscussion }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

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

  const filteredItems = useMemo(() => filter === "all" ? items : items.filter((item) => item.entityType === filter), [filter, items]);
  const groups = useMemo(() => groupActivity(filteredItems), [filteredItems]);

  return <section className="mx-auto w-full max-w-5xl space-y-5 pb-8">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><ActivityIcon size={22} className="text-acc" />Activity</h1><p className="mt-1 text-sm text-muted">Recent changes in this project.</p></div>
      <button type="button" onClick={() => load()} className="inline-flex items-center gap-2 rounded-lg border border-line bg-control px-3 py-2 text-sm hover:bg-hover"><RefreshCw size={15} />Refresh</button>
    </header>
    {error && <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200" role="alert">{error}<button type="button" onClick={() => load()} className="ml-3 underline">Retry</button></div>}
    {!loading && items.length > 0 && <div className="flex flex-wrap gap-2" aria-label="Filter activity">
      {filters.map((option) => <button key={option.type} type="button" onClick={() => setFilter(option.type)} aria-pressed={filter === option.type} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${filter === option.type ? "border-[#18201c] bg-[#18201c] text-white dark:border-[#e8eee9] dark:bg-[#e8eee9] dark:text-[#18201c]" : "border-line bg-control text-muted hover:bg-hover hover:text-text"}`}>{option.label}</button>)}
    </div>}
    {loading ? <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">Loading project activity…</div> : items.length === 0 ? <div className="rounded-xl border border-line bg-surface p-8 text-center"><p className="font-medium">No activity yet</p><p className="mt-1 text-sm text-muted">Task, discussion, and decision changes will appear here.</p></div> : filteredItems.length === 0 ? <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">No {filters.find((option) => option.type === filter)?.label.toLowerCase()} activity yet.</div> : <div className="space-y-5">
      {groups.map(([heading, rows]) => <section key={heading} className="space-y-2"><h2 className="px-1 text-xs font-semibold text-muted">{heading}</h2><div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card"><ActivityList items={rows} onOpen={open} /></div></section>)}
      {cursor && <div className="rounded-xl border border-line bg-surface p-4 text-center"><button type="button" disabled={loadingMore} onClick={() => load(cursor, true)} className="rounded-lg border border-line px-4 py-2 text-sm hover:bg-hover disabled:opacity-50">{loadingMore ? "Loading…" : "Load more"}</button></div>}
    </div>}
  </section>;
}
