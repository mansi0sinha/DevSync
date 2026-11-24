import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  GitMerge,
  MessageSquare,
  Plus,
  ArrowRight,
  AlertCircle,
  LoaderCircle,
  ListTodo,
  LayoutDashboard,
} from "lucide-react";

import Button from "../components/ui/Button";
import { ActivityList } from "../components/ActivityItem";
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
    "in progress": "border border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    "in-progress": "border border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    in_progress: "border border-sky-500/35 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    "in review": "border border-line bg-hover text-muted",
    review: "border border-line bg-hover text-muted",
    completed: "border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    complete: "border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    done: "border border-emerald-500/35 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    todo: "border border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    "to do": "border border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    "to-do": "border border-amber-500/35 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    open: "border border-line bg-surface text-muted",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium ${
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

function useReducedMotion() { const [reduced, setReduced] = useState(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false); useEffect(() => { const query = window.matchMedia?.("(prefers-reduced-motion: reduce)"); if (!query) return undefined; const update = () => setReduced(query.matches); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []); return reduced; }
function easeOut(time) { return 1 - (1 - time) ** 3; }
function useCountUp(target, duration, reduced) { const [value, setValue] = useState(0); const prior = useRef(0); useEffect(() => { const from = prior.current; prior.current = target; if (reduced || from === target) { setValue(target); return undefined; } let frame; const started = performance.now(); const tick = (now) => { const time = Math.min(1, (now - started) / duration); setValue(from + (target - from) * easeOut(time)); if (time < 1) frame = requestAnimationFrame(tick); }; frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame); }, [target, duration, reduced]); return value; }
function ProgressRing({ percent }) { const reduced = useReducedMotion(); const value = useCountUp(percent, 1400, reduced); const radius = 56; const circumference = 2 * Math.PI * radius; return <div className="dashboard-motion relative grid h-34 w-34 shrink-0 place-items-center"><svg viewBox="0 0 136 136" className="h-full w-full -rotate-90" aria-hidden="true"><defs><linearGradient id="project-pulse-gradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop stopColor="#5cd6bd"/><stop offset="1" stopColor="#6aa6ff"/></linearGradient><filter id="project-pulse-glow" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#5cd6bd" floodOpacity=".45"/></filter></defs><circle cx="68" cy="68" r={radius} fill="none" stroke="var(--hover)" strokeWidth="12"/><circle cx="68" cy="68" r={radius} fill="none" stroke="url(#project-pulse-gradient)" strokeWidth="12" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - value / 100)} filter={value > 0 ? "url(#project-pulse-glow)" : undefined}/></svg><span className="absolute font-mono text-[30px] font-semibold tabular-nums text-text">{Math.round(value)}%</span></div>; }
function PulseSegment({ item, total, index, reduced }) { const value = useCountUp(item.value, 900, reduced); const share = total ? value / total * 100 : 0; const percent = total ? Math.round(item.value / total * 100) : 0; return <div title={`${item.value} ${item.value === 1 ? "task" : "tasks"} · ${percent}%`} className={`pulse-segment ${item.shimmer ? "pulse-shimmer" : ""}`} style={{ width: `${share}%`, background: item.color, transition: reduced ? "none" : `width 900ms cubic-bezier(0.22, 1, 0.36, 1) ${index * 120}ms` }} />; }
function PulseLegend({ item, reduced }) { const value = useCountUp(item.value, 900, reduced); return <span className="flex items-center gap-2 text-sm text-muted"><i className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }}/><b className="font-mono font-medium tabular-nums text-text">{Math.round(value)}</b>{item.label}</span>; }

