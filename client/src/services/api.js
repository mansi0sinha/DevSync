import { resolveApiConfig } from "./apiConfig.js";
import { normalizeNetworkError, normalizeResponseError, normalizeUnexpectedResponse } from "./apiErrors.js";

const { apiBaseUrl: API_BASE_URL, apiOrigin: API_ORIGIN } = resolveApiConfig({
  configuredUrl: import.meta.env?.VITE_API_BASE_URL,
  isProduction: import.meta.env?.PROD,
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
export async function request(endpoint, options = {}) {
  const headers = { ...options.headers };
  const token = getToken();

  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { ...options, headers });
  } catch (error) {
    throw normalizeNetworkError(error);
  }

  let result;
  let invalidJson = false;
  try {
    result = await response.json();
  } catch {
    invalidJson = true;
  }

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearSession();
      window.dispatchEvent(new Event("devsync:session-expired"));
    }

    throw normalizeResponseError(response.status, result, { invalidJson });
  }

  if (invalidJson || !result || typeof result !== "object") throw normalizeUnexpectedResponse(response.status);

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

  updateProfile: (profile) => request("/auth/me", { method: "PATCH", body: JSON.stringify(profile) }),

  logout: () => clearSession(),
};

// Workspaces
export const workspaceAPI = {
  getAll: () => request("/workspaces"),

  getById: (workspaceId) =>
    request(`/workspaces/${workspaceId}`),

  getMemberManagement: (workspaceId) => request(`/workspaces/${workspaceId}/member-management`),

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

  revokeInvitation: (workspaceId, invitationId) => request(`/workspaces/${workspaceId}/invitations/${invitationId}/revoke`, { method: "POST" }),

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
  delete: (workspaceId, confirmName) => request(`/workspaces/${workspaceId}`, { method: "DELETE", body: JSON.stringify({ confirmName }) }),
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
  delete: (workspaceId, projectId, confirmName) => request(`/workspaces/${workspaceId}/projects/${projectId}`, { method: "DELETE", body: JSON.stringify({ confirmName }) }),
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
  complete: (id, completionNote, workspaceId, projectId) =>
    request(`/tasks/${id}/complete?${new URLSearchParams({ workspaceId, projectId })}`, {
      method: "POST", body: JSON.stringify({ completionNote }),
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
  getAll: (options = {}) => {
    const params = new URLSearchParams({ limit: String(options.limit || 30) });
    if (options.before) params.set("before", options.before);
    return request(`/notifications?${params}`);
  },
  markRead: (id) => request(`/notifications/${id}/read`, { method: "PATCH" }),
  markAllRead: () => request("/notifications/read-all", { method: "PATCH" }),
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


// Existing file upload API
export const uploadAPI = {
  getConfig: () => request("/uploads/config"),
  uploadFiles: (files, workspaceId, projectId, onProgress) => {
    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    const scope = new URLSearchParams({ workspaceId, projectId });
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE_URL}/uploads?${scope}`);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onerror = () => reject(normalizeNetworkError(new TypeError("Network request failed")));
      xhr.ontimeout = () => reject(normalizeNetworkError(new TypeError("Upload timed out")));
      xhr.onload = () => {
        let payload;
        let invalidJson = false;
        try { payload = JSON.parse(xhr.responseText); } catch { invalidJson = true; }
        if (xhr.status === 401 && token) {
          clearSession();
          window.dispatchEvent(new Event("devsync:session-expired"));
        }
        if (xhr.status < 200 || xhr.status >= 300) return reject(normalizeResponseError(xhr.status, payload, { invalidJson }));
        if (invalidJson || !payload || typeof payload !== "object" || payload.success !== true || !Array.isArray(payload.data) || payload.data.length !== files.length || payload.data.some((item) => typeof item?.uploadId !== "string" || !item.uploadId)) return reject(normalizeUnexpectedResponse(xhr.status));
        resolve(payload);
      };
      xhr.timeout = 120_000;
      xhr.send(formData);
    });
  },
};

export const getAttachmentURL = (url, uploadId) => {
  if (typeof url !== "string" || typeof uploadId !== "string" || !/^[a-f\d]{24}$/i.test(uploadId)) return null;
  const match = url.match(/^\/api\/uploads\/file\/([a-f\d]{24})$/i);
  if (!match || match[1].toLowerCase() !== uploadId.toLowerCase()) return null;
  return `${API_ORIGIN}/api/uploads/file/${match[1]}`;
};
