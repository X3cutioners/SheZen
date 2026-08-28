import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, keyWrappings } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const identifier = req.nextUrl.searchParams.get("identifier");
  if (!identifier) {
    return NextResponse.json({ error: "identifier required" }, { status: 400 });
  }

  try {
    const trimmed = identifier.trim();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.identifier}) = LOWER(${trimmed})`);
    if (!user) {
      return NextResponse.json({ salt: "not-found" }, { status: 200 });
    }

    const [wrapping] = await db
      .select({ salt: keyWrappings.salt })
      .from(keyWrappings)
      .where(and(eq(keyWrappings.userId, user.id), eq(keyWrappings.wrappedBy, "password")));

    return NextResponse.json({ salt: wrapping?.salt ?? "not-found" });
  } catch (err) {
    console.error("[salt]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
