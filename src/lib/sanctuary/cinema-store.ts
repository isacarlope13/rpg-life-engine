import { isOfflineOwner } from "../offline-owner.ts";
import { safeLocalStorage } from "../storage-safe.ts";
import type { SessionStorage } from "./session-storage.ts";

export type CinemaMediaKind = "movie" | "series" | "musical";
export type CinemaEntryStatus = "watching" | "watchlist" | "watched" | "favorite";

export interface CinemaEntry {
  id: string;
  title: string;
  kind: CinemaMediaKind;
  status: CinemaEntryStatus;
  rating?: number; // 1-5 opcional
  season?: number;
  episode?: number;
  favoriteSongOrScene?: string;
  notes: string;
  watchedAt?: string;
  createdAt: string;
  updatedAt: string;
}

function storageKey(owner: string): string {
  return `oakhaven_cinema_catalog_v1_${encodeURIComponent(owner)}`;
}

function isValidEntry(value: unknown): value is CinemaEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Record<string, unknown>;
  const validKinds = ["movie", "series", "musical"];
  const validStatuses = ["watching", "watchlist", "watched", "favorite"];
  return (
    typeof e.id === "string" &&
    typeof e.title === "string" &&
    validKinds.includes(String(e.kind)) &&
    validStatuses.includes(String(e.status)) &&
    typeof e.notes === "string" &&
    typeof e.createdAt === "string" &&
    typeof e.updatedAt === "string"
  );
}

function isValidPayload(value: unknown, owner: string): value is { ownerId: string; entries: CinemaEntry[] } {
  if (!value || typeof value !== "object") return false;
  const data = value as { ownerId?: unknown; entries?: unknown };
  return data.ownerId === owner && Array.isArray(data.entries) && data.entries.every(isValidEntry);
}

export function readCinemaEntries(storage: SessionStorage, owner?: string): CinemaEntry[] {
  if (!isOfflineOwner(owner)) return [];
  try {
    const raw = storage.getItem(storageKey(owner));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return isValidPayload(parsed, owner) ? parsed.entries : [];
  } catch {
    return [];
  }
}

export function saveCinemaEntries(
  storage: SessionStorage,
  owner: string | undefined,
  entries: CinemaEntry[]
): { ok: boolean; error?: string; entries: CinemaEntry[] } {
  if (!isOfflineOwner(owner)) {
    return { ok: false, error: "Inicia sesión para guardar tu catálogo de Cine.", entries: [] };
  }
  try {
    const ok = storage.setItem(storageKey(owner), JSON.stringify({ ownerId: owner, entries }));
    if (ok === false) {
      return { ok: false, error: "No se pudo escribir en almacenamiento local.", entries };
    }
    return { ok: true, entries };
  } catch {
    return { ok: false, error: "Error al guardar tu catálogo de Cine.", entries };
  }
}

export function createCinemaEntry(input: {
  title: string;
  kind: CinemaMediaKind;
  status?: CinemaEntryStatus;
  rating?: number;
  season?: number;
  episode?: number;
  favoriteSongOrScene?: string;
  notes?: string;
}): CinemaEntry {
  const cleanTitle = input.title.trim();
  if (!cleanTitle) {
    throw new Error("El título es obligatorio.");
  }
  const now = new Date().toISOString();
  const status: CinemaEntryStatus = input.status || "watchlist";
  return {
    id: `cine-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: cleanTitle,
    kind: input.kind,
    status,
    rating: input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : undefined,
    season: input.kind === "series" ? Math.max(1, Math.round(input.season || 1)) : undefined,
    episode: input.kind === "series" ? Math.max(0, Math.round(input.episode || 0)) : undefined,
    favoriteSongOrScene: input.favoriteSongOrScene?.trim() || undefined,
    notes: (input.notes || "").trim(),
    watchedAt: status === "watched" || status === "favorite" ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export function incrementSeriesEpisode(entries: CinemaEntry[], entryId: string): CinemaEntry[] {
  const now = new Date().toISOString();
  return entries.map((e) => {
    if (e.id !== entryId || e.kind !== "series") return e;
    return {
      ...e,
      status: e.status === "watchlist" ? "watching" : e.status,
      season: e.season || 1,
      episode: (e.episode || 0) + 1,
      updatedAt: now,
    };
  });
}

export function updateCinemaEntryStatus(
  entries: CinemaEntry[],
  entryId: string,
  status: CinemaEntryStatus
): CinemaEntry[] {
  const now = new Date().toISOString();
  return entries.map((e) => {
    if (e.id !== entryId) return e;
    return {
      ...e,
      status,
      watchedAt: status === "watched" || status === "favorite" ? e.watchedAt || now : e.watchedAt,
      updatedAt: now,
    };
  });
}

export function readCinemaEntriesSafe(owner?: string): CinemaEntry[] {
  return readCinemaEntries(safeLocalStorage, owner);
}

export function saveCinemaEntriesSafe(owner: string | undefined, entries: CinemaEntry[]) {
  return saveCinemaEntries(safeLocalStorage, owner, entries);
}
