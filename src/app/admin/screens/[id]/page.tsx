import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Campaign, Screen } from "@/types";
import CampaignForm from "./CampaignForm";
import CampaignList from "./CampaignList";
import ScreenActions from "./ScreenActions";

export const dynamic = "force-dynamic";

export default async function ScreenDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data: screen } = await supabase.from("screens").select("*").eq("id", id).maybeSingle();
  if (!screen) notFound();
  const s = screen as Screen;
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("screen_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link href="/admin" className="text-sm text-slate-400 hover:text-slate-200">← Semua layar</Link>
        <h1 className="mt-1 text-2xl font-bold">{s.name}</h1>
        <p className="text-sm text-slate-400">{s.media_owner ?? "-"} {s.address ? `• ${s.address}` : ""}</p>
      </div>

      <ScreenActions screen={s} />

      <section className="space-y-3">
        <h2 className="font-semibold">Campaign ({campaigns?.length ?? 0})</h2>
        <CampaignList campaigns={(campaigns ?? []) as Campaign[]} />
      </section>

      <CampaignForm screenId={s.id} />
    </div>
  );
}
