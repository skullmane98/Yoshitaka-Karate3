import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import api, { apiMetrics, BACKEND_BASE_URL, formatApiError } from "@/lib/api";
import { Activity, CheckCircle2, AlertTriangle, RefreshCw, Database, Clock, Cpu, Zap } from "lucide-react";

/**
 * Real-time backend health dashboard. Mounted at `/#/status`. No auth required
 * so an operator can hit it even when login is broken.
 *   • /api/health  → instant readiness probe (latency timed here)
 *   • /api/status  → DB connectivity, dialect, uptime, keep-warm config
 *   • apiMetrics   → in-memory frontend metrics (retries, failures, last URL)
 */
const POLL_MS = 10000;

function formatUptime(seconds) {
  if (!seconds || seconds < 0) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days) return `${days}d ${hours}h ${minutes}m`;
  if (hours) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function StatRow({ label, value, mono = false, ok = null, "data-testid": testId }) {
  let valueClass = "text-sm";
  if (mono) valueClass += " font-mono-accent";
  if (ok === true) valueClass += " text-[var(--dojo-green)]";
  if (ok === false) valueClass += " text-[var(--dojo-hinomaru)]";
  return (
    <div className="flex justify-between items-start gap-4 py-2 border-b border-[var(--dojo-border)] last:border-b-0">
      <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--dojo-ink-soft)] shrink-0 pt-0.5">{label}</div>
      <div className={`${valueClass} text-right break-all`} data-testid={testId}>{value}</div>
    </div>
  );
}

function Card({ icon: Icon, title, children, headerExtra }) {
  return (
    <section className="border border-[var(--dojo-border)] bg-[var(--dojo-paper)]">
      <header className="px-5 py-3 border-b border-[var(--dojo-border)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-[var(--dojo-ink-soft)]" />
          <h2 className="font-serif text-lg">{title}</h2>
        </div>
        {headerExtra}
      </header>
      <div className="px-5 py-2">{children}</div>
    </section>
  );
}

