const fs = require("node:fs/promises");
const path = require("node:path");

const managedFilePattern = /^[0-9a-f-]{36}\.(?:jpg|png|webp|pdf|txt)$/i;

function createResourceDeletionService({ models, storageDirectory, fileSystem = fs }) {
  const root = path.resolve(storageDirectory);

  async function removeManagedUploads(filter) {
    const uploads = await models.Upload.find(filter).select("filename uploadedBy").lean();
    const targets = uploads.map((upload) => {
      if (!managedFilePattern.test(upload.filename)) throw new Error("An attachment has an unmanaged storage name.");
      const target = path.resolve(root, upload.filename);
      if (!target.startsWith(`${root}${path.sep}`)) throw new Error("An attachment path is outside managed storage.");
      return target;
    });
    await Promise.all(targets.map(async (target) => {
      try { await fileSystem.unlink(target); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
    }));
    return uploads;
  }

  async function purgeProjectRecords(workspaceId, projectId) {
    const scope = { workspace: workspaceId, project: projectId };
    await models.Task.deleteMany(scope);
    await models.Discussion.deleteMany(scope);
    await models.Decision.deleteMany({ workspace: workspaceId, projectRef: projectId });
    await models.Activity.deleteMany(scope);
    await models.Notification.deleteMany(scope);
    await models.GitHubWebhookDelivery.deleteMany({ workspace: workspaceId, project: projectId });
    const uploads = await removeManagedUploads(scope);

    // Quotas are workspace/user scoped. Recompute the usage to make this retry-safe.
    const uploaderIds = [...new Set(uploads.map((upload) => String(upload.uploadedBy)))];
    for (const uploadedBy of uploaderIds) {
      const removedFilenames = uploads.filter((upload) => String(upload.uploadedBy) === uploadedBy).map((upload) => upload.filename);
      const remaining = await models.Upload.find({ workspace: workspaceId, uploadedBy, filename: { $nin: removedFilenames } }).select("size").lean();
      const usedBytes = remaining.reduce((sum, upload) => sum + upload.size, 0);
      await models.UploadQuota.updateOne({ workspace: workspaceId, user: uploadedBy }, { $set: { usedBytes } });
    }
    await models.Upload.deleteMany(scope);
  }

  return {
    removeManagedUploads,
    purgeProjectRecords,
    async deleteTask(workspaceId, projectId, taskId) {
      const task = await models.Task.findOne({ _id: taskId, workspace: workspaceId, project: projectId });
      if (!task) return null;
      // Discussions and decisions are independent records: preserve their history
      // while clearing only references to the task being removed. Keep activity
      // as an audit trail; its resource link is suppressed when the task is gone.
      await models.Discussion.updateMany({ workspace: workspaceId, project: projectId, linkedTask: taskId }, { $set: { linkedTask: null } });
      await models.Decision.updateMany({ workspace: workspaceId, projectRef: projectId, $or: [{ linkedTask: taskId }, { taskId: String(taskId) }] }, { $set: { linkedTask: null, taskId: "" } });
      await models.Notification.deleteMany({ entityType: "task", entityId: taskId, workspace: workspaceId, project: projectId });
      const deleted = await models.Task.deleteOne({ _id: taskId, workspace: workspaceId, project: projectId });
      return deleted.deletedCount ? task : null;
    },
    async deleteProject(workspaceId, project) {
      await purgeProjectRecords(workspaceId, project._id);
      await models.Project.deleteOne({ _id: project._id, workspace: workspaceId });
    },
    async deleteWorkspace(workspace) {
      const projects = await models.Project.find({ workspace: workspace._id }).select("_id").lean();
      for (const project of projects) await purgeProjectRecords(workspace._id, project._id);
      await models.Project.deleteMany({ workspace: workspace._id });
      // Clean up legacy or incomplete records whose project row is already missing.
      const legacyScope = { workspace: workspace._id };
      await models.Task.deleteMany(legacyScope);
      await models.Discussion.deleteMany(legacyScope);
      await models.Decision.deleteMany(legacyScope);
      await models.Activity.deleteMany(legacyScope);
      await models.Notification.deleteMany(legacyScope);
      await models.GitHubWebhookDelivery.deleteMany(legacyScope);
      const uploads = await removeManagedUploads(legacyScope);
      await models.Upload.deleteMany(legacyScope);
      await models.UploadQuota.deleteMany({ workspace: workspace._id });
      await models.WorkspaceInvitation.deleteMany({ workspace: workspace._id });
      await models.Workspace.deleteOne({ _id: workspace._id });
      return { removedFiles: uploads.length, removedProjects: projects.length };
    },
  };
}

const models = {
  Workspace: require("../models/Workspace"),
  Project: require("../models/Project"),
  Task: require("../models/Task"),
  Discussion: require("../models/Discussion"),
  Decision: require("../models/Decision"),
  Activity: require("../models/Activity"),
  Notification: require("../models/Notification"),
  Upload: require("../models/Upload"),
  UploadQuota: require("../models/UploadQuota"),
  WorkspaceInvitation: require("../models/WorkspaceInvitation"),
  GitHubWebhookDelivery: require("../models/GitHubWebhookDelivery"),
};
const storageDirectory = path.resolve(process.env.DEVSYNC_UPLOAD_DIRECTORY || path.join(__dirname, "../../uploads"));
const resourceDeletion = createResourceDeletionService({ models, storageDirectory });

module.exports = { ...resourceDeletion, createResourceDeletionService, managedFilePattern };
