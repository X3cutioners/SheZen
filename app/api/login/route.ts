import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, keyWrappings } from "@/lib/db/schema";
import { createSession, sessionCookieOptions } from "@/lib/db/auth";
import bcrypt from "bcryptjs";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { identifier, password } = await req.json();

    if (!identifier || !password) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const trimmed = identifier.trim();
    const [user] = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.identifier}) = LOWER(${trimmed})`);
    if (!user) {
      await bcrypt.compare(password, "$2b$12$invalidhashpadding000000000000000000000000000000000000");
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const [wrapping] = await db
      .select()
      .from(keyWrappings)
      .where(and(eq(keyWrappings.userId, user.id), eq(keyWrappings.wrappedBy, "password")));

    if (!wrapping) {
      return NextResponse.json({ error: "Key data not found" }, { status: 500 });
    }

    const token = await createSession({ userId: user.id, identifier: user.identifier });
    const response = NextResponse.json({
      user_id: user.id,
      salt: wrapping.salt,
      wrapped_key_by_password: wrapping.wrappedKey,
    });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
