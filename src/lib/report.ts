import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv } from "@/lib/csv";

export type ReportType = "detail" | "summary";

interface Log {
  id: number;
  screen_id: string;
  campaign_id: string | null;
  event_type: string;
  played_at: string;
  duration_seconds: number | null;
  session_id: string | null;
  trigger_snapshot: unknown;
}
interface ScreenRow {
  id: string;
  slug: string;
  name: string;
  media_owner: string | null;
  timezone: string;
}

/** "YYYY-MM" -> [startISO, endISO) in Asia/Jakarta (UTC+7, no DST). */
export function monthRange(month: string): { start: string; end: string } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const offset = 7 * 3600 * 1000;
  return {
    start: new Date(Date.UTC(y, mo, 1) - offset).toISOString(),
    end: new Date(Date.UTC(y, mo + 1, 1) - offset).toISOString(),
  };
}

function localParts(iso: string, tz: string) {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const g = (t: string) => f.find((p) => p.type === t)?.value ?? "";
  return { date: `${g("year")}-${g("month")}-${g("day")}`, hour: String(Number(g("hour")) % 24).padStart(2, "0") };
}

async function fetchAllLogs(screenIds: string[], start: string, end: string): Promise<Log[]> {
  const db = createAdminClient();
  const out: Log[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from("impression_logs")
      .select("id, screen_id, campaign_id, event_type, played_at, duration_seconds, session_id, trigger_snapshot")
      .in("screen_id", screenIds)
      .gte("played_at", start)
      .lt("played_at", end)
      .order("played_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Log[]));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export async function buildReport(opts: { month: string; screenSlug?: string; type: ReportType }) {
  const range = monthRange(opts.month);
  if (!range) throw new Error("Invalid month, expected YYYY-MM");

  const db = createAdminClient();
  let sq = db.from("screens").select("id, slug, name, media_owner, timezone");
  if (opts.screenSlug) sq = sq.eq("slug", opts.screenSlug);
  const { data: screens, error } = await sq;
  if (error) throw error;
  if (!screens?.length) throw new Error("No screens found");
  const screenMap = new Map((screens as ScreenRow[]).map((s) => [s.id, s]));

  const { data: camps } = await db.from("campaigns").select("id, name, brand").in("screen_id", [...screenMap.keys()]);
  const campMap = new Map((camps ?? []).map((c) => [c.id as string, c as { id: string; name: string; brand: string | null }]));

  const logs = await fetchAllLogs([...screenMap.keys()], range.start, range.end);
  const scope = opts.screenSlug ?? "all-screens";
  const filename = `pdooh-${opts.type}-${scope}-${opts.month}.csv`;

  if (opts.type === "detail") {
    const rows: unknown[][] = [
      ["log_id", "played_at_utc", "local_date", "local_hour", "screen_slug", "screen_name", "media_owner", "campaign", "brand", "event_type", "duration_seconds", "session_id", "trigger"],
    ];
    for (const l of logs) {
      const s = screenMap.get(l.screen_id)!;
      const c = l.campaign_id ? campMap.get(l.campaign_id) : undefined;
      const p = localParts(l.played_at, s.timezone);
      rows.push([l.id, l.played_at, p.date, p.hour, s.slug, s.name, s.media_owner, c?.name ?? "(deleted)", c?.brand, l.event_type, l.duration_seconds, l.session_id, l.trigger_snapshot]);
    }
    return { filename, csv: toCsv(rows), count: logs.length };
  }

  // ---- Summary: Traffic, Unique Visitors, Peak Hours ----
  const imps = logs.filter((l) => l.event_type === "impression");
  const scans = logs.filter((l) => l.event_type === "qr_scan");
  const uniqueVisitors = new Set(scans.map((l) => l.session_id).filter(Boolean)).size;

  const byCampaign = new Map<string, { impressions: number; seconds: number; scans: number }>();
  const byDay = new Map<string, number>();
  const byHour = new Map<string, number>();
  for (const l of logs) {
    const s = screenMap.get(l.screen_id)!;
    const key = l.campaign_id ?? "(deleted)";
    const row = byCampaign.get(key) ?? { impressions: 0, seconds: 0, scans: 0 };
    if (l.event_type === "impression") {
      row.impressions++;
      row.seconds += l.duration_seconds ?? 0;
      const p = localParts(l.played_at, s.timezone);
      byDay.set(p.date, (byDay.get(p.date) ?? 0) + 1);
      byHour.set(p.hour, (byHour.get(p.hour) ?? 0) + 1);
    } else row.scans++;
    byCampaign.set(key, row);
  }

  const rows: unknown[][] = [
    ["pDOOH Monthly Report"],
    ["Period", opts.month],
    ["Screen", opts.screenSlug ?? "All screens"],
    [],
    ["TOTALS"],
    ["Total impressions (Traffic)", imps.length],
    ["Total QR scans", scans.length],
    ["Unique visitors (distinct QR-scan sessions)", uniqueVisitors],
    [],
    ["BY CAMPAIGN"],
    ["campaign", "brand", "impressions", "air_seconds", "qr_scans"],
    ...[...byCampaign.entries()].map(([id, v]) => [campMap.get(id)?.name ?? id, campMap.get(id)?.brand, v.impressions, v.seconds, v.scans]),
    [],
    ["BY DAY"],
    ["date", "impressions"],
    ...[...byDay.entries()].sort().map(([d, n]) => [d, n]),
    [],
    ["BY HOUR (Peak Hours)"],
    ["hour", "impressions"],
    ...[...byHour.entries()].sort().map(([h, n]) => [`${h}:00`, n]),
  ];
  return { filename, csv: toCsv(rows), count: logs.length };
}
