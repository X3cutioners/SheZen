import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, keyWrappings } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { identifier } = await req.json();

    if (!identifier) {
      return NextResponse.json({ error: "Missing identifier" }, { status: 400 });
    }

    const trimmed = identifier.trim();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.identifier}) = LOWER(${trimmed})`);
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [wrapping] = await db
      .select({ salt: keyWrappings.salt, wrappedKey: keyWrappings.wrappedKey })
      .from(keyWrappings)
      .where(and(eq(keyWrappings.userId, user.id), eq(keyWrappings.wrappedBy, "recovery")));

    if (!wrapping) {
      return NextResponse.json({ error: "Recovery key not found" }, { status: 404 });
    }

    return NextResponse.json({
      salt: wrapping.salt,
      wrapped_key_by_recovery: wrapping.wrappedKey,
    });
  } catch (err) {
    console.error("[recovery/unlock]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
