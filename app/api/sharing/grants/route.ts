import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sharedAccessGrants } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { data_type, partner_public_key } = await req.json();

    if (!data_type || !partner_public_key) {
      return NextResponse.json({ error: "dataType and partnerPublicKey required" }, { status: 400 });
    }

    const [grant] = await db
      .insert(sharedAccessGrants)
      .values({
        ownerUserId: session.userId,
        dataType: data_type,
        partnerPublicKey: partner_public_key,
        status: "active",
      })
      .returning();

    return NextResponse.json({ grant });
  } catch (err) {
    console.error("[sharing/grants POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const grants = await db
      .select()
      .from(sharedAccessGrants)
      .where(and(eq(sharedAccessGrants.ownerUserId, session.userId), eq(sharedAccessGrants.status, "active")));

    return NextResponse.json({ grants });
  } catch (err) {
    console.error("[sharing/grants GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
