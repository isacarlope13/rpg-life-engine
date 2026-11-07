import { NextResponse } from "next/server";
import { buildAuthSetCookieHeaders, createDemoQuickSession } from "@/lib/auth";

/**
 * POST /api/auth/demo — Sesión demo con datos de ejemplo (motor local en memoria).
 * Deshabilitado en producción.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "El modo demo no está disponible en producción." },
      { status: 403 }
    );
  }
  const { sessionToken } = createDemoQuickSession();
  const res = NextResponse.json({ ok: true });
  for (const header of buildAuthSetCookieHeaders({ localSessionToken: sessionToken })) {
    res.headers.append("Set-Cookie", header);
  }
  return res;
}
