import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GitMerge,
  Search,
  Plus,
  ArrowUpRight,
  Link2,
  CalendarDays,
  UserRound,
  X,
  Filter,
  MessageSquare,
  LoaderCircle,
  AlertCircle,
} from "lucide-react";

import Button from "../components/ui/Button";
import { discussionAPI } from "../services/api";

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

function getDecisionId(discussionId) {
  if (!discussionId) return "DEC-UNKNOWN";

  return `DEC-${String(discussionId).slice(-6).toUpperCase()}`;
}

function normalizeDecision(discussion) {
  if (!discussion?.decision) return null;

  return {
    id: getDecisionId(discussion._id || discussion.id),
    discussionId: discussion._id || discussion.id,
    discussionTitle: discussion.title || "Untitled discussion",
    title: discussion.decision.title || "Untitled decision",
    summary: discussion.decision.summary || "",
    context: discussion.decision.context || "",
    project: discussion.project || "Unassigned",
    taskId: discussion.taskId || "",
    author: "Workspace member",
    date: formatDate(discussion.updatedAt || discussion.createdAt),
    status: discussion.decision.status || "Accepted",
  };
}

function getResponseData(response) {
  return response?.data ?? response;
}

function DecisionModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [context, setContext] = useState("");
  const [project, setProject] = useState("");
  const [taskId, setTaskId] = useState("");
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
      await onCreate({
        title: title.trim(),
        summary: summary.trim(),
        context: context.trim(),
        project: project.trim(),
        taskId: taskId.trim(),
      });

      onClose();
    } catch (err) {
      setError(err.message || "Could not save the decision. Please try again.");
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
              htmlFor="decision-task-id"
              className="mb-1.5 block text-sm font-medium text-text"
            >
              Related task ID
            </label>

            <input
              id="decision-task-id"
              maxLength={100}
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              placeholder="e.g. DS-024"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
            />
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
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All projects");
  const [showModal, setShowModal] = useState(false);
  const [selectedDecisionId, setSelectedDecisionId] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const loadDecisions = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const response = await discussionAPI.getAll();
      const discussions = getResponseData(response);

      if (!Array.isArray(discussions)) {
        throw new Error(
          "The server returned an unexpected discussions response."
        );
      }

      const savedDecisions = discussions
        .map(normalizeDecision)
        .filter(Boolean);

      setDecisions(savedDecisions);

      setSelectedDecisionId((currentId) => {
        if (savedDecisions.some((decision) => decision.id === currentId)) {
          return currentId;
        }

        return savedDecisions[0]?.id || "";
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
    filteredDecisions.find((decision) => decision.id === selectedDecisionId) ||
    filteredDecisions[0];

  async function createDecision(data) {
    // Create the discussion and its opening message first.
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

    // Save the decision inside the newly created discussion.
    const decisionResponse = await discussionAPI.update(discussionId, {
      decision: {
        title: data.title,
        summary: data.summary,
        context: data.context,
      },
    });

    const updatedDiscussion = getResponseData(decisionResponse);

    if (!updatedDiscussion?.decision) {
      throw new Error(
        "The discussion was created, but the decision was not returned. Refresh the page to check its status."
      );
    }

    const newDecision = normalizeDecision(updatedDiscussion);

    if (!newDecision) {
      throw new Error("The server could not return the saved decision.");
    }

    setDecisions((current) => [
      newDecision,
      ...current.filter((item) => item.id !== newDecision.id),
    ]);

    setSelectedDecisionId(newDecision.id);
    setSearch("");
    setProjectFilter("All projects");
    setPageError("");
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
              : decisions.filter((decision) => decision.taskId.trim()).length}
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
            placeholder="Search decisions, reasoning, or task IDs..."
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
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-text">All decisions</h2>

            <span className="font-mono text-xs text-muted">
              {loading ? "…" : filteredDecisions.length}
            </span>
          </div>

          <div className="divide-y divide-line">
            {loading ? (
              <div className="flex min-h-56 flex-col items-center justify-center p-8 text-center">
                <LoaderCircle size={24} className="animate-spin text-muted" />
                <p className="mt-3 text-sm text-muted">
                  Loading saved decisions...
                </p>
              </div>
            ) : (
              <>
                {filteredDecisions.map((decision) => {
                  const isSelected = selectedDecision?.id === decision.id;

                  return (
                    <button
                      key={decision.id}
                      type="button"
                      onClick={() => setSelectedDecisionId(decision.id)}
                      className={`w-full p-5 text-left transition-colors ${
                        isSelected ? "bg-hover" : "hover:bg-hover/60"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amb/30 bg-ambSoft text-amb">
                          <GitMerge size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-muted">
                              {decision.id}
                            </span>

                            <span className="rounded-md border border-amb/30 bg-ambSoft px-2 py-0.5 text-[10px] font-medium text-amb">
                              {decision.status}
                            </span>
                          </div>

                          <h3 className="mt-2 text-sm font-semibold leading-5 text-text">
                            {decision.title}
                          </h3>

                          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-muted">
                            {decision.summary}
                          </p>

                          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                            <span>{decision.project}</span>

                            {decision.taskId && (
                              <span className="flex items-center gap-1 font-mono">
                                <Link2 size={12} />
                                {decision.taskId}
                              </span>
                            )}

                            <span className="flex items-center gap-1">
                              <CalendarDays size={12} />
                              {decision.date}
                            </span>
                          </div>
                        </div>

                        <ArrowUpRight
                          size={16}
                          className="shrink-0 text-muted"
                        />
                      </div>
                    </button>
                  );
                })}

                {filteredDecisions.length === 0 && (
                  <div className="p-10 text-center">
                    <GitMerge size={24} className="mx-auto text-muted" />

                    <p className="mt-3 text-sm font-medium text-text">
                      {decisions.length === 0
                        ? "No decisions recorded yet"
                        : "No decisions found"}
                    </p>

                    <p className="mt-1 text-sm text-muted">
                      {decisions.length === 0
                        ? "Record a decision to save it to your workspace."
                        : "Try changing your search or project filter."}
                    </p>

                    {decisions.length === 0 && (
                      <button
                        type="button"
                        onClick={() => setShowModal(true)}
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-acc hover:underline"
                      >
                        <Plus size={15} />
                        Record your first decision
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Selected decision detail */}
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          {selectedDecision && !loading ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amb/30 bg-ambSoft text-amb">
                  <GitMerge size={21} />
                </div>

                <span className="rounded-md border border-amb/30 bg-ambSoft px-2.5 py-1 text-xs font-medium text-amb">
                  {selectedDecision.status}
                </span>
              </div>

              <p className="mt-5 font-mono text-xs text-muted">
                {selectedDecision.id}
              </p>

              <h2 className="mt-2 text-xl font-semibold leading-7 text-text">
                {selectedDecision.title}
              </h2>

              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span className="flex items-center gap-1.5">
                  <UserRound size={14} />
                  {selectedDecision.author}
                </span>

                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {selectedDecision.date}
                </span>
              </div>

              <div className="my-6 border-t border-line" />

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Outcome
                </h3>

                <p className="mt-3 text-sm leading-6 text-text">
                  {selectedDecision.summary}
                </p>
              </div>

              <div className="mt-6 rounded-xl border border-amb/30 bg-ambSoft p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amb">
                  Context and reasoning
                </h3>

                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-text">
                  {selectedDecision.context || "No additional context provided."}
                </p>
              </div>

              <div className="mt-6">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Connected work
                </h3>

                <div className="mt-3 rounded-lg border border-line bg-bg p-3">
                  <p className="text-xs text-muted">Project</p>
                  <p className="mt-1 text-sm font-medium text-text">
                    {selectedDecision.project}
                  </p>

                  {selectedDecision.taskId && (
                    <>
                      <div className="my-3 border-t border-line" />

                      <p className="text-xs text-muted">Related task ID</p>
                      <p className="mt-1 flex items-center gap-2 font-mono text-sm text-text">
                        <Link2 size={14} />
                        {selectedDecision.taskId}
                      </p>
                    </>
                  )}

                  <div className="my-3 border-t border-line" />

                  <p className="text-xs text-muted">Source discussion</p>
                  <p className="mt-1 flex items-start gap-2 text-sm text-text">
                    <MessageSquare
                      size={15}
                      className="mt-0.5 shrink-0 text-muted"
                    />
                    <span>{selectedDecision.discussionTitle}</span>
                  </p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              {loading ? (
                <>
                  <LoaderCircle
                    size={25}
                    className="animate-spin text-muted"
                  />
                  <p className="mt-4 text-sm text-muted">
                    Loading decision details...
                  </p>
                </>
              ) : (
                <>
                  <GitMerge size={25} className="text-muted" />

                  <h2 className="mt-4 text-sm font-semibold text-text">
                    Select a decision
                  </h2>

                  <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
                    Choose a decision from the list to inspect its outcome and
                    reasoning.
                  </p>
                </>
              )}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <DecisionModal
          onClose={() => setShowModal(false)}
          onCreate={createDecision}
        />
      )}
    </div>
  );
}
