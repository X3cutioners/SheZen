import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { ADJECTIVES, NOUNS } from "@/lib/name-generator";

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function GET() {
  try {
    let candidate = "";
    let attempts = 0;

    while (attempts < 10) {
      const adj = capitalize(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]);
      const noun = capitalize(NOUNS[Math.floor(Math.random() * NOUNS.length)]);
      candidate = `${adj}${noun}`;

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.identifier}) = LOWER(${candidate})`);

      if (existing.length === 0) {
        return NextResponse.json({ username: candidate });
      }

      attempts++;
    }

    const adj = capitalize(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]);
    const noun = capitalize(NOUNS[Math.floor(Math.random() * NOUNS.length)]);
    const suffix = Math.floor(Math.random() * 90 + 10);
    candidate = `${adj}${noun}${suffix}`;

    return NextResponse.json({ username: candidate });
  } catch (err) {
    console.error("[username/generate]", err);
    const adj = capitalize(ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]);
    const noun = capitalize(NOUNS[Math.floor(Math.random() * NOUNS.length)]);
    return NextResponse.json({ username: `${adj}${noun}` });
  }
}
