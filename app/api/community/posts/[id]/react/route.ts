import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { reaction } = await req.json();

    if (!id || !reaction) {
      return NextResponse.json({ error: "id and reaction required" }, { status: 400 });
    }

    const [post] = await db.select().from(posts).where(eq(posts.id, id));
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const current = post.reactions ? JSON.parse(post.reactions) : { hug: 0, relate: 0, helpful: 0, strength: 0 };
    current[reaction] = (current[reaction] || 0) + 1;

    await db
      .update(posts)
      .set({ reactions: JSON.stringify(current) })
      .where(eq(posts.id, id));

    return NextResponse.json({ reactions: current });
  } catch (err) {
    console.error("[community/posts/react]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
