import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

/** Proof-of-Play endpoint. Called by the player each time a creative starts (or a QR is scanned). */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug : "";
  const campaignId = typeof body.campaign_id === "string" && UUID.test(body.campaign_id) ? body.campaign_id : null;
  const eventType = body.event_type === "qr_scan" ? "qr_scan" : "impression";
  const duration = Number.isFinite(body.duration_seconds) ? Math.max(0, Math.min(600, Number(body.duration_seconds))) : null;
  const sessionId = typeof body.session_id === "string" ? body.session_id.slice(0, 64) : null;
  const snapshot = body.trigger_snapshot && typeof body.trigger_snapshot === "object" ? body.trigger_snapshot : null;

  if (!/^[a-z0-9-]{1,80}$/.test(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data: screen } = await db.from("screens").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!screen) return NextResponse.json({ error: "Screen not found" }, { status: 404 });

    const { error } = await db.from("impression_logs").insert({
      screen_id: screen.id,
      campaign_id: campaignId,
      event_type: eventType,
      duration_seconds: duration,
      session_id: sessionId,
      trigger_snapshot: snapshot,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[log]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