export default function Dashboard({
  onNavigate,
  onOpenTask,
  onOpenDiscussion,
  onOpenDecision,
  workspaceId,
  projectId,
}) {
  const [tasks, setTasks] = useState([]);
  const [loadingTasks, setLoadingTasks] = useState(Boolean(workspaceId && projectId));
  const [taskError, setTaskError] = useState("");
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [decisionCount, setDecisionCount] = useState(0);
  const [decisions, setDecisions] = useState([]);
  const [decisionsLoading, setDecisionsLoading] = useState(true);
  const [decisionsError, setDecisionsError] = useState("");
  const [overviewAttempt, setOverviewAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!workspaceId || !projectId) {
        setActivity([]); setActivityError(""); setActivityLoading(false);
        setDecisionCount(0); setDecisions([]); setDecisionsError(""); setDecisionsLoading(false);
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
        setDecisions(Array.isArray(decisionResult.value?.data) ? decisionResult.value.data : Array.isArray(decisionResult.value?.decisions) ? decisionResult.value.decisions : []);
      } else { setDecisionCount(0); setDecisions([]); setDecisionsError(decisionResult.reason?.message || "Could not load decisions."); }
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
  const completed = tasks.filter(isCompleted).length;
  const inProgress = tasks.filter(isInProgress).length;
  const open = Math.max(0, tasks.length - completed - inProgress);
  const completion = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const pipeline = [{ label: "Open", value: open, color: "#8fb4ff" }, { label: "In progress", value: inProgress, color: "#f0a640", shimmer: true }, { label: "Done", value: completed, color: "#5cd6bd" }];
  const reducedMotion = useReducedMotion();
  const latestDecision = decisions[0];

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-8">
      {/* Page heading */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">
            Your workspace at a glance
          </p>

          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-text">
            <LayoutDashboard size={22} strokeWidth={1.8} className="text-acc" aria-hidden="true" />
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

      {/* Project pulse */}
      {hasProject && <section className="rounded-[20px] border border-line bg-surface p-5 sm:p-7">{loadingTasks ? <div className="flex min-h-34 items-center gap-3 text-sm text-muted"><LoaderCircle size={18} className="dashboard-motion animate-spin text-acc" aria-hidden="true" />Loading project pulse…</div> : <div className="grid gap-7 lg:grid-cols-[136px_minmax(0,1fr)_minmax(230px,.7fr)] lg:items-center"><ProgressRing percent={completion} /><div className="min-w-0"><p className="text-base font-semibold text-text">Project pulse</p><p className="mt-1 truncate text-sm text-muted">{open} Open tasks · {inProgress} In progress · {completed} Completed</p><div className="dashboard-motion mt-5 flex h-3 gap-0.75 overflow-hidden rounded-md bg-hover">{pipeline.map((item, index) => <PulseSegment key={item.label} item={item} total={tasks.length} index={index} reduced={reducedMotion} />)}</div><div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">{pipeline.map((item) => <PulseLegend key={item.label} item={item} reduced={reducedMotion} />)}</div></div><button type="button" onClick={() => onNavigate?.("decisions")} className="min-h-32 rounded-[14px] border border-line bg-hover p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acc"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.08em] text-muted"><GitMerge size={15} className="text-acc"/>Decisions logged <span className="ml-auto font-mono text-text">{decisionsLoading ? "…" : decisionsError ? "!" : decisionCount}</span></div><p className="mt-4 truncate text-sm font-semibold text-text">{latestDecision?.title || "No decisions logged yet"}</p><span className="mt-3 inline-block text-sm font-semibold text-acc">Review decisions</span></button></div>}</section>}

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
                  const completedTask = isCompleted(task);
                  const inProgressTask = isInProgress(task);
                  const markerClass = completedTask
                    ? "border-emerald-500 bg-emerald-500/15"
                    : inProgressTask
                      ? "border-sky-500 bg-sky-500/15"
                      : "border-line bg-transparent";
                  const priority = String(task?.priority || "Normal priority").toLowerCase();
                  const priorityClass = priority.includes("high")
                    ? "bg-rose-500"
                    : priority.includes("medium") || priority.includes("normal")
                      ? "bg-amber-500"
                      : "bg-slate-400";

                  return (
                    <div
                      key={taskId}
                      className="-mx-2 flex flex-col gap-3 rounded-lg px-2 py-4 transition-colors duration-200 hover:bg-white/5 first:pt-1 last:pb-1 sm:flex-row sm:items-center"
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${markerClass}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${completedTask ? "bg-emerald-500" : inProgressTask ? "bg-sky-500" : "bg-transparent"}`} />
                        </div>

                        <div className="min-w-0">
                          <p className={`text-sm font-medium ${completedTask ? "text-muted line-through" : "text-text"}`}>
                            {task?.title || "Untitled task"}
                          </p>

                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-muted">
                              {String(taskId).slice(-8)}
                            </span>
                            <span className="text-muted">·</span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                              <span className={`h-1.5 w-1.5 rounded-full ${priorityClass}`} />
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
              action="View all"
              onAction={() => onNavigate?.("activity")}
            />

            {!workspaceId || !projectId ? <EmptyState icon={MessageSquare} title="Select a project" description="Choose a project to see its recent activity." /> : activityState === "loading" ? <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-muted"><LoaderCircle size={17} className="animate-spin" />Loading recent activity…</div> : activityState === "error" ? <div className="py-6 text-center"><p role="alert" className="text-sm text-red-600 dark:text-red-300">{activityError}</p><button type="button" onClick={() => setOverviewAttempt((attempt) => attempt + 1)} className="mt-2 text-sm font-medium text-acc hover:underline">Try again</button></div> : activityState === "empty" ? <EmptyState icon={MessageSquare} title="No recent activity yet" description="Task, discussion, decision, and pull request events for this project will appear here." /> : <ActivityList compact items={activity.slice(0, 5)} onOpen={(item) => {
              if (!item.relatedAvailable) return;
              if (item.entityType === "task") onOpenTask?.(String(item.entityId));
              else if (item.entityType === "decision") onOpenDecision?.(String(item.entityId));
              else if (item.entityType === "discussion") onOpenDiscussion?.(String(item.entityId));
            }} />}
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
