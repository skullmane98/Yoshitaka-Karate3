import { useEffect, useState } from "react";
import api, { formatApiError } from "@/lib/api";
import { Send } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "", label: "Everyone (active)" },
  { value: "super_admin", label: "Super Admins" },
  { value: "admin", label: "Admins" },
  { value: "renshi", label: "Renshi" },
  { value: "sensei", label: "Sensei" },
  { value: "team_member", label: "Team Members" },
  { value: "student", label: "Students" },
];

/** Admin/super_admin tab — compose and broadcast notifications. */
export default function NotificationsPanel() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState("");
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("");
  const [mode, setMode] = useState("broadcast"); // broadcast | role | user
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get("/users").then((r) => setUsers(r.data || [])).catch(() => {});
  }, []);

  const send = async (e) => {
    e.preventDefault();
    setMsg("");
    setBusy(true);
    try {
      const payload = { title, body };
      if (mode === "role") payload.role = role;
      else if (mode === "user") payload.user_id = userId;
      const { data } = await api.post("/notifications", payload);
      setMsg(`Sent to ${data.length} ${data.length === 1 ? "person" : "people"}.`);
      setTitle("");
      setBody("");
    } catch (err) {
      setMsg(`Error: ${formatApiError(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl border border-[var(--dojo-border)] bg-[var(--dojo-paper)] p-6" data-testid="notifications-panel">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)]">Compose</div>
          <h2 className="font-serif text-2xl">Send Notification</h2>
        </div>
      </div>
      <form onSubmit={send} className="space-y-5">
        <div>
          <label className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] block mb-2">Recipients</label>
          <div className="flex gap-2 mb-2">
            {[["broadcast","Everyone"],["role","By Role"],["user","One Person"]].map(([v, l]) => (
              <button
                key={v}
                type="button"
                onClick={() => setMode(v)}
                className={`px-3 py-1.5 text-xs border ${mode === v ? "bg-[var(--dojo-ink)] text-[var(--dojo-paper)] border-[var(--dojo-ink)]" : "border-[var(--dojo-border)]"}`}
                data-testid={`notif-mode-${v}`}
              >
                {l}
              </button>
            ))}
          </div>
          {mode === "role" && (
            <select value={role} onChange={(e) => setRole(e.target.value)} required className="input" data-testid="notif-role-select">
              <option value="">— Pick a role —</option>
              {ROLE_OPTIONS.filter((o) => o.value).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {mode === "user" && (
            <select value={userId} onChange={(e) => setUserId(e.target.value)} required className="input" data-testid="notif-user-select">
              <option value="">— Pick a person —</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] block mb-2">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} data-testid="notif-title-input" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] block mb-2">Body</label>
          <textarea className="input min-h-[120px]" value={body} onChange={(e) => setBody(e.target.value)} required maxLength={1000} data-testid="notif-body-input" />
        </div>
        {msg && <div className="text-sm text-[var(--dojo-ink-soft)]" data-testid="notif-result">{msg}</div>}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="btn-primary flex items-center gap-2" data-testid="notif-send-btn">
            <Send size={14} />
            {busy ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}
