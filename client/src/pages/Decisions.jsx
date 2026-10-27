
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GitMerge,
  Search,
  Plus,
  ArrowUpRight,
  Link2,
  CalendarDays,
  X,
  Filter,
  MessageSquare,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";

import Button from "../components/ui/Button";
import {
  decisionAPI,
  discussionAPI,
  taskAPI,
} from "../services/api";

function formatDate(value) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date unavailable";

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDecisionId(databaseId) {
  if (!databaseId) return "DEC-UNKNOWN";

  return `DEC-${String(databaseId).slice(-6).toUpperCase()}`;
}

function getResponseData(response) {
  return response?.data ?? response;
}

function normalizeDecision(decision, discussions = [], tasks = []) {
  if (!decision) return null;

  const rawDiscussionId =
    typeof decision.discussionId === "object"
      ? decision.discussionId?._id || ""
      : decision.discussionId || "";

  const discussionId = String(rawDiscussionId);

  const sourceDiscussion = discussions.find(
    (discussion) =>
      String(discussion._id || discussion.id) === discussionId
  );

  const rawLinkedTask = decision.linkedTask;

  const linkedTaskId =
    rawLinkedTask && typeof rawLinkedTask === "object"
      ? String(rawLinkedTask._id || rawLinkedTask.id || "")
      : String(rawLinkedTask || "");

  const linkedTask =
    rawLinkedTask && typeof rawLinkedTask === "object"
      ? rawLinkedTask
      : tasks.find(
          (task) => String(task._id || task.id) === linkedTaskId
        ) || null;

  return {
    id: getDecisionId(decision._id || decision.id),
    databaseId: String(decision._id || decision.id || ""),
    discussionId,
    discussionTitle: sourceDiscussion?.title || "Linked discussion",
    title: decision.title || "Untitled decision",
    summary: decision.summary || "",
    context: decision.context || "",
    project: decision.project || "Unassigned",
    taskId: decision.taskId || "",
    linkedTaskId,
    linkedTask,
    author: decision.createdBy || "Workspace member",
    date: formatDate(decision.createdAt || decision.updatedAt),
    status: decision.lifecycleStatus || "Accepted",
    supersededBy: decision.supersededBy || null,
  };
}

