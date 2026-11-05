"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Overlay, PlayerPayload, PlaylistItem } from "@/types";

const REFRESH_MS = 60_000;
const CACHE_KEY = (slug: string) => `pdooh:last:${slug}`;

function useSessionId() {
  return useMemo(() => {
    try {
      const k = "pdooh:session";
      let v = localStorage.getItem(k);
      if (!v) {
        v = crypto.randomUUID();
        localStorage.setItem(k, v);
      }
      return v;
    } catch {
      return "anon";
    }
  }, []);
}

function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((new Date(target).getTime() - now) / 1000));
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span>
      {label}: <b className="tabular-nums">{d > 0 ? `${d}h ` : ""}{hh}:{mm}:{ss}</b>
    </span>
  );
}

function OverlayBar({ overlay }: { overlay: Overlay }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-[3vw] pb-[2vh] pt-[6vh] text-[3.2vh] font-semibold text-white">
      {overlay.kind === "financial" ? (
        <div className="flex flex-wrap gap-x-[3vw]">
          {overlay.items.map((i) => (
            <span key={i}>{i}</span>
          ))}
        </div>
      ) : overlay.kind === "countdown" ? (
        <Countdown target={overlay.target} label={overlay.label} />
      ) : (
        <span>{overlay.text}</span>
      )}
    </div>
  );
}

export default function PlayerClient({ slug }: { slug: string }) {
  const sessionId = useSessionId();
  const [payload, setPayload] = useState<PlayerPayload | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "notfound" | "offline">("loading");
  const [index, setIndex] = useState(0);
  const currentIdRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playlist: PlaylistItem[] = payload?.playlist ?? [];
  const item = playlist.length ? playlist[index % playlist.length] : null;

  /* ---- Fetch + poll config. Falls back to last good payload when offline. ---- */
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/player/${encodeURIComponent(slug)}`, { cache: "no-store" });
      if (res.status === 404) {
        setStatus("notfound");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as PlayerPayload;
      setPayload(data);
      setStatus("ok");
      try {
        localStorage.setItem(CACHE_KEY(slug), JSON.stringify(data));
      } catch {}
    } catch {
      setPayload((prev) => {
        if (prev) return prev;
        try {
          const raw = localStorage.getItem(CACHE_KEY(slug));
          if (raw) return JSON.parse(raw) as PlayerPayload;
        } catch {}
        return prev;
      });
      setStatus((s) => (s === "ok" ? s : "offline"));
    }
  }, [slug]);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  /* ---- Keep the current creative when the playlist refreshes. ---- */
  useEffect(() => {
    if (!playlist.length) return;
    const i = playlist.findIndex((p) => p.campaign.id === currentIdRef.current);
    if (i >= 0) setIndex(i);
    else setIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload?.generated_at]);

  /* ---- Advance + Proof-of-Play. ---- */
  const advance = useCallback(() => setIndex((i) => i + 1), []);

  useEffect(() => {
    if (!item) return;
    currentIdRef.current = item.campaign.id;

    fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        slug,
        campaign_id: item.campaign.id,
        event_type: "impression",
        duration_seconds: item.campaign.duration_seconds,
        session_id: sessionId,
        trigger_snapshot: { trigger: item.campaign.trigger_type, overlay: item.overlay },
      }),
    }).catch(() => {});

    if (timerRef.current) clearTimeout(timerRef.current);
    // Images advance on a timer. Videos advance on `ended`; the timer is a safety net
    // in case a video stalls (duration + 10s grace).
    const ms = item.campaign.duration_seconds * 1000 + (item.campaign.creative_type === "video" ? 10_000 : 0);
    timerRef.current = setTimeout(advance, ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.campaign.id, index, slug]);

  /* ---- Kiosk niceties: wake lock + hidden cursor. ---- */
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
        };
        lock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {}
    };
    req();
    const onVis = () => document.visibilityState === "visible" && req();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  const nextItem = playlist.length > 1 ? playlist[(index + 1) % playlist.length] : null;
  const single = playlist.length === 1;

  return (
    <main className="fixed inset-0 cursor-none select-none overflow-hidden bg-black text-white">
      {item ? (
        <>
          {item.campaign.creative_type === "video" ? (
            <video
              key={`${item.campaign.id}-${index}`}
              src={item.campaign.creative_url}
              className="h-full w-full object-contain"
              autoPlay
              muted
              playsInline
              loop={single}
              onEnded={single ? undefined : advance}
              onError={advance}
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${item.campaign.id}-${index}`}
              src={item.campaign.creative_url}
              alt={item.campaign.name}
              className="h-full w-full object-contain"
              onError={advance}
            />
          )}
          {item.overlay && <OverlayBar overlay={item.overlay} />}
          {/* Preload next image so transitions are seamless */}
          {nextItem?.campaign.creative_type === "image" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nextItem.campaign.creative_url} alt="" className="hidden" />
          )}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-slate-500">
          <p className="text-[4vh] font-semibold">
            {status === "loading" && "Memuat..."}
            {status === "notfound" && "Layar tidak ditemukan"}
            {status === "offline" && "Menunggu koneksi..."}
            {status === "ok" && "Tidak ada materi tayang"}
          </p>
          <p className="text-[2vh]">{slug}</p>
        </div>
      )}
    </main>
  );
}
