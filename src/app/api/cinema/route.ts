import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import type { CinemaEntry, CinemaEntryStatus, CinemaMediaKind } from "@/lib/sanctuary/cinema-store";

interface DbCinemaRow {
  id: string;
  title: string;
  kind: CinemaMediaKind;
  status: CinemaEntryStatus;
  rating: number | null;
  season: number | null;
  episode: number | null;
  favorite_song_or_scene: string | null;
  notes: string | null;
  watched_at: string | null;
  created_at: string;
  updated_at: string;
}

function mapRowToEntry(row: DbCinemaRow): CinemaEntry {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    rating: row.rating ?? undefined,
    season: row.season ?? undefined,
    episode: row.episode ?? undefined,
    favoriteSongOrScene: row.favorite_song_or_scene ?? undefined,
    notes: row.notes || "",
    watchedAt: row.watched_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  if (mode !== "supabase" || !db) {
    return NextResponse.json({ success: true, synced: false, entries: [] });
  }

  const { data, error } = await db
    .from("cinema_entries")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({
      success: true,
      synced: false,
      entries: [],
      notice: "Tabla cinema_entries aún pendiente de ejecutar en Supabase.",
    });
  }

  return NextResponse.json({
    success: true,
    synced: true,
    entries: ((data as DbCinemaRow[]) || []).map(mapRowToEntry),
  });
}

export async function POST(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  let body: Partial<CinemaEntry>;
  try {
    body = (await req.json()) as Partial<CinemaEntry>;
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido." }, { status: 400 });
  }

  const title = (body.title || "").trim();
  const kind = body.kind;
  const status: CinemaEntryStatus = body.status || "watchlist";
  if (!title || !kind || !["movie", "series", "musical"].includes(kind)) {
    return NextResponse.json({ success: false, error: "Título y tipo válido requeridos." }, { status: 400 });
  }

  if (mode !== "supabase" || !db) {
    return NextResponse.json({ success: true, synced: false });
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("cinema_entries")
    .insert({
      user_id: userId,
      title,
      kind,
      status,
      rating: body.rating ?? null,
      season: kind === "series" ? body.season ?? 1 : null,
      episode: kind === "series" ? body.episode ?? 0 : null,
      favorite_song_or_scene: body.favoriteSongOrScene || null,
      notes: (body.notes || "").trim(),
      watched_at: status === "watched" || status === "favorite" ? body.watchedAt || now : null,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error || !data) {
    return NextResponse.json({ success: true, synced: false });
  }

  return NextResponse.json({
    success: true,
    synced: true,
    entry: mapRowToEntry(data as DbCinemaRow),
  });
}

export async function PATCH(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  let body: { id?: string; status?: CinemaEntryStatus; season?: number; episode?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido." }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ success: false, error: "id requerido." }, { status: 400 });
  }

  if (mode !== "supabase" || !db || body.id.startsWith("cine-")) {
    return NextResponse.json({ success: true, synced: false });
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = { updated_at: now };
  if (body.status) {
    updatePayload.status = body.status;
    if (body.status === "watched" || body.status === "favorite") {
      updatePayload.watched_at = now;
    }
  }
  if (typeof body.season === "number") updatePayload.season = body.season;
  if (typeof body.episode === "number") updatePayload.episode = body.episode;

  const { error } = await db
    .from("cinema_entries")
    .update(updatePayload)
    .eq("id", body.id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true, synced: !error });
}

export async function DELETE(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "id requerido." }, { status: 400 });
  }

  if (mode !== "supabase" || !db || id.startsWith("cine-")) {
    return NextResponse.json({ success: true, synced: false });
  }

  const { error } = await db
    .from("cinema_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true, synced: !error });
}
