import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Month-grid calendar for payments. Each payment's due_date drops a dot on its day;
 * status determines color. Clicking a day opens a side list of payments due that day.
 */
const STATUS_COLOR = {
  paid: "#1A7A3D",     // green
  due: "#1E5BA8",      // blue
  overdue: "#D7263D",  // red
};

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function PaymentCalendar({ payments = [] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(null);

  const byDay = useMemo(() => {
    const m = {};
    for (const p of payments) {
      if (!p.due_date) continue;
      const d = new Date(p.due_date);
      if (isNaN(d)) continue;
      const k = ymd(d);
      if (!m[k]) m[k] = [];
      m[k].push(p);
    }
    return m;
  }, [payments]);

  const firstWeekday = cursor.getDay(); // 0 = Sun
  const totalDays = daysInMonth(cursor);
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayKey = ymd(new Date());

  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) {
    cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta) => {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
    setSelected(null);
  };

  const selectedItems = selected ? (byDay[selected] || []) : [];

  return (
    <div className="border border-[var(--dojo-border)] bg-[var(--dojo-paper)]" data-testid="payment-calendar">
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dojo-border)]">
        <h3 className="font-serif text-xl">Calendar View</h3>
        <div className="flex items-center gap-3">
          <button onClick={() => move(-1)} className="p-1.5 border border-[var(--dojo-border)] hover:border-[var(--dojo-green)]" data-testid="cal-prev"><ChevronLeft size={16} /></button>
          <div className="text-sm font-medium min-w-[140px] text-center" data-testid="cal-month-label">{monthLabel}</div>
          <button onClick={() => move(1)} className="p-1.5 border border-[var(--dojo-border)] hover:border-[var(--dojo-green)]" data-testid="cal-next"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]">
        <div className="p-4">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.18em] text-[var(--dojo-ink-soft)] mb-2">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
              <div key={d} className="text-center py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;
              const k = ymd(cell);
              const items = byDay[k] || [];
              const isToday = k === todayKey;
              const isSelected = k === selected;
              const hasOverdue = items.some((p) => p.status === "overdue");
              const dueTotal = items.reduce((a, b) => a + b.amount, 0);
              return (
                <button
                  key={i}
                  onClick={() => setSelected(items.length ? k : null)}
                  className={`aspect-square border text-left p-1.5 transition-all hover:border-[var(--dojo-ink)] ${
                    isSelected ? "border-[var(--dojo-ink)] bg-[var(--dojo-input-bg)]" :
                    isToday ? "border-[var(--dojo-green)]" :
                    items.length ? "border-[var(--dojo-border)] bg-[var(--dojo-input-bg)]" :
                    "border-transparent"
                  }`}
                  data-testid={`cal-day-${k}`}
                >
                  <div className={`text-xs font-medium ${hasOverdue ? "text-[var(--dojo-hinomaru)]" : ""}`}>{cell.getDate()}</div>
                  {items.length > 0 && (
                    <div className="mt-auto">
                      <div className="flex gap-0.5 mt-1 flex-wrap">
                        {items.slice(0, 4).map((p) => (
                          <span
                            key={p.id}
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: STATUS_COLOR[p.status] || "#888" }}
                            aria-hidden
                          />
                        ))}
                        {items.length > 4 && <span className="text-[8px] text-[var(--dojo-ink-soft)]">+{items.length - 4}</span>}
                      </div>
                      <div className="text-[9px] text-[var(--dojo-ink-soft)] mt-0.5 font-mono">${dueTotal.toFixed(0)}</div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4 mt-4 text-[10px] uppercase tracking-[0.18em] text-[var(--dojo-ink-soft)]">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.due }} />Due</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.paid }} />Paid</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR.overdue }} />Overdue</span>
          </div>
        </div>

        <div className="border-l border-[var(--dojo-border)] p-4 min-h-[260px]" data-testid="cal-side">
          <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] mb-3">
            {selected ? `Due ${new Date(selected + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "Select a day"}
          </div>
          {selected ? (
            selectedItems.length === 0 ? (
              <div className="text-sm text-[var(--dojo-ink-soft)]">Nothing due that day.</div>
            ) : (
              <ul className="space-y-3">
                {selectedItems.map((p) => (
                  <li key={p.id} className="border border-[var(--dojo-border)] p-3" data-testid={`cal-payment-${p.id}`}>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <div className="font-medium text-sm">{p.user_name || "—"}</div>
                        <div className="text-xs text-[var(--dojo-ink-soft)] mt-0.5">{p.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono font-medium text-sm">${p.amount.toFixed(2)}</div>
                        <span
                          className="inline-block mt-1 text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 border"
                          style={{ borderColor: STATUS_COLOR[p.status], color: STATUS_COLOR[p.status] }}
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="text-sm text-[var(--dojo-ink-soft)]">
              Click a day with dots to see who's due. Each dot = one payment.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
