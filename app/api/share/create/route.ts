import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sharedReports } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import bcrypt from "bcryptjs";

function generateSlug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let slug = "";
  for (let i = 0; i < 10; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const { share_type, data_type, ciphertext, nonce, expires_hours = 48, pin } = await req.json();

    if (!share_type || !data_type || !ciphertext || !nonce) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const id = generateSlug();
    const expiresAt = new Date(Date.now() + (Number(expires_hours) || 48) * 3600 * 1000);
    const pinHash = pin ? await bcrypt.hash(String(pin), 10) : null;

    await db.insert(sharedReports).values({
      id,
      userId: session?.userId ?? null,
      shareType: share_type,
      dataType: data_type,
      ciphertext,
      nonce,
      pinHash,
      expiresAt,
    });

    return NextResponse.json({
      id,
      share_type,
      data_type,
      expires_at: expiresAt.toISOString(),
      requires_pin: !!pin,
    });
  } catch (err) {
    console.error("[share/create]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
