const mongoose = require("mongoose");

const decisionSuggestionSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 200 },
  outcome: { type: String, required: true, maxlength: 2000 },
  rationale: { type: String, required: true, maxlength: 2000 },
  sourceMessageIds: [{ type: mongoose.Schema.Types.ObjectId }],
  approvedEntityId: { type: mongoose.Schema.Types.ObjectId, ref: "Decision", default: null },
}, { _id: false });

const taskSuggestionSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, default: "", maxlength: 2000 },
  priority: { type: String, enum: ["low", "medium", "high"], required: true },
  suggestedAssignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  dueDate: { type: Date, default: null },
  approvedEntityId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
}, { _id: false });

const approvedDecisionSchema = new mongoose.Schema({
  itemKey: { type: String, required: true },
  title: { type: String, required: true, maxlength: 200 },
  outcome: { type: String, required: true, maxlength: 5000 },
  rationale: { type: String, default: "", maxlength: 5000 },
  discussionId: { type: mongoose.Schema.Types.ObjectId, ref: "Discussion", required: true },
  sourceMessageId: { type: mongoose.Schema.Types.ObjectId, required: true },
}, { _id: false });

const approvedTaskSchema = new mongoose.Schema({
  itemKey: { type: String, required: true },
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, default: "", maxlength: 2000 },
  priority: { type: String, enum: ["low", "medium", "high"], required: true },
  assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  dueDate: { type: Date, default: null },
}, { _id: false });

const aiSuggestionSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
  project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
  discussion: { type: mongoose.Schema.Types.ObjectId, ref: "Discussion", required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sourceMessageIds: [{ type: mongoose.Schema.Types.ObjectId }],
  decisions: { type: [decisionSuggestionSchema], default: [] },
  tasks: { type: [taskSuggestionSchema], default: [] },
  uncertainties: { type: [String], default: [] },
  providerModel: { type: String, required: true, maxlength: 120 },
  status: { type: String, enum: ["pending", "approving", "approved", "rejected", "expired"], default: "pending", index: true },
  approvalPlan: { decisions: { type: [approvedDecisionSchema], default: [] }, tasks: { type: [approvedTaskSchema], default: [] } },
  approvedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true });

aiSuggestionSchema.index({ workspace: 1, project: 1, createdAt: -1 });
module.exports = mongoose.models.AISuggestion || mongoose.model("AISuggestion", aiSuggestionSchema);
