
import { useState } from "react";
import {
  MessageSquare,
  Search,
  Plus,
  Paperclip,
  Send,
  MoreHorizontal,
  GitMerge,
  Check,
  X,
} from "lucide-react";

import Button from "../components/ui/Button";

const initialThreads = [
  {
    id: 1,
    title: "API response structure",
    project: "Platform",
    taskId: "DS-026",
    status: "Open",
    messages: [
      {
        id: 1,
        author: "Aarav Kumar",
        initials: "AK",
        time: "10:24 AM",
        text: "Should we keep the API response structure consistent across all endpoints?",
      },
      {
        id: 2,
        author: "Mansi Sinha",
        initials: "MS",
        time: "10:29 AM",
        text: "I think we should. A consistent format will make error handling and frontend integration easier.",
      },
      {
        id: 3,
        author: "Riya Sharma",
        initials: "RS",
        time: "10:35 AM",
        text: "Agreed. Let's use a standard structure with data, message, and error fields.",
      },
    ],
    decision: null,
  },
  {
    id: 2,
    title: "Authentication strategy",
    project: "Platform",
    taskId: "DS-024",
    status: "Resolved",
    messages: [
      {
        id: 1,
        author: "Riya Sharma",
        initials: "RS",
        time: "9:15 AM",
        text: "We need to choose an authentication strategy before implementing the login flow.",
      },
      {
        id: 2,
        author: "Mansi Sinha",
        initials: "MS",
        time: "9:21 AM",
        text: "For our current architecture, JWT-based authentication should work well. We should keep token handling secure.",
      },
    ],
    decision: {
      title: "Use JWT for authentication",
      summary: "Adopt JWT-based authentication for the initial implementation.",
    },
  },
  {
    id: 3,
    title: "Dashboard component structure",
    project: "Web App",
    taskId: "DS-027",
    status: "Open",
    messages: [
      {
        id: 1,
        author: "Aarav Kumar",
        initials: "AK",
        time: "Yesterday",
        text: "Should dashboard cards live in separate reusable components?",
      },
    ],
    decision: null,
  },
];

