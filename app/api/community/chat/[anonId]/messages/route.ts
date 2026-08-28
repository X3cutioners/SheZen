import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { chatMessages, anonIdentities } from "@/lib/db/schema";
import { or, and, eq, asc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ anonId: string }> }
) {
  try {
    const { anonId: peerAnonId } = await params;
    const myAnonId = req.nextUrl.searchParams.get("my_anon_id");

    if (!myAnonId || !peerAnonId) {
      return NextResponse.json({ error: "Both identity IDs required" }, { status: 400 });
    }

    // Fetch peer's public key
    const [peer] = await db
      .select({
        id: anonIdentities.id,
        anonHandle: anonIdentities.anonHandle,
        publicKey: anonIdentities.publicKey,
      })
      .from(anonIdentities)
      .where(eq(anonIdentities.id, peerAnonId));

    if (!peer) {
      return NextResponse.json({ error: "Peer not found" }, { status: 404 });
    }

    // Fetch ciphertext messages
    const messages = await db
      .select()
      .from(chatMessages)
      .where(
        or(
          and(eq(chatMessages.senderAnonId, myAnonId), eq(chatMessages.recipientAnonId, peerAnonId)),
          and(eq(chatMessages.senderAnonId, peerAnonId), eq(chatMessages.recipientAnonId, myAnonId))
        )
      )
      .orderBy(asc(chatMessages.createdAt))
      .limit(100);

    return NextResponse.json({
      peer: {
        id: peer.id,
        anon_handle: peer.anonHandle,
        public_key: peer.publicKey,
      },
      messages: messages.map((m) => ({
        id: m.id,
        sender_anon_id: m.senderAnonId,
        recipient_anon_id: m.recipientAnonId,
        ciphertext: m.ciphertext,
        nonce: m.nonce,
        created_at: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[community/chat GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ anonId: string }> }
) {
  try {
    const { anonId: recipientAnonId } = await params;
    const { sender_anon_id, ciphertext, nonce } = await req.json();

    if (!sender_anon_id || !recipientAnonId || !ciphertext || !nonce) {
      return NextResponse.json({ error: "Missing required message parameters" }, { status: 400 });
    }

    const [newMsg] = await db
      .insert(chatMessages)
      .values({
        senderAnonId: sender_anon_id,
        recipientAnonId,
        ciphertext,
        nonce,
      })
      .returning();

    return NextResponse.json({
      message: {
        id: newMsg.id,
        sender_anon_id: newMsg.senderAnonId,
        recipient_anon_id: newMsg.recipientAnonId,
        ciphertext: newMsg.ciphertext,
        nonce: newMsg.nonce,
        created_at: newMsg.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[community/chat POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
