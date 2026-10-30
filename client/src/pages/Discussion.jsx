
import { useEffect, useMemo, useRef, useState } from "react";
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
  decisionAPI,
  taskAPI,
  uploadAPI,
  getAttachmentURL,
  getToken,
} from "../services/api";
import { subscribeRealtime } from "../services/realtime";
import { uploadAttachmentsAndSend } from "../services/discussionMessageUpload";

const MAX_FILES = 5;
const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;
const DEFAULT_UPLOAD_FORMATS = [".jpg", ".jpeg", ".png", ".webp", ".pdf", ".txt"];

function formatFileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function isAllowedFile(file, formats) {
  const extension = `.${file.name.split(".").pop()?.toLowerCase()}`;
  return formats.includes(extension);
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
  const project = typeof thread.project === "string"
    ? thread.project
    : thread.project?.name || "Project";

  return {
    ...thread,
    id: thread._id || thread.id,
    project,
    taskId: thread.taskId || "",
    linkedTask: thread.linkedTask || null,
    status: thread.status || "Open",
    decision: thread.decision || null,
    messages: (thread.messages || []).map((item, index) => {
      const author = typeof item.author === "string"
        ? item.author
        : item.author?.name || item.author?.email || "Workspace member";

      return {
        ...item,
        id: item._id || item.id || `${thread._id || thread.id}-message-${index}`,
        author,
        text: item.text || "",
        attachments: item.attachments || [],
        initials:
          item.initials ||
          author
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
        time: item.time || formatMessageTime(item.createdAt),
      };
    }),
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
  const previewURL = useMemo(() => file.type.startsWith("image/") ? URL.createObjectURL(file) : "", [file]);
  useEffect(() => () => { if (previewURL) URL.revokeObjectURL(previewURL); }, [previewURL]);

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

function AttachmentLink({ attachment }) {
  const [fileURL, setFileURL] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let objectURL;
    const trustedURL = getAttachmentURL(attachment.url, attachment.uploadId);

    Promise.resolve()
      .then(() => {
        if (!trustedURL) throw new Error("UNTRUSTED_ATTACHMENT_URL");
        return fetch(trustedURL, {
          headers: { Authorization: `Bearer ${getToken() || ""}` },
          signal: controller.signal,
        });
      })
      .then((response) => {
        if (!response.ok) throw new Error("Attachment unavailable");
        return response.blob();
      })
      .then((blob) => {
        objectURL = URL.createObjectURL(blob);
        setFileURL(objectURL);
        setError("");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(trustedURL
            ? "Couldn't load this attachment."
            : "This attachment link is unverified. Ask the sender to upload it again.");
        }
      });

    return () => {
      controller.abort();
      if (objectURL) URL.revokeObjectURL(objectURL);
    };
  }, [attachment.uploadId, attachment.url, attempt]);

  const isImage = attachment.mimetype?.startsWith("image/");

  return (
    <div className="min-w-0 rounded-lg border border-line bg-bg p-3">
      <div className="flex items-center gap-3">
        {isImage && fileURL ? (
          <img src={fileURL} alt={attachment.originalName || "Attached image"} loading="lazy" className="h-12 w-12 shrink-0 rounded-md border border-line object-cover" />
        ) : (
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted">
            <FileText size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text">{attachment.originalName || "Attachment"}</p>
          {fileURL ? (
            <a href={fileURL} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted hover:text-text">
              {formatFileSize(attachment.size)} <Download size={12} /> Open or download
            </a>
          ) : error ? (
            <p role="alert" className="mt-1 text-[11px] text-red-600">{error}</p>
          ) : (
            <p className="mt-1 text-[11px] text-muted">Loading attachment...</p>
          )}
        </div>
      </div>
      {error && getAttachmentURL(attachment.url, attachment.uploadId) && (
        <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 text-xs font-medium text-acc hover:underline">
          Retry
        </button>
      )}
    </div>
  );
}

function MessageAttachments({ attachments = [] }) {
  if (!attachments.length) return null;
  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      {attachments.map((attachment, index) => (
        <AttachmentLink key={`${attachment.uploadId || attachment.url || attachment.filename || attachment.originalName}-${index}`} attachment={attachment} />
      ))}
    </div>
  );
}

