import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchLiveMatches, fetchRates, fetchWeather, resolvePlaylist } from "@/lib/triggers";
import type { Campaign, PlayerPayload, TriggerContext } from "@/types";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(id)) {
    return NextResponse.json({ error: "Invalid screen id" }, { status: 400, headers: NO_STORE });
  }

  try {
    const db = createAdminClient();
    const { data: screen, error } = await db
      .from("screens")
      .select("id, slug, name, qr_url, latitude, longitude, timezone, is_active")
      .eq("slug", id)
      .maybeSingle();
    if (error) throw error;
    if (!screen || !screen.is_active) {
      return NextResponse.json({ error: "Screen not found" }, { status: 404, headers: NO_STORE });
    }

    const { data: campaigns, error: cErr } = await db
      .from("campaigns")
      .select("*")
      .eq("screen_id", screen.id)
      .eq("is_active", true);
    if (cErr) throw cErr;
    const list = (campaigns ?? []) as Campaign[];

    // Only call the external APIs that this screen's campaigns actually use.
    const types = new Set(list.map((c) => c.trigger_type));
    const [weather, matches, financial] = await Promise.all([
      types.has("weather") && screen.latitude != null && screen.longitude != null
        ? fetchWeather(screen.latitude, screen.longitude)
        : null,
      types.has("sports") ? fetchLiveMatches() : null,
      types.has("financial") ? fetchRates() : null,
    ]);

    const ctx: TriggerContext = { now: new Date().toISOString(), weather, matches, financial };
    const payload: PlayerPayload = {
      screen: { slug: screen.slug, name: screen.name, qr_url: screen.qr_url },
      playlist: resolvePlaylist(list, ctx, screen.timezone),
      generated_at: ctx.now,
    };
    return NextResponse.json(payload, { headers: NO_STORE });
  } catch (e) {
    console.error("[player]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500, headers: NO_STORE });
  }
}
