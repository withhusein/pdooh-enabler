"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ScreenForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const num = (k: string) => {
      const v = String(f.get(k) ?? "").trim();
      return v === "" ? null : Number(v);
    };
    const lat = num("latitude");
    const lon = num("longitude");
    if ((lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) || (lon !== null && (isNaN(lon) || lon < -180 || lon > 180))) {
      setError("Koordinat tidak valid.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await createClient()
      .from("screens")
      .insert({
        slug: String(f.get("slug")).trim().toLowerCase(),
        name: String(f.get("name")).trim(),
        media_owner: String(f.get("media_owner") ?? "").trim() || null,
        address: String(f.get("address") ?? "").trim() || null,
        latitude: lat,
        longitude: lon,
        qr_url: String(f.get("qr_url") ?? "").trim() || null,
      });
    setBusy(false);
    if (error) {
      setError(error.code === "23505" ? "Slug sudah dipakai." : error.message);
      return;
    }
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="font-semibold">Tambah titik layar</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nama</label>
          <input name="name" required className="input" placeholder="Videotron Sudirman 01" />
        </div>
        <div>
          <label className="label">Slug (URL player)</label>
          <input name="slug" required pattern="[a-z0-9\-]+" className="input" placeholder="sudirman-01" />
        </div>
        <div>
          <label className="label">Media Owner</label>
          <input name="media_owner" className="input" />
        </div>
        <div>
          <label className="label">Alamat</label>
          <input name="address" className="input" />
        </div>
        <div>
          <label className="label">Latitude (untuk cuaca)</label>
          <input name="latitude" inputMode="decimal" className="input" placeholder="-6.2088" />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input name="longitude" inputMode="decimal" className="input" placeholder="106.8456" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">URL QR / microsite (opsional)</label>
          <input name="qr_url" type="url" className="input" placeholder="https://..." />
        </div>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Menyimpan..." : "Simpan layar"}</button>
    </form>
  );
}
