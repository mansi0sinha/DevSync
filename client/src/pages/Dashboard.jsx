
import { useEffect, useMemo, useState } from "react";

import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  GitMerge,
  MessageSquare,
  Plus,
  ArrowRight,
  AlertCircle,
  LoaderCircle,
  ListTodo,
} from "lucide-react";

import Button from "../components/ui/Button";
import { activityAPI, decisionAPI, taskAPI } from "../services/api";
import { getActivityState, getDecisionCount } from "../services/dashboardData";

function SectionHeading({ title, action, onAction }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-text">{title}</h2>

      {action && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-text"
        >
          {action}
          <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}

function StatusChip({ status }) {
  const normalizedStatus = String(status || "To do")
    .toLowerCase()
    .trim();

  const styles = {
    "in progress": "border border-acc/30 bg-accSoft text-acc",
    "in-progress": "border border-acc/30 bg-accSoft text-acc",
    "in review": "border border-line bg-hover text-muted",
    review: "border border-line bg-hover text-muted",
    completed: "border border-line bg-hover text-muted",
    done: "border border-line bg-hover text-muted",
    todo: "border border-line bg-surface text-muted",
    "to do": "border border-line bg-surface text-muted",
    open: "border border-line bg-surface text-muted",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${
        styles[normalizedStatus] || styles["to do"]
      }`}
    >
      {status || "To do"}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-hover text-muted">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <p className="text-sm font-medium text-text">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-5 text-muted">
        {description}
      </p>
    </div>
  );
}

function getTaskStatus(task) {
  return String(task?.status || "To do").toLowerCase().trim();
}

function isCompleted(task) {
  return ["completed", "complete", "done"].includes(
    getTaskStatus(task)
  );
}

function isInProgress(task) {
  return ["in progress", "in-progress", "in_progress"].includes(
    getTaskStatus(task)
  );
}

function relativeTime(value) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Time unavailable";
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const units = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]];
  let amount = seconds;
  for (const [threshold, unit] of units) {
    if (Math.abs(amount) < threshold) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(amount, unit);
    amount = Math.round(amount / threshold);
  }
  return "Time unavailable";
}

export default function Dashboard({
  onNavigate,
  onOpenTask,
  onOpenDiscussion,
  onOpenDecision,
  workspaceId,
  projectId,
}) {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [decisionCount, setDecisionCount] = useState(0);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [decisionsError, setDecisionsError] = useState("");
  const [overviewAttempt, setOverviewAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!workspaceId || !projectId) {
        setActivity([]); setActivityError(""); setActivityLoading(false);
        setDecisionCount(0); setDecisionsError(""); setDecisionsLoading(false);
        return;
      }
      setActivityLoading(true); setActivityError("");
      setDecisionsLoading(true); setDecisionsError("");
      const [activityResult, decisionResult] = await Promise.allSettled([
        activityAPI.getAll(workspaceId, projectId, { limit: 6 }),
        decisionAPI.getAll(workspaceId, projectId),
      ]);
      if (cancelled) return;
      if (activityResult.status === "fulfilled") setActivity(activityResult.value.data || []);
      else { setActivity([]); setActivityError(activityResult.reason?.message || "Could not load recent activity."); }
      if (decisionResult.status === "fulfilled") {
        setDecisionCount(getDecisionCount(decisionResult.value));
      } else { setDecisionCount(0); setDecisionsError(decisionResult.reason?.message || "Could not load decisions."); }
      setActivityLoading(false); setDecisionsLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [workspaceId, projectId, overviewAttempt]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTasks() {
      setLoadingTasks(true);
      setTaskError("");

      try {
        const result = await taskAPI.getAll(workspaceId, projectId);

        // The API wrapper may return the response body directly.
        const fetchedTasks = Array.isArray(result)
          ? result
          : Array.isArray(result?.data)
            ? result.data
            : Array.isArray(result?.tasks)
              ? result.tasks
              : [];

        if (!cancelled) {
          setTasks(fetchedTasks);
        }
      } catch (error) {
        if (!cancelled) {
          setTasks([]);
          setTaskError(error?.message || "Failed to load tasks.");
        }
      } finally {
        if (!cancelled) {
          setLoadingTasks(false);
        }
      }
    }

    fetchTasks();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId]);

  const stats = useMemo(() => {
    const completed = tasks.filter(isCompleted).length;
    const inProgress = tasks.filter(isInProgress).length;
    const open = tasks.length - completed;

    return [
      {
        label: "Open tasks",
        value: open,
        detail: "Not yet completed",
        icon: CircleDashed,
      },
      {
        label: "In progress",
        value: inProgress,
        detail: "Currently being worked on",
        icon: Clock3,
      },
      {
        label: "Completed",
        value: completed,
        detail: "Tasks finished",
        icon: CheckCircle2,
      },
      {
        label: "Decisions logged",
        value: decisionCount,
        detail: decisionsError ? "Decision count unavailable" : "Recorded for this project",
        icon: GitMerge,
      },
    ];
  }, [tasks, decisionCount, decisionsError]);

  const recentTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const dateA = new Date(a?.createdAt || 0).getTime();
        const dateB = new Date(b?.createdAt || 0).getTime();
        return dateB - dateA;
      })
      .slice(0, 5);
  }, [tasks]);

  const hasProject = Boolean(workspaceId && projectId);
  const activityState = getActivityState({ loading: activityLoading, error: activityError, items: activity });

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-8">
      {/* Page heading */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">
            Your workspace at a glance
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Overview
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Keep track of your team's work, conversations, and decisions in
            one place.
          </p>
        </div>

        <Button onClick={() => onNavigate?.("board")}>
          <Plus size={17} />
          View task board
        </Button>
      </section>

      {/* No selected project */}
      {!hasProject && (
        <section className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={ListTodo}
            title="Select a project to get started"
            description="Choose a workspace and project from the header to see its actual tasks and statistics here."
          />
        </section>
      )}

      {/* Task loading error */}
      {hasProject && taskError && (
        <section className="rounded-xl border border-line bg-surface p-5">
          <div className="flex items-start gap-3">
            <AlertCircle
              size={20}
              className="mt-0.5 shrink-0 text-amb"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-text">
                Couldn't load project tasks
              </p>
              <p className="mt-1 text-sm text-muted">{taskError}</p>
              <button
                type="button"
                onClick={() => {
                  setTaskError("");
                  setLoadingTasks(true);
                  taskAPI
                    .getAll(workspaceId, projectId)
                    .then((result) => {
                      const data = Array.isArray(result)
                        ? result
                        : Array.isArray(result?.data)
                          ? result.data
                          : Array.isArray(result?.tasks)
                            ? result.tasks
                            : [];

                      setTasks(data);
                    })
                    .catch((error) => {
                      setTaskError(
                        error?.message || "Failed to load tasks."
                      );
                    })
                    .finally(() => setLoadingTasks(false));
                }}
                className="mt-3 text-sm font-medium text-acc hover:underline"
              >
                Try again
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Real task statistics */}
      {hasProject && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className="rounded-xl border border-line bg-surface p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-muted">
                    {stat.label}
                  </p>

                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    className="text-muted"
                  />
                </div>

                <p className="mt-5 font-mono text-3xl font-medium tracking-tight text-text">
                  {(stat.label === "Decisions logged" ? decisionsLoading : loadingTasks) ? (
                    <LoaderCircle
                      size={25}
                      className="animate-spin text-muted"
                    />
                  ) : (
                    stat.label === "Decisions logged"
                      ? decisionsError ? "!" : decisionCount
                      : taskError ? "!" : stat.value
                  )}
                </p>

                <p className="mt-2 text-xs text-muted">{stat.label === "Decisions logged" && decisionsError ? "Decision count unavailable" : taskError && stat.label !== "Decisions logged" ? "Task data unavailable" : stat.detail}</p>
                {((stat.label === "Decisions logged" && decisionsError) || (stat.label !== "Decisions logged" && taskError)) && <button type="button" onClick={() => setOverviewAttempt((attempt) => attempt + 1)} className="mt-2 text-xs font-medium text-acc hover:underline">Retry</button>}
              </div>
            );
          })}
        </section>
      )}

      {/* Main content */}
      {hasProject && (
        <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
          {/* Recent tasks */}
          <div className="min-w-0 rounded-xl border border-line bg-surface p-5">
            <SectionHeading
              title="Recent tasks"
              action="Open board"
              onAction={() => onNavigate?.("board")}
            />

            {loadingTasks ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                <LoaderCircle size={17} className="animate-spin" />
                Loading project tasks...
              </div>
            ) : taskError ? (
              <EmptyState
                icon={AlertCircle}
                title="Tasks unavailable"
                description="Check your connection and try loading the project again."
              />
            ) : recentTasks.length === 0 ? (
              <EmptyState
                icon={ListTodo}
                title="No tasks yet"
                description="Tasks created for this project will appear here."
              />
            ) : (
              <div className="divide-y divide-line">
                {recentTasks.map((task, index) => {
                  const taskId = task?._id || task?.id || `task-${index}`;

                  return (
                    <div
                      key={taskId}
                      className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line">
                          <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                        </div>

                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text">
                            {task?.title || "Untitled task"}
                          </p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-muted">
                              {String(taskId).slice(-8)}
                            </span>
                            <span className="text-muted">·</span>
                            <span className="text-xs text-muted">
                              {task?.priority || "Normal priority"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="sm:pl-2">
                        <StatusChip status={task?.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              type="button"
              onClick={() => onNavigate?.("board")}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-faint px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-line hover:bg-hover hover:text-text"
            >
              <Plus size={16} />
              Explore all tasks
            </button>
          </div>

          {/* Activity feed */}
          <div className="min-w-0 rounded-xl border border-line bg-surface p-5">
            <SectionHeading
              title="Recent activity"
              action="Discussion"
              onAction={() => onNavigate?.("discussion")}
            />

            {!workspaceId || !projectId ? <EmptyState icon={MessageSquare} title="Select a project" description="Choose a project to see its recent activity." /> : activityState === "loading" ? <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted"><LoaderCircle size={17} className="animate-spin" />Loading recent activity…</div> : activityState === "error" ? <div className="py-6 text-center"><p role="alert" className="text-sm text-red-600 dark:text-red-300">{activityError}</p><button type="button" onClick={() => setOverviewAttempt((attempt) => attempt + 1)} className="mt-2 text-sm font-medium text-acc hover:underline">Try again</button></div> : activityState === "empty" ? <EmptyState icon={MessageSquare} title="No recent activity yet" description="Task, discussion, decision, and pull request events for this project will appear here." /> : <div className="divide-y divide-line">{activity.map((item) => {
              const type = item.entityType === "task" ? "Task" : item.entityType === "decision" ? "Decision" : "Discussion";
              const open = () => {
                if (!item.relatedAvailable) return;
                if (item.entityType === "task") onOpenTask?.(String(item.entityId));
                else if (item.entityType === "decision") onOpenDecision?.(String(item.entityId));
                else if (item.entityType === "discussion") onOpenDiscussion?.(String(item.entityId));
              };
              return <article key={item._id} className="flex items-start gap-3 py-3 first:pt-1 last:pb-1"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-acc"/><div className="min-w-0 flex-1"><p className="text-sm leading-5 text-text"><span className="font-semibold">{item.actorType === "system" ? "GitHub" : item.actor?.name || "A member"}</span> {item.summary}</p><div className="mt-1 flex items-center gap-2 text-[11px] text-muted"><span>{type}</span><span aria-hidden="true">·</span><time dateTime={item.createdAt}>{relativeTime(item.createdAt)}</time></div></div>{item.relatedAvailable && <button type="button" onClick={open} className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-acc hover:bg-hover" aria-label={`Open ${type.toLowerCase()}: ${item.summary}`}>Open</button>}</article>;
            })}</div>}
          </div>
        </section>
      )}

      {/* Quick navigation */}
      <section>
        <SectionHeading title="Your workspace" />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => onNavigate?.("discussion")}
            className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-5 text-left transition-colors hover:bg-hover"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-hover text-muted">
              <MessageSquare size={19} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">
                Team discussion
              </p>
              <p className="mt-1 text-sm leading-5 text-muted">
                Keep conversations connected to your work.
              </p>
            </div>

            <ArrowUpRight
              size={17}
              className="shrink-0 text-muted transition-colors group-hover:text-text"
            />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("decisions")}
            className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-5 text-left transition-colors hover:bg-hover"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-amb/30 bg-ambSoft text-amb">
              <GitMerge size={19} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">
                Decision log
              </p>
              <p className="mt-1 text-sm leading-5 text-muted">
                Keep the reasoning behind important choices.
              </p>
            </div>

            <ArrowUpRight
              size={17}
              className="shrink-0 text-muted transition-colors group-hover:text-text"
            />
          </button>

          <button
            type="button"
            onClick={() => onNavigate?.("board")}
            className="group flex items-start gap-4 rounded-xl border border-line bg-surface p-5 text-left transition-colors hover:bg-hover"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-hover text-muted">
              <CheckCircle2 size={19} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">
                Task board
              </p>
              <p className="mt-1 text-sm leading-5 text-muted">
                Track progress from planned to completed.
              </p>
            </div>

            <ArrowUpRight
              size={17}
              className="shrink-0 text-muted transition-colors group-hover:text-text"
            />
          </button>
        </div>
      </section>
    </div>
  );
}
