import { createClient } from "@/lib/supabase/server";
import ReportForm from "./ReportForm";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: screens } = await supabase.from("screens").select("slug, name").order("name");
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Monthly Report</h1>
      <p className="text-sm text-slate-400">
        Summary: total traffic, unique visitors, dan peak hours. Detail: seluruh log Proof-of-Play per penayangan.
      </p>
      <ReportForm screens={screens ?? []} />
    </div>
  );
}
