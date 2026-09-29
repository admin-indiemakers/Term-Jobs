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

// In-flight GET request deduplication map (shares 1 active promise for identical concurrent requests)
const inflightGetRequests = new Map();

// Multi-tier cache for GET requests:
// 1. Fresh Cache (20s): returns instantly in 0ms without hitting the network.
// 2. Stale-While-Revalidate (SWR, 3 min): returns cached data instantly in 0ms, revalidates silently in background.
const apiGetCache = new Map();
const FRESH_CACHE_TTL_MS = 20000; // 20 seconds fresh
const STALE_CACHE_TTL_MS = 180000; // 3 minutes stale-while-revalidate

export function clearApiCache() {
  apiGetCache.clear();
  inflightGetRequests.clear();
}

export function prefetch(path, options = {}) {
  return request(path, { ...options, method: 'GET' }).catch(() => null);
}

export async function request(path, { 
  method = 'GET', 
  body, 
  data: requestData, 
  token, 
  timeout = 15000,
  forceRefresh = false,
  noCache = false
} = {}) {
  const upperMethod = method.toUpperCase();
  const payloadBody = body !== undefined ? body : requestData;

  // On any mutating method (POST, PUT, PATCH, DELETE), clear cache immediately
  if (upperMethod !== 'GET') {
    apiGetCache.clear();
  }

  let normalizedPath = String(path || '');
  if (!normalizedPath.startsWith('http://') && !normalizedPath.startsWith('https://')) {
    if (!normalizedPath.startsWith('/')) {
      normalizedPath = `/${normalizedPath}`;
    }

    const isLocalBackend = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');

    if (isLocalBackend) {
      // Local uvicorn process registers /requisitions, /company-profiles, /templates, /candidates at root
      normalizedPath = normalizedPath
        .replace(/^\/api\/requisitions/, '/requisitions')
        .replace(/^\/api\/company-profiles/, '/company-profiles')
        .replace(/^\/api\/templates/, '/templates')
        .replace(/^\/api\/candidates/, '/candidates');
    } else {
      // On production Vercel, relative requests need /api prefix to be proxied to backend instead of serving index.html
      if (
        !normalizedPath.startsWith('/api/') &&
        normalizedPath !== '/api' &&
        !normalizedPath.startsWith('/health')
      ) {
        normalizedPath = `/api${normalizedPath}`;
      }
    }
  }

  const fullUrl = `${API_BASE_URL}${normalizedPath}`;
  const cacheKey = `${token || 'anon'}:${fullUrl}`;
  const sessionCacheKey = `tj_cache:${cacheKey}`;

  const executeFetch = async () => {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'N/A';
    const isFormData = typeof FormData !== 'undefined' && payloadBody instanceof FormData;
    const headers = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Only log in local development — never expose credentials or request details in production
    const isDev = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

    // Safe headers: redact Authorization value even in dev logs
    const safeHeaders = Object.fromEntries(
      Object.entries(headers).map(([k, v]) =>
        k.toLowerCase() === 'authorization' ? [k, 'Bearer [REDACTED]'] : [k, v]
      )
    );

    if (isDev) {
      console.log(`🚀 [API REQUEST] ${upperMethod} ${fullUrl}`, {
        origin: currentOrigin,
        apiBaseUrl: API_BASE_URL,
        path,
        method: upperMethod,
        headers: safeHeaders,
        body: isFormData ? '[FormData]' : (payloadBody !== undefined ? payloadBody : null),
      });
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    let response;
    try {
      response = await fetch(fullUrl, {
        method: upperMethod,
        headers,
        body: payloadBody !== undefined ? (isFormData ? payloadBody : JSON.stringify(payloadBody)) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      // Network / CORS errors are always logged (no credentials in these logs)
      if (isDev) {
        console.error(`❌ [API NETWORK / CORS ERROR] ${upperMethod} ${fullUrl}`, {
          origin: currentOrigin,
          apiBaseUrl: API_BASE_URL,
          path,
          errorMessage: err?.message || err,
          errorName: err?.name,
          hint: 'If status shows net::ERR_FAILED / CORS blocked, check origin headers and preflight handling.',
        });
      }

      if (err && err.name === 'AbortError') {
        throw new ApiError('Request timed out. Please try again.', 0);
      }
      throw new ApiError('Unable to reach the server. Is the backend running or is CORS blocking the request?', 0);
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 204) {
      if (isDev) console.log(`✅ [API RESPONSE 204 No Content] ${upperMethod} ${fullUrl}`);
      return null;
    }

    let resData = null;
    try {
      resData = await response.json();
    } catch (parseErr) {
      if (isDev) {
        console.warn(`⚠️ [API JSON PARSE WARNING] Unable to parse response as JSON for ${fullUrl}:`, parseErr);
      }
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
          detail = resData.error === 'Route Not Found' ? `Route Not Found (${upperMethod} ${path})` : resData.error;
        }
      } else if (response.status >= 500) {
        detail = 'Server temporarily unavailable. Please try again in a moment.';
      }

      if (isDev) {
        console.error(`🚨 [API ERROR RESPONSE ${response.status}] ${upperMethod} ${fullUrl}`, {
          status: response.status,
          detail,
          responseBody: resData,
        });
      }

      throw new ApiError(detail, response.status);
    }

    if (isDev) {
      console.log(`✅ [API RESPONSE SUCCESS ${response.status}] ${upperMethod} ${fullUrl}`, resData);
    }

    if (upperMethod === 'GET' && !noCache) {
      const cachePayload = { timestamp: Date.now(), data: resData };
      apiGetCache.set(cacheKey, cachePayload);
      try {
        sessionStorage.setItem(sessionCacheKey, JSON.stringify(cachePayload));
      } catch (e) {}
    }

    return resData;
  };

  // SWR: Check if identical GET request is fresh or stale in memory or sessionStorage
  if (upperMethod === 'GET' && !forceRefresh && !noCache) {
    let cached = apiGetCache.get(cacheKey);
    if (!cached && typeof window !== 'undefined') {
      try {
        const item = sessionStorage.getItem(sessionCacheKey);
        if (item) {
          cached = JSON.parse(item);
          if (cached && cached.data) {
            apiGetCache.set(cacheKey, cached);
          }
        }
      } catch (e) {}
    }

    const now = Date.now();
    if (cached) {
      const age = now - cached.timestamp;
      if (age < FRESH_CACHE_TTL_MS) {
        // Return fresh data immediately (0ms)
        return cached.data;
      }
      if (age < STALE_CACHE_TTL_MS) {
        // Return stale data immediately in 0ms, and revalidate in background
        if (!inflightGetRequests.has(cacheKey)) {
          const bgPromise = executeFetch()
            .catch(() => {})
            .finally(() => {
              inflightGetRequests.delete(cacheKey);
            });
          inflightGetRequests.set(cacheKey, bgPromise);
        }
        return cached.data;
      }
    }

    if (inflightGetRequests.has(cacheKey)) {
      return inflightGetRequests.get(cacheKey);
    }

    const requestPromise = executeFetch().finally(() => {
      inflightGetRequests.delete(cacheKey);
    });
    inflightGetRequests.set(cacheKey, requestPromise);
    return await requestPromise;
  }

  return await executeFetch();
}
