import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, Check, ExternalLink, LoaderCircle, RefreshCw, Sparkles, X } from "lucide-react";
import { aiSuggestionAPI, discussionAPI, workspaceAPI } from "../services/api";

function idOf(value) { return String(value?._id || value?.id || value || ""); }
function messageAuthor(message) { return message.author?.name || message.author?.email || "Workspace member"; }

export default function AISuggestions({ workspaceId, projectId, onOpenTask, onOpenDecision, onOpenDiscussion }) {
  const [discussions, setDiscussions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [members, setMembers] = useState([]);
  const [providerConfigured, setProviderConfigured] = useState(null);
  const [discussionId, setDiscussionId] = useState("");
  const [messageIds, setMessageIds] = useState([]);
  const [selected, setSelected] = useState({});
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [discussionResult, suggestionResult, workspaceResult] = await Promise.all([
        discussionAPI.getAll(workspaceId, projectId),
        aiSuggestionAPI.getAll(workspaceId, projectId),
        workspaceAPI.getById(workspaceId),
      ]);
      const threads = discussionResult.data || [];
      const items = suggestionResult.data || [];
      setDiscussions(threads);
      setSuggestions(items);
      setMembers((workspaceResult.workspace || workspaceResult).members || []);
      setProviderConfigured(suggestionResult.providerConfigured !== false);
      setSelected(Object.fromEntries(items.map((item) => [idOf(item), { decisions: item.decisions.map((_, index) => index), tasks: item.tasks.map((_, index) => index) }])));
      setDiscussionId((current) => threads.some((item) => idOf(item) === current) ? current : idOf(threads[0]));
      setMessageIds([]);
    } catch (cause) { setError(cause.message || "Could not load AI suggestions."); }
    finally { setLoading(false); }
  }, [workspaceId, projectId]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const selectedDiscussion = discussions.find((item) => idOf(item) === discussionId);
  const messages = selectedDiscussion?.messages || [];

  async function generate(event) {
    event.preventDefault();
    if (!discussionId || !messageIds.length) { setError("Choose a discussion and at least one message first."); return; }
    setGenerating(true); setError(""); setNotice("");
    try {
      const result = await aiSuggestionAPI.create({ workspaceId, projectId, discussionId, messageIds });
      const item = result.data;
      setSuggestions((current) => [item, ...current.filter((row) => idOf(row) !== idOf(item))]);
      setSelected((current) => ({ ...current, [idOf(item)]: { decisions: item.decisions.map((_, index) => index), tasks: item.tasks.map((_, index) => index) } }));
      setNotice("Suggestions saved for human review. No tasks or decisions were created.");
    } catch (cause) { setError(cause.message || "AI extraction failed."); }
    finally { setGenerating(false); }
  }

  function updateSuggestion(suggestionId, type, index, field, value) {
    setSuggestions((current) => current.map((item) => {
      if (idOf(item) !== suggestionId) return item;
      const rows = [...item[type]];
      rows[index] = { ...rows[index], [field]: value };
      return { ...item, [type]: rows };
    }));
  }

  async function saveEdits(item) {
    setWorkingId(idOf(item)); setError(""); setNotice("");
    try {
      const result = await aiSuggestionAPI.update(idOf(item), workspaceId, projectId, {
        decisions: item.decisions.map(({ title, outcome, rationale, sourceMessageIds }) => ({ title, outcome, rationale, sourceMessageIds: sourceMessageIds.map(idOf) })),
        tasks: item.tasks.map(({ title, description, priority, suggestedAssignee, dueDate }) => ({ title, description, priority, suggestedAssignee: idOf(suggestedAssignee) || null, dueDate: dueDate ? new Date(dueDate).toISOString().slice(0, 10) : null })),
        uncertainties: item.uncertainties,
      });
      setSuggestions((current) => current.map((row) => idOf(row) === idOf(item) ? result.data : row));
      setNotice("Suggestion edits saved.");
      return true;
    } catch (cause) { setError(cause.message || "Could not save suggestion edits."); return false; }
    finally { setWorkingId(""); }
  }

  async function reject(item) {
    setWorkingId(idOf(item)); setError(""); setNotice("");
    try {
      const result = await aiSuggestionAPI.reject(idOf(item), workspaceId, projectId);
      setSuggestions((current) => current.map((row) => idOf(row) === idOf(item) ? result.data : row));
    } catch (cause) { setError(cause.message || "Could not reject suggestion."); }
    finally { setWorkingId(""); }
  }

  async function approve(item) {
    const selection = selected[idOf(item)] || { decisions: [], tasks: [] };
    const body = item.status === "approving" ? { decisions: [], tasks: [] } : {
      decisions: selection.decisions.map((index) => {
        const value = item.decisions[index];
        return { index, title: value.title, outcome: value.outcome, rationale: value.rationale, sourceMessageId: idOf(value.sourceMessageIds[0]) };
      }),
      tasks: selection.tasks.map((index) => {
        const value = item.tasks[index];
        return { index, title: value.title, description: value.description, priority: value.priority, assignee: idOf(value.suggestedAssignee) || null, dueDate: value.dueDate ? new Date(value.dueDate).toISOString().slice(0, 10) : null };
      }),
    };
    setWorkingId(idOf(item)); setError(""); setNotice("");
    try {
      if (item.status === "pending" && !await saveEdits(item)) return;
      const result = await aiSuggestionAPI.approve(idOf(item), workspaceId, projectId, body);
      setSuggestions((current) => current.map((row) => idOf(row) === idOf(item) ? { ...row, status: result.status, decisions: row.decisions.map((entry, index) => ({ ...entry, approvedEntityId: result.decisions?.find((approved) => approved.index === index)?.id || entry.approvedEntityId })), tasks: row.tasks.map((entry, index) => ({ ...entry, approvedEntityId: result.tasks?.find((approved) => approved.index === index)?.id || entry.approvedEntityId })) } : row));
      setNotice("Selected suggestions were approved and saved to this project.");
    } catch (cause) {
      setError(cause.message || "Approval did not finish. Retry to resume safely.");
      try { const latest = await aiSuggestionAPI.getAll(workspaceId, projectId); setSuggestions(latest.data || []); }
      catch { /* Keep the current review visible if the refresh also fails. */ }
    }
    finally { setWorkingId(""); }
  }

  const selectedMessages = useMemo(() => new Set(messageIds), [messageIds]);
  function toggleSource(id) {
    setMessageIds((current) => current.includes(id) ? current.filter((value) => value !== id) : current.length < 10 ? [...current, id] : current);
  }

  return <section className="mx-auto w-full max-w-6xl space-y-6 pb-8">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Sparkles size={22} className="text-acc" />AI Discussion Suggestions</h1><p className="mt-1 text-sm text-muted">Extract possible decisions and tasks for people to review.</p></div><button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm hover:bg-hover"><RefreshCw size={15} />Refresh</button></header>
    <aside className="flex gap-3 rounded-xl border border-amb/30 bg-ambSoft p-4 text-sm"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amb" /><p><strong>AI suggestions may be incorrect.</strong> Review and edit every item. Nothing becomes a task or decision until you explicitly approve it.</p></aside>
    {providerConfigured === false && <p role="status" className="rounded-lg border border-line bg-surface p-3 text-sm text-muted">AI extraction is not configured. A server administrator must set <code>LLM_API_KEY</code> before suggestions can be generated.</p>}
    {error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-teal-600/30 bg-teal-600/10 p-3 text-sm text-text">{notice}</p>}
    <form onSubmit={generate} className="space-y-4 rounded-xl border border-line bg-surface p-4">
      <div><h2 className="flex items-center gap-2 font-semibold"><Bot size={18} className="text-acc" />Analyze discussion messages</h2><p className="mt-1 text-sm text-muted">Choose up to 10 messages from one discussion. Only text loaded from this authorized project is sent.</p></div>
      <label className="block text-sm font-medium">Discussion<select value={discussionId} onChange={(event) => { setDiscussionId(event.target.value); setMessageIds([]); }} className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm"><option value="">Select a discussion</option>{discussions.map((item) => <option key={idOf(item)} value={idOf(item)}>{item.title}</option>)}</select></label>
      {selectedDiscussion && <fieldset className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-line p-3"><legend className="px-1 text-sm font-medium">Source messages ({messageIds.length}/10)</legend>{messages.map((message) => <label key={idOf(message)} className="flex items-start gap-2 rounded-md p-2 hover:bg-hover"><input type="checkbox" checked={selectedMessages.has(idOf(message))} disabled={!selectedMessages.has(idOf(message)) && messageIds.length >= 10} onChange={() => toggleSource(idOf(message))} className="mt-1 accent-teal-700" /><span className="min-w-0"><span className="block text-xs font-semibold text-text">{messageAuthor(message)} · {message.createdAt ? new Date(message.createdAt).toLocaleString() : "Time unavailable"}</span><span className="mt-1 block whitespace-pre-wrap text-sm text-muted">{message.text || "Attachment-only message (no text sent for analysis)."}</span></span></label>)}</fieldset>}
      <button type="submit" disabled={generating || !discussionId || messageIds.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{generating ? <LoaderCircle size={16} className="animate-spin" /> : <Sparkles size={16} />}{generating ? "Analyzing…" : "Generate suggestions"}</button>
    </form>
    <div><h2 className="mb-3 text-lg font-semibold">Saved suggestions</h2>{loading ? <div className="rounded-xl border border-line bg-surface p-6 text-center text-sm text-muted">Loading suggestions…</div> : suggestions.length === 0 ? <div className="rounded-xl border border-line bg-surface p-6 text-center"><p className="font-medium">No suggestions yet</p><p className="mt-1 text-sm text-muted">Choose discussion messages above to request a review draft.</p></div> : <div className="space-y-4">{suggestions.map((item) => {
      const itemId = idOf(item); const thread = discussions.find((entry) => idOf(entry) === idOf(item.discussion)); const canReview = item.status === "pending" && new Date(item.expiresAt) > new Date(); const canResume = item.status === "approving";
      const picked = selected[itemId] || { decisions: [], tasks: [] };
      return <article key={itemId} className="space-y-4 rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-muted">{item.providerModel} · {new Date(item.createdAt).toLocaleString()}</p><h3 className="mt-1 font-semibold">{thread?.title || "Source discussion"}</h3><p className="mt-1 text-sm text-muted">Requested by {item.requestedBy?.name || "Workspace member"} · expires {new Date(item.expiresAt).toLocaleDateString()}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === "approved" ? "bg-teal-600/10 text-teal-700 dark:text-teal-300" : item.status === "pending" ? "bg-ambSoft text-amb" : "bg-hover text-muted"}`}>{item.status}</span></div>
        {item.sourceMessageIds.map((sourceId) => { const source = thread?.messages?.find((message) => idOf(message) === idOf(sourceId)); return <blockquote key={idOf(sourceId)} className="rounded-lg border-l-2 border-acc bg-bg p-3 text-sm text-muted"><span className="mb-1 block text-xs font-semibold">{source ? messageAuthor(source) : "Source message"}</span>{source?.text || "Source message is no longer available."}{source && <button type="button" onClick={() => onOpenDiscussion?.(idOf(thread), idOf(source))} className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-acc hover:underline">Open source message <ExternalLink size={12} /></button>}</blockquote>; })}
        {item.uncertainties.length > 0 && <div className="rounded-lg border border-amb/25 bg-ambSoft p-3"><p className="text-sm font-semibold">Needs clarification</p><ul className="mt-1 list-disc pl-5 text-sm">{item.uncertainties.map((entry, index) => <li key={`${index}-${entry}`}>{entry}</li>)}</ul></div>}
        {item.decisions.map((decision, index) => <div key={`d-${index}`} className="space-y-2 rounded-lg border border-amb/30 p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canReview} checked={picked.decisions.includes(index)} onChange={() => setSelected((current) => ({ ...current, [itemId]: { ...picked, decisions: picked.decisions.includes(index) ? picked.decisions.filter((value) => value !== index) : [...picked.decisions, index] } }))} className="accent-amber-600" />Decision suggestion</label><input aria-label="Decision title" disabled={!canReview} value={decision.title} onChange={(event) => updateSuggestion(itemId, "decisions", index, "title", event.target.value)} maxLength={200} className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm" /><textarea aria-label="Decision outcome" disabled={!canReview} value={decision.outcome} onChange={(event) => updateSuggestion(itemId, "decisions", index, "outcome", event.target.value)} maxLength={2000} rows={2} className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm" /><textarea aria-label="Decision rationale" disabled={!canReview} value={decision.rationale} onChange={(event) => updateSuggestion(itemId, "decisions", index, "rationale", event.target.value)} maxLength={2000} rows={2} className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm" /><p className="text-xs text-muted">Approved decisions link to the first listed source message.</p>{decision.approvedEntityId && <button type="button" onClick={() => onOpenDecision?.(idOf(decision.approvedEntityId))} className="text-xs text-acc underline">Open saved decision</button>}</div>)}
        {item.tasks.map((task, index) => <div key={`t-${index}`} className="space-y-2 rounded-lg border border-line p-3"><label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!canReview} checked={picked.tasks.includes(index)} onChange={() => setSelected((current) => ({ ...current, [itemId]: { ...picked, tasks: picked.tasks.includes(index) ? picked.tasks.filter((value) => value !== index) : [...picked.tasks, index] } }))} className="accent-teal-700" />Task suggestion</label><input aria-label="Task title" disabled={!canReview} value={task.title} onChange={(event) => updateSuggestion(itemId, "tasks", index, "title", event.target.value)} maxLength={120} className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm" /><textarea aria-label="Task description" disabled={!canReview} value={task.description} onChange={(event) => updateSuggestion(itemId, "tasks", index, "description", event.target.value)} maxLength={2000} rows={2} className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm" /><div className="grid gap-2 sm:grid-cols-2"><select aria-label="Suggested priority" disabled={!canReview} value={task.priority} onChange={(event) => updateSuggestion(itemId, "tasks", index, "priority", event.target.value)} className="rounded-md border border-line bg-bg px-3 py-2 text-sm"><option value="low">Low priority</option><option value="medium">Medium priority</option><option value="high">High priority</option></select><select aria-label="Suggested assignee" disabled={!canReview} value={idOf(task.suggestedAssignee)} onChange={(event) => updateSuggestion(itemId, "tasks", index, "suggestedAssignee", event.target.value || null)} className="rounded-md border border-line bg-bg px-3 py-2 text-sm"><option value="">Unassigned</option>{members.map((member) => { const user = member.user || {}; const userId = idOf(user); return userId ? <option key={userId} value={userId}>{user.name || user.email || "Workspace member"}</option> : null; })}</select><label className="text-xs text-muted">Suggested due date<input type="date" disabled={!canReview} value={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""} onChange={(event) => updateSuggestion(itemId, "tasks", index, "dueDate", event.target.value || null)} className="mt-1 block w-full rounded-md border border-line bg-bg px-3 py-2 text-sm text-text" /></label></div>{task.approvedEntityId && <button type="button" onClick={() => onOpenTask?.(idOf(task.approvedEntityId))} className="text-xs text-acc underline">Open saved task</button>}</div>)}
        {(canReview || canResume) && <div className="flex flex-wrap justify-end gap-2">{canReview && <><button type="button" disabled={workingId === itemId} onClick={() => saveEdits(item)} className="rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover">Save edits</button><button type="button" disabled={workingId === itemId} onClick={() => reject(item)} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:bg-hover"><X size={14} />Reject</button></>}<button type="button" disabled={workingId === itemId || (canReview && !picked.decisions.length && !picked.tasks.length)} onClick={() => approve(item)} className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"><Check size={15} />{workingId === itemId ? "Working…" : canResume ? "Resume approval" : "Approve selected"}</button></div>}
      </article>;
    })}</div>}</div>
  </section>;
}
