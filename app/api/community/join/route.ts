import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { anonIdentities } from "@/lib/db/schema";
import { ADJECTIVES, NOUNS } from "@/lib/name-generator";
import { eq } from "drizzle-orm";

function generateAnonHandle(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 90 + 10);
  return `${adj}-${noun}-${num}`;
}

export async function POST(req: NextRequest) {
  try {
    const { public_key, avatar, anon_handle: customHandle } = await req.json();

    if (!public_key) {
      return NextResponse.json({ error: "Public key is required for E2E chat" }, { status: 400 });
    }

    let anonHandle = customHandle?.trim() || generateAnonHandle();
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db
        .select({ id: anonIdentities.id })
        .from(anonIdentities)
        .where(eq(anonIdentities.anonHandle, anonHandle));

      if (existing.length === 0) break;
      anonHandle = generateAnonHandle();
      attempts++;
    }

    const [created] = await db
      .insert(anonIdentities)
      .values({
        anonHandle,
        avatar: avatar || "bloom",
        publicKey: public_key,
      })
      .returning({
        id: anonIdentities.id,
        anonHandle: anonIdentities.anonHandle,
        avatar: anonIdentities.avatar,
      });

    return NextResponse.json({
      anon_id: created.id,
      anon_handle: created.anonHandle,
      avatar: created.avatar,
    });
  } catch (err) {
    console.error("[community/join]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
