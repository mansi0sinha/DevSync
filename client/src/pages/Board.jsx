import { useEffect, useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  MoreHorizontal,
  CalendarDays,
  MessageSquare,
  Trash2,
  X,
} from "lucide-react";

import Button from "../components/ui/Button";
import { taskAPI } from "../services/api";

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

function formatDueDate(date) {
  if (!date) return "No date";

  const parsedDate = new Date(date);

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
    assignee: task.assignee || "MS",
    comments: task.comments ?? 0,
    dueDate: formatDueDate(task.dueDate),
  };
}

function TaskCard({ task, onChangeStatus, onDelete, deleting }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <article className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-faint">
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-[11px] text-muted">
          {task.id?.length > 12 ? task.id.slice(-6) : task.id}
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
            <div className="absolute right-0 top-8 z-10 w-44 rounded-lg border border-line bg-surface p-1 shadow-sm">
              {columns.map((column) => (
                <button
                  key={column.id}
                  type="button"
                  disabled={task.status === column.id || deleting}
                  onClick={() => {
                    setMenuOpen(false);
                    onChangeStatus(task.id, column.id);
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-xs text-text hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Move to {column.title}
                </button>
              ))}

              <div className="my-1 border-t border-line" />

              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(task.id, task.title);
                }}
                className="w-full rounded-md px-3 py-2 text-left text-xs text-red-500 hover:bg-hover disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <Trash2 size={14} />
                  Delete task
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-5 text-text">
        {task.title}
      </h3>

      <p className="mt-1.5 text-xs leading-5 text-muted">
        {task.description || "No description added."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-md px-2 py-1 text-[11px] font-medium ${
            priorityStyles[task.priority] || priorityStyles.Medium
          }`}
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

    try {
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        status: toApiStatus(status),
        priority: priority.toLowerCase(),
        dueDate: null,
      });

      onClose();
    } catch (err) {
      setError(err.message || "Failed to create task.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-line bg-surface p-6"
      >
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">Create task</h2>
            <p className="mt-1 text-sm text-muted">
              Add a task to your workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
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
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Build authentication flow"
          className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label className="mb-1.5 block text-sm font-medium text-text">
          Description
        </label>
        <textarea
          maxLength={2000}
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
            <Plus size={16} />
            {saving ? "Creating..." : "Create task"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Board() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTasks() {
      try {
        setLoadError("");
        const response = await taskAPI.getAll();

        if (active) {
          setTasks((response.data || []).map(normalizeTask));
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
  }, []);

  async function changeStatus(taskId, newStatus) {
    const task = tasks.find((item) => item.id === taskId);

    if (!task || task.status === newStatus) return;

    const previousTasks = tasks;
    setActionError("");

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
        dueDate: task.dueDate === "No date" ? null : task.dueDate,
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === taskId ? normalizeTask(response.data) : item
        )
      );
    } catch (error) {
      setTasks(previousTasks);
      setActionError(error.message || "Failed to update task status.");
    }
  }

  async function createTask(newTask) {
    setActionError("");
    const response = await taskAPI.create(newTask);
    setTasks((current) => [normalizeTask(response.data), ...current]);
  }

  async function deleteTask(taskId, taskTitle) {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${taskTitle}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(taskId);
    setActionError("");

    try {
      await taskAPI.delete(taskId);
      setTasks((current) => current.filter((task) => task.id !== taskId));
    } catch (error) {
      setActionError(error.message || "Failed to delete task.");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredTasks = tasks.filter((task) =>
    `${task.title} ${task.id} ${task.description || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 pb-8">
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

      {(loadError || actionError) && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/30 px-4 py-3 text-sm text-red-500"
        >
          {loadError || actionError}

          {loadError && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-3 font-medium underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-line bg-surface px-4 py-12 text-center">
          <p className="text-sm text-muted">Loading tasks from MongoDB...</p>
        </div>
      ) : (
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
                    onClick={() => setShowModal(true)}
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
                      onDelete={deleteTask}
                      deleting={deletingId === task.id}
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
      )}

      {showModal && (
        <NewTaskModal
          onClose={() => setShowModal(false)}
          onCreate={createTask}
        />
      )}
    </div>
  );
}
