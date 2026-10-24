
import { useEffect, useRef, useState } from "react";
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
  FileText,
  Image as ImageIcon,
  Download,
} from "lucide-react";

import Button from "../components/ui/Button";
import {
  discussionAPI,
  uploadAPI,
  getAttachmentURL,
} from "../services/api";

const MAX_FILES = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "pdf",
  "txt",
];

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAllowedFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ALLOWED_EXTENSIONS.includes(extension);
}

function formatMessageTime(dateValue) {
  if (!dateValue) return "Just now";

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Just now";

  if (date.toDateString() === new Date().toDateString()) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

function normalizeThread(thread) {
  return {
    ...thread,
    id: thread._id || thread.id,
    taskId: thread.taskId || "",
    status: thread.status || "Open",
    decision: thread.decision || null,
    messages: (thread.messages || []).map((item, index) => ({
      ...item,
      id: item._id || item.id || `${thread._id || thread.id}-message-${index}`,
      text: item.text || "",
      attachments: item.attachments || [],
      initials:
        item.initials ||
        (item.author || "U")
          .split(" ")
          .map((part) => part[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      time: item.time || formatMessageTime(item.createdAt),
    })),
  };
}

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

function FilePreview({ file, onRemove, disabled }) {
  const [previewURL, setPreviewURL] = useState("");

  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setPreviewURL("");
      return undefined;
    }

    const url = URL.createObjectURL(file);
    setPreviewURL(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const isImage = file.type.startsWith("image/");

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-line bg-surface p-2">
      {isImage && previewURL ? (
        <img
          src={previewURL}
          alt={`Preview of ${file.name}`}
          className="h-11 w-11 shrink-0 rounded-md border border-line object-cover"
        />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-line bg-hover text-muted">
          {isImage ? <ImageIcon size={19} /> : <FileText size={19} />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-text">{file.name}</p>
        <p className="mt-1 text-[11px] text-muted">
          {formatFileSize(file.size)}
        </p>
      </div>

      <button
        type="button"
        disabled={disabled}
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        title="Remove attachment"
        className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-text disabled:opacity-50"
      >
        <X size={15} />
      </button>
    </div>
  );
}

function MessageAttachments({ attachments = [] }) {
  if (!attachments.length) return null;

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {attachments.map((attachment, index) => {
        const url = getAttachmentURL(attachment.url);
        const isImage = attachment.mimetype?.startsWith("image/");

        return (
          <a
            key={`${attachment.filename || attachment.originalName}-${index}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="group flex min-w-0 items-center gap-3 rounded-lg border border-line bg-bg p-3 transition-colors hover:border-acc/50 hover:bg-hover"
            title={`Open ${attachment.originalName}`}
          >
            {isImage ? (
              <img
                src={url}
                alt={attachment.originalName || "Attached image"}
                loading="lazy"
                className="h-12 w-12 shrink-0 rounded-md border border-line object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted">
                <FileText size={20} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text">
                {attachment.originalName || "Attachment"}
              </p>
              <p className="mt-1 text-[11px] text-muted">
                {formatFileSize(attachment.size)}
              </p>
            </div>

            <Download
              size={15}
              className="shrink-0 text-muted group-hover:text-acc"
            />
          </a>
        );
      })}
    </div>
  );
}

function NewDiscussionModal({ onClose, onCreate }) {
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [taskId, setTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !project.trim() || !message.trim() || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");

      const created = await onCreate({
        title: title.trim(),
        project: project.trim(),
        taskId: taskId.trim(),
        message: message.trim(),
      });

      if (created) onClose();
    } catch (error) {
      setSubmitError(error.message || "Could not create discussion.");
    } finally {
      setSubmitting(false);
    }
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
        <div className="mb-5 flex items-start justify-between gap-3">
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
          maxLength={200}
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
            <input
              required
              maxLength={100}
              value={project}
              onChange={(event) => setProject(event.target.value)}
              placeholder="e.g. DevSync"
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
            />
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
          maxLength={5000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="What would you like the team to discuss?"
          className="mb-5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        {submitError && (
          <p role="alert" className="mb-4 text-sm text-red-500">
            {submitError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            <Plus size={16} />
            {submitting ? "Creating..." : "Create discussion"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DecisionModal({ thread, onClose, onSave }) {
  const [title, setTitle] = useState(thread.decision?.title || "");
  const [summary, setSummary] = useState(thread.decision?.summary || "");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !summary.trim() || submitting) return;

    try {
      setSubmitting(true);
      setSubmitError("");

      const saved = await onSave(thread.id, {
        title: title.trim(),
        summary: summary.trim(),
      });

      if (saved) onClose();
    } catch (error) {
      setSubmitError(error.message || "Could not save decision.");
    } finally {
      setSubmitting(false);
    }
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
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-text">
              {thread.decision ? "Update decision" : "Record a decision"}
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
          maxLength={200}
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
          maxLength={5000}
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Why was this approach chosen?"
          className="mb-5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-acc"
        />

        {submitError && (
          <p role="alert" className="mb-4 text-sm text-red-500">
            {submitError}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            <GitMerge size={16} />
            {submitting ? "Saving..." : "Save decision"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function Discussion() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filter, setFilter] = useState("All");
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDiscussions() {
      try {
        setLoading(true);
        setPageError("");

        const result = await discussionAPI.getAll();
        if (cancelled) return;

        const loadedThreads = (result.data || []).map(normalizeThread);
        setThreads(loadedThreads);

        setActiveThreadId((currentId) => {
          if (
            currentId &&
            loadedThreads.some((thread) => thread.id === currentId)
          ) {
            return currentId;
          }

          return loadedThreads[0]?.id ?? null;
        });
      } catch (error) {
        if (!cancelled) {
          setPageError(error.message || "Failed to load discussions.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDiscussions();

    return () => {
      cancelled = true;
    };
  }, []);

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

  async function createDiscussion(data) {
    const result = await discussionAPI.create(data);
    const createdThread = normalizeThread(result.data);

    setThreads((current) => [
      createdThread,
      ...current.filter((thread) => thread.id !== createdThread.id),
    ]);

    setActiveThreadId(createdThread.id);
    setFilter("All");
    setSearch("");
    setPageError("");

    return true;
  }

  function handleFileSelection(event) {
    const incomingFiles = Array.from(event.target.files || []);
    event.target.value = "";

    if (!incomingFiles.length) return;

    const nextFiles = [...selectedFiles];
    let error = "";

    for (const file of incomingFiles) {
      if (!isAllowedFile(file)) {
        error = `${file.name}: only JPG, PNG, WebP, PDF, and TXT files are allowed.`;
        break;
      }

      if (file.size > MAX_FILE_SIZE) {
        error = `${file.name}: each file must be 5 MB or smaller.`;
        break;
      }

      const alreadySelected = nextFiles.some(
        (selected) =>
          selected.name === file.name &&
          selected.size === file.size &&
          selected.lastModified === file.lastModified
      );

      if (alreadySelected) continue;

      if (nextFiles.length >= MAX_FILES) {
        error = "You can attach a maximum of 5 files per message.";
        break;
      }

      nextFiles.push(file);
    }

    if (error) {
      setPageError(error);
      return;
    }

    setPageError("");
    setSelectedFiles(nextFiles);
  }

  function removeSelectedFile(indexToRemove) {
    setSelectedFiles((current) =>
      current.filter((_, index) => index !== indexToRemove)
    );
  }

  async function sendMessage(event) {
    event.preventDefault();

    const text = message.trim();

    if (
      (!text && selectedFiles.length === 0) ||
      !activeThread ||
      sendingMessage
    ) {
      return;
    }

    try {
      setSendingMessage(true);
      setPageError("");

      let attachments = [];

      if (selectedFiles.length > 0) {
        const uploadResult = await uploadAPI.uploadFiles(selectedFiles);
        attachments = uploadResult.data || [];
      }

      const result = await discussionAPI.addMessage(activeThread.id, {
        text,
        author: "Mansi Sinha",
        initials: "MS",
        attachments,
      });

      const updatedThread = normalizeThread(result.data);

      setThreads((current) =>
        current.map((thread) =>
          thread.id === updatedThread.id ? updatedThread : thread
        )
      );

      setMessage("");
      setSelectedFiles([]);
    } catch (error) {
      setPageError(error.message || "Failed to send message or upload files.");
    } finally {
      setSendingMessage(false);
    }
  }

  async function saveDecision(threadId, decision) {
    try {
      setPageError("");

      const result = await discussionAPI.update(threadId, { decision });
      const updatedThread = normalizeThread(result.data);

      setThreads((current) =>
        current.map((thread) =>
          thread.id === updatedThread.id ? updatedThread : thread
        )
      );

      return true;
    } catch (error) {
      setPageError(error.message || "Failed to save decision.");
      throw error;
    }
  }

  async function toggleThreadStatus(threadId) {
    const thread = threads.find((item) => item.id === threadId);
    if (!thread) return;

    const nextStatus = thread.status === "Open" ? "Resolved" : "Open";

    try {
      setPageError("");

      const result = await discussionAPI.update(threadId, {
        status: nextStatus,
      });

      const updatedThread = normalizeThread(result.data);

      setThreads((current) =>
        current.map((item) =>
          item.id === updatedThread.id ? updatedThread : item
        )
      );
    } catch (error) {
      setPageError(error.message || "Failed to update discussion status.");
    }
  }

  if (loading) {
    return (
      <div className="p-6 text-sm text-muted" role="status">
        Loading discussions...
      </div>
    );
  }

  if (pageError && threads.length === 0) {
    return (
      <div className="p-6" role="alert">
        <p className="text-sm text-red-500">{pageError}</p>
        <Button className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full min-h-150 w-full max-w-none flex-col gap-5 pb-2">
      {pageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-500"
        >
          <span>{pageError}</span>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => setPageError("")}
            className="shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">Workspace / Engineering</p>
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

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden rounded-xl border border-line bg-surface lg:grid-cols-[280px_minmax(0,1fr)]">
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
              const lastMessage = thread.messages[thread.messages.length - 1];
              const previewText = lastMessage
                ? lastMessage.text ||
                  `${lastMessage.attachments?.length || 0} attachment(s)`
                : "No messages yet";

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`w-full border-b border-line p-4 text-left transition-colors ${
                    isActive ? "bg-hover" : "hover:bg-hover/60"
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
                          <Check size={15} className="shrink-0 text-acc" />
                        )}
                      </div>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                        {previewText}
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
                <MessageSquare size={22} className="mx-auto text-muted" />
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

        <section className="flex min-h-125 min-w-0 flex-col">
          {activeThread ? (
            <>
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

              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
                <div className="mx-auto max-w-4xl">
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

                        {item.text && (
                          <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-text">
                            {item.text}
                          </p>
                        )}

                        <MessageAttachments attachments={item.attachments} />
                      </div>

                      <button
                        type="button"
                        aria-label="Message options"
                        title="Message options"
                        className="rounded-md p-1 text-muted hover:bg-hover hover:text-text"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                    </div>
                  ))}

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
                            onClick={() => setShowDecisionModal(true)}
                          >
                            Update decision
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

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

                <div className="mx-auto max-w-4xl rounded-xl border border-line bg-bg p-3 focus-within:border-acc">
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
                    maxLength={5000}
                    placeholder="Write a message... (Enter to send, Shift+Enter for a new line)"
                    aria-label="Write a message"
                    className="w-full resize-none bg-transparent text-sm leading-6 text-text outline-none placeholder:text-muted"
                  />

                  {selectedFiles.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {selectedFiles.map((file, index) => (
                        <FilePreview
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          file={file}
                          disabled={sendingMessage}
                          onRemove={() => removeSelectedFile(index)}
                        />
                      ))}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,image/jpeg,image/png,image/webp,application/pdf,text/plain"
                        className="hidden"
                        onChange={handleFileSelection}
                      />

                      <button
                        type="button"
                        disabled={sendingMessage || selectedFiles.length >= MAX_FILES}
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Attach files"
                        title="Attach up to 5 files (5 MB each)"
                        className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Paperclip size={17} />
                      </button>

                      <span className="text-[11px] text-muted">
                        {selectedFiles.length}/{MAX_FILES} files · 5 MB max each
                      </span>
                    </div>

                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        (!message.trim() && selectedFiles.length === 0) ||
                        sendingMessage
                      }
                    >
                      {sendingMessage ? "Uploading..." : "Send"}
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
