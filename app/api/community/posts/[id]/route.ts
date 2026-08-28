import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { posts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { author_anon_id } = await req.json();

    if (!id || !author_anon_id) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(posts)
      .where(and(eq(posts.id, id), eq(posts.authorAnonId, author_anon_id)))
      .returning({ id: posts.id });

    if (!deleted) {
      return NextResponse.json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[community/posts DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
