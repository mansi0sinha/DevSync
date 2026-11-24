import { ArrowUpRight, Gavel, MessageCircle, SquareCheck } from "lucide-react";

const activityTypes = {
  decision: { label: "Decision", Icon: Gavel, chip: "bg-violet-500/15 text-violet-600 dark:text-violet-300", tag: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
  discussion: { label: "Discussion", Icon: MessageCircle, chip: "bg-sky-500/15 text-sky-600 dark:text-sky-300", tag: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  task: { label: "Task", Icon: SquareCheck, chip: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300", tag: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
};

export function relativeActivityTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.35, "week"], [12, "month"], [Infinity, "year"]];
  let amount = seconds;
  for (const [limit, unit] of units) {
    if (Math.abs(amount) < limit) return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(amount, unit);
    amount = Math.round(amount / limit);
  }
  return "Time unavailable";
}

export function ActivityItem({ item, onOpen, compact = false }) {
  const type = activityTypes[item.entityType] || activityTypes.task;
  const { Icon, chip, tag, label } = type;
  const actor = item.actorType === "system" ? "GitHub" : item.actor?.name || "A member";
  const date = new Date(item.createdAt);
  const fullDate = Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString();

  return <article className={`flex items-center gap-3 rounded-lg px-3 transition-colors hover:bg-hover/60 ${compact ? "py-3" : "py-4"}`}>
    <span className={`grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg ${chip}`} aria-hidden="true"><Icon size={17} strokeWidth={1.9} /></span>
    <div className="min-w-0 flex-1">
      <p className="text-sm leading-5 text-text"><span className="font-medium">{actor}</span> {item.summary}</p>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tag}`}>{label}</span>
        <span aria-hidden="true">·</span>
        <time dateTime={item.createdAt} title={fullDate}>{relativeActivityTime(item.createdAt)}</time>
      </div>
    </div>
    {item.relatedAvailable && <button type="button" onClick={() => onOpen?.(item)} className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-acc transition-colors hover:bg-hover">Open <ArrowUpRight size={14} /></button>}
  </article>;
}

export function ActivityList({ items, onOpen, compact = false, className = "" }) {
  return <div className={`divide-y divide-line ${className}`}>{items.map((item) => <ActivityItem key={item._id} item={item} onOpen={onOpen} compact={compact} />)}</div>;
}
