import axios from "axios";

// Tolerate operators who accidentally set REACT_APP_BACKEND_URL with a trailing
// slash or with `/api` already appended — both situations cause `/api/api/...`
// 404s in production. Normalise once at module load.
const RAW = (process.env.REACT_APP_BACKEND_URL || "").trim();
const BASE = RAW.replace(/\/+$/, "").replace(/\/api$/i, "");
if (!BASE) {
  // eslint-disable-next-line no-console
  console.error("[api] REACT_APP_BACKEND_URL is not set — every API call will fail.");
}
export const BACKEND_BASE_URL = BASE;

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
  // VPS-backed FastAPI is always warm — 20 s is plenty even for slow networks.
  timeout: 20000,
});

// Attach bearer token from localStorage if present (fallback for cookie issues)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("yk_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Transient failure resilience ─────────────────────────────────────────
// On a VPS the backend doesn't cold-start, but a brief 502 can still occur
// during `systemctl restart yoshitaka-api` (≈1 s). One quick retry rides
// over that without surfacing an error to the user.
const RETRY_STATUSES = new Set([502, 503, 504]);
const MAX_RETRIES = 2;

// Lightweight metrics for the in-app `/status` page. Persists across page
// navigations (module scope) but resets on a hard reload.
export const apiMetrics = {
  total_requests: 0,
  total_retries: 0,
  total_failures: 0,
  last_status: null,
  last_url: null,
  last_attempts: 0,
  last_error: null,
  last_at: null,
};

function shouldRetry(error) {
  if (!error) return false;
  if (!error.response) return true; // network / timeout
  return RETRY_STATUSES.has(error.response.status);
}

function backoffDelay(attempt) {
  // 600 ms, 1.2 s — total ~1.8 s extra before failing loud.
  return Math.min(1500, 600 * Math.pow(2, attempt));
}

api.interceptors.response.use(
  (r) => {
    apiMetrics.total_requests += 1;
    apiMetrics.last_status = r.status;
    apiMetrics.last_url = `${r.config?.method?.toUpperCase()} ${r.config?.url}`;
    apiMetrics.last_attempts = (r.config?.__yk_attempt || 0) + 1;
    apiMetrics.last_error = null;
    apiMetrics.last_at = new Date().toISOString();
    return r;
  },
  async (error) => {
    const cfg = error?.config;
    if (!cfg) return Promise.reject(error);
    cfg.__yk_attempt = (cfg.__yk_attempt || 0) + 1;
    if (cfg.__yk_attempt > MAX_RETRIES || !shouldRetry(error)) {
      apiMetrics.total_requests += 1;
      apiMetrics.total_failures += 1;
      apiMetrics.last_status = error?.response?.status || 0;
      apiMetrics.last_url = `${cfg.method?.toUpperCase()} ${cfg.url}`;
      apiMetrics.last_attempts = cfg.__yk_attempt;
      apiMetrics.last_error = error?.message || String(error);
      apiMetrics.last_at = new Date().toISOString();
      return Promise.reject(error);
    }
    apiMetrics.total_retries += 1;
    const wait = backoffDelay(cfg.__yk_attempt - 1);
    // eslint-disable-next-line no-console
    console.info(`[api] transient retry ${cfg.__yk_attempt}/${MAX_RETRIES} in ${wait}ms`);
    await new Promise((res) => setTimeout(res, wait));
    return api.request(cfg);
  }
);

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  const status = err?.response?.status;
  if (!detail) {
    if (err?.code === "ECONNABORTED") return "The server is slow to respond. Please try again.";
    if (!err?.response) return "Could not reach the dojo server. Check your connection and try again.";
    if (RETRY_STATUSES.has(status)) {
      return "The dojo server is briefly unavailable. Please try again in a few seconds.";
    }
    if (status === 400) {
      const body = err?.response?.data;
      if (typeof body === "string" && body.toLowerCase().includes("cors")) {
        return "This site isn't on the backend's allow-list. Update CORS_ORIGINS in /etc/yoshitaka-api.env on the VPS.";
      }
    }
    return err?.message || "Something went wrong";
  }
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  }
  if (detail?.msg) return detail.msg;
  return String(detail);
}

// Kept for compatibility with components that call `warmBackend()` on mount.
// On a VPS the backend is always warm — this is a no-op.
export function warmBackend() { /* no-op on VPS */ }

export default api;
