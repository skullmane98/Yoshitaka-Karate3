import { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

/**
 * Bell icon + dropdown. Polls unread count every 30s and refreshes the list
 * when the dropdown opens.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const popRef = useRef(null);

  // Poll unread count
  useEffect(() => {
    if (!user) return;
    let alive = true;
    const fetchCount = async () => {
      try {
        const { data } = await api.get("/notifications/unread-count");
        if (alive) setUnread(data.count || 0);
      } catch {
        /* ignore */
      }
    };
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => { alive = false; clearInterval(t); };
  }, [user]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (!popRef.current) return;
      if (!popRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Load items when opened
  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/notifications", { params: { limit: 20 } });
        setItems(data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const markOne = async (id) => {
    setItems((arr) => arr.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try { await api.post(`/notifications/${id}/read`); } catch { /* ignore */ }
  };

  const markAll = async () => {
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try { await api.post("/notifications/read-all"); } catch { /* ignore */ }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={popRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 border border-[var(--dojo-border)] hover:border-[var(--dojo-green)] hover:text-[var(--dojo-green)] transition-colors"
        data-testid="notification-bell-btn"
        aria-label={`Notifications, ${unread} unread`}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-[var(--dojo-hinomaru)] text-white flex items-center justify-center"
            data-testid="notification-unread-count"
          >
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[360px] max-h-[480px] overflow-hidden border border-[var(--dojo-border)] bg-[var(--dojo-paper)] shadow-2xl z-50 flex flex-col"
          data-testid="notification-dropdown"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--dojo-border)]">
            <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)]">Notifications</div>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs flex items-center gap-1 text-[var(--dojo-green)] hover:underline" data-testid="notif-mark-all">
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-4 py-6 text-center text-sm text-[var(--dojo-ink-soft)]">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-3xl mb-2 opacity-40">🔔</div>
                <div className="text-sm text-[var(--dojo-ink-soft)]">No notifications yet.</div>
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li
                    key={n.id}
                    data-testid={`notif-item-${n.id}`}
                    className={`px-4 py-3 border-b border-[var(--dojo-border)] hover:bg-[var(--dojo-input-bg)] transition-colors ${n.read ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1">
                        <div className="font-medium text-sm leading-tight">{n.title}</div>
                        <div className="text-xs text-[var(--dojo-ink-soft)] mt-1 line-clamp-2">{n.body}</div>
                        <div className="flex items-center gap-2 mt-2 text-[10px] uppercase tracking-[0.18em] text-[var(--dojo-ink-soft)]">
                          <span>{n.sender_name}</span>
                          <span>·</span>
                          <span>{new Date(n.created_at).toLocaleString()}</span>
                        </div>
                      </div>
                      {!n.read && (
                        <button
                          onClick={() => markOne(n.id)}
                          className="text-[var(--dojo-ink-soft)] hover:text-[var(--dojo-green)] p-1"
                          title="Mark read"
                          aria-label="Mark read"
                        >
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
