// ============================================
// CloudVault API Client
// ============================================

// In production, VITE_API_URL points to your Render/Railway backend
// In development, Vite proxy handles /api -> localhost:5000
const API_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL + "/api"
  : "/api";

function getToken() {
  return localStorage.getItem("cloudvault_token");
}

function authHeaders() {
  const token = getToken();
  return {
    Authorization: token ? `Bearer ${token}` : "",
  };
}

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

// ---- Auth ----
export async function apiRegister(name, email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  return handleResponse(res);
}

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function apiGetMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ---- Files ----
export async function apiGetFiles(params = {}) {
  const query = new URLSearchParams();
  if (params.folder_id !== undefined) query.set("folder_id", params.folder_id);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  if (params.category) query.set("category", params.category);

  const res = await fetch(`${API_BASE}/files?${query.toString()}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiUploadFiles(files, folderId = null) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  if (folderId) formData.append("folder_id", folderId);

  const res = await fetch(`${API_BASE}/files/upload`, {
    method: "POST",
    headers: { Authorization: authHeaders().Authorization },
    body: formData,
  });
  return handleResponse(res);
}

export async function apiDeleteFiles(ids) {
  const res = await fetch(`${API_BASE}/files`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ ids }),
  });
  return handleResponse(res);
}

export async function apiRenameFile(id, name) {
  const res = await fetch(`${API_BASE}/files/${id}/rename`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name }),
  });
  return handleResponse(res);
}

export async function apiStarFile(id) {
  const res = await fetch(`${API_BASE}/files/${id}/star`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiMoveFile(id, folderId) {
  const res = await fetch(`${API_BASE}/files/${id}/move`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ folder_id: folderId }),
  });
  return handleResponse(res);
}

export function getDownloadUrl(id) {
  return `${API_BASE}/files/${id}/download?token=${getToken()}`;
}

export function getViewUrl(id) {
  return `${API_BASE}/files/${id}/download?token=${getToken()}`;
}

// Fetch file as blob for previews — tries two methods
export async function apiFetchFileBlob(id) {
  // Method 1: Use /download endpoint with Authorization header
  try {
    const res = await fetch(`${API_BASE}/files/${id}/download`, {
      headers: authHeaders(),
    });
    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn("Download endpoint failed, trying fallback:", e);
  }

  // Method 2: Use /download with token in query
  try {
    const res = await fetch(`${API_BASE}/files/${id}/download?token=${getToken()}`);
    if (res.ok) {
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    }
  } catch (e) {
    console.warn("Query token download also failed:", e);
  }

  throw new Error("Could not load file. Make sure you replaced server/routes/files.js and restarted the server.");
}

export async function apiGetFileStats() {
  const res = await fetch(`${API_BASE}/files/stats`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ---- Folders ----
export async function apiGetFolders() {
  const res = await fetch(`${API_BASE}/folders`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiCreateFolder(name, parentId = null) {
  const res = await fetch(`${API_BASE}/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ name, parent_id: parentId }),
  });
  return handleResponse(res);
}

export async function apiDeleteFolder(id) {
  const res = await fetch(`${API_BASE}/folders/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ---- Preferences ----
export async function apiGetPreferences() {
  const res = await fetch(`${API_BASE}/preferences`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiUpdatePreferences(prefs) {
  const res = await fetch(`${API_BASE}/preferences`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(prefs),
  });
  return handleResponse(res);
}

// ---- Activity ----
export async function apiGetActivity(limit = 50, offset = 0) {
  const res = await fetch(`${API_BASE}/activity?limit=${limit}&offset=${offset}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}
