
import { useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  CalendarDays,
  MessageSquare,
  Check,
  X,
} from "lucide-react";

import Button from "../components/ui/Button";

const initialTasks = [
  {
    id: "DS-024",
    title: "Implement user authentication",
    description: "Add secure login and registration flow.",
    status: "In progress",
    priority: "High",
    assignee: "MS",
    comments: 4,
    dueDate: "Oct 20",
  },
  {
    id: "DS-025",
    title: "Design database schema",
    description: "Define the first version of the data models.",
    status: "To do",
    priority: "Medium",
    assignee: "AK",
    comments: 2,
    dueDate: "Oct 22",
  },
  {
    id: "DS-026",
    title: "Review API error handling",
    description: "Standardize errors returned by API routes.",
    status: "In review",
    priority: "Medium",
    assignee: "RS",
    comments: 3,
    dueDate: "Oct 21",
  },
  {
    id: "DS-027",
    title: "Create dashboard layout",
    description: "Build the initial responsive dashboard UI.",
    status: "Done",
    priority: "Low",
    assignee: "MS",
    comments: 1,
    dueDate: "Oct 16",
  },
  {
    id: "DS-028",
    title: "Connect discussion to tasks",
    description: "Keep the conversation context attached to work.",
    status: "To do",
    priority: "High",
    assignee: "AK",
    comments: 0,
    dueDate: "Oct 24",
  },
];

const columns = [
  { id: "To do", title: "To do" },
  { id: "In progress", title: "In progress" },
  { id: "In review", title: "In review" },
  { id: "Done", title: "Done" },
];

const priorityStyles = {
  High: "border border-amb/30 bg-ambSoft text-amb",
  Medium: "border border-line bg-hover text-muted",
  Low: "border border-line bg-surface text-muted",
};

function TaskCard({ task, onChangeStatus }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-faint">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">
          {task.id}
        </span>

        <div className="relative">
          <button
            type="button"
            aria-label={`Options for ${task.title}`}
            onClick={() => setMenuOpen((open) => !open)}
            className="rounded-md p-1 text-muted hover:bg-hover hover:text-text"
          >
            <MoreHorizontal size={17} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-40 rounded-lg border border-line bg-surface p-1 shadow-sm">
              {columns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => {
                    onChangeStatus(task.id, column.id);
                    setMenuOpen(false);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-xs text-text hover:bg-hover"
                >
                  Move to {column.title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-5 text-text">
        {task.title}
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-muted">
        {task.description}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-[11px] font-medium ${priorityStyles[task.priority]}`}
        >
          {task.priority}
        </span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
        <div className="flex items-center gap-3 text-muted">
          <span className="flex items-center gap-1 text-xs">
            <MessageSquare size={13} />
            {task.comments}
          </span>

          <span className="flex items-center gap-1 text-xs">
            <CalendarDays size={13} />
            {task.dueDate}
          </span>
        </div>

        <div
          title={`Assigned to ${task.assignee}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-hover font-mono text-[10px] font-medium text-text"
        >
          {task.assignee}
        </div>
      </div>
    </article>
  );
}

function NewTaskModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("To do");
  const [priority, setPriority] = useState("Medium");

  function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim()) return;

    onCreate({
      title: title.trim(),
      description: description.trim() || "No description added.",
      status,
      priority,
      assignee: "MS",
      comments: 0,
      dueDate: "No date",
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
        className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Create task
            </h2>
            <p className="mt-1 text-sm text-muted">
              Add a task to your workspace.
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
          Task title
        </label>
        <input
          autoFocus
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Build authentication flow"
          className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label className="mb-1.5 block text-sm font-medium text-text">
          Description
        </label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What needs to be done?"
          rows={3}
          className="mb-4 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Status
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc"
            >
              {columns.map((column) => (
                <option key={column.id} value={column.id}>
                  {column.title}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Priority
            </label>
            <select
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Plus size={16} />
            Create task
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Board() {
  const [tasks, setTasks] = useState(initialTasks);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  function changeStatus(taskId, newStatus) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, status: newStatus } : task
      )
    );
  }

  function createTask(newTask) {
    setTasks((current) => [
      {
        ...newTask,
        id: `DS-${String(29 + current.length - initialTasks.length).padStart(3, "0")}`,
      },
      ...current,
    ]);
  }

  const filteredTasks = tasks.filter((task) =>
    `${task.title} ${task.id} ${task.description}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
      {/* Page header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">
            Workspace / Projects / Platform
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Task Board
          </h1>

          <p className="mt-2 text-sm text-muted">
            Move work forward and keep every task connected to its context.
          </p>
        </div>

        <Button onClick={() => setShowModal(true)}>
          <Plus size={17} />
          New task
        </Button>
      </div>

      {/* Board toolbar */}
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
          <span>{filteredTasks.length} tasks</span>
        </div>
      </div>

      {/* Board columns */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {columns.map((column) => {
          const columnTasks = filteredTasks.filter(
            (task) => task.status === column.id
          );

          return (
            <section
              key={column.id}
              className="min-w-0 rounded-xl border border-line bg-col p-3"
            >
              <div className="mb-3 flex items-center justify-between px-1 py-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      column.id === "Done"
                        ? "bg-acc"
                        : column.id === "In progress"
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
                  onClick={() => {
                    setShowModal(true);
                  }}
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
                    onChangeStatus={changeStatus}
                  />
                ))}

                {columnTasks.length === 0 && (
                  <div className="rounded-lg border border-dashed border-faint px-3 py-6 text-center">
                    <p className="text-xs text-muted">
                      No tasks in this column
                    </p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowModal(true)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-faint px-3 py-2.5 text-xs font-medium text-muted transition-colors hover:border-line hover:bg-hover hover:text-text"
              >
                <Plus size={14} />
                Add a task
              </button>
            </section>
          );
        })}
      </div>

      {showModal && (
        <NewTaskModal
          onClose={() => setShowModal(false)}
          onCreate={createTask}
        />
      )}
    </div>
  );
}
