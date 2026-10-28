const API_BASE_URL = "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");
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
  // Fetch tasks from the selected workspace or project.
  // Without filters, the backend returns tasks from workspaces
  // the authenticated user belongs to.
  getAll: (workspaceId, projectId) => {
    const params = new URLSearchParams();

    if (workspaceId) params.set("workspaceId", workspaceId);
    if (projectId) params.set("projectId", projectId);

    const query = params.toString();

    return request(`/tasks${query ? `?${query}` : ""}`);
  },

  // The task object must include workspaceId and projectId.
  create: (task) =>
    request("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    }),

  update: (id, task) =>
    request(`/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(task),
    }),

  delete: (id) =>
    request(`/tasks/${id}`, {
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
  getAll: () => request("/decisions"),

  getTrash: () => request("/decisions/trash"),

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

// Existing file upload API
export const uploadAPI = {
  uploadFiles: (files) => {
    const formData = new FormData();

    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    return request("/uploads", {
      method: "POST",
      body: formData,
    });
  },
};

export const getAttachmentURL = (url) => {
  if (!url) return "#";

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `${API_ORIGIN}${url.startsWith("/") ? "" : "/"}${url}`;
};
