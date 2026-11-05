-- pDOOH Enabler schema. Run in Supabase SQL Editor (or `supabase db push`).
create extension if not exists "pgcrypto";

-- ---------- Profiles (admins/users) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null default 'viewer' check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- ---------- Screens (Media Owner locations) ----------
create table if not exists public.screens (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  media_owner text,
  address text,
  latitude double precision,
  longitude double precision,
  timezone text not null default 'Asia/Jakarta',
  qr_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Campaigns ----------
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references public.screens(id) on delete cascade,
  name text not null,
  brand text,
  trigger_type text not null default 'default'
    check (trigger_type in ('default', 'weather', 'sports', 'financial', 'time')),
  trigger_config jsonb not null default '{}'::jsonb,
  creative_path text not null,
  creative_url text not null,
  creative_type text not null check (creative_type in ('image', 'video')),
  duration_seconds int not null default 15 check (duration_seconds between 3 and 300),
  priority int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists campaigns_screen_idx on public.campaigns (screen_id, is_active);

-- ---------- Impression / Proof-of-Play logs ----------
create table if not exists public.impression_logs (
  id bigint generated always as identity primary key,
  screen_id uuid not null references public.screens(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  event_type text not null default 'impression' check (event_type in ('impression', 'qr_scan')),
  played_at timestamptz not null default now(),
  duration_seconds int,
  session_id text,
  trigger_snapshot jsonb
);
create index if not exists logs_screen_time_idx on public.impression_logs (screen_id, played_at);
create index if not exists logs_campaign_idx on public.impression_logs (campaign_id);

-- ---------- Row Level Security ----------
-- Player/log/report APIs use the service role (bypasses RLS). Browser clients are admin-only.
alter table public.profiles enable row level security;
alter table public.screens enable row level security;
alter table public.campaigns enable row level security;
alter table public.impression_logs enable row level security;

drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select using (id = auth.uid() or public.is_admin());

drop policy if exists "screens admin all" on public.screens;
create policy "screens admin all" on public.screens for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "campaigns admin all" on public.campaigns;
create policy "campaigns admin all" on public.campaigns for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "logs admin read" on public.impression_logs;
create policy "logs admin read" on public.impression_logs for select using (public.is_admin());

-- ---------- Storage ----------
-- Public bucket so the player streams creatives straight from the Supabase CDN.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creatives', 'creatives', true, 52428800,
        array['video/mp4', 'video/webm', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "creatives admin insert" on storage.objects;
create policy "creatives admin insert" on storage.objects for insert
  with check (bucket_id = 'creatives' and public.is_admin());
drop policy if exists "creatives admin update" on storage.objects;
create policy "creatives admin update" on storage.objects for update
  using (bucket_id = 'creatives' and public.is_admin());
drop policy if exists "creatives admin delete" on storage.objects;
create policy "creatives admin delete" on storage.objects for delete
  using (bucket_id = 'creatives' and public.is_admin());

-- ---------- Promote your first admin ----------
-- 1) Create the user in Supabase Auth > Users, then run:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
