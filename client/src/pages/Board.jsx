
import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  CalendarDays,
  MessageSquare,
  Trash2,
  X,
  Pencil,
  Link2,
  ExternalLink,
  GitPullRequest,
} from "lucide-react";

import Button from "../components/ui/Button";
import { getSavedUser, taskAPI, workspaceAPI } from "../services/api";
import { subscribeRealtime } from "../services/realtime";

const columns = [
  { id: "To do", title: "To Do" },
  { id: "In progress", title: "In Progress" },
  { id: "In review", title: "Review" },
  { id: "Done", title: "Done" },
];

const priorityStyles = {
  High: "border border-amb/30 bg-ambSoft text-amb",
  Medium: "border border-line bg-hover text-muted",
  Low: "border border-line bg-surface text-muted",
};

function toDisplayStatus(status) {
  const statusMap = {
    todo: "To do",
    "in-progress": "In progress",
    "in-review": "In review",
    done: "Done",
  };

  return statusMap[status] || status;
}

function toApiStatus(status) {
  const statusMap = {
    "To do": "todo",
    "In progress": "in-progress",
    "In review": "in-review",
    Done: "done",
  };

  return statusMap[status] || "todo";
}

function toDisplayPriority(priority) {
  if (!priority) return "Medium";

  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

// Preserve the date as YYYY-MM-DD for editing and API requests.
function toDateInputValue(date) {
  if (!date) return "";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "";

  return parsedDate.toISOString().slice(0, 10);
}

function formatDueDate(date) {
  if (!date) return "No date";

  const parsedDate =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(`${date}T00:00:00`)
      : new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "No date";

  return parsedDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function normalizeTask(task) {
  return {
    ...task,
    id: task._id || task.id,
    status: toDisplayStatus(task.status),
    priority: toDisplayPriority(task.priority),
    assignee: task.assignee || null,
    comments: Array.isArray(task.comments) ? task.comments : [],
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria) ? task.acceptanceCriteria : [],
    dueDate: toDateInputValue(task.dueDate),
  };
}

function upsertTask(currentTasks, task) {
  const normalized = normalizeTask(task);
  if (!normalized.id) return currentTasks;
  const existing = currentTasks.find((item) => String(item.id) === String(normalized.id));
  if (!existing) return [normalized, ...currentTasks];
  const currentTime = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
  const incomingTime = new Date(normalized.updatedAt || normalized.createdAt || 0).getTime();
  if (currentTime > incomingTime) return currentTasks;
  return currentTasks.map((item) => String(item.id) === String(normalized.id) ? normalized : item);
}

function TaskCard({
  task,
  onEdit,
  onChangeStatus,
  onDelete,
  onOpenComments,
  onOpenContext,
  onDragStart,
  deleting,
  updating,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article
      draggable={!deleting && !updating}
      onDragStart={(event) => onDragStart(event, task.id)}
      className="cursor-grab rounded-xl border border-line bg-surface p-4 transition-colors hover:border-faint active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">
          {task.id?.length > 12 ? task.id.slice(-6) : task.id}
        </span>

        <div className="relative">
          <button
            type="button"
            aria-label={`Options for ${task.title}`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            disabled={deleting || updating}
            className="rounded-md p-1 text-muted hover:bg-hover hover:text-text disabled:opacity-50"
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 w-44 rounded-lg border border-line bg-surface p-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenContext(task);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-text hover:bg-hover"
              >
                <Link2 size={14} />
                Task context
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(task);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-text hover:bg-hover"
              >
                <Pencil size={14} />
                Edit task
              </button>

              <div className="my-1 border-t border-line" />

              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                Move task
              </p>

              {columns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  disabled={
                    task.status === column.id || deleting || updating
                  }
                  onClick={() => {
                    setMenuOpen(false);
                    onChangeStatus(task.id, column.id);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-xs text-text hover:bg-hover disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {column.title}
                </button>
              ))}

              <div className="my-1 border-t border-line" />

              <button
                type="button"
                disabled={deleting || updating}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(task);
                }}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs text-red-500 hover:bg-hover disabled:opacity-50"
              >
                <Trash2 size={14} />
                Delete task
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="mt-2 wrap-break-word text-sm font-semibold leading-5 text-text">
        {task.title}
      </h3>

      <p className="mt-1.5 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-muted">
        {task.description || "No description added."}
      </p>

      {task.pullRequests?.length > 0 && <div className="mt-3 space-y-1.5">{task.pullRequests.map((pullRequest) => <a key={pullRequest._id} href={pullRequest.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-acc hover:underline"><GitPullRequest size={14} /><span>{pullRequest.title || `${pullRequest.owner}/${pullRequest.repository} #${pullRequest.number}`}</span><span className="ml-auto text-[10px] text-muted">{pullRequest.state === "unknown" ? "Unverified · waiting for webhook" : pullRequest.state}</span></a>)}</div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-[11px] font-medium ${
            priorityStyles[task.priority] || priorityStyles.Medium
          }`}
        >
          {task.priority}
        </span>

        {updating && (
          <span className="text-[11px] text-muted">Saving...</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <div className="flex flex-wrap items-center gap-3 text-muted">
          <button type="button" onClick={() => onOpenComments(task)} className="flex items-center gap-1 text-xs hover:text-text" aria-label={`View ${task.comments.length} comments on ${task.title}`}>
            <MessageSquare size={13} />
            {task.comments.length}
          </button>

          <span className="flex items-center gap-1 text-xs">
            <CalendarDays size={13} />
            {formatDueDate(task.dueDate)}
          </span>
        </div>

        <div
          title={`Assigned to ${typeof task.assignee === "object" ? task.assignee?.name || "workspace member" : "Unassigned"}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-hover font-mono text-[10px] font-medium text-text"
        >
          {typeof task.assignee === "object" ? task.assignee?.name?.slice(0, 2).toUpperCase() || "U" : "—"}
        </div>
      </div>
    </article>
  );
}

function TaskModal({
  task,
  members = [],
  membersLoading = false,
  membersError = "",
  onClose,
  onSave,
}) {
  const isEditing = Boolean(task);

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(
    task?.description || ""
  );
  const [criteriaText, setCriteriaText] = useState((task?.acceptanceCriteria || []).map((item) => item.text).join("\n"));
  const [priority, setPriority] = useState(
    task?.priority || "Medium"
  );
  const [dueDate, setDueDate] = useState(task?.dueDate || "");
  const [assignee, setAssignee] = useState(task?.assignee?._id || task?.assignee || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    setSaving(true);
    setError("");

    const payload = {
      title: title.trim(),
      description: description.trim(),
      ...(isEditing ? {} : { status: "todo" }),
      priority: priority.toLowerCase(),
      dueDate: dueDate || null,
      assignee: assignee || null,
      acceptanceCriteria: criteriaText.split("\n").map((text) => text.trim()).filter(Boolean).map((text) => {
        const existing = task?.acceptanceCriteria?.find((item) => item.text === text);
        return existing ? { _id: existing._id, text, completed: existing.completed } : { text, completed: false };
      }),
    };

    try {
      if (isEditing) {
        await onSave(task.id, payload);
      } else {
        await onSave(payload);
      }

      onClose();
    } catch (err) {
      setError(
        err.message ||
          `Failed to ${isEditing ? "update" : "create"} task.`
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="my-auto w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-xl"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text">
              {isEditing ? "Edit task" : "Create task"}
            </h2>

            <p className="mt-1 text-sm text-muted">
              {isEditing
                ? "Update the details of this task."
                : "Add a task to the selected project."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Close dialog"
            className="rounded-md p-2 text-muted hover:bg-hover hover:text-text disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <label
          htmlFor="task-title"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Task title
        </label>

        <input
          id="task-title"
          autoFocus
          required
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Build authentication flow"
          className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label
          htmlFor="task-description"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Description
        </label>

        <textarea
          id="task-description"
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What needs to be done?"
          rows={3}
          className="mb-4 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label htmlFor="task-acceptance-criteria" className="mb-1.5 block text-sm font-medium text-text">Acceptance criteria <span className="font-normal text-muted">(one per line)</span></label>
        <textarea id="task-acceptance-criteria" maxLength={6000} value={criteriaText} onChange={(event) => setCriteriaText(event.target.value)} placeholder="Each item should be verifiable" rows={3} className="mb-4 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc" />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="task-priority"
              className="mb-1.5 block text-sm font-medium text-text"
            >
              Priority
            </label>

            <select
              id="task-priority"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <label htmlFor="task-assignee" className="mb-1.5 block text-sm font-medium text-text">Assignee</label>
        <select id="task-assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)} disabled={membersLoading || Boolean(membersError)} className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc disabled:opacity-60">
          <option value="">{membersLoading ? "Loading workspace members..." : membersError ? "Members unavailable" : "Unassigned"}</option>
          {members.map((member) => {
            const account = member.user || member;
            const memberId = account?._id || account?.id;
            if (!memberId) return null;
            return <option key={memberId} value={memberId}>{account.name || account.email || "Workspace member"}</option>;
          })}
        </select>

        <label
          htmlFor="task-due-date"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Due date <span className="font-normal text-muted">(optional)</span>
        </label>

        <input
          id="task-due-date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
          className="mb-5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc"
        />

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>

          <Button type="submit" disabled={saving}>
            {isEditing ? <Pencil size={15} /> : <Plus size={16} />}
            {saving
              ? isEditing
                ? "Saving..."
                : "Creating..."
              : isEditing
                ? "Save changes"
                : "Create task"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function TaskCommentsDialog({ task, onClose, onAddComment }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onAddComment(task.id, text.trim());
      setText("");
    } catch (failure) {
      setError(failure.message || "Could not add your comment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="task-comments-title" className="my-auto w-full max-w-lg rounded-xl border border-line bg-surface p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="task-comments-title" className="text-lg font-semibold text-text">Task comments</h2>
            <p className="mt-1 text-sm text-muted">{task.title}</p>
          </div>
          <button type="button" aria-label="Close comments" onClick={onClose} className="rounded-md p-2 text-muted hover:bg-hover hover:text-text"><X size={18} /></button>
        </div>

        <div className="max-h-72 space-y-3 overflow-y-auto rounded-lg border border-line bg-bg p-3">
          {task.comments.length === 0 ? <p className="py-4 text-center text-sm text-muted">No comments yet. Start the conversation.</p> : task.comments.map((comment) => (
            <article key={comment._id} className="rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-text">{comment.author?.name || comment.author?.email || "Workspace member"}</p>
                <time className="text-[11px] text-muted" dateTime={comment.createdAt}>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ""}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-5 text-text">{comment.text}</p>
            </article>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <label htmlFor="task-comment-text" className="block text-sm font-medium text-text">Add a comment</label>
          <textarea id="task-comment-text" value={text} onChange={(event) => setText(event.target.value)} maxLength={2000} rows={3} required placeholder="Write a comment..." className="w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc" />
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Close</Button>
            <Button type="submit" disabled={saving || !text.trim()}>{saving ? "Posting..." : "Post comment"}</Button>
          </div>
        </form>
      </section>
    </div>
  );
}

function TaskContextDialog({ task, context, loading, error, onClose, onOpenDecision, onOpenDiscussion, onAddPullRequest, onUpdatePullRequest, onRemovePullRequest, onUpdateTask, onCompleteTask, canManuallyComplete }) {
  const [pullRequestUrl, setPullRequestUrl] = useState("");
  const [editingPullRequest, setEditingPullRequest] = useState(null);
  const [pullRequestError, setPullRequestError] = useState("");
  const [pullRequestBusy, setPullRequestBusy] = useState(false);
  const [pullRequestSuccess, setPullRequestSuccess] = useState("");
  const [completionNote, setCompletionNote] = useState("");
  const [taskActionBusy, setTaskActionBusy] = useState(false);
  const currentUserId = String(getSavedUser()?._id || getSavedUser()?.id || "");
  const isAssignee = String(task.assignee?._id || task.assignee || "") === currentUserId;
  async function savePullRequest(event) {
    event.preventDefault();
    if (pullRequestBusy) return;
    setPullRequestError("");
    let parsedUrl;
    try { parsedUrl = new URL(pullRequestUrl.trim()); } catch { parsedUrl = null; }
    if (!parsedUrl || parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "github.com" || parsedUrl.username || parsedUrl.password || parsedUrl.port || parsedUrl.search || parsedUrl.hash || !/^\/[^/]+\/[^/]+\/pull\/[1-9]\d*$/.test(parsedUrl.pathname)) {
      setPullRequestError("Enter a valid HTTPS GitHub pull request URL, such as https://github.com/owner/repo/pull/123.");
      return;
    }
    setPullRequestBusy(true);
    try {
      if (editingPullRequest) await onUpdatePullRequest(editingPullRequest._id, parsedUrl.href);
      else await onAddPullRequest(parsedUrl.href);
      setPullRequestSuccess("Pull request link saved. Lifecycle status will update only from verified GitHub webhooks.");
      setEditingPullRequest(null);
      setPullRequestUrl("");
    } catch (saveError) {
      setPullRequestError(saveError.message || "Could not save this pull request link.");
    } finally {
      setPullRequestBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="task-context-title" className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="task-context-title" className="text-lg font-semibold text-text">Task context</h2>
            <p className="mt-1 text-sm text-muted">{task.title}</p>
          </div>
          <button type="button" aria-label="Close task context" onClick={onClose} className="rounded-md p-2 text-muted hover:bg-hover"><X size={18} /></button>
        </div>
        <div className="mt-5 space-y-5">
          <section className="rounded-lg border border-line p-4">
            <h3 className="text-sm font-semibold text-text">Task details</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{task.description || "No description provided."}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted">Status</dt><dd className="font-medium text-text">{task.status}</dd></div><div><dt className="text-muted">Priority</dt><dd className="font-medium text-text">{task.priority}</dd></div><div><dt className="text-muted">Assignee</dt><dd className="font-medium text-text">{typeof task.assignee === "object" ? task.assignee?.name || task.assignee?.email : "Unassigned"}</dd></div><div><dt className="text-muted">Created by</dt><dd className="font-medium text-text">{task.createdBy?.name || task.createdBy?.email || "Workspace member"}</dd></div><div><dt className="text-muted">Due date</dt><dd className="font-medium text-text">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No deadline"}</dd></div><div><dt className="text-muted">Pull requests</dt><dd className="font-medium text-text">{task.pullRequests?.length || 0} linked</dd></div></dl>
            {isAssignee && task.status !== "Done" && <div className="mt-4 flex flex-wrap items-center gap-2"><p className="mr-auto text-xs text-muted">{task.status === "To do" ? "Next: start work on this task." : task.status === "In progress" ? "Next: submit your work for review." : "Next: return to work if changes were requested."}</p>{task.status === "To do" && <Button size="sm" disabled={taskActionBusy} onClick={async () => { setTaskActionBusy(true); try { await onUpdateTask({ status: "in-progress" }); } catch (cause) { setPullRequestError(cause.message || "Could not start this task."); } finally { setTaskActionBusy(false); } }}>Start work</Button>}{task.status === "In progress" && <Button size="sm" disabled={taskActionBusy} onClick={async () => { setTaskActionBusy(true); try { await onUpdateTask({ status: "in-review" }); } catch (cause) { setPullRequestError(cause.message || "Could not submit this task for review."); } finally { setTaskActionBusy(false); } }}>Submit for review</Button>}{task.status === "In review" && <Button size="sm" variant="secondary" disabled={taskActionBusy} onClick={async () => { setTaskActionBusy(true); try { await onUpdateTask({ status: "in-progress" }); } catch (cause) { setPullRequestError(cause.message || "Could not return this task to work."); } finally { setTaskActionBusy(false); } }}>Return to work</Button>}</div>}
            {task.acceptanceCriteria?.length > 0 && <div className="mt-4"><h4 className="text-xs font-semibold text-text">Acceptance criteria</h4><ul className="mt-2 space-y-2">{task.acceptanceCriteria.map((criterion) => <li key={criterion._id} className="flex items-start gap-2 text-sm"><input type="checkbox" checked={Boolean(criterion.completed)} disabled={taskActionBusy || criterion.completed || task.status === "done"} aria-label={`Complete acceptance criterion: ${criterion.text}`} onChange={async () => { setTaskActionBusy(true); try { await onUpdateTask({ acceptanceCriteria: task.acceptanceCriteria.map((item) => ({ _id: item._id, text: item.text, completed: item._id === criterion._id || item.completed })) }); } catch (cause) { setPullRequestError(cause.message || "Could not update acceptance criteria."); } finally { setTaskActionBusy(false); } }} className="mt-0.5 accent-teal-600"/><span className={criterion.completed ? "text-muted line-through" : "text-text"}>{criterion.text}</span></li>)}</ul></div>}
            {task.status === "in-review" && canManuallyComplete && <form className="mt-4 space-y-2 border-t border-line pt-3" onSubmit={async (event) => { event.preventDefault(); if (!completionNote.trim() || taskActionBusy) return; setTaskActionBusy(true); try { await onCompleteTask(completionNote.trim()); setCompletionNote(""); } catch (cause) { setPullRequestError(cause.message || "Could not complete this task."); } finally { setTaskActionBusy(false); } }}><label htmlFor="task-completion-note" className="block text-xs font-medium text-text">Authorized manual completion</label><input id="task-completion-note" value={completionNote} onChange={(event) => setCompletionNote(event.target.value)} maxLength={500} required placeholder="Why is this task complete?" className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm text-text"/><Button type="submit" disabled={taskActionBusy}>{taskActionBusy ? "Completing…" : "Complete task"}</Button></form>}
            {task.completionMethod && <p className="mt-3 text-xs text-muted">Completed by {task.completedBy?.name || "a workspace admin"} via {task.completionMethod === "github" ? "merged pull request" : "manual confirmation"}{task.completionNote ? ` · ${task.completionNote}` : ""}</p>}
          </section>
          <section className="rounded-lg border border-line p-4"><h3 className="text-sm font-semibold text-text">GitHub pull requests</h3><p className="mt-1 text-xs text-muted">Lifecycle state is updated only from verified GitHub webhooks.</p>
            {task.pullRequests?.map((pullRequest) => <div key={pullRequest._id} className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-hover p-3"><GitPullRequest size={15} className="text-acc" /><a href={pullRequest.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 break-all text-sm text-acc hover:underline">{pullRequest.owner}/{pullRequest.repository} #{pullRequest.number}</a><span className="text-xs text-muted">{pullRequest.state === "unknown" ? "Awaiting webhook" : pullRequest.state}{pullRequest.draft ? " · draft" : ""}</span><button type="button" className="text-xs text-muted hover:text-text" onClick={() => { setEditingPullRequest(pullRequest); setPullRequestUrl(pullRequest.url); setPullRequestError(""); }}>Edit</button><button type="button" disabled={pullRequestBusy} className="text-xs text-red-500 disabled:opacity-50" onClick={async () => { setPullRequestError(""); setPullRequestBusy(true); try { await onRemovePullRequest(pullRequest._id); } catch (removeError) { setPullRequestError(removeError.message || "Could not remove this link."); } finally { setPullRequestBusy(false); } }}>Remove</button></div>)}
            <form onSubmit={savePullRequest} className="mt-3 space-y-2"><label htmlFor="github-pr-url" className="block text-xs font-medium text-text">{editingPullRequest ? "Update pull request URL" : "Add pull request URL"}</label><div className="flex flex-col gap-2 sm:flex-row"><input id="github-pr-url" type="url" value={pullRequestUrl} onChange={(event) => { setPullRequestUrl(event.target.value); setPullRequestError(""); }} placeholder="https://github.com/owner/repo/pull/123" aria-invalid={Boolean(pullRequestError)} aria-describedby={pullRequestError ? "github-pr-url-error" : undefined} className="h-10 min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 text-sm text-text outline-none focus:border-acc" required /><Button type="submit" disabled={pullRequestBusy}>{pullRequestBusy ? "Saving..." : editingPullRequest ? "Update link" : "Add link"}</Button>{editingPullRequest && <Button type="button" variant="secondary" disabled={pullRequestBusy} onClick={() => { setEditingPullRequest(null); setPullRequestUrl(""); setPullRequestError(""); }}>Cancel</Button>}</div><p className="text-xs text-muted">Status cannot be set here. DevSync updates it from signed GitHub webhook events.</p>{pullRequestSuccess && <p role="status" className="text-sm text-teal-600">{pullRequestSuccess}</p>}{pullRequestError && <p id="github-pr-url-error" role="alert" className="text-sm text-red-500">{pullRequestError}</p>}</form>
          </section>
        {loading ? <p role="status" className="py-4 text-center text-sm text-muted">Loading linked context...</p> : error ? <p role="alert" className="rounded-lg border border-red-500/30 p-3 text-sm text-red-500">{error}</p> : !context || (!context.decisions?.length && !context.discussions?.length) ? <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">No decisions or source discussions are linked to this task yet.</p> : (
          <div className="mt-5 space-y-5">
            {context.decisions?.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-text">Linked decisions</h3><div className="space-y-2">{context.decisions.map((decision) => <div key={decision.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"><span className="text-sm text-text">{decision.title}</span><Button size="sm" variant="secondary" onClick={() => onOpenDecision(decision.id)}><ExternalLink size={14} />Open decision</Button></div>)}</div></div>}
            {context.discussions?.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-text">Linked discussions</h3><div className="space-y-2">{context.discussions.map((discussion) => <div key={discussion.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"><span className="text-sm text-text">{discussion.title}</span><Button size="sm" variant="secondary" onClick={() => onOpenDiscussion(discussion.id)}><ExternalLink size={14} />Open discussion</Button></div>)}</div></div>}
            {context.decisions?.filter((decision) => decision.discussionId).map((decision) => <div key={`source-${decision.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-amb/30 bg-ambSoft p-3"><span className="text-xs text-text">Source for “{decision.title}”</span><Button size="sm" variant="secondary" onClick={() => onOpenDiscussion(decision.discussionId, decision.discussionMessageId)}><ExternalLink size={14} />Open source</Button></div>)}
          </div>
        )}</div>
      </section>
    </div>
  );
}

export default function Board({ workspaceId, projectId, workspace, project, onOpenDecision = () => {}, onOpenDiscussion = () => {} }) {
  const [tasks, setTasks] = useState([]);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [membersError, setMembersError] = useState("");
  const [actionError, setActionError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [pendingDeleteTask, setPendingDeleteTask] = useState(null);
  const [commentingTask, setCommentingTask] = useState(null);
  const [createStatus, setCreateStatus] = useState("To do");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [membersLoadAttempt, setMembersLoadAttempt] = useState(0);
  const [contextTask, setContextTask] = useState(null);
  const [taskContext, setTaskContext] = useState(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState("");

  const openTaskContext = useCallback(async (task) => {
    setContextTask(task);
    setTaskContext(null);
    setContextError("");
    setContextLoading(true);
    try {
      const result = await taskAPI.getContext(task.id, workspaceId, projectId);
      setTaskContext(result.data || null);
    } catch (error) {
      setContextError(error.message || "Could not load task context.");
    } finally {
      setContextLoading(false);
    }
  }, [workspaceId, projectId]);

  useEffect(() => {
    let active = true;

    if (!workspaceId || !projectId) {
      return () => { active = false; };
    }

    async function loadTasks() {
      try {
        setLoadError("");

        const response = await taskAPI.getAll(workspaceId, projectId);

        if (active) {
          const normalized = (response.data || []).map(normalizeTask);
          setTasks(normalized);
          const focusId = sessionStorage.getItem("devsync_task_focus");
          const focusedTask = focusId && normalized.find((task) => String(task.id) === String(focusId));
          if (focusId) sessionStorage.removeItem("devsync_task_focus");
          if (focusedTask) openTaskContext(focusedTask);
          setLoadError("");
        }
      } catch (error) {
        if (active) {
          setLoadError(error.message || "Failed to load tasks.");
          console.error("Failed to load tasks:", error);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadTasks();

    return () => {
      active = false;
    };
  }, [workspaceId, projectId, loadAttempt, openTaskContext]);

  useEffect(() => {
    const isCurrentProject = (event) => String(event?.workspaceId) === String(workspaceId) && String(event?.projectId) === String(projectId);
    const unsubscribers = [
      subscribeRealtime("task:created", (event) => {
        if (isCurrentProject(event) && event.task) setTasks((current) => upsertTask(current, event.task));
      }),
      subscribeRealtime("task:updated", (event) => {
        if (isCurrentProject(event) && event.task) setTasks((current) => upsertTask(current, event.task));
      }),
      subscribeRealtime("task:deleted", (event) => {
        if (isCurrentProject(event) && event.taskId) setTasks((current) => current.filter((task) => String(task.id) !== String(event.taskId)));
      }),
      subscribeRealtime("realtime:resync", (event) => {
        if (!isCurrentProject(event)) return;
        setLoading(true);
        setLoadAttempt((attempt) => attempt + 1);
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [workspaceId, projectId]);

  useEffect(() => {
    let active = true;
    async function loadMembers() {
      try {
        const response = await workspaceAPI.getById(workspaceId);
        if (active) {
          setMembers(response.workspace?.members || []);
          setMembersError("");
        }
      } catch (error) {
        if (active) {
          setMembers([]);
          setMembersError(error.message || "Workspace members could not be loaded.");
        }
      } finally {
        if (active) setMembersLoading(false);
      }
    }
    loadMembers();
    return () => { active = false; };
  }, [workspaceId, membersLoadAttempt]);

  async function changeStatus(taskId, newStatus) {
    const task = tasks.find((item) => item.id === taskId);

    if (
      !task ||
      task.status === newStatus ||
      updatingId ||
      deletingId
    ) {
      return;
    }

    const previousTasks = tasks;

    setActionError("");
    setSuccessMessage("");
    setUpdatingId(taskId);

    setTasks((current) =>
      current.map((item) =>
        item.id === taskId ? { ...item, status: newStatus } : item
      )
    );

    try {
      const response = await taskAPI.update(taskId, {
        title: task.title,
        description: task.description || "",
        status: toApiStatus(newStatus),
        priority: task.priority.toLowerCase(),
        dueDate: task.dueDate || null,
      }, workspaceId, projectId);

      setTasks((current) =>
        current.map((item) =>
          item.id === taskId ? normalizeTask(response.data) : item
        )
      );
      setSuccessMessage("Task moved.");
    } catch (error) {
      setTasks(previousTasks);
      setActionError(error.message || "Failed to update task status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function createTask(newTask) {
    setActionError("");

    const response = await taskAPI.create({ ...newTask, workspaceId, projectId });

    setTasks((current) => upsertTask(current, response.data));
    setSuccessMessage("Task created.");
  }

  async function editTask(taskId, updates) {
    setActionError("");

    const response = await taskAPI.update(taskId, updates, workspaceId, projectId);

    setTasks((current) => upsertTask(current, response.data));
    setSuccessMessage("Task updated.");
  }

  async function deleteTask(task) {
    setPendingDeleteTask(task);
    setActionError("");
  }

  async function confirmDeleteTask() {
    if (!pendingDeleteTask) return;
    if (updatingId || deletingId) return;
    const taskId = pendingDeleteTask.id;
    setDeletingId(taskId);
    setActionError("");
    setSuccessMessage("");

    try {
      await taskAPI.delete(taskId, workspaceId, projectId);

      setTasks((current) =>
        current.filter((task) => task.id !== taskId)
      );
      setPendingDeleteTask(null);
      setSuccessMessage("Task deleted.");
    } catch (error) {
      setActionError(error.message || "Failed to delete task.");
    } finally {
      setDeletingId(null);
    }
  }

  async function addComment(taskId, text) {
    setActionError("");
    const response = await taskAPI.addComment(taskId, text, workspaceId, projectId);
    const updatedTask = normalizeTask(response.data);
    setTasks((current) => current.map((task) => task.id === taskId ? updatedTask : task));
    setCommentingTask(updatedTask);
    setSuccessMessage("Comment added.");
  }

  async function savePullRequestLink(taskId, request) {
    const response = await request();
    const updatedTask = normalizeTask(response.data);
    setTasks((current) => upsertTask(current, updatedTask));
    setContextTask(updatedTask);
    return updatedTask;
  }

  async function updateTaskContext(taskId, updates) {
    const response = await taskAPI.update(taskId, updates, workspaceId, projectId);
    const updated = normalizeTask(response.data);
    setTasks((current) => upsertTask(current, updated));
    setContextTask(updated);
    return updated;
  }

  async function completeTask(taskId, note) {
    const response = await taskAPI.complete(taskId, note, workspaceId, projectId);
    const updated = normalizeTask(response.data);
    setTasks((current) => upsertTask(current, updated));
    setContextTask(updated);
    setSuccessMessage("Task completed.");
    return updated;
  }

  function handleDragStart(event, taskId) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
  }

  function handleDrop(event, status) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/plain");
    if (taskId) changeStatus(taskId, status);
  }

  const filteredTasks = tasks.filter((task) =>
    `${task.title} ${task.id} ${task.description || ""}`
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  function openCreateModal(status = "To do") {
    setActionError("");
    setSuccessMessage("");
    setEditingTask(null);
    setCreateStatus(status);
    setShowModal(true);
  }

  function openEditModal(task) {
    setActionError("");
    setShowModal(false);
    setEditingTask(task);
  }

  function closeModal() {
    setShowModal(false);
    setEditingTask(null);
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">
            {workspace?.name || "Workspace"} / {project?.name || "Project"}
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Task Board
          </h1>

          <p className="mt-2 text-sm text-muted">
            Move work forward and keep every task connected to its context.
          </p>
        </div>

        <Button onClick={() => openCreateModal("To do")}>
          <Plus size={17} />
          New task
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks..."
            aria-label="Search tasks"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <SlidersHorizontal size={15} />
          <span>
            {filteredTasks.length}{" "}
            {filteredTasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>
      </div>

      {(loadError || actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 px-4 py-3 text-sm text-red-500"
        >
          {loadError || actionError}

          {loadError && (
            <button
              type="button"
              onClick={() => { setLoading(true); setLoadAttempt((attempt) => attempt + 1); }}
              className="ml-3 font-medium underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {membersError && <div role="alert" className="rounded-lg border border-red-500/30 px-4 py-3 text-sm text-red-500">{membersError}<button type="button" onClick={() => { setMembersLoading(true); setMembersLoadAttempt((attempt) => attempt + 1); }} className="ml-3 font-medium underline">Retry member list</button></div>}
      {successMessage && <p role="status" className="rounded-lg border border-acc/30 bg-accSoft px-4 py-3 text-sm text-acc">{successMessage}</p>}

      {loading ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-12 text-center">
          <p className="text-sm text-muted">
            Loading tasks for {project?.name || "this project"}...
          </p>
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-12 text-center text-sm text-muted">Project tasks are unavailable. Use Retry above to load them again.</div>
      ) : (
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {columns.map((column) => {
            const columnTasks = filteredTasks.filter(
              (task) => task.status === column.id
            );

            return (
              <section
                key={column.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, column.id)}
                className="min-w-0 rounded-xl border border-line bg-col p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1 py-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        column.id === "Done" || column.id === "In progress"
                          ? "bg-acc"
                          : "bg-faint"
                      }`}
                    />

                    <h2 className="text-sm font-semibold text-text">
                      {column.title}
                    </h2>

                    <span className="font-mono text-xs text-muted">
                      {columnTasks.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => openCreateModal(column.id)}
                    aria-label={`Add task to ${column.title}`}
                    title={`Add task to ${column.title}`}
                    className="rounded-md p-1 text-muted transition-colors hover:bg-hover hover:text-text"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onEdit={openEditModal}
                      onChangeStatus={changeStatus}
                      onDelete={deleteTask}
                      onOpenComments={setCommentingTask}
                      onOpenContext={openTaskContext}
                      onDragStart={handleDragStart}
                      deleting={deletingId === task.id}
                      updating={updatingId === task.id}
                    />
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="rounded-lg border border-dashed border-faint px-3 py-6 text-center">
                      <p className="text-xs text-muted">
                        {search
                          ? "No matching tasks"
                          : "No tasks in this column"}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => openCreateModal(column.id)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-faint px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:border-line hover:bg-hover hover:text-text"
                >
                  <Plus size={14} />
                  Add a task
                </button>
              </section>
            );
          })}
        </div>
      )}

      {showModal && (
        <TaskModal
          key={createStatus}
          initialStatus={createStatus}
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          onClose={closeModal}
          onSave={createTask}
        />
      )}

      {editingTask && (
        <TaskModal
          key={editingTask.id}
          task={editingTask}
          members={members}
          membersLoading={membersLoading}
          membersError={membersError}
          onClose={closeModal}
          onSave={editTask}
        />
      )}

      {pendingDeleteTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingId) setPendingDeleteTask(null); }}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-task-title" className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-xl">
            <h2 id="delete-task-title" className="text-lg font-semibold text-text">Delete task?</h2>
            <p className="mt-2 text-sm text-muted">“{pendingDeleteTask.title}” and its comments will be permanently deleted.</p>
            {actionError && <p role="alert" className="mt-3 text-sm text-red-500">{actionError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="secondary" disabled={Boolean(deletingId)} onClick={() => setPendingDeleteTask(null)}>Cancel</Button>
              <Button type="button" variant="danger" disabled={Boolean(deletingId)} onClick={confirmDeleteTask}>{deletingId ? "Deleting..." : "Delete task"}</Button>
            </div>
          </section>
        </div>
      )}

      {commentingTask && <TaskCommentsDialog task={commentingTask} onClose={() => setCommentingTask(null)} onAddComment={addComment} />}
      {contextTask && <TaskContextDialog task={contextTask} context={taskContext} loading={contextLoading} error={contextError} canManuallyComplete={String(workspace?.createdBy || "") === String(getSavedUser()?._id || getSavedUser()?.id || "") || members.some((member) => String(member.user?._id || member.user) === String(getSavedUser()?._id || getSavedUser()?.id || "") && member.role === "Admin")} onUpdateTask={(updates) => updateTaskContext(contextTask.id, updates)} onCompleteTask={(note) => completeTask(contextTask.id, note)} onClose={() => setContextTask(null)} onOpenDecision={(id) => { setContextTask(null); onOpenDecision(id); }} onOpenDiscussion={(id, messageId) => { setContextTask(null); onOpenDiscussion(id, messageId); }} onAddPullRequest={(url) => savePullRequestLink(contextTask.id, () => taskAPI.addPullRequest(contextTask.id, url, workspaceId, projectId))} onUpdatePullRequest={(prId, url) => savePullRequestLink(contextTask.id, () => taskAPI.updatePullRequest(contextTask.id, prId, url, workspaceId, projectId))} onRemovePullRequest={(prId) => savePullRequestLink(contextTask.id, () => taskAPI.removePullRequest(contextTask.id, prId, workspaceId, projectId))} />}
    </div>
  );
}
