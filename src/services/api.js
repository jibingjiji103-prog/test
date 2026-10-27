async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function health() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await fetch('/api/health', { credentials: 'include', signal: controller.signal });
    clearTimeout(timer);
    const payload = await response.json();
    return { ok: response.ok, ...payload };
  } catch {
    return { ok: false, status: 'unreachable' };
  }
}

export const api = {
  health,
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  getState: () => request('/state'),
  mutations: (operations) => request('/state/mutations', { method: 'POST', body: JSON.stringify({ operations }) }),
  saveUser: (user) => request('/users', { method: 'POST', body: JSON.stringify(user) }),
  deleteUser: (id) => request(`/users/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  saveSettings: (meta) => request('/settings', { method: 'PUT', body: JSON.stringify({ meta }) }),
  savePreferences: (preferences) => request('/preferences', { method: 'PUT', body: JSON.stringify({ preferences }) }),
  saveProfile: (profile) => request('/profile', { method: 'PATCH', body: JSON.stringify(profile) }),
  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
};

export default api;
