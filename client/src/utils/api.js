const API_BASE = '/api';

const TOKEN_KEY = 'claude-wrapper-token';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getAuthHeaders(token = getToken()) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function loginUser(username, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Login failed with status ${response.status}`);
  }

  return payload;
}

export async function fetchCurrentUser(token = getToken()) {
  const response = await fetch(`${API_BASE}/auth/me`, {
    headers: getAuthHeaders(token),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload.user;
}

export async function fetchAdminUsers(token = getToken()) {
  const response = await fetch(`${API_BASE}/admin/users`, {
    headers: getAuthHeaders(token),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload.users;
}

export async function updateAdminUser(userId, updates, token = getToken()) {
  const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token),
    },
    body: JSON.stringify(updates),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload.user;
}

export async function resetAdminUserPassword(userId, password, token = getToken()) {
  const response = await fetch(`${API_BASE}/admin/users/${userId}/password`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(token),
    },
    body: JSON.stringify({ password }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }

  return payload.user;
}

export async function deleteAdminUser(userId, token = getToken()) {
  const response = await fetch(`${API_BASE}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(token),
  });

  if (!response.ok && response.status !== 204) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed with status ${response.status}`);
  }
}

export async function sendChatMessage(messages, model) {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify({ messages, model }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Network error' }));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function checkHealth() {
  const response = await fetch(`${API_BASE}/health`);
  return response.json();
}
