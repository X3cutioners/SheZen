import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { blobs } from "@/lib/db/schema";
import { getSession } from "@/lib/db/auth";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await db.select().from(blobs).where(eq(blobs.userId, session.userId));

    const exportData = {
      exported_at: new Date().toISOString(),
      user_identifier: session.identifier,
      note: "All records are encrypted. Decryption requires your passcode and the SheZen app.",
      records: rows.map((b) => ({
        id: b.id,
        ciphertext: b.ciphertext,
        nonce: b.nonce,
        record_type: b.recordType,
        updated_at: b.updatedAt.toISOString(),
        deleted_at: b.deletedAt?.toISOString() ?? null,
      })),
    };

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="shezen-export-${Date.now()}.json"`,
      },
    });
  } catch (err) {
    console.error("[export]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
