import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import IDCard from "@/components/IDCard";
import BeltIcon from "@/components/BeltIcon";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getBelt, getNextBelt, getBeltProgress } from "@/lib/belts";
import BlogReader from "@/components/BlogReader";

function StatCard({ label, value, sub }) {
  return (
    <div className="border border-[var(--dojo-border)] p-6 bg-[var(--dojo-paper)]">
      <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] mb-2">{label}</div>
      <div className="font-serif text-4xl tracking-tight">{value}</div>
      {sub && <div className="text-xs text-[var(--dojo-ink-soft)] mt-1">{sub}</div>}
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [payments, setPayments] = useState([]);
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    api.get("/payments").then((r) => setPayments(r.data)).catch(() => {});
    api.get("/cms/pages/schedule").then((r) => setSchedule(r.data?.content?.classes || [])).catch(() => {});
  }, []);

  const due = payments.filter((p) => p.status !== "paid");
  const totalDue = due.reduce((a, b) => a + b.amount, 0);
  const paidTotal = payments.filter((p) => p.status === "paid").reduce((a, b) => a + b.amount, 0);
  const currentBelt = getBelt(user?.belt_rank);
  const nextBelt = getNextBelt(user?.belt_rank);
  const progress = getBeltProgress(user?.belt_rank);

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "blog", label: "Blog" },
  ];

  return (
    <DashboardLayout title="Student Portal" subtitle={`Welcome, ${user?.name?.split(" ")[0] || "student"}.`}>
      <div className="flex gap-2 mb-8 border-b border-[var(--dojo-border)] overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            data-testid={`tab-${t.id}`}
            className={`px-5 py-3 text-[11px] uppercase tracking-[0.2em] border-b-2 whitespace-nowrap transition-colors ${
              tab === t.id ? "border-[var(--dojo-green)] text-[var(--dojo-ink)]" : "border-transparent text-[var(--dojo-ink-soft)] hover:text-[var(--dojo-ink)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "blog" && <BlogReader />}

      {tab === "overview" && (
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Balance Due" value={`$${totalDue.toFixed(2)}`} sub={`${due.length} open`} />
            <StatCard label="Paid to date" value={`$${paidTotal.toFixed(2)}`} />
            <StatCard label="Rank" value={user?.belt_rank || "—"} />
          </div>

          {/* Belt progression */}
          <section className="border border-[var(--dojo-border)] bg-[var(--dojo-paper)]" data-testid="belt-progression-card">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dojo-border)]">
              <h2 className="font-serif text-2xl">Your Path</h2>
              <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)]">
                Rank {progress.current} of {progress.total}
              </span>
            </div>
            <div className="px-6 py-6 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-6 items-center">
              <div>
                <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] mb-3">Current</div>
                <div className="flex items-center gap-4">
                  <BeltIcon belt={currentBelt} size={56} />
                  <div className="font-serif text-xl tracking-tight">{currentBelt.name}</div>
                </div>
              </div>
              <div className="text-[var(--dojo-ink-soft)] font-serif text-2xl text-center hidden sm:block">→</div>
              <div className="sm:text-right">
                <div className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)] mb-3">
                  {nextBelt ? "Next" : "Pinnacle"}
                </div>
                {nextBelt ? (
                  <div className="flex items-center gap-4 sm:justify-end">
                    <BeltIcon belt={nextBelt} size={56} />
                    <div className="font-serif text-xl tracking-tight">{nextBelt.name}</div>
                  </div>
                ) : (
                  <div className="font-serif text-xl tracking-tight text-[var(--dojo-hinomaru)]">
                    10th Dan — Mastery
                  </div>
                )}
              </div>
            </div>
            {/* Progress bar */}
            <div className="px-6 pb-6">
              <div className="h-1 bg-[var(--dojo-border)] relative overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--dojo-hinomaru)] transition-all duration-500"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          </section>

          <section className="border border-[var(--dojo-border)] bg-[var(--dojo-paper)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dojo-border)]">
              <h2 className="font-serif text-2xl">Payments</h2>
              <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)]">Account Ledger</span>
            </div>
            <div className="divide-y divide-[var(--dojo-border)]">
              {payments.length === 0 && (
                <div className="px-6 py-8 text-sm text-[var(--dojo-ink-soft)]">No payments recorded.</div>
              )}
              {payments.map((p) => (
                <div key={p.id} className="px-6 py-4 grid grid-cols-[1fr_auto_auto] gap-6 items-center" data-testid={`payment-row-${p.id}`}>
                  <div>
                    <div className="font-medium text-sm">{p.description}</div>
                    <div className="text-xs text-[var(--dojo-ink-soft)] mt-0.5">
                      {p.due_date ? `Due ${new Date(p.due_date).toLocaleDateString()}` : "No due date"}
                      {p.paid_date && ` · Paid ${new Date(p.paid_date).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="font-mono-accent tracking-widest text-sm">${p.amount.toFixed(2)}</div>
                  <span className={`text-[10px] uppercase tracking-[0.2em] px-3 py-1 border ${
                    p.status === "paid" ? "border-[#2E4E3F] text-[#2E4E3F]" :
                    p.status === "overdue" ? "border-[var(--dojo-hinomaru)] text-[var(--dojo-hinomaru)]" :
                    "border-[#B87F17] text-[#B87F17]"
                  }`}>{p.status}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="border border-[var(--dojo-border)] bg-[var(--dojo-paper)]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--dojo-border)]">
              <h2 className="font-serif text-2xl">Your Classes</h2>
              <span className="text-[10px] uppercase tracking-[0.24em] text-[var(--dojo-ink-soft)]">Weekly Schedule</span>
            </div>
            <div className="divide-y divide-[var(--dojo-border)]">
              {schedule.map((s, i) => (
                <div key={i} className="px-6 py-3 flex items-center justify-between">
                  <div className="text-sm"><span className="font-medium">{s.day}</span> · {s.class}</div>
                  <div className="font-mono-accent text-xs text-[var(--dojo-ink-soft)]">{s.time}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5">
          <div className="sticky top-28">
            <IDCard user={user} />
          </div>
        </div>
      </div>
      )}
    </DashboardLayout>
  );
}
