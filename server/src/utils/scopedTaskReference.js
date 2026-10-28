function idOf(value) {
  if (value && typeof value.toHexString === "function") return value.toHexString();
  if (value && typeof value === "object") return idOf(value._id ?? value.id);
  return value === null || value === undefined ? null : String(value);
}

function taskMatchesParentScope(task, parent, { workspaceField = "workspace", projectField = "project" } = {}) {
  if (!task || typeof task !== "object" || !parent || typeof parent !== "object") return false;
  const taskWorkspace = idOf(task.workspace);
  const taskProject = idOf(task.project);
  const parentWorkspace = idOf(parent[workspaceField]);
  const parentProject = idOf(parent[projectField]);
  return Boolean(taskWorkspace && taskProject && parentWorkspace && parentProject &&
    taskWorkspace.toLowerCase() === parentWorkspace.toLowerCase() &&
    taskProject.toLowerCase() === parentProject.toLowerCase());
}

function clearCrossScopeTask(parent, options) {
  if (!parent?.linkedTask) return parent;
  if (!taskMatchesParentScope(parent.linkedTask, parent, options)) {
    parent.linkedTask = null;
  } else if (typeof parent.linkedTask.set === "function") {
    parent.linkedTask.set({ workspace: undefined, project: undefined });
  } else {
    delete parent.linkedTask.workspace;
    delete parent.linkedTask.project;
  }
  return parent;
}

module.exports = { clearCrossScopeTask, taskMatchesParentScope };
