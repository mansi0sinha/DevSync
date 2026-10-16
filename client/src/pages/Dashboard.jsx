
import {
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock3,
  GitMerge,
  MessageSquare,
  Plus,
  ArrowRight,
} from "lucide-react";

import Button from "../components/ui/Button";

const stats = [
  {
    label: "Open tasks",
    value: "12",
    detail: "Across all projects",
    icon: CircleDashed,
  },
  {
    label: "In progress",
    value: "4",
    detail: "Currently being worked on",
    icon: Clock3,
  },
  {
    label: "Completed",
    value: "18",
    detail: "Tasks finished",
    icon: CheckCircle2,
  },
  {
    label: "Decisions logged",
    value: "6",
    detail: "Team decisions recorded",
    icon: GitMerge,
  },
];

const activity = [
  {
    type: "task",
    title: "Set up authentication flow",
    detail: "Moved to In Progress",
    project: "Platform",
    time: "12 min ago",
  },
  {
    type: "decision",
    title: "Use JWT for session handling",
    detail: "A decision was recorded",
    project: "Platform",
    time: "38 min ago",
  },
  {
    type: "discussion",
    title: "API response structure",
    detail: "New discussion message",
    project: "API Service",
    time: "1 hr ago",
  },
  {
    type: "task",
    title: "Create dashboard wireframe",
    detail: "Task marked as completed",
    project: "Web App",
    time: "3 hrs ago",
  },
];

const tasks = [
  {
    id: "DS-024",
    title: "Implement user authentication",
    project: "Platform",
    status: "In progress",
  },
  {
    id: "DS-025",
    title: "Design database schema",
    project: "API Service",
    status: "To do",
  },
  {
    id: "DS-026",
    title: "Review API error handling",
    project: "Platform",
    status: "In review",
  },
];

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
  const styles = {
    "In progress": "border border-acc/30 bg-accSoft text-acc",
    "In review": "border border-line bg-hover text-muted",
    "To do": "border border-line bg-surface text-muted",
  };

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${
        styles[status] || styles["To do"]
      }`}
    >
      {status}
    </span>
  );
}

export default function Dashboard({ onNavigate }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-8">
      {/* Page heading */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">
            Friday, your workspace at a glance
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

      {/* Stats */}
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
                {stat.value}
              </p>

              <p className="mt-2 text-xs text-muted">{stat.detail}</p>
            </div>
          );
        })}
      </section>

      {/* Main content */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
        {/* Recent tasks */}
        <div className="min-w-0 rounded-xl border border-line bg-surface p-5">
          <SectionHeading
            title="Recent tasks"
            action="Open board"
            onAction={() => onNavigate?.("board")}
          />

          <div className="divide-y divide-line">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-3 py-4 first:pt-1 last:pb-1 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-line">
                    <span className="h-1.5 w-1.5 rounded-full bg-faint" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">
                      {task.title}
                    </p>

                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] text-muted">
                        {task.id}
                      </span>
                      <span className="text-muted">·</span>
                      <span className="text-xs text-muted">
                        {task.project}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="sm:pl-2">
                  <StatusChip status={task.status} />
                </div>
              </div>
            ))}
          </div>

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

          <div className="space-y-5">
            {activity.map((item, index) => {
              const Icon =
                item.type === "decision"
                  ? GitMerge
                  : item.type === "discussion"
                    ? MessageSquare
                    : item.type === "task"
                      ? CheckCircle2
                      : ArrowUpRight;

              const isDecision = item.type === "decision";

              return (
                <div key={`${item.title}-${index}`} className="flex gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                      isDecision
                        ? "border-amb/30 bg-ambSoft text-amb"
                        : "border-line bg-hover text-muted"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.8} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-5 text-text">
                      {item.title}
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted">
                      {item.detail}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{item.project}</span>
                      <span>·</span>
                      <span>{item.time}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

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