function DecisionModal({ onClose, onCreate, tasks }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [context, setContext] = useState("");
  const [project, setProject] = useState("");
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !summary.trim() || !context.trim()) {
      setError("Please complete the title, outcome, and context.");
      return;
    }

    if (project.trim().length < 2) {
      setError("Please enter a project name with at least 2 characters.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const selectedTask = tasks.find(
        (task) => String(task._id || task.id) === linkedTaskId
      );

      await onCreate({
        title: title.trim(),
        summary: summary.trim(),
        context: context.trim(),
        project: project.trim(),
        linkedTask: linkedTaskId || null,
        taskId: selectedTask
          ? String(selectedTask._id || selectedTask.id)
          : "",
      });

      onClose();
    } catch (err) {
      setError(
        err.message || "Could not save the decision. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const canSave =
    !saving &&
    title.trim().length >= 2 &&
    Boolean(summary.trim()) &&
    Boolean(context.trim()) &&
    project.trim().length >= 2;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-line bg-surface p-6"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-amb/30 bg-ambSoft text-amb">
              <GitMerge size={20} />
            </div>

            <h2 className="text-lg font-semibold text-text">
              Record a decision
            </h2>

            <p className="mt-1 text-sm leading-5 text-muted">
              Capture the outcome and reasoning so your team can refer back to
              it. A discussion will also be created automatically.
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
          htmlFor="decision-title"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Decision title
        </label>

        <input
          id="decision-title"
          autoFocus
          required
          minLength={2}
          maxLength={200}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Use JWT for authentication"
          className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label
          htmlFor="decision-summary"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Outcome
        </label>

        <textarea
          id="decision-summary"
          required
          maxLength={5000}
          rows={2}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="What did the team decide?"
          className="mb-4 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label
          htmlFor="decision-context"
          className="mb-1.5 block text-sm font-medium text-text"
        >
          Context and reasoning
        </label>

        <textarea
          id="decision-context"
          required
          maxLength={5000}
          rows={3}
          value={context}
          onChange={(event) => setContext(event.target.value)}
          placeholder="Why was this approach chosen? What alternatives were considered?"
          className="mb-4 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="decision-project"
              className="mb-1.5 block text-sm font-medium text-text"
            >
              Project
            </label>

            <input
              id="decision-project"
              required
              minLength={2}
              maxLength={100}
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder="e.g. DevSync"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
            />
          </div>

          <div>
            <label
              htmlFor="decision-linked-task"
              className="mb-1.5 block text-sm font-medium text-text"
            >
              Related task
              <span className="ml-1 font-normal text-muted">(optional)</span>
            </label>

            <select
              id="decision-linked-task"
              value={linkedTaskId}
              onChange={(event) => setLinkedTaskId(event.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc"
            >
              <option value="">No task linked</option>

              {tasks.map((task) => (
                <option
                  key={task._id || task.id}
                  value={String(task._id || task.id)}
                >
                  {task.title} · {task.status || "todo"}
                </option>
              ))}
            </select>

            {tasks.length === 0 && (
              <p className="mt-1.5 text-xs text-muted">
                No tasks available. You can still record a decision.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500"
          >
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
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

          <Button type="submit" disabled={!canSave}>
            {saving ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <Plus size={16} />
            )}
            {saving ? "Saving..." : "Save decision"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Decisions() {
  const [decisions, setDecisions] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All projects");
  const [showModal, setShowModal] = useState(false);
  const [selectedDecisionId, setSelectedDecisionId] = useState("");
  const [showDecisionDetail, setShowDecisionDetail] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const [decisionResponse, discussionResponse] = await Promise.all([
        decisionAPI.getAll(),
        discussionAPI.getAll(),
      ]);

      const savedRecords = getResponseData(decisionResponse);
      const discussions = getResponseData(discussionResponse);

      if (!Array.isArray(savedRecords) || !Array.isArray(discussions)) {
        throw new Error("The server returned an unexpected decisions response.");
      }

      // Load tasks separately so a task-loading issue doesn't break the Decision Log.
      let availableTasks = [];

      try {
        const taskResponse = await taskAPI.getAll();
        const taskRecords = getResponseData(taskResponse);

        if (Array.isArray(taskRecords)) {
          availableTasks = taskRecords;
        }
      } catch (taskError) {
        console.error("Could not load tasks for the Decision Log:", taskError);
      }

      setTasks(availableTasks);

      const savedDecisions = savedRecords
        .map((decision) =>
          normalizeDecision(decision, discussions, availableTasks)
        )
        .filter((decision) => decision && decision.databaseId);

      setDecisions(savedDecisions);

      setSelectedDecisionId((currentId) => {
        if (
          savedDecisions.some(
            (decision) => decision.databaseId === currentId
          )
        ) {
          return currentId;
        }

        return savedDecisions[0]?.databaseId || "";
      });
    } catch (err) {
      setPageError(
        err.message ||
          "Unable to load decisions. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  const projects = useMemo(
    () => [
      "All projects",
      ...new Set(decisions.map((decision) => decision.project)),
    ],
    [decisions]
  );

  const filteredDecisions = useMemo(() => {
    const searchTerm = search.toLowerCase().trim();

    return decisions.filter((decision) => {
      const searchableText = [
        decision.id,
        decision.title,
        decision.summary,
        decision.context,
        decision.taskId,
        decision.linkedTask?.title,
        decision.linkedTask?.status,
        decision.discussionTitle,
        decision.project,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(searchTerm);

      const matchesProject =
        projectFilter === "All projects" ||
        decision.project === projectFilter;

      return matchesSearch && matchesProject;
    });
  }, [decisions, search, projectFilter]);

  const selectedDecision =
    filteredDecisions.find(
      (decision) => decision.databaseId === selectedDecisionId
    ) || filteredDecisions[0];

  async function createDecision(data) {
    // Create the source discussion first to preserve the decision's history link.
    const discussionResponse = await discussionAPI.create({
      title: `Decision: ${data.title}`,
      project: data.project,
      taskId: data.taskId,
      message:
        data.context ||
        data.summary ||
        `The team recorded this decision: ${data.title}`,
    });

    const createdDiscussion = getResponseData(discussionResponse);
    const discussionId = createdDiscussion?._id || createdDiscussion?.id;

    if (!discussionId) {
      throw new Error(
        "The discussion was created, but the server did not return its ID."
      );
    }

    // Save the decision and its actual Task document reference.
    const decisionResponse = await decisionAPI.create({
      title: data.title,
      summary: data.summary,
      context: data.context,
      project: data.project,
      taskId: data.taskId,
      linkedTask: data.linkedTask || null,
      discussionId,
      createdBy: "Mansi Sinha",
    });

    const savedRecord = getResponseData(decisionResponse);

    if (!savedRecord?._id && !savedRecord?.id) {
      throw new Error(
        "The discussion was created, but the standalone decision was not returned."
      );
    }

    const newDecision = normalizeDecision(
      {
        ...savedRecord,
        discussionId,
        linkedTask:
          savedRecord.linkedTask ||
          (data.linkedTask
            ? tasks.find(
                (task) =>
                  String(task._id || task.id) === String(data.linkedTask)
              ) || null
            : null),
      },
      [
        {
          ...createdDiscussion,
          _id: discussionId,
          title: createdDiscussion.title || `Decision: ${data.title}`,
        },
      ],
      tasks
    );

    setDecisions((current) => [
      newDecision,
      ...current.filter(
        (item) => item.databaseId !== newDecision.databaseId
      ),
    ]);

    setSelectedDecisionId(newDecision.databaseId);
    setShowDecisionDetail(true);
    setSearch("");
    setProjectFilter("All projects");
    setPageError("");
  }

  async function changeDecisionStatus(lifecycleStatus) {
    if (
      !selectedDecision?.databaseId ||
      lifecycleStatus === selectedDecision.status ||
      savingStatus
    ) {
      return;
    }

    try {
      setSavingStatus(true);
      setPageError("");

      const response = await decisionAPI.updateStatus(
        selectedDecision.databaseId,
        lifecycleStatus
      );

      const updatedRecord = getResponseData(response);

      const updatedDecision = normalizeDecision(
        {
          ...updatedRecord,
          linkedTask:
            updatedRecord.linkedTask || selectedDecision.linkedTask,
          discussionId:
            typeof updatedRecord.discussionId === "object"
              ? updatedRecord.discussionId?._id
              : updatedRecord.discussionId ||
                selectedDecision.discussionId,
        },
        [],
        tasks
      );

      setDecisions((current) =>
        current.map((decision) =>
          decision.databaseId === updatedDecision.databaseId
            ? {
                ...decision,
                ...updatedDecision,
                discussionTitle: decision.discussionTitle,
              }
            : decision
        )
      );
    } catch (err) {
      setPageError(err.message || "Could not update the decision status.");
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">Workspace / Engineering</p>

          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Decision Log
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            A searchable record of what your team decided, why it was chosen,
            and which work it affects.
          </p>
        </div>

        <Button onClick={() => setShowModal(true)}>
          <Plus size={17} />
          Record decision
        </Button>
      </div>

      {/* Error */}
      {pageError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-sm text-red-500">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{pageError}</span>
          </div>

          <Button variant="secondary" onClick={loadDecisions}>
            Retry
          </Button>
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Recorded decisions</p>
          <p className="mt-3 font-mono text-2xl text-text">
            {loading ? "—" : decisions.length}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Projects covered</p>
          <p className="mt-3 font-mono text-2xl text-text">
            {loading
              ? "—"
              : new Set(decisions.map((decision) => decision.project)).size}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Linked to tasks</p>
          <p className="mt-3 font-mono text-2xl text-text">
            {loading
              ? "—"
              : decisions.filter(
                  (decision) =>
                    decision.linkedTaskId || decision.taskId.trim()
                ).length}
          </p>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search decisions, reasoning, or tasks..."
            aria-label="Search decisions"
            className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={16} className="text-muted" />

          <select
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
            aria-label="Filter by project"
            className="h-10 min-w-40 rounded-lg border border-line bg-surface px-3 text-sm text-text outline-none focus:border-acc"
          >
            {projects.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Decision list and detail */}
      <div
        className={`grid grid-cols-1 items-start gap-5 ${
          showDecisionDetail
            ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
            : ""
        }`}
      >
        {/* Decision list */}
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-text">All decisions</h2>

            <span className="font-mono text-xs text-muted">
              {loading ? "…" : filteredDecisions.length}
            </span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted">
              <LoaderCircle size={18} className="animate-spin" />
              Loading decisions...
            </div>
          ) : filteredDecisions.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-bg text-muted">
                <GitMerge size={21} />
              </div>

              <h3 className="text-sm font-semibold text-text">
                {search || projectFilter !== "All projects"
                  ? "No matching decisions"
                  : "No decisions yet"}
              </h3>

              <p className="mt-2 max-w-sm text-sm leading-5 text-muted">
                {search || projectFilter !== "All projects"
                  ? "Try changing your search or project filter."
                  : "Record your first decision to keep important engineering choices and their reasoning in one place."}
              </p>

              {!search && projectFilter === "All projects" && (
                <Button
                  className="mt-4"
                  onClick={() => setShowModal(true)}
                >
                  <Plus size={16} />
                  Record decision
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-line">
              {filteredDecisions.map((decision) => {
                const isSelected =
                  selectedDecision?.databaseId === decision.databaseId;

                const taskTitle =
                  decision.linkedTask?.title || decision.taskId;

                return (
                  <button
                    key={decision.databaseId}
                    type="button"
                    onClick={() => {
                      setSelectedDecisionId(decision.databaseId);
                      setShowDecisionDetail(true);
                    }}
                    className={`group w-full px-5 py-4 text-left transition-colors hover:bg-hover ${
                      isSelected && showDecisionDetail ? "bg-hover" : ""
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amb/30 bg-ambSoft text-amb">
                        <GitMerge size={17} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] text-muted">
                            {decision.id}
                          </span>

                          <span
                            className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                              decision.status === "Accepted"
                                ? "border-acc/25 bg-acc/10 text-acc"
                                : decision.status === "Superseded"
                                  ? "border-amb/30 bg-ambSoft text-amb"
                                  : "border-line bg-bg text-muted"
                            }`}
                          >
                            {decision.status}
                          </span>
                        </div>

                        <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-text">
                          {decision.title}
                        </h3>

                        <p className="mt-1 line-clamp-2 text-sm leading-5 text-muted">
                          {decision.summary}
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                          <span className="inline-flex items-center gap-1.5">
                            <GitMerge size={13} />
                            {decision.project}
                          </span>

                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays size={13} />
                            {decision.date}
                          </span>

                          {taskTitle && (
                            <span className="inline-flex max-w-full items-center gap-1.5">
                              <Link2 size={13} className="shrink-0" />
                              <span className="truncate">{taskTitle}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <ArrowUpRight
                        size={17}
                        className="mt-1 shrink-0 text-muted transition-colors group-hover:text-acc"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Decision detail panel */}
        {showDecisionDetail && (
          <section className="min-w-0 overflow-hidden rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-text">
                  Decision details
                </h2>
                <p className="mt-1 text-xs text-muted">
                  Outcome, context, and status
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={() => setShowDecisionDetail(false)}
              >
                Done
              </Button>
            </div>

            {!selectedDecision ? (
              <div className="p-8 text-center text-sm text-muted">
                Select a decision from the list to see its details.
              </div>
            ) : (
              <div className="space-y-6 p-5">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-muted">
                      {selectedDecision.id}
                    </span>

                    <span
                      className={`rounded-md border px-2 py-1 text-xs font-medium ${
                        selectedDecision.status === "Accepted"
                          ? "border-acc/25 bg-acc/10 text-acc"
                          : selectedDecision.status === "Superseded"
                            ? "border-amb/30 bg-ambSoft text-amb"
                            : "border-line bg-bg text-muted"
                      }`}
                    >
                      {selectedDecision.status}
                    </span>
                  </div>

                  <h3 className="text-xl font-semibold leading-7 tracking-tight text-text">
                    {selectedDecision.title}
                  </h3>

                  <p className="mt-3 text-sm leading-6 text-muted">
                    {selectedDecision.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-line bg-bg p-3">
                    <p className="text-xs text-muted">Project</p>
                    <p className="mt-1 wrap-break-word text-sm font-medium text-text">
                      {selectedDecision.project}
                    </p>
                  </div>

                  <div className="rounded-lg border border-line bg-bg p-3">
                    <p className="text-xs text-muted">Related task</p>

                    <p className="mt-1 wrap-break-word text-sm font-medium text-text">
                      {selectedDecision.linkedTask?.title ||
                        selectedDecision.taskId ||
                        "No task linked"}
                    </p>

                    {selectedDecision.linkedTask && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-xs text-muted">
                          <ClipboardList size={13} />
                          {selectedDecision.linkedTask.status || "todo"}
                        </span>

                        {selectedDecision.linkedTask.priority && (
                          <span className="rounded-md border border-line px-2 py-1 text-xs text-muted">
                            {selectedDecision.linkedTask.priority} priority
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-line bg-bg p-3">
                    <p className="text-xs text-muted">Recorded on</p>
                    <p className="mt-1 text-sm font-medium text-text">
                      {selectedDecision.date}
                    </p>
                  </div>

                  <div className="rounded-lg border border-line bg-bg p-3">
                    <p className="text-xs text-muted">Recorded by</p>
                    <p className="mt-1 wrap-break-word text-sm font-medium text-text">
                      {selectedDecision.author}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-text">
                    Context and reasoning
                  </h4>

                  <div className="whitespace-pre-wrap wrap-break-word rounded-lg border border-line bg-bg p-4 text-sm leading-6 text-muted">
                    {selectedDecision.context ||
                      "No additional context was recorded."}
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-text">
                    Decision status
                  </h4>

                  <p className="mb-3 text-sm leading-5 text-muted">
                    Update the lifecycle status when the team's decision
                    changes.
                  </p>

                  <select
                    value={selectedDecision.status}
                    onChange={(event) =>
                      changeDecisionStatus(event.target.value)
                    }
                    disabled={savingStatus}
                    aria-label="Update decision status"
                    className="h-10 w-full rounded-lg border border-line bg-bg px-3 text-sm text-text outline-none focus:border-acc disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="Accepted">Accepted</option>
                    <option value="Superseded">Superseded</option>
                    <option value="Archived">Archived</option>
                  </select>

                  {savingStatus && (
                    <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                      <LoaderCircle size={14} className="animate-spin" />
                      Updating status...
                    </p>
                  )}
                </div>

                <div className="rounded-lg border border-line p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-bg text-muted">
                      <MessageSquare size={17} />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-text">
                        Discussion history
                      </h4>

                      <p className="mt-1 text-sm leading-5 text-muted">
                        This decision is linked to its source discussion so
                        your team can preserve the context behind the outcome.
                      </p>

                      <p className="mt-2 wrap-break-word font-mono text-xs text-muted">
                        {selectedDecision.discussionTitle}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end border-t border-line pt-4">
                  <Button
                    variant="secondary"
                    onClick={() => setShowDecisionDetail(false)}
                  >
                    Done
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {showModal && (
        <DecisionModal
          tasks={tasks}
          onClose={() => setShowModal(false)}
          onCreate={createDecision}
        />
      )}
    </div>
  );
}
