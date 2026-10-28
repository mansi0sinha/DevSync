import { resolveApiConfig } from "./apiConfig.js";

const { apiBaseUrl: API_BASE_URL, apiOrigin: API_ORIGIN } = resolveApiConfig({
  configuredUrl: import.meta.env.VITE_API_BASE_URL,
  isProduction: import.meta.env.PROD,
});
export { API_ORIGIN };
const TOKEN_KEY = "devsync_token";
const USER_KEY = "devsync_user";

// Read the saved authentication token.
export const getToken = () => localStorage.getItem(TOKEN_KEY);

// Read the saved user.
export const getSavedUser = () => {
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
};

// Save login/register response.
export const saveSession = ({ token, user }) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
};

// Clear the current session.
export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

// Central API request handler.
async function request(endpoint, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let result = {};

  try {
    result = await response.json();
  } catch {
    result = {};
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession();
      window.dispatchEvent(new Event("devsync:session-expired"));
    }

    throw new Error(result.message || "Something went wrong");
  }

  return result;
}

// Authentication
export const authAPI = {
  register: (user) =>
    request("/auth/register", {
      method: "POST",
      body: JSON.stringify(user),
    }),

  login: (credentials) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  me: () => request("/auth/me"),

  logout: () => clearSession(),
};

// Workspaces
export const workspaceAPI = {
  getAll: () => request("/workspaces"),

  getById: (workspaceId) =>
    request(`/workspaces/${workspaceId}`),

  create: (workspace) =>
    request("/workspaces", {
      method: "POST",
      body: JSON.stringify(workspace),
    }),

  createInvitation: (workspaceId, email) =>
    request(`/workspaces/${workspaceId}/invitations`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  acceptInvitation: (token) =>
    request("/workspaces/invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),

  addMember: (workspaceId, email) =>
    request(`/workspaces/${workspaceId}/members`, {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  updateMemberRole: (workspaceId, userId, role) =>
    request(`/workspaces/${workspaceId}/members/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
};

// Projects inside a workspace
export const projectAPI = {
  getAll: (workspaceId) =>
    request(`/workspaces/${workspaceId}/projects`),

  create: (workspaceId, project) =>
    request(`/workspaces/${workspaceId}/projects`, {
      method: "POST",
      body: JSON.stringify(project),
    }),
};

// Existing task API

export const taskAPI = {
  getAll: (workspaceId, projectId) => {
    const params = new URLSearchParams();

    if (workspaceId) params.set("workspaceId", workspaceId);
    if (projectId) params.set("projectId", projectId);

    const query = params.toString();

    return request(`/tasks${query ? `?${query}` : ""}`);
  },

  create: (task) =>
    request("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    }),

  update: (id, task, workspaceId, projectId) =>
    request(`/tasks/${id}?${new URLSearchParams({ workspaceId, projectId })}`, {
      method: "PUT",
      body: JSON.stringify(task),
    }),

  delete: (id, workspaceId, projectId) =>
    request(`/tasks/${id}?${new URLSearchParams({ workspaceId, projectId })}`, {
      method: "DELETE",
    }),

  addComment: (id, text, workspaceId, projectId) =>
    request(`/tasks/${id}/comments?${new URLSearchParams({ workspaceId, projectId })}`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),

  getContext: (id, workspaceId, projectId) =>
    request(`/tasks/${id}/context?${new URLSearchParams({ workspaceId, projectId })}`),

  addPullRequest: (id, url, workspaceId, projectId) =>
    request(`/tasks/${id}/github-prs?${new URLSearchParams({ workspaceId, projectId })}`, {
      method: "POST", body: JSON.stringify({ url }),
    }),

  updatePullRequest: (id, pullRequestId, url, workspaceId, projectId) =>
    request(`/tasks/${id}/github-prs/${pullRequestId}?${new URLSearchParams({ workspaceId, projectId })}`, {
      method: "PUT", body: JSON.stringify({ url }),
    }),

  removePullRequest: (id, pullRequestId, workspaceId, projectId) =>
    request(`/tasks/${id}/github-prs/${pullRequestId}?${new URLSearchParams({ workspaceId, projectId })}`, {
      method: "DELETE",
    }),
};


// Existing discussion API
// Discussions scoped to the selected workspace and project
export const discussionAPI = {
  getAll: (workspaceId, projectId) => {
    const params = new URLSearchParams();

    if (workspaceId) params.set("workspaceId", workspaceId);
    if (projectId) params.set("projectId", projectId);

    const query = params.toString();

    return request(`/discussions${query ? `?${query}` : ""}`);
  },

  create: (discussion) =>
    request("/discussions", {
      method: "POST",
      body: JSON.stringify(discussion),
    }),

  addMessage: (id, message) =>
    request(`/discussions/${id}/messages`, {
      method: "POST",
      body: JSON.stringify(message),
    }),

  update: (id, updates) =>
    request(`/discussions/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    }),
};

// Existing decision API
export const decisionAPI = {
  getAll: (workspaceId, projectId) => {
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspaceId", workspaceId);
    if (projectId) params.set("projectId", projectId);
    return request(`/decisions?${params}`);
  },

  getTrash: (workspaceId, projectId) => {
    const params = new URLSearchParams();
    if (workspaceId) params.set("workspaceId", workspaceId);
    if (projectId) params.set("projectId", projectId);
    return request(`/decisions/trash?${params}`);
  },

  create: (decision) =>
    request("/decisions", {
      method: "POST",
      body: JSON.stringify(decision),
    }),

  updateStatus: (id, lifecycleStatus) =>
    request(`/decisions/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ lifecycleStatus }),
    }),

  supersede: (id, replacementDecisionId) =>
    request(`/decisions/${id}/supersede`, {
      method: "PATCH",
      body: JSON.stringify({ replacementDecisionId }),
    }),

  delete: (id, deletedBy = "Unknown") =>
    request(`/decisions/${id}`, {
      method: "DELETE",
      body: JSON.stringify({ deletedBy }),
    }),

  restore: (id) =>
    request(`/decisions/${id}/restore`, {
      method: "POST",
    }),
};

export const notificationAPI = {
  getAll: (workspaceId, projectId, options = {}) => {
    const params = new URLSearchParams({ workspaceId, projectId, limit: String(options.limit || 30) });
    if (options.before) params.set("before", options.before);
    return request(`/notifications?${params}`);
  },
  markRead: (id, workspaceId, projectId) => request(`/notifications/${id}/read?${new URLSearchParams({ workspaceId, projectId })}`, { method: "PATCH" }),
  markAllRead: (workspaceId, projectId) => request(`/notifications/read-all?${new URLSearchParams({ workspaceId, projectId })}`, { method: "PATCH" }),
};

export const activityAPI = {
  getAll: (workspaceId, projectId, options = {}) => {
    const params = new URLSearchParams({ workspaceId, projectId, limit: String(options.limit || 30) });
    if (options.before) params.set("before", options.before);
    return request(`/activity?${params}`);
  },
};

export const searchAPI = {
  search: (workspaceId, projectId, filters) => {
    const params = new URLSearchParams({ workspaceId, projectId });
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    return request(`/search?${params}`);
  },
};

export const aiSuggestionAPI = {
  getAll: (workspaceId, projectId) => request(`/ai-suggestions?${new URLSearchParams({ workspaceId, projectId })}`),
  create: (payload) => request("/ai-suggestions", { method: "POST", body: JSON.stringify(payload) }),
  update: (id, workspaceId, projectId, payload) => request(`/ai-suggestions/${id}?${new URLSearchParams({ workspaceId, projectId })}`, { method: "PATCH", body: JSON.stringify(payload) }),
  approve: (id, workspaceId, projectId, payload) => request(`/ai-suggestions/${id}/approve?${new URLSearchParams({ workspaceId, projectId })}`, { method: "POST", body: JSON.stringify(payload) }),
  reject: (id, workspaceId, projectId) => request(`/ai-suggestions/${id}/reject?${new URLSearchParams({ workspaceId, projectId })}`, { method: "POST" }),
  expire: (id, workspaceId, projectId) => request(`/ai-suggestions/${id}/expire?${new URLSearchParams({ workspaceId, projectId })}`, { method: "POST" }),
};

// Existing file upload API
export const uploadAPI = {
  uploadFiles: (files, workspaceId, projectId) => {
    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    const scope = new URLSearchParams({ workspaceId, projectId });
    return request(`/uploads?${scope}`, {
      method: "POST",
      body: formData,
    });
  },
};

export const getAttachmentURL = (url, uploadId) => {
  if (typeof url !== "string" || typeof uploadId !== "string" || !/^[a-f\d]{24}$/i.test(uploadId)) return null;
  const match = url.match(/^\/api\/uploads\/file\/([a-f\d]{24})$/i);
  if (!match || match[1].toLowerCase() !== uploadId.toLowerCase()) return null;
  return `${API_ORIGIN}/api/uploads/file/${match[1]}`;
};
