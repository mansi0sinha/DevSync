
import { useMemo, useState } from "react";
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
} from "lucide-react";

import Button from "../components/ui/Button";

const initialDecisions = [
  {
    id: "DEC-001",
    title: "Use JWT for authentication",
    summary:
      "Use JWT-based authentication for the initial implementation, with secure token handling and protected API routes.",
    context:
      "The team compared session-based authentication and JWT. JWT fits our current API architecture and keeps authentication manageable across protected routes.",
    project: "Platform",
    taskId: "DS-024",
    author: "Mansi Sinha",
    date: "Oct 15, 2026",
    status: "Accepted",
  },
  {
    id: "DEC-002",
    title: "Standardize API response structure",
    summary:
      "All API endpoints should return a consistent response format.",
    context:
      "A predictable response shape makes frontend integration and error handling easier to maintain.",
    project: "API Service",
    taskId: "DS-026",
    author: "Riya Sharma",
    date: "Oct 14, 2026",
    status: "Accepted",
  },
  {
    id: "DEC-003",
    title: "Build reusable dashboard components",
    summary:
      "Keep dashboard cards and shared UI elements reusable instead of duplicating markup.",
    context:
      "Reusable components reduce inconsistencies and make future changes easier as the application grows.",
    project: "Web App",
    taskId: "DS-027",
    author: "Aarav Kumar",
    date: "Oct 13, 2026",
    status: "Accepted",
  },
];

function DecisionModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [context, setContext] = useState("");
  const [project, setProject] = useState("Platform");
  const [taskId, setTaskId] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !summary.trim() || !context.trim()) return;

    onCreate({
      title: title.trim(),
      summary: summary.trim(),
      context: context.trim(),
      project,
      taskId: taskId.trim(),
    });

    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
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
              Capture the outcome and reasoning so your team can refer back to it.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-2 text-muted hover:bg-hover hover:text-text"
          >
            <X size={18} />
          </button>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-text">
          Decision title
        </label>
        <input
          autoFocus
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Use JWT for authentication"
          className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label className="mb-1.5 block text-sm font-medium text-text">
          Outcome
        </label>
        <textarea
          required
          rows={2}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="What did the team decide?"
          className="mb-4 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label className="mb-1.5 block text-sm font-medium text-text">
          Context and reasoning
        </label>
        <textarea
          required
          rows={3}
          value={context}
          onChange={(event) => setContext(event.target.value)}
          placeholder="Why was this approach chosen? What alternatives were considered?"
          className="mb-4 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Project
            </label>
            <select
              value={project}
              onChange={(event) => setProject(event.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc"
            >
              <option>Platform</option>
              <option>Web App</option>
              <option>API Service</option>
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Related task ID
            </label>
            <input
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              placeholder="e.g. DS-024"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Plus size={16} />
            Save decision
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Decisions() {
  const [decisions, setDecisions] = useState(initialDecisions);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("All projects");
  const [showModal, setShowModal] = useState(false);
  const [selectedDecisionId, setSelectedDecisionId] = useState("DEC-001");

  const projects = [
    "All projects",
    ...new Set(decisions.map((decision) => decision.project)),
  ];

  const filteredDecisions = useMemo(() => {
    return decisions.filter((decision) => {
      const matchesSearch =
        `${decision.title} ${decision.summary} ${decision.context} ${decision.taskId}`
          .toLowerCase()
          .includes(search.toLowerCase());

      const matchesProject =
        projectFilter === "All projects" ||
        decision.project === projectFilter;

      return matchesSearch && matchesProject;
    });
  }, [decisions, search, projectFilter]);

  const selectedDecision =
    filteredDecisions.find(
      (decision) => decision.id === selectedDecisionId
    ) || filteredDecisions[0];

  function createDecision(data) {
    const nextNumber =
      Math.max(
        0,
        ...decisions.map((decision) =>
          Number(decision.id.split("-")[1])
        )
      ) + 1;

    const newDecision = {
      ...data,
      id: `DEC-${String(nextNumber).padStart(3, "0")}`,
      author: "Mansi Sinha",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      status: "Accepted",
    };

    setDecisions((current) => [newDecision, ...current]);
    setSelectedDecisionId(newDecision.id);
    setSearch("");
    setProjectFilter("All projects");
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">
            Workspace / Engineering
          </p>

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

      {/* Summary */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Recorded decisions</p>
          <p className="mt-3 font-mono text-2xl text-text">
            {decisions.length}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Projects covered</p>
          <p className="mt-3 font-mono text-2xl text-text">
            {new Set(decisions.map((decision) => decision.project)).size}
          </p>
        </div>

        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-sm text-muted">Linked to tasks</p>
          <p className="mt-3 font-mono text-2xl text-text">
            {decisions.filter((decision) => decision.taskId).length}
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
            {projects.map((project) => (
              <option key={project}>{project}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Decision list and detail */}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)]">
        <section className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-text">
              All decisions
            </h2>

            <span className="font-mono text-xs text-muted">
              {filteredDecisions.length}
            </span>
          </div>

          <div className="divide-y divide-line">
            {filteredDecisions.map((decision) => {
              const isSelected =
                selectedDecision?.id === decision.id;

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
                <GitMerge
                  size={24}
                  className="mx-auto text-muted"
                />

                <p className="mt-3 text-sm font-medium text-text">
                  No decisions found
                </p>

                <p className="mt-1 text-sm text-muted">
                  Try changing your search or project filter.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Selected decision detail */}
        <section className="rounded-xl border border-line bg-surface p-5 sm:p-6">
          {selectedDecision ? (
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

                <p className="mt-3 text-sm leading-6 text-text">
                  {selectedDecision.context}
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

                      <p className="text-xs text-muted">Related task</p>
                      <p className="mt-1 flex items-center gap-2 font-mono text-sm text-text">
                        <Link2 size={14} />
                        {selectedDecision.taskId}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center text-center">
              <GitMerge size={25} className="text-muted" />

              <h2 className="mt-4 text-sm font-semibold text-text">
                Select a decision
              </h2>

              <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
                Choose a decision from the list to inspect its outcome and reasoning.
              </p>
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
