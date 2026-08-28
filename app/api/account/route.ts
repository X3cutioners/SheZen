import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { getSession, clearSessionCookieOptions } from "@/lib/db/auth";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { password_hash } = await req.json();
    if (!password_hash) {
      return NextResponse.json({ error: "Password confirmation required" }, { status: 400 });
    }

    const [user] = await db.select().from(users).where(eq(users.id, session.userId));
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const valid = await bcrypt.compare(password_hash, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    await db.delete(users).where(eq(users.id, session.userId));

    const response = NextResponse.json({ ok: true, message: "Account deleted permanently." });
    response.cookies.set(clearSessionCookieOptions());
    return response;
  } catch (err) {
    console.error("[account DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
