import { useEffect, useState } from "react";
import { Search as SearchIcon, X, ArrowUpRight } from "lucide-react";
import { searchAPI, workspaceAPI } from "../services/api";

const initial = { q: "", status: "", priority: "", assignee: "", lifecycleStatus: "" };

export default function Search({ workspaceId, projectId, onOpenTask, onOpenDecision, onOpenDiscussion }) {
  const [filters, setFilters] = useState(initial);
  const [members, setMembers] = useState([]);
  const [results, setResults] = useState({ tasks: [], decisions: [] });
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    workspaceAPI.getById(workspaceId).then((result) => {
      if (active) setMembers((result.workspace || result).members || []);
    }).catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [workspaceId, projectId]);

  async function submit(event) {
    event.preventDefault(); setLoading(true); setError(""); setSearched(true);
    try { setResults(await searchAPI.search(workspaceId, projectId, filters)); }
    catch (cause) { setResults({ tasks: [], decisions: [] }); setError(cause.message || "Search failed."); }
    finally { setLoading(false); }
  }
  function clear() { setFilters(initial); setResults({ tasks: [], decisions: [] }); setSearched(false); setError(""); }

  return <section className="mx-auto w-full max-w-6xl space-y-5 pb-8">
    <header><h1 className="flex items-center gap-2 text-2xl font-semibold"><SearchIcon size={22} className="text-acc" />Search project</h1><p className="mt-1 text-sm text-muted">Find tasks and decisions in the selected project.</p></header>
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <label className="block text-sm font-medium" htmlFor="project-search">Search text</label>
      <input id="project-search" maxLength={120} value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder="Titles, descriptions, decision details…" className="w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-text outline-none focus:border-teal-600" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select aria-label="Task status" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"><option value="">Any task status</option><option value="todo">To Do</option><option value="in-progress">In Progress</option><option value="in-review">Review</option><option value="done">Done</option></select>
        <select aria-label="Task priority" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"><option value="">Any priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <select aria-label="Task assignee" value={filters.assignee} onChange={(e) => setFilters({ ...filters, assignee: e.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"><option value="">Any assignee</option>{members.map((member) => { const user = member.user || {}; const id = user._id || user.id; return id ? <option key={id} value={id}>{user.name || user.email || "Member"}</option> : null; })}</select>
        <select aria-label="Decision status" value={filters.lifecycleStatus} onChange={(e) => setFilters({ ...filters, lifecycleStatus: e.target.value })} className="rounded-lg border border-line bg-bg px-3 py-2 text-sm"><option value="">Any decision status</option><option value="Accepted">Accepted</option><option value="Superseded">Superseded</option><option value="Archived">Archived</option></select>
      </div>
      <div className="flex gap-2"><button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"><SearchIcon size={15} />{loading ? "Searching…" : "Search"}</button><button type="button" onClick={clear} className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm hover:bg-hover"><X size={15} />Clear filters</button></div>
    </form>
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
    {searched && !loading && !error && <div className="grid gap-5 lg:grid-cols-2">
      {[ ["Tasks", results.tasks, "task"], ["Decisions", results.decisions, "decision"] ].map(([heading, rows, kind]) => <section key={heading} className="overflow-hidden rounded-xl border border-line bg-surface"><h2 className="border-b border-line px-4 py-3 font-semibold">{heading} <span className="text-xs font-normal text-muted">({rows.length})</span></h2>{rows.length ? rows.map((item) => <article key={item._id} className="border-b border-line p-4 last:border-0"><button type="button" onClick={() => kind === "task" ? onOpenTask?.(item._id) : onOpenDecision?.(item._id)} className="flex w-full items-center justify-between gap-3 text-left"><span className="font-medium text-text">{item.title}</span><ArrowUpRight size={15} className="shrink-0 text-acc" /></button><p className="mt-1 line-clamp-2 text-sm text-muted">{kind === "task" ? item.description : item.summary || item.context}</p><p className="mt-2 text-xs text-muted">{kind === "task" ? `${item.status} · ${item.priority}${item.assignee?.name ? ` · ${item.assignee.name}` : ""}` : item.lifecycleStatus}</p>{kind === "decision" && item.discussionId && <button type="button" onClick={() => onOpenDiscussion?.(String(item.discussionId), String(item.discussionMessageId || ""))} className="mt-2 text-xs font-medium text-acc hover:underline">Open source discussion</button>}</article>) : <p className="p-4 text-sm text-muted">No {heading.toLowerCase()} found. Try another search or filter.</p>}</section>)}
    </div>}
    {searched && !loading && !error && results.tasks.length === 0 && results.decisions.length === 0 && <p className="rounded-xl border border-line bg-surface p-5 text-center text-sm text-muted">No project work matched. <button type="button" onClick={clear} className="text-acc underline">Clear filters</button></p>}
  </section>;
}
