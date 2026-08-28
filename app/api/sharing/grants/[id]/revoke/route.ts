import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sharedAccessGrants } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import { eq, and } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;

    const [revoked] = await db
      .update(sharedAccessGrants)
      .set({
        status: "revoked",
        revokedAt: new Date(),
      })
      .where(and(eq(sharedAccessGrants.id, id), eq(sharedAccessGrants.ownerUserId, session.userId)))
      .returning();

    if (!revoked) {
      return NextResponse.json({ error: "Grant not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      message: "Grant revoked. Partner will stop receiving new entries. Any previously synced records may still exist on their device.",
    });
  } catch (err) {
    console.error("[sharing/grants/revoke]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
