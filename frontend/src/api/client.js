const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;

    // 1. Localhost development always points directly to local uvicorn backend
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8000`;
    }

    // 2. On production domain (termjobs.in, www.termjobs.in, or termjobs.vercel.app),
    // use same-origin relative path '' so Vercel rewrites proxy all /api requests without CORS
    if (
      hostname === 'termjobs.in' ||
      hostname === 'www.termjobs.in' ||
      hostname === 'termjobs.vercel.app'
    ) {
      return '';
    }

    // 3. If explicit backend URL is provided via environment variables, use it
    const envUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
      const trimmed = envUrl.trim().replace(/\/+$/, '');
      if (!trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
        return trimmed;
      }
    }

    // 4. Default for production preview deployments: use relative proxy ''
    return '';
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

export async function request(path, { method = 'GET', body, data: requestData, token, timeout = 180000 } = {}) {
  const payloadBody = body !== undefined ? body : requestData;
  const fullUrl = `${API_BASE_URL}${path}`;
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'N/A';

  const isFormData = typeof FormData !== 'undefined' && payloadBody instanceof FormData;
  const headers = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  console.log(`🚀 [API REQUEST] ${method} ${fullUrl}`, {
    origin: currentOrigin,
    apiBaseUrl: API_BASE_URL,
    path,
    method,
    headers,
    body: isFormData ? '[FormData]' : (payloadBody !== undefined ? payloadBody : null),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  let response;
  try {
    response = await fetch(fullUrl, {
      method,
      headers,
      body: payloadBody !== undefined ? (isFormData ? payloadBody : JSON.stringify(payloadBody)) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    console.error(`❌ [API NETWORK / CORS ERROR] ${method} ${fullUrl}`, {
      origin: currentOrigin,
      apiBaseUrl: API_BASE_URL,
      path,
      errorMessage: err?.message || err,
      errorName: err?.name,
      hint: 'If status shows net::ERR_FAILED / CORS blocked, check origin headers and preflight handling.',
    });

    if (err && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 0);
    }
    throw new ApiError('Unable to reach the server. Is the backend running or is CORS blocking the request?', 0);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) {
    console.log(`✅ [API RESPONSE 204 No Content] ${method} ${fullUrl}`);
    return null;
  }

  let resData = null;
  try {
    resData = await response.json();
  } catch (parseErr) {
    console.warn(`⚠️ [API JSON PARSE WARNING] Unable to parse response as JSON for ${fullUrl}:`, parseErr);
    resData = null;
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status})`;
    if (resData) {
      if (typeof resData.detail === 'string') {
        detail = resData.detail;
      } else if (Array.isArray(resData.detail) && resData.detail.length > 0) {
        detail = resData.detail.map(d => d.msg || d.detail || JSON.stringify(d)).join(', ');
      } else if (typeof resData.message === 'string') {
        detail = resData.message;
      } else if (typeof resData.error === 'string') {
        detail = resData.error;
      }
    }

    console.error(`🚨 [API ERROR RESPONSE ${response.status}] ${method} ${fullUrl}`, {
      status: response.status,
      detail,
      responseBody: resData,
    });

    throw new ApiError(detail, response.status);
  }

  console.log(`✅ [API RESPONSE SUCCESS ${response.status}] ${method} ${fullUrl}`, resData);
  return resData;
}
