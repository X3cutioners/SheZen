import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { blobs } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import { and, eq, inArray } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids must be a non-empty array" }, { status: 400 });
    }

    await db
      .update(blobs)
      .set({ deletedAt: new Date() })
      .where(and(eq(blobs.userId, session.userId), inArray(blobs.id, ids)));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[sync/delete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
