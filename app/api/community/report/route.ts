import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { reports } from "@/lib/db/schema";

export async function POST(req: NextRequest) {
  try {
    const { reporter_anon_id, target_type, target_id, reason, reported_content } = await req.json();

    if (!reporter_anon_id || !target_type || !target_id || !reason) {
      return NextResponse.json({ error: "Missing required report fields" }, { status: 400 });
    }

    const [report] = await db
      .insert(reports)
      .values({
        reporterAnonId: reporter_anon_id,
        targetType: target_type,
        targetId: target_id,
        reason,
        reportedContent: reported_content ?? null,
      })
      .returning();

    return NextResponse.json({ ok: true, report_id: report.id });
  } catch (err) {
    console.error("[community/report]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
