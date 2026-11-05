"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TriggerConfig, TriggerType } from "@/types";

const MAX_BYTES = 50 * 1024 * 1024; // Supabase free-tier per-file limit
const ALLOWED = ["video/mp4", "video/webm", "image/png", "image/jpeg", "image/webp"];

export default function CampaignForm({ screenId }: { screenId: string }) {
  const router = useRouter();
  const [trigger, setTrigger] = useState<TriggerType>("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildConfig(f: FormData): TriggerConfig {
    const s = (k: string) => String(f.get(k) ?? "").trim();
    const n = (k: string) => (s(k) === "" ? undefined : Number(s(k)));
    switch (trigger) {
      case "weather":
        return { condition: (s("condition") || "any") as TriggerConfig["condition"], min_temp: n("min_temp"), max_temp: n("max_temp") };
      case "sports":
        return { team: s("team") || undefined, label: s("label") || undefined };
      case "financial":
        return { pairs: s("pairs") ? s("pairs").split(",").map((p) => p.trim().toUpperCase()).filter(Boolean) : undefined };
      case "time": {
        const cd = s("countdown_to");
        return {
          start_hour: n("start_hour"),
          end_hour: n("end_hour"),
          countdown_to: cd ? new Date(cd).toISOString() : undefined,
          countdown_label: s("countdown_label") || undefined,
        };
      }
      default:
        return {};
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("file") as File | null;
    if (!file || !file.size) return setError("Pilih file creative.");
    if (!ALLOWED.includes(file.type)) return setError("Format harus MP4/WebM atau PNG/JPG/WebP.");
    if (file.size > MAX_BYTES) return setError("Ukuran file maksimal 50 MB.");

    const config = buildConfig(f);
    if (trigger === "time" && !config.countdown_to && (config.start_hour == null || config.end_hour == null)) {
      return setError("Isi jam mulai & selesai, atau waktu countdown.");
    }

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${screenId}/${Date.now()}-${safe}`;

    const up = await supabase.storage.from("creatives").upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) {
      setBusy(false);
      return setError(`Upload gagal: ${up.error.message}`);
    }
    const { data: pub } = supabase.storage.from("creatives").getPublicUrl(path);

    const dur = Number(f.get("duration_seconds")) || 15;
    const { error } = await supabase.from("campaigns").insert({
      screen_id: screenId,
      name: String(f.get("name")).trim(),
      brand: String(f.get("brand") ?? "").trim() || null,
      trigger_type: trigger,
      trigger_config: config,
      creative_path: path,
      creative_url: pub.publicUrl,
      creative_type: file.type.startsWith("video/") ? "video" : "image",
      duration_seconds: Math.min(300, Math.max(3, dur)),
      priority: Number(f.get("priority")) || 0,
    });
    if (error) {
      await supabase.storage.from("creatives").remove([path]); // don't orphan the upload
      setBusy(false);
      return setError(error.message);
    }
    setBusy(false);
    form.reset();
    setTrigger("default");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <h2 className="font-semibold">Tambah campaign & creative</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Nama campaign</label>
          <input name="name" required className="input" />
        </div>
        <div>
          <label className="label">Brand</label>
          <input name="brand" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">File creative (MP4/WebM/PNG/JPG/WebP, maks 50 MB)</label>
          <input name="file" type="file" required accept={ALLOWED.join(",")} className="input file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-1 file:text-slate-100" />
        </div>
        <div>
          <label className="label">Durasi (detik)</label>
          <input name="duration_seconds" type="number" min={3} max={300} defaultValue={15} className="input" />
        </div>
        <div>
          <label className="label">Prioritas (lebih besar tayang dulu)</label>
          <input name="priority" type="number" defaultValue={0} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">API Trigger</label>
          <select value={trigger} onChange={(e) => setTrigger(e.target.value as TriggerType)} className="input">
            <option value="default">Default (tayang bila tidak ada trigger cocok)</option>
            <option value="weather">Weather (OpenWeatherMap)</option>
            <option value="sports">Live Sports (Football-Data)</option>
            <option value="financial">Financial Ticker (kurs)</option>
            <option value="time">Time / Countdown</option>
          </select>
        </div>

        {trigger === "weather" && (
          <>
            <div>
              <label className="label">Kondisi</label>
              <select name="condition" className="input" defaultValue="hot">
                <option value="hot">Panas (suhu ≥ batas)</option>
                <option value="cool">Sejuk (suhu ≤ batas)</option>
                <option value="rain">Hujan</option>
                <option value="any">Selalu, tampilkan cuaca</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Panas ≥ °C</label>
                <input name="min_temp" type="number" placeholder="31" className="input" />
              </div>
              <div>
                <label className="label">Sejuk ≤ °C</label>
                <input name="max_temp" type="number" placeholder="25" className="input" />
              </div>
            </div>
          </>
        )}
        {trigger === "sports" && (
          <>
            <div>
              <label className="label">Filter tim (opsional)</label>
              <input name="team" className="input" placeholder="Arsenal" />
            </div>
            <div>
              <label className="label">Label sponsor</label>
              <input name="label" className="input" placeholder="Presented by Brand X" />
            </div>
          </>
        )}
        {trigger === "financial" && (
          <div className="sm:col-span-2">
            <label className="label">Mata uang vs IDR (pisahkan koma)</label>
            <input name="pairs" className="input" placeholder="USD, EUR, SGD, JPY" />
          </div>
        )}
        {trigger === "time" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Jam mulai (0-23)</label>
                <input name="start_hour" type="number" min={0} max={23} className="input" />
              </div>
              <div>
                <label className="label">Jam selesai (0-23)</label>
                <input name="end_hour" type="number" min={0} max={23} className="input" />
              </div>
            </div>
            <div>
              <label className="label">atau Countdown ke</label>
              <input name="countdown_to" type="datetime-local" className="input" />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Label countdown</label>
              <input name="countdown_label" className="input" placeholder="Flash sale berakhir dalam" />
            </div>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? "Mengunggah..." : "Upload & simpan"}</button>
    </form>
  );
}
