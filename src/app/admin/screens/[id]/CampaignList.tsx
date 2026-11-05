"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Campaign } from "@/types";

const TRIGGER_LABEL: Record<string, string> = {
  default: "Default",
  weather: "Weather",
  sports: "Live Sports",
  financial: "Financial Ticker",
  time: "Time / Countdown",
};

export default function CampaignList({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(c: Campaign) {
    setBusyId(c.id);
    setError(null);
    const { error } = await createClient().from("campaigns").update({ is_active: !c.is_active }).eq("id", c.id);
    setBusyId(null);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function remove(c: Campaign) {
    if (!confirm(`Hapus campaign "${c.name}"?`)) return;
    setBusyId(c.id);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("campaigns").delete().eq("id", c.id);
    if (error) {
      setBusyId(null);
      return setError(error.message);
    }
    await supabase.storage.from("creatives").remove([c.creative_path]);
    setBusyId(null);
    router.refresh();
  }

  if (!campaigns.length) return <p className="text-sm text-slate-500">Belum ada campaign untuk layar ini.</p>;

  return (
    <div className="space-y-2">
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      {campaigns.map((c) => (
        <div key={c.id} className="card flex items-center gap-4 !p-3">
          <div className="h-16 w-28 shrink-0 overflow-hidden rounded-md bg-black">
            {c.creative_type === "video" ? (
              <video src={c.creative_url} muted preload="metadata" className="h-full w-full object-cover" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.creative_url} alt="" className="h-full w-full object-cover" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{c.name}</div>
            <div className="truncate text-xs text-slate-400">
              {c.brand ?? "-"} • {TRIGGER_LABEL[c.trigger_type]} • {c.duration_seconds}s • prioritas {c.priority}
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button className="btn-ghost" disabled={busyId === c.id} onClick={() => toggle(c)}>
              {c.is_active ? "Aktif" : "Off"}
            </button>
            <button className="btn-ghost text-red-300" disabled={busyId === c.id} onClick={() => remove(c)}>
              Hapus
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