export default function StatusPage() {
  const [health, setHealth] = useState(null);
  const [healthLatency, setHealthLatency] = useState(null);
  const [healthError, setHealthError] = useState(null);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef(null);

  const refresh = async () => {
    setBusy(true);
    const t0 = performance.now();
    try {
      const r = await api.get("/health");
      setHealthLatency(Math.round(performance.now() - t0));
      setHealth(r.data);
      setHealthError(null);
    } catch (e) {
      setHealthLatency(Math.round(performance.now() - t0));
      setHealth(null);
      setHealthError(formatApiError(e));
    }
    try {
      const r = await api.get("/status");
      setStatus(r.data);
      setStatusError(null);
    } catch (e) {
      setStatus(null);
      setStatusError(formatApiError(e));
    }
    setBusy(false);
    setTick((t) => t + 1);
  };

  useEffect(() => {
    refresh();
    timerRef.current = setInterval(refresh, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timerRef.current);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const healthy = !!health && !healthError;
  const dbOk = status?.database?.ok;

  return (
    <div className="min-h-screen bg-[var(--dojo-paper-alt)]" data-testid="status-page">
      <header className="border-b border-[var(--dojo-border)] bg-[var(--dojo-paper)]">
        <div className="max-w-5xl mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-[var(--dojo-ink-soft)]">Operator Console</div>
            <h1 className="font-serif text-3xl tracking-tight">System Status</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)]" data-testid="status-tick">
              auto-refresh · {POLL_MS / 1000}s
            </span>
            <button onClick={refresh} disabled={busy} className="btn-outline inline-flex items-center gap-2" data-testid="status-refresh">
              <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
              Refresh
            </button>
            <Link to="/login" className="btn-primary" data-testid="status-back">Back to Login</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 lg:px-10 py-10 grid lg:grid-cols-2 gap-6">
        {/* Overall verdict */}
        <section className={`lg:col-span-2 border p-6 flex items-center gap-4 ${healthy && dbOk ? "border-[var(--dojo-green)] bg-[rgba(26,122,61,0.04)]" : "border-[var(--dojo-hinomaru)] bg-[rgba(215,38,61,0.04)]"}`} data-testid="status-verdict">
          {healthy && dbOk ? (
            <CheckCircle2 className="text-[var(--dojo-green)]" size={32} />
          ) : (
            <AlertTriangle className="text-[var(--dojo-hinomaru)]" size={32} />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-serif text-2xl tracking-tight">
              {healthy && dbOk ? "All systems operational" : healthy ? "Backend up, database degraded" : "Backend unreachable"}
            </div>
            <div className="text-xs text-[var(--dojo-ink-soft)] mt-1">
              Last checked {new Date(apiMetrics.last_at || now).toLocaleTimeString()} · poll #{tick}
            </div>
          </div>
        </section>

        {/* Backend health */}
        <Card
          icon={Activity}
          title="Backend Health"
          headerExtra={
            <span className={`text-[10px] uppercase tracking-[0.24em] ${healthy ? "text-[var(--dojo-green)]" : "text-[var(--dojo-hinomaru)]"}`}>
              {healthy ? "ONLINE" : "OFFLINE"}
            </span>
          }
        >
          <StatRow label="Endpoint" value={`${BACKEND_BASE_URL || "/"}/api/health`} mono data-testid="status-health-endpoint" />
          <StatRow label="HTTP status" value={healthy ? "200 OK" : healthError || "—"} ok={healthy} data-testid="status-health-status" />
          <StatRow label="Latency" value={healthLatency != null ? `${healthLatency} ms` : "—"} mono data-testid="status-health-latency" />
          <StatRow label="Service" value={health?.service || "—"} mono />
        </Card>

        {/* Database */}
        <Card
          icon={Database}
          title="Database"
          headerExtra={
            <span className={`text-[10px] uppercase tracking-[0.24em] ${dbOk ? "text-[var(--dojo-green)]" : "text-[var(--dojo-hinomaru)]"}`}>
              {dbOk ? "CONNECTED" : status ? "DEGRADED" : "—"}
            </span>
          }
        >
          <StatRow label="Dialect" value={status?.database?.dialect?.toUpperCase() || "—"} mono data-testid="status-db-dialect" />
          <StatRow label="Connection" value={status?.database?.url || "—"} mono data-testid="status-db-url" />
          <StatRow label="Users" value={status?.database?.user_count != null ? String(status.database.user_count) : "—"} mono data-testid="status-db-users" />
          {status?.database?.error && (
            <StatRow label="Error" value={status.database.error} ok={false} data-testid="status-db-error" />
          )}
        </Card>

        {/* Runtime */}
        <Card icon={Clock} title="Runtime">
          <StatRow label="Server time" value={status?.server_time?.replace("T", " ").split(".")[0] || "—"} mono />
          <StatRow label="Booted" value={status?.boot_time?.replace("T", " ").split(".")[0] || "—"} mono />
          <StatRow label="Uptime" value={formatUptime(status?.uptime_seconds)} mono data-testid="status-uptime" />
          <StatRow label="Version" value={status?.version || "—"} mono />
        </Card>

        {/* Keep-warm */}
        <Card
          icon={Zap}
          title="Keep-Warm"
          headerExtra={
            <span className={`text-[10px] uppercase tracking-[0.24em] ${status?.keep_warm?.enabled ? "text-[var(--dojo-green)]" : "text-[var(--dojo-ink-soft)]"}`}>
              {status?.keep_warm?.enabled ? "ACTIVE" : "DISABLED"}
            </span>
          }
        >
          <StatRow label="Self-ping URL" value={status?.keep_warm?.url || "(set KEEP_WARM_URL on Render)"} mono data-testid="status-keepwarm-url" />
          <StatRow label="Cold-start guard" value="Active · 5 retries · 90s timeout" mono />
        </Card>

        {/* Client metrics */}
        <Card icon={Cpu} title="Frontend Metrics">
          <StatRow label="Frontend host" value={typeof window !== "undefined" ? window.location.host : "—"} mono />
          <StatRow label="Backend base" value={BACKEND_BASE_URL || "(not set)"} mono data-testid="status-backend-base" />
          <StatRow label="Total requests" value={String(apiMetrics.total_requests)} mono data-testid="status-total-req" />
          <StatRow label="Cold-start retries" value={String(apiMetrics.total_retries)} mono data-testid="status-retries" />
          <StatRow label="Failed requests" value={String(apiMetrics.total_failures)} mono ok={apiMetrics.total_failures === 0} data-testid="status-failures" />
          <StatRow label="Last request" value={apiMetrics.last_url || "—"} mono />
          <StatRow label="Last status" value={apiMetrics.last_status != null ? String(apiMetrics.last_status) : "—"} mono />
          {apiMetrics.last_error && <StatRow label="Last error" value={apiMetrics.last_error} ok={false} />}
        </Card>

        <div className="lg:col-span-2 text-[10px] text-[var(--dojo-ink-soft)] text-center mt-4">
          This page is public so you can diagnose login failures even while logged out.
          {statusError && <div className="mt-2 text-[var(--dojo-hinomaru)]" data-testid="status-fetch-error">/api/status: {statusError}</div>}
        </div>
      </main>
    </div>
  );
}
