import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sharedReports } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ reports: [] });
    }

    const reports = await db
      .select({
        id: sharedReports.id,
        share_type: sharedReports.shareType,
        data_type: sharedReports.dataType,
        created_at: sharedReports.createdAt,
        expires_at: sharedReports.expiresAt,
        has_pin: sharedReports.pinHash,
      })
      .from(sharedReports)
      .where(eq(sharedReports.userId, session.userId))
      .orderBy(desc(sharedReports.createdAt));

    return NextResponse.json({
      reports: reports.map((r) => ({
        id: r.id,
        share_type: r.share_type,
        data_type: r.data_type,
        created_at: r.created_at.toISOString(),
        expires_at: r.expires_at.toISOString(),
        has_pin: !!r.has_pin,
        is_expired: new Date() > new Date(r.expires_at),
      })),
    });
  } catch (err) {
    console.error("[share/list]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
