const express = require("express");
const mongoose = require("mongoose");
const AISuggestion = require("../models/AISuggestion");
const Workspace = require("../models/Workspace");
const Project = require("../models/Project");
const Discussion = require("../models/Discussion");
const Task = require("../models/Task");
const Decision = require("../models/Decision");
const authMiddleware = require("../middleware/authMiddleware");
const { requestSuggestions, ProviderError } = require("../services/llmProvider");
const { createTaskRecord, createDecisionRecord } = require("../services/projectRecords");
const { recordProjectEvent } = require("../services/projectEvents");

const router = express.Router();
router.use(authMiddleware);
const validId = (value) => mongoose.isObjectIdOrHexString(value);
const priorities = ["low", "medium", "high"];
const rateBuckets = new Map();
const MAX_REQUESTS = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_SOURCE_MESSAGES = 10;

async function getScope(workspaceId, projectId, userId) {
  if (!validId(workspaceId) || !validId(projectId)) return { status: 400, message: "Valid workspace and project IDs are required." };
  const workspace = await Workspace.findOne({ _id: workspaceId, "members.user": userId }).populate("members.user", "name");
  if (!workspace) return { status: 404, message: "Workspace not found or access denied." };
  const project = await Project.findOne({ _id: projectId, workspace: workspace._id }).select("_id name");
  if (!project) return { status: 404, message: "Project not found in this workspace." };
  return { workspace, project };
}

function sendScopeError(res, scope) {
  return res.status(scope.status).json({ message: scope.message });
}

async function getOwnedSuggestion(id, scope) {
  if (!validId(id)) return { error: { status: 400, message: "Invalid suggestion ID." } };
  const suggestion = await AISuggestion.findOne({ _id: id, workspace: scope.workspace._id, project: scope.project._id });
  if (!suggestion) return { error: { status: 404, message: "Suggestion not found in this project." } };
  return { suggestion };
}

function consumeRequest(userId, workspaceId, projectId) {
  const now = Date.now();
  const key = `${userId}:${workspaceId}:${projectId}`;
  let bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) bucket = { startedAt: now, count: 0 };
  bucket.count += 1;
  if (rateBuckets.size > 1000) {
    for (const [bucketKey, value] of rateBuckets) if (now - value.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(bucketKey);
  }
  if (!rateBuckets.has(key) && rateBuckets.size >= 5000) return false;
  rateBuckets.set(key, bucket);
  return bucket.count <= MAX_REQUESTS;
}

function exactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => expected.includes(key)) && expected.every((key) => Object.hasOwn(value, key));
}

function hasOnlyKeys(value, allowed) {
  return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => allowed.includes(key));
}

function textField(value, max, required = true) {
  return typeof value === "string" && value.trim().length <= max && (!required || Boolean(value.trim()));
}

function isValidDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validateExtraction(raw, sourceIds, memberIds) {
  if (!exactKeys(raw, ["decisions", "tasks", "uncertainties"]) ||
      !Array.isArray(raw.decisions) || raw.decisions.length > 5 ||
      !Array.isArray(raw.tasks) || raw.tasks.length > 5 ||
      !Array.isArray(raw.uncertainties) || raw.uncertainties.length > 5) return null;
  const allowedSources = new Set(sourceIds.map(String));
  const decisions = [];
  for (const item of raw.decisions) {
    if (!exactKeys(item, ["title", "outcome", "rationale", "sourceMessageIds"]) ||
        !textField(item.title, 200) || !textField(item.outcome, 2000) || !textField(item.rationale, 2000) ||
        !Array.isArray(item.sourceMessageIds) || item.sourceMessageIds.length < 1 || item.sourceMessageIds.length > MAX_SOURCE_MESSAGES) return null;
    const ids = [...new Set(item.sourceMessageIds.map(String))];
    if (ids.length !== item.sourceMessageIds.length || ids.some((id) => !validId(id) || !allowedSources.has(id))) return null;
    decisions.push({ title: item.title.trim(), outcome: item.outcome.trim(), rationale: item.rationale.trim(), sourceMessageIds: ids });
  }
  const tasks = [];
  for (const item of raw.tasks) {
    if (!exactKeys(item, ["title", "description", "priority", "suggestedAssignee", "dueDate"]) ||
        !textField(item.title, 120) || !textField(item.description, 2000, false) || !priorities.includes(item.priority) ||
        (item.suggestedAssignee !== null && (!validId(item.suggestedAssignee) || !memberIds.has(String(item.suggestedAssignee)))) ||
        (item.dueDate !== null && !isValidDateOnly(item.dueDate))) return null;
    tasks.push({
      title: item.title.trim(), description: item.description.trim(), priority: item.priority,
      suggestedAssignee: item.suggestedAssignee || null,
      dueDate: item.dueDate ? new Date(`${item.dueDate}T00:00:00.000Z`) : null,
    });
  }
  if (raw.uncertainties.some((item) => !textField(item, 300))) return null;
  return { decisions, tasks, uncertainties: raw.uncertainties.map((item) => item.trim()) };
}

function validateEditableSuggestions(body, suggestion, memberIds) {
  if (!exactKeys(body, ["decisions", "tasks", "uncertainties"]) ||
      !Array.isArray(body.decisions) || body.decisions.length > 5 ||
      !Array.isArray(body.tasks) || body.tasks.length > 5 ||
      !Array.isArray(body.uncertainties) || body.uncertainties.length > 5) return null;
  const allowedSources = new Set(suggestion.sourceMessageIds.map(String));
  const decisions = [];
  for (const item of body.decisions) {
    if (!exactKeys(item, ["title", "outcome", "rationale", "sourceMessageIds"]) ||
        !textField(item.title, 200) || !textField(item.outcome, 2000) || !textField(item.rationale, 2000) ||
        !Array.isArray(item.sourceMessageIds) || item.sourceMessageIds.length < 1 || item.sourceMessageIds.length > MAX_SOURCE_MESSAGES) return null;
    const ids = [...new Set(item.sourceMessageIds.map(String))];
    if (ids.length !== item.sourceMessageIds.length || ids.some((id) => !validId(id) || !allowedSources.has(id))) return null;
    decisions.push({ title: item.title.trim(), outcome: item.outcome.trim(), rationale: item.rationale.trim(), sourceMessageIds: ids, approvedEntityId: null });
  }
  const tasks = [];
  for (const item of body.tasks) {
    if (!exactKeys(item, ["title", "description", "priority", "suggestedAssignee", "dueDate"]) ||
        !textField(item.title, 120) || !textField(item.description, 2000, false) || !priorities.includes(item.priority) ||
        (item.suggestedAssignee !== null && (!validId(item.suggestedAssignee) || !memberIds.has(String(item.suggestedAssignee)))) ||
        (item.dueDate !== null && !isValidDateOnly(item.dueDate))) return null;
    tasks.push({ title: item.title.trim(), description: item.description.trim(), priority: item.priority,
      suggestedAssignee: item.suggestedAssignee || null,
      dueDate: item.dueDate ? new Date(`${item.dueDate}T00:00:00.000Z`) : null, approvedEntityId: null });
  }
  if (body.uncertainties.some((item) => !textField(item, 300))) return null;
  return { decisions, tasks, uncertainties: body.uncertainties.map((item) => item.trim()) };
}

