# pDOOH Enabler

Lean pDOOH platform: operational CMS + dynamic HTML5 player + CSV reporting.
Stack (testing phase, Rp 0): **Next.js 15 on Vercel**, **Supabase** (Auth, Postgres, Storage), GitHub.

## Setup

1. **Supabase**: create a project, then run `supabase/schema.sql` in the SQL Editor.
   This creates the tables (`profiles`, `screens`, `campaigns`, `impression_logs`), RLS policies and the public `creatives` bucket.
2. **First admin**: Auth > Users > Add user, then run:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
3. **Env**: copy `.env.example` to `.env.local` and fill it in. On Vercel add the same variables
   (`SUPABASE_SERVICE_ROLE_KEY` must stay server-side, never `NEXT_PUBLIC_`).
4. `npm install && npm run dev`, open `/login`.
5. Push to a private GitHub repo and import it in Vercel for auto-deploy.

## How it works

| Piece | Where |
|---|---|
| Login + admin guard | `src/middleware.ts`, `src/app/login`, `src/app/admin/layout.tsx` |
| Screens, campaigns, creative upload, trigger config | `src/app/admin/**` (uploads go straight to Supabase Storage; RLS allows admins only) |
| Player `/player/[slug]` | `src/app/player/[id]/PlayerClient.tsx` |
| Player config API | `src/app/api/player/[id]/route.ts` (service role; calls only the external APIs a screen needs) |
| Trigger logic | `src/lib/triggers.ts` |
| Proof-of-Play logger | `src/app/api/log/route.ts` |
| CSV report | `src/lib/report.ts`, `src/app/api/report/route.ts` (admin only) |

### Trigger behaviour
Campaigns whose trigger matches play first (by priority). If none match, `default` campaigns play.
- **Weather**: OpenWeatherMap using the screen's lat/lon (`OPENWEATHER_API_KEY`). Conditions: hot / cool / rain / any.
- **Live Sports**: football-data.org live matches (`FOOTBALL_DATA_API_KEY`), optional team filter, score overlay.
- **Financial**: currency/IDR ticker from open.er-api.com (no key). Gold and IHSG are not included (no stable free official API); add a fetcher in `triggers.ts`.
- **Time**: hour window in the screen's timezone, or a live countdown.

Missing API keys make the trigger simply not match, so the screen falls back to default creatives.

### Player resilience
Config refreshes every 60 s; the last good payload is cached in `localStorage` for offline starts; broken media is skipped; screen wake-lock is requested.

### Reports
`/admin/reports` downloads `summary` (traffic, QR scans, unique visitors, by campaign/day/hour) or `detail` (raw logs) CSV for a month (Asia/Jakarta boundaries).
**Unique visitors** are counted from distinct `session_id` on `qr_scan` events. Your QR microsite must `POST /api/log` with `{slug, campaign_id, event_type: "qr_scan", session_id: <per-visitor id>}`. Player impressions alone cannot identify visitors.

## Limits to know
- Supabase free tier: 50 MB per file, 1 GB storage. Keep creatives compressed.
- `/api/log` is unauthenticated by necessity (videotron browsers don't log in). It validates input but has no rate limit; add Vercel Firewall rate limiting before going to production.
- Vercel Hobby plan is for non-commercial use; move to Pro or the planned VPS for paying clients.
