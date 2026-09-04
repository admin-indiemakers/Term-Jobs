const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Always route to local backend when running on localhost
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8000`;
    }
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'http://localhost:8000';
};

export const API_BASE_URL = getApiBaseUrl();

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function request(path, { method = 'GET', body, token, timeout = 180000 } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 0);
    }
    throw new ApiError('Unable to reach the server. Is the backend running?', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    if (data) {
      if (typeof data.detail === 'string') {
        detail = data.detail;
      } else if (Array.isArray(data.detail) && data.detail.length > 0) {
        detail = data.detail.map(d => d.msg || d.detail || JSON.stringify(d)).join(', ');
      } else if (typeof data.message === 'string') {
        detail = data.message;
      } else if (typeof data.error === 'string') {
        detail = data.error;
      }
    }
    throw new ApiError(detail, response.status);
  }

  return data;
}
