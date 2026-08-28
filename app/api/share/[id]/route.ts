import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { sharedReports } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pin = req.nextUrl.searchParams.get("pin");

    const [report] = await db.select().from(sharedReports).where(eq(sharedReports.id, id));

    if (!report) {
      return NextResponse.json({ error: "Report not found or has been revoked." }, { status: 404 });
    }

    // Check expiration
    if (new Date() > new Date(report.expiresAt)) {
      await db.delete(sharedReports).where(eq(sharedReports.id, id));
      return NextResponse.json({ error: "This share link has expired." }, { status: 410 });
    }

    // Check PIN requirement
    if (report.pinHash) {
      if (!pin) {
        return NextResponse.json({
          requires_pin: true,
          share_type: report.shareType,
          data_type: report.dataType,
        }, { status: 401 });
      }

      const validPin = await bcrypt.compare(String(pin), report.pinHash);
      if (!validPin) {
        return NextResponse.json({ error: "Incorrect PIN." }, { status: 403 });
      }
    }

    return NextResponse.json({
      ciphertext: report.ciphertext,
      nonce: report.nonce,
      share_type: report.shareType,
      data_type: report.dataType,
      created_at: report.createdAt.toISOString(),
      expires_at: report.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[share/[id] GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await db.delete(sharedReports).where(eq(sharedReports.id, id));
    return NextResponse.json({ ok: true, message: "Share revoked successfully." });
  } catch (err) {
    console.error("[share/[id] DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