function buildApprovalPlan(body, suggestion, discussion, memberIds) {
  if (!exactKeys(body, ["decisions", "tasks"]) || !Array.isArray(body.decisions) || !Array.isArray(body.tasks) ||
      body.decisions.length > suggestion.decisions.length || body.tasks.length > suggestion.tasks.length ||
      (!body.decisions.length && !body.tasks.length)) return null;
  const plan = { decisions: [], tasks: [] };
  const seenDecisions = new Set();
  for (const item of body.decisions) {
    if (!exactKeys(item, ["index", "title", "outcome", "rationale", "sourceMessageId"]) ||
        !Number.isInteger(item.index) || item.index < 0 || item.index >= suggestion.decisions.length || seenDecisions.has(item.index) ||
        !textField(item.title, 200) || !textField(item.outcome, 5000) || !textField(item.rationale, 5000) || !validId(item.sourceMessageId)) return null;
    const original = suggestion.decisions[item.index];
    const sourceId = String(item.sourceMessageId);
    if (!original.sourceMessageIds.some((id) => String(id) === sourceId) || !discussion.messages.id(sourceId)) return null;
    seenDecisions.add(item.index);
    plan.decisions.push({ itemKey: `decision-${item.index}`, title: item.title.trim(), outcome: item.outcome.trim(), rationale: item.rationale.trim(), discussionId: discussion._id, sourceMessageId: sourceId });
  }
  const seenTasks = new Set();
  for (const item of body.tasks) {
    if (!exactKeys(item, ["index", "title", "description", "priority", "assignee", "dueDate"]) ||
        !Number.isInteger(item.index) || item.index < 0 || item.index >= suggestion.tasks.length || seenTasks.has(item.index) ||
        !textField(item.title, 120) || !textField(item.description, 2000, false) || !priorities.includes(item.priority) ||
        (item.assignee !== null && (!validId(item.assignee) || !memberIds.has(String(item.assignee)))) ||
        (item.dueDate !== null && !isValidDateOnly(item.dueDate))) return null;
    seenTasks.add(item.index);
    plan.tasks.push({ itemKey: `task-${item.index}`, title: item.title.trim(), description: item.description.trim(), priority: item.priority,
      assignee: item.assignee || null, dueDate: item.dueDate ? new Date(`${item.dueDate}T00:00:00.000Z`) : null });
  }
  return plan;
}

async function persistApprovedEntities(req, scope, suggestion, discussion) {
  const result = { decisions: [], tasks: [] };
  for (const item of suggestion.approvalPlan.tasks) {
    let record = await Task.findOne({ aiSuggestionId: suggestion._id, aiSuggestionItemKey: item.itemKey, workspace: scope.workspace._id, project: scope.project._id });
    if (!record) {
      try {
        record = await createTaskRecord({ scope, actorId: req.user._id, fields: item, aiSuggestionId: suggestion._id, aiSuggestionItemKey: item.itemKey });
      } catch (error) {
        if (error.code !== 11000) throw error;
        record = await Task.findOne({ aiSuggestionId: suggestion._id, aiSuggestionItemKey: item.itemKey, workspace: scope.workspace._id, project: scope.project._id });
        if (!record) throw error;
      }
    }
    const index = Number(item.itemKey.slice("task-".length));
    suggestion.tasks[index].approvedEntityId = record._id;
    await suggestion.save();
    result.tasks.push({ index, id: String(record._id) });
    await recordProjectEvent({ io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id, projectId: scope.project._id,
      action: "task.ai_approved", summary: `Created AI-suggested task: ${record.title}`, entityType: "task", entityId: record._id,
      eventKey: `ai-suggestion:${suggestion._id}:${item.itemKey}`,
      notifications: record.assignee ? [{ recipient: record.assignee, type: "task.assigned", title: "You were assigned a task", message: record.title, eventKey: `ai-suggestion:${suggestion._id}:${item.itemKey}` }] : [] });
  }
  for (const item of suggestion.approvalPlan.decisions) {
    let record = await Decision.findOne({ aiSuggestionId: suggestion._id, aiSuggestionItemKey: item.itemKey, workspace: scope.workspace._id, projectRef: scope.project._id });
    if (!record) {
      try {
        record = await createDecisionRecord({ scope, actorName: req.user.name || req.user.email,
          fields: { title: item.title, summary: item.outcome, context: item.rationale }, discussion,
          discussionMessageId: item.sourceMessageId, aiSuggestionId: suggestion._id, aiSuggestionItemKey: item.itemKey });
      } catch (error) {
        if (error.code !== 11000) throw error;
        record = await Decision.findOne({ aiSuggestionId: suggestion._id, aiSuggestionItemKey: item.itemKey, workspace: scope.workspace._id, projectRef: scope.project._id });
        if (!record) throw error;
      }
    }
    const index = Number(item.itemKey.slice("decision-".length));
    suggestion.decisions[index].approvedEntityId = record._id;
    await suggestion.save();
    result.decisions.push({ index, id: String(record._id) });
    const sourceAuthor = discussion.messages.id(item.sourceMessageId)?.author;
    await recordProjectEvent({ io: req.app.get("io"), actorId: req.user._id, workspaceId: scope.workspace._id, projectId: scope.project._id,
      action: "decision.ai_approved", summary: `Recorded AI-suggested decision: ${record.title}`, entityType: "decision", entityId: record._id,
      eventKey: `ai-suggestion:${suggestion._id}:${item.itemKey}`,
      notifications: sourceAuthor ? [{ recipient: sourceAuthor, type: "decision.recorded", title: "A project decision was recorded", message: record.title, eventKey: `ai-suggestion:${suggestion._id}:${item.itemKey}` }] : [] });
  }
  return result;
}

