import { NextResponse } from "next/server";
import { buildClearAuthCookieHeaders } from "@/lib/auth";

/** POST /api/auth/logout — borra las cookies de sesión. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  for (const header of buildClearAuthCookieHeaders()) {
    res.headers.append("Set-Cookie", header);
  }
  return res;
}
