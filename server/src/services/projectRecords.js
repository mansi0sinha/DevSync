const Task = require("../models/Task");
const Decision = require("../models/Decision");

function createTaskRecord({ scope, actorId, fields }) {
  return Task.create({
    title: fields.title,
    description: fields.description || "",
    acceptanceCriteria: (fields.acceptanceCriteria || []).map((item) => ({ text: item.text.trim(), completed: false })),
    status: fields.status || "todo",
    priority: fields.priority || "medium",
    dueDate: fields.dueDate || null,
    assignee: fields.assignee || null,
    workspace: scope.workspace._id,
    project: scope.project._id,
    createdBy: actorId,
  });
}

function createDecisionRecord({ scope, actorName, fields, task = null, discussion = null, discussionMessageId = null }) {
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
  });
}

module.exports = { createTaskRecord, createDecisionRecord };
