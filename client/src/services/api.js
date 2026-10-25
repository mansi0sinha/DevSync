
const API_BASE_URL = "http://localhost:5000/api";
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

async function request(endpoint, options = {}) {
  const headers = { ...options.headers };

  // Let the browser set the multipart boundary for FormData.
  if (options.body && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || "Something went wrong");
  }

  return result;
}

export const taskAPI = {
  getAll: () => request("/tasks"),

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

export const discussionAPI = {
  getAll: () => request("/discussions"),

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

// Standalone Decision collection API
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
