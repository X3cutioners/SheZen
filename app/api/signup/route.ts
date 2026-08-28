import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, keyWrappings } from "@/lib/db/schema";
import { createSession, sessionCookieOptions } from "@/lib/db/auth";
import bcrypt from "bcryptjs";
import { sql, eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      identifier: customIdentifier,
      name,
      password_hash,
      wrapped_key_by_password,
      password_salt,
      wrapped_key_by_recovery,
      recovery_salt,
    } = body;

    if (!password_hash || !wrapped_key_by_password || !password_salt || !wrapped_key_by_recovery || !recovery_salt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const chosenName = (customIdentifier || name || "").trim();
    let identifier = chosenName;

    if (identifier) {
      // Check if chosen name is already registered (case-insensitive)
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.identifier}) = LOWER(${identifier})`);

      if (existing.length > 0) {
        return NextResponse.json(
          { error: `The name "${identifier}" is already registered. Please choose another name.` },
          { status: 409 }
        );
      }
    } else {
      identifier = `User-${Math.floor(Math.random() * 90000 + 10000)}`;
    }

    // Double-hash: client sent a hashed password, we bcrypt it again server-side.
    const serverHash = await bcrypt.hash(password_hash, 12);

    // Create user.
    const [user] = await db.insert(users).values({
      identifier,
      passwordHash: serverHash,
    }).returning({ id: users.id, identifier: users.identifier });

    // Store both wrapped key variants.
    await db.insert(keyWrappings).values([
      {
        userId: user.id,
        wrappedBy: "password",
        wrappedKey: wrapped_key_by_password,
        salt: password_salt,
      },
      {
        userId: user.id,
        wrappedBy: "recovery",
        wrappedKey: wrapped_key_by_recovery,
        salt: recovery_salt,
      },
    ]);

    // Create session.
    const token = await createSession({ userId: user.id, identifier: user.identifier });
    const response = NextResponse.json({ identifier: user.identifier, user_id: user.id });
    response.cookies.set(sessionCookieOptions(token));
    return response;
  } catch (err) {
    console.error("[signup]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
