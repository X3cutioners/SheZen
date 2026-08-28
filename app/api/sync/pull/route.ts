import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { blobs } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import { eq, and, gte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const sinceParam = req.nextUrl.searchParams.get("since");
    const recordType = req.nextUrl.searchParams.get("record_type");

    const conditions = [eq(blobs.userId, session.userId)];
    if (sinceParam) {
      conditions.push(gte(blobs.updatedAt, new Date(sinceParam)));
    }
    if (recordType) {
      conditions.push(eq(blobs.recordType, recordType));
    }

    const rows = await db
      .select()
      .from(blobs)
      .where(and(...conditions));

    return NextResponse.json({
      blobs: rows.map((b) => ({
        id: b.id,
        ciphertext: b.ciphertext,
        nonce: b.nonce,
        record_type: b.recordType,
        updated_at: b.updatedAt.toISOString(),
        deleted_at: b.deletedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    console.error("[sync/pull]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
