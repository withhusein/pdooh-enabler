"use client";

import { useState } from "react";

export default function ReportForm({ screens }: { screens: { slug: string; name: string }[] }) {
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [screen, setScreen] = useState("");
  const [type, setType] = useState<"summary" | "detail">("summary");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const q = new URLSearchParams({ month, type });
      if (screen) q.set("screen", screen);
      const res = await fetch(`/api/report?${q}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Gagal (${res.status})`);
      }
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "report.csv";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengunduh.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Bulan</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label">Layar</label>
          <select value={screen} onChange={(e) => setScreen(e.target.value)} className="input">
            <option value="">Semua layar</option>
            {screens.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Jenis</label>
          <select value={type} onChange={(e) => setType(e.target.value as "summary" | "detail")} className="input">
            <option value="summary">Summary</option>
            <option value="detail">Detail (raw log)</option>
          </select>
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button className="btn" onClick={download} disabled={busy || !month}>{busy ? "Menyusun..." : "Unduh CSV"}</button>
    </div>
  );
}
