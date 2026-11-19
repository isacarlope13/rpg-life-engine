import { isOfflineOwner } from "../offline-owner.ts";
import { safeLocalStorage } from "../storage-safe.ts";
import type { SessionStorage } from "./session-storage.ts";

export interface AtelierPatternImage {
  id: string;
  name: string;
  dataUrl: string;
  addedAt: string;
}

export interface AtelierProjectPattern {
  projectId: string;
  title: string;
  steps: string[];
  notes: string;
  externalUrl?: string;
  images: AtelierPatternImage[];
  updatedAt: string;
}

type PatternsMap = Record<string, AtelierProjectPattern>;

const MAX_IMAGES_PER_PROJECT = 6;
const MAX_IMAGE_DATA_URL_LENGTH = 900_000; // ~650KB base64 seguro para localStorage

function storageKey(owner: string): string {
  return `oakhaven_atelier_patterns_v1_${encodeURIComponent(owner)}`;
}

function isValidImage(value: unknown): value is AtelierPatternImage {
  if (!value || typeof value !== "object") return false;
  const img = value as Record<string, unknown>;
  return (
    typeof img.id === "string" &&
    typeof img.name === "string" &&
    typeof img.dataUrl === "string" &&
    img.dataUrl.startsWith("data:image/") &&
    img.dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH &&
    typeof img.addedAt === "string"
  );
}

function isValidPattern(value: unknown): value is AtelierProjectPattern {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.projectId === "string" &&
    typeof p.title === "string" &&
    Array.isArray(p.steps) &&
    p.steps.every((s) => typeof s === "string") &&
    typeof p.notes === "string" &&
    (p.externalUrl === undefined || typeof p.externalUrl === "string") &&
    Array.isArray(p.images) &&
    p.images.every(isValidImage) &&
    typeof p.updatedAt === "string"
  );
}

function isValidPayload(value: unknown, owner: string): value is { ownerId: string; patterns: PatternsMap } {
  if (!value || typeof value !== "object") return false;
  const data = value as { ownerId?: unknown; patterns?: unknown };
  if (data.ownerId !== owner || !data.patterns || typeof data.patterns !== "object") return false;
  return Object.values(data.patterns as Record<string, unknown>).every(isValidPattern);
}

export function readAtelierPatterns(storage: SessionStorage, owner?: string): PatternsMap {
  if (!isOfflineOwner(owner)) return {};
  try {
    const raw = storage.getItem(storageKey(owner));
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isValidPayload(parsed, owner) ? parsed.patterns : {};
  } catch {
    return {};
  }
}

export function saveAtelierPattern(
  storage: SessionStorage,
  owner: string | undefined,
  pattern: AtelierProjectPattern
): { ok: boolean; error?: string; patterns: PatternsMap } {
  if (!isOfflineOwner(owner)) {
    return { ok: false, error: "Inicia sesión para guardar patrones en tu Atelier.", patterns: {} };
  }
  const cleanImages = pattern.images.slice(0, MAX_IMAGES_PER_PROJECT);
  for (const img of cleanImages) {
    if (!isValidImage(img)) {
      return {
        ok: false,
        error: "Una imagen supera el tamaño permitido o tiene un formato no soportado.",
        patterns: readAtelierPatterns(storage, owner),
      };
    }
  }
  const current = readAtelierPatterns(storage, owner);
  const next: PatternsMap = {
    ...current,
    [pattern.projectId]: {
      ...pattern,
      title: pattern.title.trim() || "Patrón del proyecto",
      steps: pattern.steps.map((s) => s.trim()).filter(Boolean),
      notes: pattern.notes,
      externalUrl: pattern.externalUrl?.trim() || undefined,
      images: cleanImages,
      updatedAt: new Date().toISOString(),
    },
  };
  try {
    const written = storage.setItem(storageKey(owner), JSON.stringify({ ownerId: owner, patterns: next }));
    if (written === false) {
      return {
        ok: false,
        error: "Espacio local lleno. Reduce el tamaño o cantidad de imágenes guardadas.",
        patterns: current,
      };
    }
    return { ok: true, patterns: next };
  } catch {
    return {
      ok: false,
      error: "No se pudo guardar el patrón en este dispositivo.",
      patterns: current,
    };
  }
}

export function getDefaultAtelierPattern(projectId: string, projectName?: string): AtelierProjectPattern {
  return {
    projectId,
    title: projectName ? `Patrón de ${projectName}` : "Patrón del proyecto",
    steps: [],
    notes: "",
    images: [],
    updatedAt: new Date().toISOString(),
  };
}

export function readAtelierPatternsSafe(owner?: string): PatternsMap {
  return readAtelierPatterns(safeLocalStorage, owner);
}

export function saveAtelierPatternSafe(owner: string | undefined, pattern: AtelierProjectPattern) {
  return saveAtelierPattern(safeLocalStorage, owner, pattern);
}