function NewDiscussionModal({ onClose, onCreate, tasks, tasksError, projectName }) {
  const [title, setTitle] = useState("");
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !message.trim() || submitting) {
      return;
    }

    try {
      setSubmitting(true);
      setSubmitError("");

      const created = await onCreate({
        title: title.trim(),
        linkedTask: linkedTaskId || null,
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
          <div className="rounded-lg border border-line bg-bg p-3">
            <p className="mb-1.5 text-sm font-medium text-text">Project</p>
            <p className="text-sm text-muted">{projectName || "Selected project"}</p>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">
              Related task (optional)
            </label>
            <select
              value={linkedTaskId}
              onChange={(event) => setLinkedTaskId(event.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc"
            >
              <option value="">No linked task</option>
              {tasks.map((task) => (
                <option key={task._id || task.id} value={task._id || task.id}>
                  {task.title} ({task.status || "No status"})
                </option>
              ))}
            </select>
            {tasksError && (
              <p className="mt-1 text-xs text-red-500">{tasksError}</p>
            )}
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

function MessageDecisionModal({ thread, message, tasks, onClose, onSave }) {
  const author = message.author || "Workspace member";
  const [title, setTitle] = useState(`Decision from ${thread.title}`.slice(0, 200));
  const [summary, setSummary] = useState(message.text || "");
  const [context, setContext] = useState(`Source message by ${author}:\n${message.text || ""}`.slice(0, 5000));
  const [linkedTaskId, setLinkedTaskId] = useState(String(thread.linkedTask?._id || thread.linkedTask?.id || ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (saving || !title.trim() || !summary.trim() || !context.trim()) return;
    setSaving(true);
    setError("");
    try {
      await onSave({
        title: title.trim(),
        summary: summary.trim(),
        context: context.trim(),
        linkedTask: linkedTaskId || null,
        discussionId: thread.id,
        discussionMessageId: message.id,
      });
      onClose();
    } catch (failure) {
      setError(failure.message || "Could not save this decision.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby="message-decision-title" onSubmit={submit} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-line bg-surface p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="message-decision-title" className="text-lg font-semibold text-text">Record as decision</h2>
            <p className="mt-1 text-sm text-muted">From {author} in “{thread.title}”</p>
          </div>
          <button type="button" aria-label="Close dialog" disabled={saving} onClick={onClose} className="rounded-md p-2 text-muted hover:bg-hover"><X size={18} /></button>
        </div>
        <blockquote className="mt-4 max-h-28 overflow-y-auto whitespace-pre-wrap wrap-break-word rounded-lg border border-line bg-bg p-3 text-sm text-muted">{message.text || "This message contains an attachment and no text."}</blockquote>
        <label className="mt-4 block text-sm font-medium text-text">Decision title</label>
        <input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1.5 w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc" />
        <label className="mt-4 block text-sm font-medium text-text">Outcome and details</label>
        <textarea required maxLength={5000} rows={3} value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="What was decided?" className="mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc" />
        <label className="mt-4 block text-sm font-medium text-text">Rationale</label>
        <textarea required maxLength={5000} rows={3} value={context} onChange={(event) => setContext(event.target.value)} placeholder="Why was this approach chosen?" className="mt-1.5 w-full resize-y rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-text outline-none focus:border-acc" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-bg p-3"><p className="text-sm font-medium text-text">Source author</p><p className="mt-1 text-sm text-muted">{author} (recorded as decision creator: you)</p></div>
          <label className="text-sm font-medium text-text">Related task (optional)
            <select value={linkedTaskId} onChange={(event) => setLinkedTaskId(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-line bg-bg px-3 font-normal text-text">
              <option value="">No task linked</option>
              {tasks.map((task) => <option key={task._id || task.id} value={String(task._id || task.id)}>{task.title}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-muted">Participant fields are not supported by the current Decision model. The source author and decision creator are preserved.</p>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-500/30 p-3 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !title.trim() || !summary.trim() || !context.trim()}><GitMerge size={15} />{saving ? "Saving..." : "Save decision"}</Button></div>
      </form>
    </div>
  );
}

export default function Discussion({ workspaceId, projectId, workspace, project, onOpenDecision }) {
  const [threads, setThreads] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [tasksError, setTasksError] = useState("");
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filter, setFilter] = useState("All");
  const [showNewDiscussion, setShowNewDiscussion] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [composerError, setComposerError] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadConfig, setUploadConfig] = useState({ maxFileBytes: DEFAULT_MAX_FILE_SIZE, maxFiles: MAX_FILES, formats: DEFAULT_UPLOAD_FORMATS });
  const [focusedMessageId, setFocusedMessageId] = useState("");
  const [recordedDecisions, setRecordedDecisions] = useState({});
  const [recordingMessage, setRecordingMessage] = useState(null);
  const [pageNotice, setPageNotice] = useState("");
  const [lastRecordedDecisionId, setLastRecordedDecisionId] = useState("");
  const [discussionLoadAttempt, setDiscussionLoadAttempt] = useState(0);
  const threadsRef = useRef(threads);

  const fileInputRef = useRef(null);

  useEffect(() => {
    let active = true;
    uploadAPI.getConfig().then((config) => {
      if (active && Number.isSafeInteger(config.maxFileBytes) && config.maxFileBytes > 0) {
        const formats = Array.isArray(config.formats) && config.formats.length && config.formats.every((item) => typeof item === "string" && /^\.[a-z0-9]+$/.test(item)) ? config.formats : DEFAULT_UPLOAD_FORMATS;
        setUploadConfig({ maxFileBytes: config.maxFileBytes, maxFiles: Number.isSafeInteger(config.maxFiles) ? config.maxFiles : MAX_FILES, formats });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    let cancelled = false;

    async function loadDiscussions() {
      try {
        setLoading(true);
        setPageError("");

        if (!workspaceId || !projectId) {
          setThreads([]);
          setActiveThreadId(null);
          return;
        }
        const result = await discussionAPI.getAll(workspaceId, projectId);
        if (cancelled) return;

        const loadedThreads = (result.data || []).map(normalizeThread);
        setThreads(loadedThreads);

        const requestedThreadId = sessionStorage.getItem("devsync_discussion_focus");
        const requestedMessageId = sessionStorage.getItem("devsync_message_focus");
        const requestedThread = loadedThreads.find((thread) => thread.id === requestedThreadId);
        if (requestedThread) {
          setActiveThreadId(requestedThread.id);
          setFocusedMessageId(requestedThread.messages.some((message) => message.id === requestedMessageId) ? requestedMessageId : "");
        }
        sessionStorage.removeItem("devsync_discussion_focus");
        sessionStorage.removeItem("devsync_message_focus");

        setActiveThreadId((currentId) => {
          if (requestedThread) return requestedThread.id;
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

    async function loadTasks() {
      try {
        if (!workspaceId || !projectId) {
          setTasks([]);
          return;
        }
        const result = await taskAPI.getAll(workspaceId, projectId);
        if (cancelled) return;
        const items = Array.isArray(result) ? result : result?.data;
        if (!Array.isArray(items)) throw new Error("Unexpected task response");
        setTasks(items);
        setTasksError("");
      } catch {
        if (!cancelled) setTasksError("Tasks could not be loaded. You can still create a discussion without linking one.");
      }
    }

    loadDiscussions();
    loadTasks();

    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, discussionLoadAttempt]);

  useEffect(() => {
    const matchesScope = (event) => String(event?.workspaceId) === String(workspaceId) && String(event?.projectId) === String(projectId);
    const unsubscribers = [
      subscribeRealtime("discussion:created", (event) => {
        if (!matchesScope(event) || !event.discussion) return;
        const incoming = normalizeThread(event.discussion);
        if (!incoming.id) return;
        setThreads((current) => current.some((item) => item.id === incoming.id) ? current : [incoming, ...current]);
      }),
      subscribeRealtime("discussion:message", (event) => {
        if (!matchesScope(event) || !event.discussionId || !event.message) return;
        const threadId = String(event.discussionId);
        if (!threadsRef.current.some((item) => item.id === threadId)) {
          setDiscussionLoadAttempt((attempt) => attempt + 1);
          return;
        }
        setThreads((current) => current.map((thread) => {
          if (thread.id !== threadId || thread.messages.some((item) => item.id === String(event.message._id || event.message.id))) return thread;
          return normalizeThread({ ...thread, messages: [...thread.messages, event.message] });
        }));
      }),
      subscribeRealtime("discussion:updated", (event) => {
        if (!matchesScope(event) || !event.discussion) return;
        const incoming = normalizeThread(event.discussion);
        setThreads((current) => current.map((thread) => thread.id === incoming.id ? incoming : thread));
      }),
      subscribeRealtime("realtime:resync", (event) => {
        if (matchesScope(event)) setDiscussionLoadAttempt((attempt) => attempt + 1);
      }),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [workspaceId, projectId]);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId || !projectId) {
      return () => { cancelled = true; };
    }
    decisionAPI.getAll(workspaceId, projectId).then((result) => {
      if (cancelled) return;
      const records = Array.isArray(result) ? result : result?.data || [];
      const linked = {};
      const includeRecords = (items, deleted = false) => items.forEach((decision) => {
        const discussionId = String(decision.discussionId?._id || decision.discussionId || "");
        const messageId = String(decision.discussionMessageId || "");
        if (discussionId && messageId) linked[`${discussionId}:${messageId}`] = { id: String(decision._id || decision.id), deleted };
      });
      includeRecords(records);
      decisionAPI.getTrash(workspaceId, projectId).then((trashResult) => {
        if (cancelled) return;
        const trashed = Array.isArray(trashResult) ? trashResult : trashResult?.data || [];
        includeRecords(trashed, true);
        setRecordedDecisions(linked);
      }).catch(() => {
        if (!cancelled) setRecordedDecisions(linked);
      });
    }).catch(() => {
      if (!cancelled) setRecordedDecisions({});
    });
    return () => { cancelled = true; };
  }, [workspaceId, projectId]);

  const activeThread = threads.find(
    (thread) => thread.id === activeThreadId
  );

  useEffect(() => {
    if (!activeThread || !focusedMessageId) return;
    const messageElement = Array.from(document.querySelectorAll("[data-message-id]")).find(
      (element) => element.dataset.messageId === focusedMessageId
    );
    if (messageElement) messageElement.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeThread, focusedMessageId]);

  const filteredThreads = threads.filter((thread) => {
    const matchesSearch =
      `${thread.title} ${thread.project} ${thread.linkedTask?.title || ""} ${thread.taskId}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesFilter =
      filter === "All" ||
      (filter === "Open" && thread.status === "Open") ||
      (filter === "Resolved" && thread.status === "Resolved");

    return matchesSearch && matchesFilter;
  });

  async function createDiscussion(data) {
    const result = await discussionAPI.create({ ...data, workspaceId, projectId });
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
      if (!isAllowedFile(file, uploadConfig.formats)) {
        error = `${file.name}: supported formats are ${uploadConfig.formats.join(", ")}.`;
        break;
      }

      if (file.size > uploadConfig.maxFileBytes) {
        error = `${file.name} exceeds the maximum allowed file size of ${formatFileSize(uploadConfig.maxFileBytes)}.`;
        break;
      }

      const alreadySelected = nextFiles.some(
        (selected) =>
          selected.name === file.name &&
          selected.size === file.size &&
          selected.lastModified === file.lastModified
      );

      if (alreadySelected) continue;

      if (nextFiles.length >= uploadConfig.maxFiles) {
        error = `You can attach a maximum of ${uploadConfig.maxFiles} files per message.`;
        break;
      }

      nextFiles.push(file);
    }

    if (error) {
      setComposerError(error);
      return;
    }

    setComposerError("");
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

      if (selectedFiles.length > 0) {
        setUploadProgress(0);
      }

      const result = await uploadAttachmentsAndSend({
        files: selectedFiles,
        workspaceId,
        projectId,
        text,
        uploadFiles: uploadAPI.uploadFiles,
        onProgress: setUploadProgress,
        addMessage: (payload) => discussionAPI.addMessage(activeThread.id, payload),
      });

      const updatedThread = normalizeThread(result.data);

      setThreads((current) =>
        current.map((thread) =>
          thread.id === updatedThread.id ? updatedThread : thread
        )
      );

      setMessage("");
      setSelectedFiles([]);
      setComposerError("");
      setPageNotice("Message sent successfully.");
    } catch (error) {
      setComposerError(error.message || "Failed to send message or upload files.");
    } finally {
      setSendingMessage(false);
      setUploadProgress(null);
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

  async function recordMessageAsDecision(data) {
    const result = await decisionAPI.create({ ...data, workspaceId, projectId });
    const savedDecision = result?.data || result;
    const decisionId = String(savedDecision?._id || savedDecision?.id || "");
    if (!decisionId) throw new Error("The server did not return the saved decision.");
    const key = `${data.discussionId}:${data.discussionMessageId}`;
    setRecordedDecisions((current) => ({ ...current, [key]: decisionId }));
    setLastRecordedDecisionId(decisionId);
    setPageNotice("Decision saved to this project's Decision Log.");
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
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{pageError}</p>
        <Button className="mt-3" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-10rem)] w-full max-w-none flex-col gap-5 pb-2">
      {pageError && (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300"
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
      {pageNotice && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-acc/30 bg-accSoft px-4 py-3 text-sm text-acc">
          <span>{pageNotice}</span>
          <div className="flex items-center gap-3"><button type="button" className="font-medium underline" onClick={() => onOpenDecision?.(lastRecordedDecisionId)}>Open Decision Log entry</button><button type="button" aria-label="Dismiss notice" onClick={() => setPageNotice("")}><X size={15} /></button></div>
        </div>
      )}

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-sm text-muted">{workspace?.name || "Workspace"} / {project?.name || "Project"}</p>
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

      <div className="grid min-h-170 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-line bg-surface lg:min-h-140 lg:grid-cols-[280px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="flex max-h-64 min-h-0 flex-col border-b border-line bg-side lg:max-h-none lg:border-b-0 lg:border-r">
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
                        {(thread.linkedTask?.title || thread.taskId) && (
                          <span className="font-mono text-[10px] text-muted">
                            {thread.linkedTask?.title || thread.taskId}
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

        <section className="flex min-h-115 min-w-0 flex-col lg:min-h-0">
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

                    {(activeThread.linkedTask?.title || activeThread.taskId) && (
                      <>
                        <span className="text-muted">·</span>
                        <span className="font-mono text-xs text-muted">
                          Task: {activeThread.linkedTask?.title || activeThread.taskId}
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
                      data-message-id={item.id}
                      className={`mb-6 flex items-start gap-3 rounded-lg ${focusedMessageId === item.id ? "ring-2 ring-acc/50 ring-offset-4 ring-offset-surface" : ""}`}
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
                        {item.text.trim() && /^[a-f\d]{24}$/i.test(item.id) && (
                          <button
                            type="button"
                          onClick={() => recordedDecisions[`${activeThread.id}:${item.id}`]
                              ? onOpenDecision?.(recordedDecisions[`${activeThread.id}:${item.id}`].id)
                              : setRecordingMessage(item)}
                            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amb hover:underline"
                          >
                            <GitMerge size={13} />
                            {recordedDecisions[`${activeThread.id}:${item.id}`]
                              ? recordedDecisions[`${activeThread.id}:${item.id}`].deleted ? "View in Recycle Bin" : "Open recorded decision"
                              : "Record as decision"}
                          </button>
                        )}
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
                className="shrink-0 border-t border-line bg-surface p-3 sm:p-5"
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

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept={uploadConfig.formats.join(",")}
                        className="hidden"
                        onChange={handleFileSelection}
                      />

                      <button
                        type="button"
                        disabled={sendingMessage || selectedFiles.length >= uploadConfig.maxFiles}
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Attach files"
                        title={`Attach up to ${uploadConfig.maxFiles} files (${formatFileSize(uploadConfig.maxFileBytes)} each): ${uploadConfig.formats.join(", ")}`}
                        className="rounded-md p-1.5 text-muted hover:bg-hover hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Paperclip size={17} />
                      </button>

                      <span className="text-[10px] text-muted sm:text-[11px]">
                        {selectedFiles.length}/{uploadConfig.maxFiles} files · {formatFileSize(uploadConfig.maxFileBytes)} max each · {uploadConfig.formats.join(", ")}
                      </span>
                    </div>

                    {sendingMessage && uploadProgress !== null && <div className="w-full basis-full" role="status" aria-live="polite"><div className="h-1.5 overflow-hidden rounded-full bg-hover"><div className="h-full rounded-full bg-acc transition-[width] duration-150" style={{ width: `${uploadProgress}%` }} /></div><p className="mt-1 text-right text-[11px] text-muted">Uploading attachments · {uploadProgress}%</p></div>}

                    <Button
                      type="submit"
                      size="sm"
                      className="shrink-0"
                      disabled={
                        (!message.trim() && selectedFiles.length === 0) ||
                        sendingMessage
                      }
                    >
                      {sendingMessage ? (selectedFiles.length ? "Uploading..." : "Sending...") : "Send"}
                      <Send size={14} />
                    </Button>
                  </div>

                  {composerError && <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">{composerError}</p>}
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
          tasks={tasks}
          tasksError={tasksError}
          projectName={project?.name}
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
      {recordingMessage && activeThread && (
        <MessageDecisionModal
          key={`${activeThread.id}:${recordingMessage.id}`}
          thread={activeThread}
          message={recordingMessage}
          tasks={tasks}
          onClose={() => setRecordingMessage(null)}
          onSave={recordMessageAsDecision}
        />
      )}
    </div>
  );
}