router.get("/", async (req, res) => {
  try {
    const scope = await getScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.status) return sendScopeError(res, scope);
    const now = new Date();
    await AISuggestion.updateMany({ workspace: scope.workspace._id, project: scope.project._id, status: "pending", expiresAt: { $lte: now } }, { $set: { status: "expired" } });
    const items = await AISuggestion.find({ workspace: scope.workspace._id, project: scope.project._id }).sort({ createdAt: -1 }).limit(30).populate("requestedBy", "name").populate("tasks.suggestedAssignee", "name").lean();
    return res.json({ data: items, providerConfigured: Boolean(process.env.LLM_API_KEY?.trim()) });
  } catch { return res.status(500).json({ message: "Could not load AI suggestions." }); }
});

router.post("/", async (req, res) => {
  try {
    if (!hasOnlyKeys(req.body, ["workspaceId", "projectId", "discussionId", "messageIds", "recentCount"]) ||
        !Object.hasOwn(req.body, "workspaceId") || !Object.hasOwn(req.body, "projectId") || !Object.hasOwn(req.body, "discussionId") ||
        (Object.hasOwn(req.body, "messageIds") === Object.hasOwn(req.body, "recentCount"))) return res.status(400).json({ message: "Select a discussion and either specific messages or a recent-message count." });
    const scope = await getScope(req.body.workspaceId, req.body.projectId, req.user._id);
    if (scope.status) return sendScopeError(res, scope);
    if (!validId(req.body.discussionId)) return res.status(400).json({ message: "Invalid discussion ID." });
    const discussion = await Discussion.findOne({ _id: req.body.discussionId, workspace: scope.workspace._id, project: scope.project._id });
    if (!discussion) return res.status(404).json({ message: "Discussion not found in this project." });
    let selected = [];
    if (Array.isArray(req.body.messageIds)) {
      if (!req.body.messageIds.length || req.body.messageIds.length > MAX_SOURCE_MESSAGES || req.body.messageIds.some((id) => !validId(id)) || new Set(req.body.messageIds.map(String)).size !== req.body.messageIds.length) return res.status(400).json({ message: "Select between 1 and 10 unique valid message IDs." });
      selected = req.body.messageIds.map((id) => discussion.messages.id(id)).filter(Boolean);
      if (selected.length !== req.body.messageIds.length) return res.status(400).json({ message: "A selected message does not belong to this discussion." });
    } else {
      const count = req.body.recentCount;
      if (!Number.isInteger(count) || count < 1 || count > MAX_SOURCE_MESSAGES) return res.status(400).json({ message: "Recent message count must be between 1 and 10." });
      selected = discussion.messages.slice(-count);
    }
    const messages = selected.map((message) => ({ id: String(message._id), text: message.text || "" }));
    const totalTextLength = messages.reduce((total, message) => total + message.text.length, 0);
    if (!totalTextLength || totalTextLength > 12_000) return res.status(400).json({ message: "Selected messages must contain between 1 and 12000 characters of text." });
    if (!consumeRequest(req.user._id, scope.workspace._id, scope.project._id)) return res.status(429).json({ message: "AI extraction limit reached. Try again later." });
    const availableMembers = scope.workspace.members.map((member) => {
      const user = member.user?._id ? member.user : null;
      const id = String(user?._id || member.user || "");
      return validId(id) ? { id, name: (user?.name || "Workspace member").slice(0, 80) } : null;
    }).filter(Boolean);
    const memberIds = new Set(availableMembers.map((member) => member.id));
    const members = availableMembers.slice(0, 100);
    const providedMemberIds = new Set(members.map((member) => member.id));
    let extraction;
    try { extraction = await requestSuggestions({ messages, members }); }
    catch (error) {
      if (!(error instanceof ProviderError)) return res.status(502).json({ message: "AI suggestions are temporarily unavailable." });
      if (error.kind === "not_configured") return res.status(503).json({ message: "AI suggestions are not configured on this server." });
      if (error.kind === "timeout") return res.status(504).json({ message: "AI suggestions timed out. Try again." });
      if (error.kind === "invalid_output") return res.status(502).json({ message: "The AI returned an invalid suggestion format. Try again." });
      return res.status(502).json({ message: "AI suggestions are temporarily unavailable." });
    }
    const validated = validateExtraction(extraction.parsed, messages.map((message) => message.id), providedMemberIds);
    if (!validated) return res.status(502).json({ message: "The AI returned suggestions that failed validation." });
    const now = new Date();
    const suggestion = await AISuggestion.create({ workspace: scope.workspace._id, project: scope.project._id, discussion: discussion._id,
      requestedBy: req.user._id, sourceMessageIds: messages.map((message) => message.id), ...validated,
      providerModel: extraction.model.slice(0, 120), status: "pending", expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) });
    return res.status(201).json({ data: suggestion });
  } catch { return res.status(500).json({ message: "Could not create AI suggestions." }); }
});