function Avatar({ initials, small = false }) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-line bg-hover font-mono font-medium text-text ${
        small ? "h-8 w-8 text-[10px]" : "h-9 w-9 text-xs"
      }`}
    >
      {initials}
    </div>
  );
}

function NewDiscussionModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("Platform");
  const [taskId, setTaskId] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !message.trim()) return;

    onCreate({
      title: title.trim(),
      project,
      taskId: taskId.trim(),
      message: message.trim(),
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
        className="w-full max-w-lg rounded-xl border border-line bg-surface p-6"
      >
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Start a discussion
            </h2>
            <p className="mt-1 text-sm text-muted">
              Start a conversation and keep its context connected to work.
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
          Discussion title
        </label>
        <input
          autoFocus
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. API response structure"
          className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              Related task ID (optional)
            </label>
            <input
              value={taskId}
              onChange={(event) => setTaskId(event.target.value)}
              placeholder="e.g. DS-024"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
            />
          </div>
        </div>

        <label className="mb-1.5 block text-sm font-medium text-text">
          First message
        </label>
        <textarea
          required
          rows={4}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What would you like the team to discuss?"
          className="mb-5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <Plus size={16} />
            Create discussion
          </Button>
        </div>
      </form>
    </div>
  );
}

function DecisionModal({ thread, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !summary.trim()) return;

    onSave(thread.id, {
      title: title.trim(),
      summary: summary.trim(),
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
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-text">
              Record a decision
            </h2>
            <p className="mt-1 text-sm text-muted">
              Preserve the outcome and reasoning from this discussion.
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
          Decision
        </label>
        <input
          autoFocus
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="What did the team decide?"
          className="mb-4 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <label className="mb-1.5 block text-sm font-medium text-text">
          Context and reasoning
        </label>
        <textarea
          required
          rows={4}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Why was this approach chosen?"
          className="mb-5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">
            <GitMerge size={16} />
            Save decision
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Discussion() {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState(1);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("All");
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);

  const activeThread = threads.find(
    (thread) => thread.id === activeThreadId
  );

  const filteredThreads = threads.filter((thread) => {
    const matchesSearch =
      `${thread.title} ${thread.project} ${thread.taskId}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesFilter =
      filter === "All" ||
      (filter === "Open" && thread.status === "Open") ||
      (filter === "Resolved" && thread.status === "Resolved");

    return matchesSearch && matchesFilter;
  });

  function createDiscussion(data) {
    const nextId = Math.max(0, ...threads.map((thread) => thread.id)) + 1;

    const newThread = {
      id: nextId,
      title: data.title,
      project: data.project,
      taskId: data.taskId,
      status: "Open",
      messages: [
        {
          id: 1,
          author: "Mansi Sinha",
          initials: "MS",
          time: "Just now",
          text: data.message,
        },
      ],
      decision: null,
    };

    setThreads((current) => [newThread, ...current]);
    setActiveThreadId(nextId);
    setFilter("All");
    setSearch("");
  }

  function sendMessage(event) {
    event.preventDefault();

    if (!message.trim() || !activeThread) return;

    const newMessage = {
      id: Date.now(),
      author: "Mansi Sinha",
      initials: "MS",
      time: "Just now",
      text: message.trim(),
    };

    setThreads((current) =>
      current.map((thread) =>
        thread.id === activeThreadId
          ? {
              ...thread,
              messages: [...thread.messages, newMessage],
            }
          : thread
      )
    );

    setMessage("");
  }

  function saveDecision(threadId, decision) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? { ...thread, decision, status: "Resolved" }
          : thread
      )
    );
  }

  function toggleThreadStatus(threadId) {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              status: thread.status === "Open" ? "Resolved" : "Open",
            }
          : thread
      )
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-[600px] w-full max-w-[1600px] flex-col gap-5 pb-2">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">
            Workspace / Engineering
          </p>

          <h1 className="text-2xl font-semibold tracking-tight text-text sm:text-3xl">
            Discussion
          </h1>

          <p className="mt-2 text-sm text-muted">
            Conversations with the context behind your team's work.
          </p>
        </div>

        <Button onClick={() => setShowNewDiscussion(true)}>
          <Plus size={17} />
          New discussion
        </Button>
      </div>

      {/* Discussion workspace */}
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Thread list */}
        <aside className="flex min-h-0 flex-col border-b border-line bg-side lg:border-b-0 lg:border-r">
          <div className="border-b border-line p-4">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search discussions..."
                aria-label="Search discussions"
                className="h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
              />
            </div>

            <div className="mt-3 flex gap-1 rounded-lg bg-hover p-1">
              {["All", "Open", "Resolved"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                    filter === item
                      ? "bg-surface text-text"
                      : "text-muted hover:text-text"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {filteredThreads.map((thread) => {
              const isActive = thread.id === activeThreadId;

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full border-b border-line p-4 text-left transition-colors ${
                    isActive
                      ? "bg-hover"
                      : "hover:bg-hover/60"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        isActive
                          ? "border-acc/30 bg-accSoft text-acc"
                          : "border-line bg-surface text-muted"
                      }`}
                    >
                      <MessageSquare size={17} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-5 text-text">
                          {thread.title}
                        </p>

                        {thread.status === "Resolved" && (
                          <Check
                            size={15}
                            className="shrink-0 text-acc"
                          />
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                        {thread.messages[thread.messages.length - 1]?.text}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-line bg-surface px-2 py-1 text-[10px] text-muted">
                          {thread.project}
                        </span>

                        {thread.taskId && (
                          <span className="font-mono text-[10px] text-muted">
                            {thread.taskId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}

            {filteredThreads.length === 0 && (
              <div className="p-6 text-center">
                <MessageSquare
                  size={22}
                  className="mx-auto text-muted"
                />
                <p className="mt-3 text-sm font-medium text-text">
                  No discussions found
                </p>
                <p className="mt-1 text-xs text-muted">
                  Try another search or filter.
                </p>
              </div>
            )}
          </div>
        </aside>

        {/* Active conversation */}
        <section className="flex min-h-[500px] min-w-0 flex-col">
          {activeThread ? (
            <>
              {/* Thread header */}
              <div className="flex flex-col justify-between gap-3 border-b border-line p-4 sm:flex-row sm:items-start sm:p-5">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-text">
                    {activeThread.title}
                  </h2>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">
                      {activeThread.project}
                    </span>

                    {activeThread.taskId && (
                      <>
                        <span className="text-muted">·</span>
                        <span className="font-mono text-xs text-muted">
                          {activeThread.taskId}
                        </span>
                      </>
                    )}

                    <span
                      className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                        activeThread.status === "Resolved"
                          ? "border-acc/30 bg-accSoft text-acc"
                          : "border-line bg-hover text-muted"
                      }`}
                    >
                      {activeThread.status}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {activeThread.status === "Open" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setShowDecisionModal(true)}
                    >
                      <GitMerge size={14} />
                      Record decision
                    </Button>
                  )}

                  <button
                    type="button"
                    onClick={() => toggleThreadStatus(activeThread.id)}
                    title={
                      activeThread.status === "Open"
                        ? "Mark resolved"
                        : "Reopen discussion"
                    }
                    aria-label={
                      activeThread.status === "Open"
                        ? "Mark resolved"
                        : "Reopen discussion"
                    }
                    className="rounded-lg border border-line p-2 text-muted hover:bg-hover hover:text-text"
                  >
                    {activeThread.status === "Open" ? (
                      <Check size={16} />
                    ) : (
                      <MessageSquare size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* Message history */}
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
                <div className="mx-auto max-w-3xl">
                  <div className="mb-6 text-center">
                    <span className="rounded-full border border-line bg-bg px-3 py-1.5 text-[11px] text-muted">
                      Discussion started · {activeThread.project}
                    </span>
                  </div>

                  {activeThread.messages.map((item) => (
                    <div
                      key={item.id}
                      className="mb-6 flex items-start gap-3"
                    >
                      <Avatar initials={item.initials} />

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-text">
                            {item.author}
                          </p>
                          <span className="text-xs text-muted">
                            {item.time}
                          </span>
                        </div>

                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text">
                          {item.text}
                        </p>
                      </div>

                      <button
                        type="button"
                        aria-label="Message options"
                        className="rounded-md p-1 text-muted hover:bg-hover hover:text-text"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </div>
                  ))}

                  {/* Recorded decision */}
                  {activeThread.decision && (
                    <div className="my-6 rounded-xl border border-amb/30 bg-ambSoft p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amb/30 text-amb">
                          <GitMerge size={18} />
                        </div>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wider text-amb">
                            Decision recorded
                          </p>

                          <h3 className="mt-2 text-sm font-semibold text-text">
                            {activeThread.decision.title}
                          </h3>

                          <p className="mt-1 text-sm leading-6 text-text">
                            {activeThread.decision.summary}
                          </p>

                          <button
                            type="button"
                            className="mt-3 text-xs font-medium text-amb underline underline-offset-2"
                            onClick={() => {
                              setShowDecisionModal(true);
                            }}
                          >
                            Update decision
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Composer */}
              <form
                onSubmit={sendMessage}
                className="border-t border-line bg-surface p-4 sm:p-5"
              >
                {activeThread.status === "Resolved" && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-line bg-bg px-3 py-2 text-xs text-muted">
                    <Check size={14} className="text-acc" />
                    This discussion is resolved. You can still add a message.
                  </div>
                )}

                <div className="mx-auto max-w-3xl rounded-xl border border-line bg-bg p-3 focus-within:border-acc">
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" &&
                        !event.shiftKey &&
                        !event.nativeEvent.isComposing
                      ) {
                        event.preventDefault();
                        event.currentTarget.form?.requestSubmit();
                      }
                    }}
                    rows={2}
                    placeholder="Write a message... (Enter to send, Shift+Enter for a new line)"
                    aria-label="Write a message"
                    className="w-full resize-none bg-transparent text-sm leading-6 text-text outline-none placeholder:text-muted"
                  />

                  <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                    <button
                      type="button"
                      aria-label="Attach file (not available yet)"
                      title="File attachments are coming later"
                      className="rounded-md p-1.5 text-muted"
                    >
                      <Paperclip size={17} />
                    </button>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={!message.trim()}
                    >
                      Send
                      <Send size={14} />
                    </Button>
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-hover text-muted">
                <MessageSquare size={22} />
              </div>

              <h2 className="mt-4 text-base font-semibold text-text">
                Select a discussion
              </h2>

              <p className="mt-2 max-w-xs text-sm leading-6 text-muted">
                Choose a conversation from the list or start a new one.
              </p>
            </div>
          )}
        </section>
      </div>

      {showNewDiscussion && (
        <NewDiscussionModal
          onClose={() => setShowNewDiscussion(false)}
          onCreate={createDiscussion}
        />
      )}

      {showDecisionModal && activeThread && (
        <DecisionModal
          key={activeThread.id}
          thread={activeThread}
          onClose={() => setShowDecisionModal(false)}
          onSave={saveDecision}
        />
      )}
    </div>
  );
}
