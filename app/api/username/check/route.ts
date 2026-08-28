import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();

  if (!name || name.length < 2) {
    return NextResponse.json({ available: false, error: "Name must be at least 2 characters." });
  }

  if (name.length > 32) {
    return NextResponse.json({ available: false, error: "Name must be 32 characters or fewer." });
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`LOWER(${users.identifier}) = LOWER(${name})`);

    if (existing.length > 0) {
      return NextResponse.json({ available: false, error: "This name is already registered." });
    }

    return NextResponse.json({ available: true });
  } catch (err) {
    console.error("[username/check]", err);
    return NextResponse.json({ available: true });
  }
}
