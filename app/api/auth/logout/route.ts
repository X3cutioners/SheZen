import { NextResponse } from "next/server";
import { clearSessionCookieOptions } from "@/lib/db/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearSessionCookieOptions());
  return response;
}
