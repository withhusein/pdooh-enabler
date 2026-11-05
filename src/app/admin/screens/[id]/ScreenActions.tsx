"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Screen } from "@/types";

export default function ScreenActions({ screen }: { screen: Screen }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerUrl = typeof window === "undefined" ? `/player/${screen.slug}` : `${window.location.origin}/player/${screen.slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(playerUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Gagal menyalin, salin manual.");
    }
  }

  async function toggle() {
    setBusy(true);
    setError(null);
    const { error } = await createClient().from("screens").update({ is_active: !screen.is_active }).eq("id", screen.id);
    setBusy(false);
    if (error) return setError(error.message);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Hapus layar "${screen.name}" beserta semua campaign dan log-nya?`)) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    // Remove stored creatives first so we don't orphan files.
    const { data: camps } = await supabase.from("campaigns").select("creative_path").eq("screen_id", screen.id);
    const paths = (camps ?? []).map((c) => c.creative_path as string).filter(Boolean);
    if (paths.length) await supabase.storage.from("creatives").remove(paths);
    const { error } = await supabase.from("screens").delete().eq("id", screen.id);
    setBusy(false);
    if (error) return setError(error.message);
    router.replace("/admin");
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <div>
        <label className="label">URL Player (buka di browser videotron)</label>
        <div className="flex gap-2">
          <input readOnly value={playerUrl} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <button className="btn-ghost shrink-0" onClick={copy}>{copied ? "Tersalin" : "Salin"}</button>
          <a className="btn-ghost shrink-0" href={`/player/${screen.slug}`} target="_blank" rel="noreferrer">Preview</a>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-ghost" onClick={toggle} disabled={busy}>{screen.is_active ? "Nonaktifkan layar" : "Aktifkan layar"}</button>
        <button className="btn-ghost text-red-300" onClick={remove} disabled={busy}>Hapus layar</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
