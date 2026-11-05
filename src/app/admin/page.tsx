import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Screen } from "@/types";
import ScreenForm from "./ScreenForm";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: screens, error } = await supabase.from("screens").select("*").order("created_at", { ascending: false });
  const { count: campaignCount } = await supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("is_active", true);
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: impressions24h } = await supabase
    .from("impression_logs")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "impression")
    .gte("played_at", since);

  const list = (screens ?? []) as Screen[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Screens</h1>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Titik layar", list.length],
          ["Campaign aktif", campaignCount ?? 0],
          ["Impression 24 jam", impressions24h ?? 0],
        ].map(([k, v]) => (
          <div key={k as string} className="card">
            <div className="text-2xl font-bold">{v}</div>
            <div className="text-xs text-slate-400">{k}</div>
          </div>
        ))}
      </div>

      {error && <p className="rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error.message}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((s) => (
          <Link key={s.id} href={`/admin/screens/${s.id}`} className="card transition hover:border-brand">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-slate-400">{s.media_owner ?? "-"} • /player/{s.slug}</div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${s.is_active ? "bg-emerald-900/50 text-emerald-300" : "bg-slate-800 text-slate-400"}`}>
                {s.is_active ? "aktif" : "nonaktif"}
              </span>
            </div>
            {s.address && <p className="mt-2 text-xs text-slate-500">{s.address}</p>}
          </Link>
        ))}
        {!list.length && <p className="text-sm text-slate-500">Belum ada layar. Tambahkan di bawah.</p>}
      </div>

      <ScreenForm />
    </div>
  );
}