router.get("/:id", async (req, res) => {
  try {
    const scope = await getScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.status) return sendScopeError(res, scope);
    const owned = await getOwnedSuggestion(req.params.id, scope);
    if (owned.error) return res.status(owned.error.status).json({ message: owned.error.message });
    const suggestion = owned.suggestion;
    if (suggestion.status === "pending" && suggestion.expiresAt <= new Date()) {
      await AISuggestion.updateOne({ _id: suggestion._id, status: "pending", expiresAt: { $lte: new Date() } }, { $set: { status: "expired" } });
    }
    const current = await AISuggestion.findOne({ _id: suggestion._id, workspace: scope.workspace._id, project: scope.project._id }).populate("tasks.suggestedAssignee", "name");
    return res.json({ data: current });
  } catch { return res.status(500).json({ message: "Could not load this suggestion." }); }
});

router.patch("/:id", async (req, res) => {
  try {
    const scope = await getScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.status) return sendScopeError(res, scope);
    const owned = await getOwnedSuggestion(req.params.id, scope);
    if (owned.error) return res.status(owned.error.status).json({ message: owned.error.message });
    const suggestion = owned.suggestion;
    if (suggestion.status !== "pending" || suggestion.expiresAt <= new Date()) return res.status(409).json({ message: "Only pending, unexpired suggestions can be edited." });
    const memberIds = new Set(scope.workspace.members.map((member) => String(member.user?._id || member.user)));
    const edited = validateEditableSuggestions(req.body, suggestion, memberIds);
    if (!edited) return res.status(400).json({ message: "Suggestion edits are invalid or reference an unavailable message or member." });
    const source = await Discussion.findOne({ _id: suggestion.discussion, workspace: scope.workspace._id, project: scope.project._id }).select("messages._id");
    if (!source || suggestion.sourceMessageIds.some((id) => !source.messages.id(id))) return res.status(409).json({ message: "A source message is no longer available in this project." });
    const updated = await AISuggestion.findOneAndUpdate({ _id: suggestion._id, workspace: scope.workspace._id, project: scope.project._id, status: "pending", expiresAt: { $gt: new Date() } },
      { $set: { decisions: edited.decisions, tasks: edited.tasks, uncertainties: edited.uncertainties } }, { returnDocument: "after", runValidators: true }).populate("tasks.suggestedAssignee", "name");
    if (!updated) return res.status(409).json({ message: "Suggestion changed or expired while you were editing." });
    return res.json({ data: updated });
  } catch { return res.status(500).json({ message: "Could not update AI suggestions." }); }
});

