import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sharedAccessGrants, sharedKeyWrappings, blobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const partnerKey = req.nextUrl.searchParams.get("partner_public_key");
  if (!partnerKey) {
    return NextResponse.json({ error: "partner_public_key required" }, { status: 400 });
  }

  try {
    const activeGrants = await db
      .select()
      .from(sharedAccessGrants)
      .where(and(eq(sharedAccessGrants.partnerPublicKey, partnerKey), eq(sharedAccessGrants.status, "active")));

    return NextResponse.json({ grants: activeGrants });
  } catch (err) {
    console.error("[sharing/incoming]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
