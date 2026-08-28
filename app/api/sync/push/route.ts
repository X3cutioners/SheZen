import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { blobs } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { blobs: incoming } = await req.json();

    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: "blobs must be an array" }, { status: 400 });
    }

    const accepted: string[] = [];

    for (const blob of incoming) {
      const { id, ciphertext, nonce, recordType, updatedAt, deletedAt } = blob;

      if (!id || !ciphertext || !nonce || !updatedAt) continue;

      const incomingUpdatedAt = new Date(updatedAt);

      const [existing] = await db.select({ updatedAt: blobs.updatedAt }).from(blobs).where(eq(blobs.id, id));

      if (existing && existing.updatedAt > incomingUpdatedAt) {
        continue;
      }

      await db
        .insert(blobs)
        .values({
          id,
          userId: session.userId,
          ciphertext,
          nonce,
          recordType: recordType ?? null,
          updatedAt: incomingUpdatedAt,
          deletedAt: deletedAt ? new Date(deletedAt) : null,
        })
        .onConflictDoUpdate({
          target: blobs.id,
          set: {
            ciphertext,
            nonce,
            recordType: recordType ?? null,
            updatedAt: incomingUpdatedAt,
            deletedAt: deletedAt ? new Date(deletedAt) : null,
          },
        });

      accepted.push(id);
    }

    return NextResponse.json({ accepted });
  } catch (err) {
    console.error("[sync/push]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