router.post("/:id/reject", async (req, res) => {
  try {
    const scope = await getScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.status) return sendScopeError(res, scope);
    const owned = await getOwnedSuggestion(req.params.id, scope);
    if (owned.error) return res.status(owned.error.status).json({ message: owned.error.message });
    const suggestion = owned.suggestion;
    if (suggestion.status === "pending" && suggestion.expiresAt <= new Date()) {
      await AISuggestion.updateOne({ _id: suggestion._id, status: "pending", expiresAt: { $lte: new Date() } }, { $set: { status: "expired" } });
    }
    if (suggestion.status !== "pending") return res.status(409).json({ message: "Only pending suggestions can be rejected." });
    const updated = await AISuggestion.findOneAndUpdate({ _id: suggestion._id, workspace: scope.workspace._id, project: scope.project._id, status: "pending", expiresAt: { $gt: new Date() } }, { $set: { status: "rejected" } }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Suggestion changed or expired before rejection." });
    return res.json({ data: updated });
  } catch { return res.status(500).json({ message: "Could not reject AI suggestions." }); }
});

router.post("/:id/expire", async (req, res) => {
  try {
    const scope = await getScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.status) return sendScopeError(res, scope);
    const owned = await getOwnedSuggestion(req.params.id, scope);
    if (owned.error) return res.status(owned.error.status).json({ message: owned.error.message });
    const suggestion = owned.suggestion;
    if (suggestion.status !== "pending" || suggestion.expiresAt > new Date()) return res.status(409).json({ message: "This suggestion is not eligible for expiration." });
    const updated = await AISuggestion.findOneAndUpdate({ _id: suggestion._id, workspace: scope.workspace._id, project: scope.project._id, status: "pending", expiresAt: { $lte: new Date() } }, { $set: { status: "expired" } }, { returnDocument: "after" });
    if (!updated) return res.status(409).json({ message: "Suggestion status changed before expiration." });
    return res.json({ data: updated });
  } catch { return res.status(500).json({ message: "Could not expire this suggestion." }); }
});

