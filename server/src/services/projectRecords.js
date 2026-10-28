const Task = require("../models/Task");
const Decision = require("../models/Decision");

function createTaskRecord({ scope, actorId, fields, aiSuggestionId = null, aiSuggestionItemKey = null }) {
  return Task.create({
    title: fields.title,
    description: fields.description || "",
    status: fields.status || "todo",
    priority: fields.priority || "medium",
    dueDate: fields.dueDate || null,
    assignee: fields.assignee || null,
    workspace: scope.workspace._id,
    project: scope.project._id,
    createdBy: actorId,
    aiSuggestionId,
    aiSuggestionItemKey,
  });
}

function createDecisionRecord({ scope, actorName, fields, task = null, discussion = null, discussionMessageId = null, aiSuggestionId = null, aiSuggestionItemKey = null }) {
  return Decision.create({
    title: fields.title,
    summary: fields.summary,
    context: fields.context || "",
    project: scope.project.name,
    workspace: scope.workspace._id,
    projectRef: scope.project._id,
    taskId: task ? String(task._id) : "",
    linkedTask: task?._id || null,
    discussionId: discussion?._id || null,
    discussionMessageId: discussionMessageId || null,
    createdBy: actorName || "Unknown",
    aiSuggestionId,
    aiSuggestionItemKey,
  });
}

module.exports = { createTaskRecord, createDecisionRecord };
