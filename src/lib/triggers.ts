import type {
  Campaign,
  FinancialData,
  LiveMatch,
  Overlay,
  PlaylistItem,
  TriggerContext,
  WeatherData,
} from "@/types";

/* ------------------------------------------------------------------ */
/* External API fetchers. All degrade to null on failure/missing key.  */
/* ------------------------------------------------------------------ */

async function fetchJson<T>(url: string, init?: RequestInit & { next?: { revalidate: number } }): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherData | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=id&appid=${key}`;
  const j = await fetchJson<{
    main?: { temp: number };
    weather?: { main: string; description: string }[];
    name?: string;
  }>(url, { next: { revalidate: 600 } });
  if (!j?.main) return null;
  const main = j.weather?.[0]?.main ?? "";
  return {
    temp: Math.round(j.main.temp),
    description: j.weather?.[0]?.description ?? "",
    isRain: ["Rain", "Drizzle", "Thunderstorm"].includes(main),
    city: j.name,
  };
}

export async function fetchLiveMatches(): Promise<LiveMatch[] | null> {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) return null;
  const j = await fetchJson<{
    matches?: {
      competition: { name: string };
      homeTeam: { shortName?: string; name: string };
      awayTeam: { shortName?: string; name: string };
      score: { fullTime: { home: number | null; away: number | null } };
      status: string;
    }[];
  }>("https://api.football-data.org/v4/matches?status=LIVE", {
    headers: { "X-Auth-Token": key },
    next: { revalidate: 60 },
  });
  if (!j?.matches) return null;
  return j.matches.map((m) => ({
    competition: m.competition.name,
    home: m.homeTeam.shortName || m.homeTeam.name,
    away: m.awayTeam.shortName || m.awayTeam.name,
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    status: m.status,
  }));
}

export async function fetchRates(): Promise<FinancialData | null> {
  const j = await fetchJson<{ rates?: Record<string, number>; time_last_update_utc?: string }>(
    "https://open.er-api.com/v6/latest/USD",
    { next: { revalidate: 3600 } }
  );
  if (!j?.rates?.IDR) return null;
  const idrPerUsd = j.rates.IDR;
  const rates = Object.entries(j.rates)
    .filter(([code]) => code !== "IDR")
    .map(([code, perUsd]) => ({ code, idr: idrPerUsd / perUsd }));
  return { rates, updatedAt: j.time_last_update_utc ?? null };
}

/* ------------------------------------------------------------------ */
/* Resolver: decide which campaigns play now, and their live overlays. */
/* ------------------------------------------------------------------ */

function hourIn(tz: string, iso: string): number {
  try {
    const h = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: tz }).format(new Date(iso));
    return parseInt(h, 10) % 24;
  } catch {
    return new Date(iso).getUTCHours();
  }
}

function inWindow(c: Campaign, nowMs: number) {
  if (c.starts_at && new Date(c.starts_at).getTime() > nowMs) return false;
  if (c.ends_at && new Date(c.ends_at).getTime() < nowMs) return false;
  return true;
}

function evaluate(c: Campaign, ctx: TriggerContext, tz: string): Overlay | null | false {
  const cfg = c.trigger_config ?? {};
  switch (c.trigger_type) {
    case "default":
      return null;
    case "weather": {
      const w = ctx.weather;
      if (!w) return false;
      const cond = cfg.condition ?? "any";
      const ok =
        cond === "any" ||
        (cond === "hot" && w.temp >= (cfg.min_temp ?? 31)) ||
        (cond === "cool" && w.temp <= (cfg.max_temp ?? 25)) ||
        (cond === "rain" && w.isRain);
      if (!ok) return false;
      return { kind: "weather", text: `${w.temp}°C • ${w.description}` };
    }
    case "sports": {
      const list = ctx.matches ?? [];
      const team = cfg.team?.trim().toLowerCase();
      const m = list.find((x) => !team || x.home.toLowerCase().includes(team) || x.away.toLowerCase().includes(team));
      if (!m) return false;
      const prefix = cfg.label ? `${cfg.label} • ` : "";
      return { kind: "sports", text: `${prefix}${m.competition}: ${m.home} ${m.homeScore ?? 0} - ${m.awayScore ?? 0} ${m.away}` };
    }
    case "financial": {
      const f = ctx.financial;
      if (!f) return false;
      const pairs = cfg.pairs?.length ? cfg.pairs : ["USD", "EUR", "SGD"];
      const items = pairs
        .map((p) => f.rates.find((r) => r.code === p.toUpperCase()))
        .filter((r): r is { code: string; idr: number } => !!r)
        .map((r) => `${r.code}/IDR ${Math.round(r.idr).toLocaleString("id-ID")}`);
      return items.length ? { kind: "financial", items } : false;
    }
    case "time": {
      if (cfg.countdown_to) {
        const target = new Date(cfg.countdown_to).getTime();
        if (target <= new Date(ctx.now).getTime()) return false;
        return { kind: "countdown", target: cfg.countdown_to, label: cfg.countdown_label ?? "Berakhir dalam" };
      }
      if (cfg.start_hour != null && cfg.end_hour != null) {
        const h = hourIn(tz, ctx.now);
        const { start_hour: s, end_hour: e } = cfg;
        const ok = s <= e ? h >= s && h < e : h >= s || h < e;
        return ok ? null : false;
      }
      return null;
    }
  }
}

/**
 * Strategy: campaigns whose trigger matches play first (sorted by priority).
 * If none match, fall back to "default" campaigns. A time-window trigger without
 * an overlay still counts as a trigger match.
 */
export function resolvePlaylist(campaigns: Campaign[], ctx: TriggerContext, tz: string): PlaylistItem[] {
  const nowMs = new Date(ctx.now).getTime();
  const live = campaigns.filter((c) => c.is_active && inWindow(c, nowMs));
  const toItem = (c: Campaign, overlay: Overlay | null): PlaylistItem => ({
    campaign: {
      id: c.id,
      name: c.name,
      brand: c.brand,
      creative_url: c.creative_url,
      creative_type: c.creative_type,
      duration_seconds: c.duration_seconds,
      trigger_type: c.trigger_type,
    },
    overlay,
  });

  const byPriority = (a: Campaign, b: Campaign) => b.priority - a.priority || a.created_at.localeCompare(b.created_at);
  const triggered: PlaylistItem[] = [];
  for (const c of live.filter((x) => x.trigger_type !== "default").sort(byPriority)) {
    const r = evaluate(c, ctx, tz);
    if (r !== false) triggered.push(toItem(c, r));
  }
  if (triggered.length) return triggered;
  return live.filter((x) => x.trigger_type === "default").sort(byPriority).map((c) => toItem(c, null));
}
