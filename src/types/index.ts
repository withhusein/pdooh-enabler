export type TriggerType = "default" | "weather" | "sports" | "financial" | "time";

export interface Screen {
  id: string;
  slug: string;
  name: string;
  media_owner: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  qr_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WeatherConfig {
  condition?: "hot" | "rain" | "cool" | "any";
  min_temp?: number; // "hot" when temp >= min_temp (default 31)
  max_temp?: number; // "cool" when temp <= max_temp (default 25)
}
export interface SportsConfig {
  team?: string; // substring filter on team names; empty = any live match
  label?: string; // overlay prefix e.g. "Official Partner"
}
export interface FinancialConfig {
  pairs?: string[]; // currency codes quoted against IDR, e.g. ["USD","EUR"]
}
export interface TimeConfig {
  start_hour?: number; // 0-23, inclusive
  end_hour?: number; // 0-23, exclusive; wraps past midnight if < start
  countdown_to?: string; // ISO datetime
  countdown_label?: string;
}
export type TriggerConfig = WeatherConfig & SportsConfig & FinancialConfig & TimeConfig;

export interface Campaign {
  id: string;
  screen_id: string;
  name: string;
  brand: string | null;
  trigger_type: TriggerType;
  trigger_config: TriggerConfig;
  creative_path: string;
  creative_url: string;
  creative_type: "image" | "video";
  duration_seconds: number;
  priority: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface WeatherData {
  temp: number;
  description: string;
  isRain: boolean;
  city?: string;
}
export interface LiveMatch {
  competition: string;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}
export interface FinancialData {
  rates: { code: string; idr: number }[];
  updatedAt: string | null;
}
export interface TriggerContext {
  now: string; // ISO
  weather?: WeatherData | null;
  matches?: LiveMatch[] | null;
  financial?: FinancialData | null;
}

export type Overlay =
  | { kind: "weather"; text: string }
  | { kind: "sports"; text: string }
  | { kind: "financial"; items: string[] }
  | { kind: "countdown"; target: string; label: string };

export interface PlaylistItem {
  campaign: Pick<
    Campaign,
    "id" | "name" | "brand" | "creative_url" | "creative_type" | "duration_seconds" | "trigger_type"
  >;
  overlay: Overlay | null;
}

export interface PlayerPayload {
  screen: Pick<Screen, "slug" | "name" | "qr_url">;
  playlist: PlaylistItem[];
  generated_at: string;
}
