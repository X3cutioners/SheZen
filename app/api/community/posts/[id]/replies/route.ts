import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { replies, anonIdentities, posts } from "@/lib/db/schema";
import { detectCrisisSignals } from "@/lib/moderation/crisis";
import { eq, asc } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;

    const rows = await db
      .select({
        id: replies.id,
        authorAnonId: replies.authorAnonId,
        authorHandle: anonIdentities.anonHandle,
        body: replies.body,
        createdAt: replies.createdAt,
      })
      .from(replies)
      .innerJoin(anonIdentities, eq(replies.authorAnonId, anonIdentities.id))
      .where(eq(replies.postId, postId))
      .orderBy(asc(replies.createdAt));

    return NextResponse.json({
      replies: rows.map((r) => ({
        id: r.id,
        author_anon_id: r.authorAnonId,
        author_handle: r.authorHandle,
        body: r.body,
        created_at: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[community/replies GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: postId } = await params;
    const { author_anon_id, body } = await req.json();

    if (!author_anon_id || !body || !body.trim()) {
      return NextResponse.json({ error: "Author and body required" }, { status: 400 });
    }

    const [identity] = await db
      .select()
      .from(anonIdentities)
      .where(eq(anonIdentities.id, author_anon_id));

    if (!identity || identity.status !== "active") {
      return NextResponse.json({ error: "Invalid community identity" }, { status: 403 });
    }

    const trimmed = body.trim();
    const { isCrisis } = detectCrisisSignals(trimmed);

    const [newReply] = await db
      .insert(replies)
      .values({
        postId,
        authorAnonId: author_anon_id,
        body: trimmed,
        status: "visible",
      })
      .returning();

    return NextResponse.json({
      reply: {
        id: newReply.id,
        author_anon_id: newReply.authorAnonId,
        author_handle: identity.anonHandle,
        body: newReply.body,
        created_at: newReply.createdAt.toISOString(),
      },
      has_crisis_signals: isCrisis,
    });
  } catch (err) {
    console.error("[community/replies POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
