import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users, keyWrappings } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const { user_id, new_password_hash, new_wrapped_key_by_password, new_salt } = await req.json();

    if (!user_id || !new_password_hash || !new_wrapped_key_by_password || !new_salt) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, user_id));
    if (!user) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const serverHash = await bcrypt.hash(new_password_hash, 12);

    await db.update(users).set({ passwordHash: serverHash }).where(eq(users.id, user_id));
    await db
      .update(keyWrappings)
      .set({ wrappedKey: new_wrapped_key_by_password, salt: new_salt })
      .where(and(eq(keyWrappings.userId, user_id), eq(keyWrappings.wrappedBy, "password")));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[recovery/reset-password]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
