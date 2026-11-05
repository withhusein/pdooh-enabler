import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/auth";
import { buildReport, type ReportType } from "@/lib/report";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET /api/report?month=2026-11&screen=sudirman-01&type=summary|detail  (admin only) */
export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ?? "";
  const screen = searchParams.get("screen") || undefined;
  const type: ReportType = searchParams.get("type") === "detail" ? "detail" : "summary";

  if (screen && !/^[a-z0-9-]{1,80}$/.test(screen)) {
    return NextResponse.json({ error: "Invalid screen" }, { status: 400 });
  }

  try {
    const { filename, csv } = await buildReport({ month, screenSlug: screen, type });
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build report";
    const client = msg.startsWith("Invalid") || msg.startsWith("No screens");
    if (!client) console.error("[report]", e);
    return NextResponse.json({ error: client ? msg : "Internal error" }, { status: client ? 400 : 500 });
  }
}
