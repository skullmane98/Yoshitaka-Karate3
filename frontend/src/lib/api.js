import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: false,
  headers: { "Content-Type": "application/json" },
});

// Also attach bearer token from localStorage if present (fallback for cookie issues)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("yk_token");
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  }
  if (detail?.msg) return detail.msg;
  return String(detail);
}

export default api;
