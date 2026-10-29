const crypto = require("crypto");
const Task = require("../models/Task");
const Project = require("../models/Project");
const GitHubWebhookDelivery = require("../models/GitHubWebhookDelivery");
const { normalizeRepositoryFullName } = require("../utils/githubPullRequest");
const { recordProjectEvent } = require("./projectEvents");
const { emitProjectEvent } = require("../realtime");

const MAX_ATTEMPTS = 5;
const PROCESSING_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const SUPPORTED_ACTIONS = new Set(["opened", "reopened", "edited", "closed", "review_requested"]);
const REVIEW_ACTIONS = new Set(["approved", "changes_requested", "commented"]);

function meetsTaskCompletionPolicy(task) {
  return task?.status === "in-review" && (task.acceptanceCriteria || []).every((criterion) => criterion.completed === true);
}

function verifySignature(rawBody, signature, secret) {
  if (!Buffer.isBuffer(rawBody) || typeof signature !== "string" || !/^sha256=[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const actual = Buffer.from(signature);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function normalizePayload(eventName, payload) {
  const repo = normalizeRepositoryFullName(payload?.repository?.full_name);
  const pr = payload?.pull_request;
  let action = payload?.action;
  if (eventName === "pull_request_review") {
    if (action !== "submitted" || !REVIEW_ACTIONS.has(payload?.review?.state)) return { ignored: true };
    action = `review_${payload.review.state}`;
  } else if (eventName !== "pull_request" || !SUPPORTED_ACTIONS.has(action)) return { ignored: true };
  if (!repo || !pr || !Number.isSafeInteger(pr.number) || pr.number < 1 ||
      typeof pr.title !== "string" || pr.title.length > 256 ||
      !["open", "closed"].includes(pr.state) || typeof pr.merged !== "boolean" || typeof pr.draft !== "boolean" ||
      !pr.updated_at || Number.isNaN(Date.parse(pr.updated_at))) return null;
  const state = pr.merged ? "merged" : pr.state;
  return {
    repositoryKey: repo.repositoryKey,
    owner: repo.owner,
    repository: repo.repository,
    number: pr.number,
    action,
    state,
    title: pr.title,
    draft: pr.draft,
    pullRequestUpdatedAt: new Date(pr.updated_at),
  };
}

async function claimDelivery(deliveryId) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
  return GitHubWebhookDelivery.findOneAndUpdate({
    deliveryId,
    $or: [
      { status: { $in: ["pending", "failed"] }, nextAttemptAt: { $lte: now }, attempts: { $lt: MAX_ATTEMPTS } },
      { status: "processing", processingAt: { $lte: staleBefore }, attempts: { $lt: MAX_ATTEMPTS } },
    ],
  }, { $set: { status: "processing", processingAt: now }, $inc: { attempts: 1 } }, { returnDocument: "after" });
}

async function processClaimedDelivery(delivery, io) {
  const data = delivery.eventData;
  if (!data) {
    delivery.status = "ignored";
    delivery.processedAt = new Date();
    delivery.nextAttemptAt = null;
    await delivery.save();
    return "ignored";
  }
  const matches = await Task.find({ pullRequests: { $elemMatch: { repositoryKey: data.repositoryKey, number: data.number } } }).limit(2);
  if (matches.length === 0) {
    delivery.status = "ignored";
    delivery.processedAt = new Date();
    delivery.nextAttemptAt = null;
    await delivery.save();
    return "ignored";
  }
  if (matches.length !== 1) throw new Error("ambiguous_link");

  const task = matches[0];
  const project = await Project.findOne({ _id: task.project, workspace: task.workspace }).select("_id");
  if (!project) throw new Error("invalid_task_scope");
  const prLink = task.pullRequests.find((entry) => entry.repositoryKey === data.repositoryKey && entry.number === data.number);
  if (!prLink) throw new Error("link_changed");

  const lifecycleEvent = !data.action.startsWith("review_") && data.action !== "review_requested";
  if (lifecycleEvent && String(prLink.lastDeliveryId || "") !== String(delivery.deliveryId)) {
    const previousWebhookTime = prLink.lastWebhookAt ? new Date(prLink.lastWebhookAt).getTime() : null;
    const incomingWebhookTime = new Date(data.pullRequestUpdatedAt).getTime();
    const statePriority = { open: 1, closed: 2, merged: 3 };
    const isOlder = previousWebhookTime !== null && previousWebhookTime > incomingWebhookTime;
    const isSameTimeButNotNewer = previousWebhookTime === incomingWebhookTime && (statePriority[data.state] || 0) <= (statePriority[prLink.state] || 0);
    if (isOlder || isSameTimeButNotNewer) {
      delivery.status = "ignored";
      delivery.processedAt = new Date();
      delivery.matchedTask = task._id;
      delivery.workspace = task.workspace;
      delivery.project = task.project;
      delivery.nextAttemptAt = null;
      await delivery.save();
      return "ignored";
    }
    const update = await Task.updateOne({
      _id: task._id,
      workspace: task.workspace,
      project: task.project,
      pullRequests: { $elemMatch: { _id: prLink._id, repositoryKey: data.repositoryKey, number: data.number, lastWebhookAt: prLink.lastWebhookAt, lastDeliveryId: prLink.lastDeliveryId } },
    }, { $set: {
      "pullRequests.$.owner": data.owner,
      "pullRequests.$.repository": data.repository,
      "pullRequests.$.title": data.title,
      "pullRequests.$.state": data.state,
      "pullRequests.$.draft": data.draft,
      "pullRequests.$.lastWebhookAt": data.pullRequestUpdatedAt,
      "pullRequests.$.lastDeliveryId": delivery.deliveryId,
    } });
    if (!update.modifiedCount) {
      const current = await Task.findById(task._id).select("pullRequests");
      const currentLink = current?.pullRequests?.find((entry) => String(entry._id) === String(prLink._id));
      if (String(currentLink?.lastDeliveryId || "") !== String(delivery.deliveryId)) throw new Error("concurrent_update");
    }
  }

  if (data.action === "review_changes_requested") {
    await Task.updateOne({ _id: task._id, workspace: task.workspace, project: task.project, status: "in-review" }, { $set: { status: "in-progress" } });
  }

  // A merged PR completes a task only after it has entered review and every
  // explicitly listed acceptance criterion has been checked.
  if (data.state === "merged") {
    const completionCandidate = await Task.findById(task._id).select("status acceptanceCriteria").lean();
    const eligibleForCompletion = meetsTaskCompletionPolicy(completionCandidate);
    const completion = eligibleForCompletion && await Task.findOneAndUpdate({
      _id: task._id,
      workspace: task.workspace,
      project: task.project,
      status: "in-review",
      "pullRequests.repositoryKey": data.repositoryKey,
      "pullRequests.number": data.number,
      $nor: [{ acceptanceCriteria: { $elemMatch: { completed: false } } }],
    }, { $set: { status: "done", completedAt: new Date(data.pullRequestUpdatedAt), completionMethod: "github", completionNote: `Merged PR #${data.number}` } }, { returnDocument: "after" });
    if (completion) {
      const saved = await recordProjectEvent({
        io, systemEvent: true, workspaceId: task.workspace, projectId: task.project,
        action: "task.completed", summary: `Completed task from merged PR #${data.number}`,
        entityType: "task", entityId: task._id,
        eventKey: `github-task-completed:${delivery.deliveryId}`,
        notifications: task.assignee ? [{ recipient: task.assignee, type: "task.completed", title: "Task completed", message: `Merged PR #${data.number}`, eventKey: delivery.deliveryId }] : [],
      });
      if (!saved) throw new Error("completion_event_failed");
    }
  }

  const action = data.state === "merged" ? "github.pr_merged" : data.action.startsWith("review_") ? `github.${data.action}` : `github.pr_${data.state === "closed" ? "closed" : data.action}`;
  const stateLabel = data.state === "merged" ? "merged" : data.state === "closed" ? "closed" : data.action.replace(/^review_/, "").replaceAll("_", " ");
  const eventRecorded = await recordProjectEvent({
    io,
    systemEvent: true,
    workspaceId: task.workspace,
    projectId: task.project,
    action,
    summary: `GitHub PR #${data.number} ${stateLabel}: ${data.title}`.slice(0, 240),
    entityType: "task",
    entityId: task._id,
    eventKey: `github-delivery:${delivery.deliveryId}`,
    notifications: task.assignee ? [{ recipient: task.assignee, type: action, title: `GitHub PR ${stateLabel}`, message: `#${data.number} ${data.title}`.slice(0, 240), eventKey: delivery.deliveryId }] : [],
  });
  if (!eventRecorded) throw new Error("activity_persist_failed");
  const updatedTask = await Task.findById(task._id).populate("assignee", "name email avatar").populate("comments.author", "name email avatar");
  await emitProjectEvent(io, { workspaceId: task.workspace, projectId: task.project }, "task:updated", { task: updatedTask });

  delivery.status = "processed";
  delivery.processedAt = new Date();
  delivery.nextAttemptAt = null;
  delivery.matchedTask = task._id;
  delivery.workspace = task.workspace;
  delivery.project = task.project;
  delivery.lastError = "";
  await delivery.save();
  return "processed";
}

async function processDelivery(deliveryId, io) {
  const delivery = await claimDelivery(deliveryId);
  if (!delivery) return "duplicate_or_busy";
  try {
    return await processClaimedDelivery(delivery, io);
  } catch (error) {
    delivery.status = "failed";
    delivery.lastError = /^[a-z_]+$/.test(error.message || "") ? error.message.slice(0, 80) : "processing_error";
    delivery.processingAt = null;
    if (delivery.attempts < MAX_ATTEMPTS) {
      delivery.nextAttemptAt = new Date(Date.now() + Math.min(MAX_BACKOFF_MS, 15_000 * (2 ** (delivery.attempts - 1))));
    } else {
      delivery.nextAttemptAt = null;
    }
    await delivery.save();
    throw error;
  }
}

async function acceptDelivery({ deliveryId, eventName, rawBody, io }) {
  if (typeof deliveryId !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(deliveryId)) return { status: 400, message: "Invalid GitHub delivery ID." };
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 256 * 1024) return { status: 400, message: "Invalid webhook body." };
  let payload;
  try { payload = JSON.parse(rawBody.toString("utf8")); } catch { return { status: 400, message: "Malformed webhook JSON." }; }
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof eventName !== "string" || eventName.length > 40) return { status: 400, message: "Malformed webhook payload." };
  const data = normalizePayload(eventName, payload);
  const status = data?.ignored ? "ignored" : data ? "pending" : "invalid";
  if (status === "invalid") return { status: 400, message: "Malformed pull request event." };
  try {
    await GitHubWebhookDelivery.create({
      deliveryId, eventName, action: typeof payload.action === "string" ? payload.action.slice(0, 40) : "",
      eventData: data?.ignored ? null : data,
      status, attempts: 0, nextAttemptAt: status === "pending" ? new Date() : null,
      processedAt: status === "ignored" ? new Date() : null,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await GitHubWebhookDelivery.findOne({ deliveryId }).select("status attempts");
    if (existing?.status === "processed" || existing?.status === "ignored") return { status: 202, message: "Delivery already handled." };
    if (existing?.status === "failed" && existing.attempts >= MAX_ATTEMPTS) {
      await GitHubWebhookDelivery.updateOne({ deliveryId, status: "failed" }, { $set: { status: "pending", attempts: 0, nextAttemptAt: new Date(), lastError: "" } });
    }
    // A duplicate pending/failed delivery may safely retry processing.
  }
  try {
    const result = await processDelivery(deliveryId, io);
    return { status: 202, message: result === "processed" ? "Webhook accepted." : "Delivery already in progress." };
  } catch {
    return { status: 503, message: "Webhook processing failed and will be retried." };
  }
}

async function processDueDeliveries(io) {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - PROCESSING_TIMEOUT_MS);
  const due = await GitHubWebhookDelivery.find({
    attempts: { $lt: MAX_ATTEMPTS },
    $or: [
      { status: { $in: ["pending", "failed"] }, nextAttemptAt: { $lte: now } },
      { status: "processing", processingAt: { $lte: staleBefore } },
    ],
  }).select("deliveryId").limit(20);
  for (const item of due) {
    try { await processDelivery(item.deliveryId, io); } catch { /* state is retained for retry/audit */ }
  }
}

let workerStarted = false;
function startGitHubWebhookWorker(io) {
  if (workerStarted) return;
  workerStarted = true;
  const timer = setInterval(() => { void processDueDeliveries(io).catch(() => {}); }, 30_000);
  timer.unref?.();
}

module.exports = { acceptDelivery, verifySignature, normalizePayload, meetsTaskCompletionPolicy, startGitHubWebhookWorker };