router.post("/:id/approve", async (req, res) => {
  try {
    const scope = await getScope(req.query.workspaceId, req.query.projectId, req.user._id);
    if (scope.status) return sendScopeError(res, scope);
    const owned = await getOwnedSuggestion(req.params.id, scope);
    if (owned.error) return res.status(owned.error.status).json({ message: owned.error.message });
    const suggestion = owned.suggestion;
    if (suggestion.status === "approved") return res.json({ status: "approved", decisions: suggestion.decisions.flatMap((item, index) => item.approvedEntityId ? [{ index, id: String(item.approvedEntityId) }] : []), tasks: suggestion.tasks.flatMap((item, index) => item.approvedEntityId ? [{ index, id: String(item.approvedEntityId) }] : []) });
    if (suggestion.status === "pending" && suggestion.expiresAt <= new Date()) {
      await AISuggestion.updateOne({ _id: suggestion._id, status: "pending", expiresAt: { $lte: new Date() } }, { $set: { status: "expired" } });
      return res.status(409).json({ message: "This suggestion has expired." });
    }
    if (suggestion.status === "rejected" || suggestion.status === "expired") return res.status(409).json({ message: "This suggestion can no longer be approved." });

    if (suggestion.status === "pending") {
      const memberIds = new Set(scope.workspace.members.map((member) => String(member.user?._id || member.user)));
      const discussion = await Discussion.findOne({ _id: suggestion.discussion, workspace: scope.workspace._id, project: scope.project._id });
      if (!discussion || suggestion.sourceMessageIds.some((id) => !discussion.messages.id(id))) return res.status(409).json({ message: "A source message is no longer available in this project." });
      const plan = buildApprovalPlan(req.body, suggestion, discussion, memberIds);
      if (!plan) return res.status(400).json({ message: "Select valid suggestions and review all required fields before approval." });
      const selectedSources = plan.decisions.map((item) => String(item.sourceMessageId));
      if (new Set(selectedSources).size !== selectedSources.length) return res.status(400).json({ message: "Each approved decision must use a distinct source message." });
      for (const item of plan.decisions) {
        const existingDecision = await Decision.findOne({ workspace: scope.workspace._id, projectRef: scope.project._id, discussionMessageId: item.sourceMessageId }).select("_id aiSuggestionId aiSuggestionItemKey");
        if (existingDecision && (String(existingDecision.aiSuggestionId || "") !== String(suggestion._id) || existingDecision.aiSuggestionItemKey !== item.itemKey)) return res.status(409).json({ message: "A source message has already been recorded as a decision." });
      }
      const claimed = await AISuggestion.findOneAndUpdate({ _id: suggestion._id, workspace: scope.workspace._id, project: scope.project._id, status: "pending", expiresAt: { $gt: new Date() } },
        { $set: { status: "approving", approvalPlan: { decisions: plan.decisions, tasks: plan.tasks } } }, { returnDocument: "after", runValidators: true });
      if (!claimed) {
        const latest = await AISuggestion.findById(suggestion._id);
        if (latest?.status === "approved") return res.json({ status: "approved", decisions: latest.decisions.flatMap((item, index) => item.approvedEntityId ? [{ index, id: String(item.approvedEntityId) }] : []), tasks: latest.tasks.flatMap((item, index) => item.approvedEntityId ? [{ index, id: String(item.approvedEntityId) }] : []) });
        if (!latest || latest.status !== "approving") return res.status(409).json({ message: "Suggestion changed; reload before approving." });
        suggestion.status = latest.status;
        suggestion.approvalPlan = latest.approvalPlan;
      } else {
        suggestion.status = claimed.status;
        suggestion.approvalPlan = claimed.approvalPlan;
      }
    }

    const discussion = await Discussion.findOne({ _id: suggestion.discussion, workspace: scope.workspace._id, project: scope.project._id });
    if (!discussion || suggestion.approvalPlan.decisions.some((item) => !discussion.messages.id(item.sourceMessageId))) return res.status(409).json({ message: "Approval is paused because a source message is no longer available." });
    const memberIds = new Set(scope.workspace.members.map((member) => String(member.user?._id || member.user)));
    if (suggestion.approvalPlan.tasks.some((item) => item.assignee && !memberIds.has(String(item.assignee)))) return res.status(409).json({ message: "Approval is paused because a suggested assignee is no longer a workspace member." });
    const created = await persistApprovedEntities(req, scope, suggestion, discussion);
    suggestion.status = "approved";
    suggestion.approvedAt = new Date();
    await suggestion.save();
    return res.status(200).json({ status: "approved", ...created });
  } catch {
    return res.status(500).json({ message: "Approval did not finish. You can retry; already-created items will not be duplicated." });
  }
});

module.exports = router;
