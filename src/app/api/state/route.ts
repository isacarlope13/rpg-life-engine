import { NextResponse } from "next/server";
import {
  buildAuthSetCookieHeaders,
  getUserStore,
  resolveAuthenticatedUser,
} from "@/lib/auth";
import {
  buildLocalFallbackState,
  buildSupabaseEngineState,
} from "@/lib/state-builder";

export async function GET(req: Request) {
  // El estado SIEMPRE pertenece al usuario de la sesión: nunca a un usuario por defecto.
  const session = await resolveAuthenticatedUser(req);
  if (!session) {
    return NextResponse.json(
      { error: "No autenticado", code: "UNAUTHENTICATED" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const userStore = getUserStore(session.userId);
  let state: ReturnType<typeof buildLocalFallbackState> | Awaited<
    ReturnType<typeof buildSupabaseEngineState>
  >;

  if (session.mode === "supabase" && session.userClient) {
    try {
      state =
        (await buildSupabaseEngineState({
          userId: session.userId,
          email: session.email,
          displayName: session.displayName,
          characterClass: session.characterClass,
          db: session.userClient,
          userStore,
        })) ||
        buildLocalFallbackState(
          userStore,
          "No se encontró tu tesorería en Supabase (revisa supabase/auth_profiles.sql y supabase/seed.sql)"
        );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Error de conexión a Supabase";
      state = buildLocalFallbackState(userStore, message);
    }
  } else {
    state = buildLocalFallbackState(userStore);
  }

  const res = NextResponse.json(
    {
      ...state,
      user: {
        id: session.userId,
        email: session.email,
        display_name: session.displayName,
        character_class: session.characterClass,
        avatar_url: session.avatarUrl,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );

  if (session.refreshedTokens) {
    for (const header of buildAuthSetCookieHeaders({
      accessToken: session.refreshedTokens.accessToken,
      refreshToken: session.refreshedTokens.refreshToken,
    })) {
      res.headers.append("Set-Cookie", header);
    }
  }
  return res;
}
