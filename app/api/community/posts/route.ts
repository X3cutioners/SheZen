import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { posts, replies, anonIdentities } from "@/lib/db/schema";
import { detectCrisisSignals } from "@/lib/moderation/crisis";
import { eq, desc, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const rows = await db
      .select({
        id: posts.id,
        authorAnonId: posts.authorAnonId,
        authorHandle: anonIdentities.anonHandle,
        authorAvatar: anonIdentities.avatar,
        category: posts.category,
        moodTag: posts.moodTag,
        reactions: posts.reactions,
        body: posts.body,
        status: posts.status,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .innerJoin(anonIdentities, eq(posts.authorAnonId, anonIdentities.id))
      .where(eq(posts.status, "visible"))
      .orderBy(desc(posts.createdAt))
      .limit(50);

    const postIds = rows.map((r) => r.id);
    const replyCountMap: Record<string, number> = {};

    if (postIds.length > 0) {
      const replyCounts = await db
        .select({
          postId: replies.postId,
          count: sql<number>`count(*)::int`,
        })
        .from(replies)
        .where(eq(replies.status, "visible"))
        .groupBy(replies.postId);

      for (const rc of replyCounts) {
        replyCountMap[rc.postId] = rc.count;
      }
    }

    return NextResponse.json({
      posts: rows.map((p) => ({
        id: p.id,
        author_anon_id: p.authorAnonId,
        author_handle: p.authorHandle,
        author_avatar: p.authorAvatar || "bloom",
        category: p.category || "general",
        mood_tag: p.moodTag || null,
        reactions: p.reactions ? JSON.parse(p.reactions) : { hug: 0, relate: 0, helpful: 0, strength: 0 },
        body: p.body,
        created_at: p.createdAt.toISOString(),
        reply_count: replyCountMap[p.id] || 0,
      })),
    });
  } catch (err) {
    console.error("[community/posts GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { author_anon_id, body, category, mood_tag } = await req.json();

    if (!author_anon_id || !body || !body.trim()) {
      return NextResponse.json({ error: "Author and body are required" }, { status: 400 });
    }

    const [identity] = await db
      .select()
      .from(anonIdentities)
      .where(eq(anonIdentities.id, author_anon_id));

    if (!identity || identity.status !== "active") {
      return NextResponse.json({ error: "Invalid or inactive community identity" }, { status: 403 });
    }

    const trimmed = body.trim();
    if (trimmed.length > 1000) {
      return NextResponse.json({ error: "Post exceeds maximum length (1,000 characters)" }, { status: 400 });
    }

    const { isCrisis } = detectCrisisSignals(trimmed);

    const initialReactions = JSON.stringify({ hug: 0, relate: 0, helpful: 0, strength: 0 });

    const [newPost] = await db
      .insert(posts)
      .values({
        authorAnonId: author_anon_id,
        body: trimmed,
        category: category || "general",
        moodTag: mood_tag || null,
        reactions: initialReactions,
        status: "visible",
      })
      .returning();

    return NextResponse.json({
      post: {
        id: newPost.id,
        author_anon_id: newPost.authorAnonId,
        author_handle: identity.anonHandle,
        author_avatar: identity.avatar || "bloom",
        category: newPost.category,
        mood_tag: newPost.moodTag,
        reactions: { hug: 0, relate: 0, helpful: 0, strength: 0 },
        body: newPost.body,
        created_at: newPost.createdAt.toISOString(),
        reply_count: 0,
      },
      has_crisis_signals: isCrisis,
    });
  } catch (err) {
    console.error("[community/posts POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
