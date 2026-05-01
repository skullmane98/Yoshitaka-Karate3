import { useEffect, useState } from "react";
import api from "@/lib/api";
import { Loader2 } from "lucide-react";

/**
 * Certificate-style ID card with QR + Barcode.
 */
export default function IDCard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/${user.id}/qrcode`);
        if (active) setData(data);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  if (!user) return null;

  return (
    <div className="id-card p-8 md:p-10" data-testid="id-card">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-[#4A4A4A] mb-1">Yoshitaka Karate-Do</div>
          <div className="font-serif text-3xl md:text-4xl font-medium tracking-tight leading-none">Member Certificate</div>
        </div>
        <span className="font-kanji text-4xl text-[#C1121F] leading-none">空手道</span>
      </div>

      <div className="brush-divider mb-6" />

      <div className="grid md:grid-cols-[1fr_auto] gap-8 items-center">
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#4A4A4A]">Member</div>
            <div className="font-serif text-2xl font-medium" data-testid="idcard-name">{user.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[#4A4A4A]">Role</div>
              <div className="text-sm font-medium capitalize">{user.role.replace("_", " ")}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-[#4A4A4A]">Rank</div>
              <div className="text-sm font-medium">{user.belt_rank || "—"}</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-[#4A4A4A]">Member No.</div>
            <div className="font-mono-accent text-base tracking-widest" data-testid="idcard-member-number">
              {user.member_number}
            </div>
          </div>
          {data?.barcode_png && (
            <div className="pt-2">
              <img
                src={data.barcode_png}
                alt="Member barcode"
                className="h-14 w-auto"
                data-testid="idcard-barcode"
              />
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <div className="p-3 bg-white border border-[#E0DCD0]">
            {loading || !data ? (
              <div className="w-36 h-36 flex items-center justify-center">
                <Loader2 className="animate-spin text-[#4A4A4A]" />
              </div>
            ) : (
              <img src={data.qr_png} alt="QR code" className="w-36 h-36" data-testid="idcard-qr" />
            )}
          </div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-[#4A4A4A]">Scan to verify</div>
        </div>
      </div>

      <div className="brush-divider my-6" />
      <div className="flex justify-between items-end text-[10px] uppercase tracking-[0.24em] text-[#4A4A4A]">
        <span>Issued · Yoshitaka Dojo</span>
        <span className="font-kanji text-sm text-[#1A1A1A]">義孝</span>
      </div>
    </div>
  );
}
