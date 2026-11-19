import type { SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import type { VillageBuildingDefinition } from "./village-buildings-registry.ts";
import { getEffectiveCoordinates, type CustomPositionsMap } from "./village-slot-layout.ts";
import { safeLocalStorage } from "../storage-safe.ts";

export const VILLAGE_WORLD_WIDTH = 1400;
export const VILLAGE_WORLD_HEIGHT = 900;

export const EXPLORER_BOUNDS = {
  minX: 110,
  maxX: VILLAGE_WORLD_WIDTH - 110,
  minY: 130,
  maxY: VILLAGE_WORLD_HEIGHT - 110,
} as const;

export const DEFAULT_EXPLORER_POS = {
  x: 700,
  y: 385,
  facing: "down" as ExplorerFacing,
};

export type ExplorerFacing = "up" | "down" | "left" | "right";

export interface ExplorerPosition {
  x: number;
  y: number;
  facing: ExplorerFacing;
}

export function clampExplorerPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.round(Math.min(EXPLORER_BOUNDS.maxX, Math.max(EXPLORER_BOUNDS.minX, x))),
    y: Math.round(Math.min(EXPLORER_BOUNDS.maxY, Math.max(EXPLORER_BOUNDS.minY, y))),
  };
}

export function stepExplorerPosition(
  current: ExplorerPosition,
  direction: ExplorerFacing,
  stepPx = 42
): ExplorerPosition {
  let nextX = current.x;
  let nextY = current.y;
  if (direction === "left") nextX -= stepPx;
  if (direction === "right") nextX += stepPx;
  if (direction === "up") nextY -= stepPx;
  if (direction === "down") nextY += stepPx;

  const clamped = clampExplorerPosition(nextX, nextY);
  return {
    x: clamped.x,
    y: clamped.y,
    facing: direction,
  };
}

export interface NearbyBuildingResult {
  building: VillageBuildingDefinition;
  distancePx: number;
}

export function findNearestBuilding(
  explorerPos: { x: number; y: number },
  buildings: VillageBuildingDefinition[],
  customPositions: CustomPositionsMap = {},
  thresholdPx = 155
): NearbyBuildingResult | null {
  let nearest: NearbyBuildingResult | null = null;
  for (const building of buildings) {
    const coords = getEffectiveCoordinates(building.id, customPositions);
    const bx = (coords.x / 100) * VILLAGE_WORLD_WIDTH;
    const by = (coords.y / 100) * VILLAGE_WORLD_HEIGHT;
    const dist = Math.hypot(explorerPos.x - bx, explorerPos.y - by);
    if (dist <= thresholdPx && (!nearest || dist < nearest.distancePx)) {
      nearest = { building, distancePx: Math.round(dist) };
    }
  }
  return nearest;
}

/**
 * Señales visuales reales y confirmadas por edificio (HITO 5).
 * Nunca inventa actividad, nunca crea premios GP/XP/COP ni penaliza días de descanso.
 */
export interface BuildingVisualSignal {
  kind: "active_session" | "recent_completed" | "active_items" | "pending_proposal" | "calm_rest";
  label: string;
  icon: string;
  tone: "emerald" | "amber" | "sky" | "neutral";
}

export function deriveBuildingVisualSignals(params: {
  buildingId: string;
  isSessionActive: boolean;
  skillSummary?: SkillDomainSummary;
  recentSessions: SkillSessionRecord[];
  activeBooksCount?: number;
  activeKnittingProjectsCount?: number;
  rubikSolvesCount?: number;
  hasPendingProposal?: boolean;
}): BuildingVisualSignal[] {
  const signals: BuildingVisualSignal[] = [];

  if (params.isSessionActive) {
    signals.push({
      kind: "active_session",
      label: "Sesión activa",
      icon: "⏱️",
      tone: "emerald",
    });
  }

  if (params.hasPendingProposal) {
    signals.push({
      kind: "pending_proposal",
      label: "Propuesta pendiente",
      icon: "📋",
      tone: "amber",
    });
  }

  const confirmedSessions = params.skillSummary?.sessions_count ?? params.recentSessions.length;
  if (confirmedSessions > 0) {
    signals.push({
      kind: "recent_completed",
      label: `${confirmedSessions} ${confirmedSessions === 1 ? "registro" : "registros"}`,
      icon: "✅",
      tone: "sky",
    });
  }

  if (params.buildingId === "libreria" && (params.activeBooksCount || 0) > 0) {
    signals.push({
      kind: "active_items",
      label: `${params.activeBooksCount} ${params.activeBooksCount === 1 ? "libro" : "libros"}`,
      icon: "📖",
      tone: "amber",
    });
  } else if (params.buildingId === "atelier" && (params.activeKnittingProjectsCount || 0) > 0) {
    signals.push({
      kind: "active_items",
      label: `${params.activeKnittingProjectsCount} en progreso`,
      icon: "🧶",
      tone: "amber",
    });
  } else if (params.buildingId === "club_puzzles" && (params.rubikSolvesCount || 0) > 0) {
    signals.push({
      kind: "active_items",
      label: `${params.rubikSolvesCount} solves`,
      icon: "🧊",
      tone: "sky",
    });
  }

  if (signals.length === 0) {
    // Día de descanso o edificio tranquilo: nunca penaliza ni regaña.
    signals.push({
      kind: "calm_rest",
      label: "En calma",
      icon: "🍃",
      tone: "neutral",
    });
  }

  return signals;
}

/**
 * Estado ambiental determinista de habitantes (HITO 3).
 * Cero llamadas a Gemini; nunca inventa historial.
 */
export interface ResidentAmbientState {
  mood: "guiding" | "welcoming" | "quiet";
  shortLine: string;
  showAiMutedBadge: boolean;
}

export function getResidentAmbientState(params: {
  residentName: string;
  isSessionActive: boolean;
  confirmedSessionsCount: number;
  isAiMuted: boolean;
}): ResidentAmbientState {
  if (params.isAiMuted) {
    return {
      mood: "quiet",
      shortLine: `${params.residentName} está en modo silencioso (IA pausada).`,
      showAiMutedBadge: true,
    };
  }
  if (params.isSessionActive) {
    return {
      mood: "guiding",
      shortLine: `${params.residentName} te acompaña en tu sesión activa.`,
      showAiMutedBadge: false,
    };
  }
  if (params.confirmedSessionsCount > 0) {
    return {
      mood: "welcoming",
      shortLine: `${params.confirmedSessionsCount} ${
        params.confirmedSessionsCount === 1 ? "sesión confirmada" : "sesiones confirmadas"
      } en este espacio.`,
      showAiMutedBadge: false,
    };
  }
  return {
    mood: "welcoming",
    shortLine: "Espacio listo cuando quieras comenzar, sin prisa.",
    showAiMutedBadge: false,
  };
}

/**
 * Temas visuales y mobiliario interactivo para habitaciones interiores (HITO 4).
 */
export interface InteriorRoomThemeConfig {
  wallGradient: string;
  floorPrimary: string;
  floorLine: string;
  accentGlow: string;
  roomLabel: string;
  props: { icon: string; label: string }[];
}

const INTERIOR_THEMES: Record<string, InteriorRoomThemeConfig> = {
  biblioteca: {
    wallGradient: "from-[#253247] to-[#1A2434]",
    floorPrimary: "#4A3628",
    floorLine: "#2C1E14",
    accentGlow: "bg-sky-300/20",
    roomLabel: "Sala de Estudio y Archivos",
    props: [
      { icon: "📚", label: "Estanterías de apuntes" },
      { icon: "🕯️", label: "Escritorio iluminado" },
      { icon: "🗂️", label: "Tarjetas de repaso" },
    ],
  },
  atelier: {
    wallGradient: "from-[#4A3028] to-[#2F1E19]",
    floorPrimary: "#6B4529",
    floorLine: "#3A2414",
    accentGlow: "bg-amber-300/25",
    roomLabel: "Mesa de Tejido y Patrones",
    props: [
      { icon: "🧶", label: "Cesta de ovillos" },
      { icon: "🪡", label: "Mesa de crochet" },
      { icon: "📋", label: "Contador de vueltas" },
    ],
  },
  gimnasio: {
    wallGradient: "from-[#2D3830] to-[#1D251F]",
    floorPrimary: "#3D4440",
    floorLine: "#232825",
    accentGlow: "bg-emerald-300/20",
    roomLabel: "Sala de Fuerza y Constancia",
    props: [
      { icon: "🏋️", label: "Rack de pesas" },
      { icon: "📓", label: "Registro de series" },
      { icon: "💧", label: "Zona de descanso" },
    ],
  },
  club_puzzles: {
    wallGradient: "from-[#253342] to-[#18222C]",
    floorPrimary: "#3A4958",
    floorLine: "#1E2833",
    accentGlow: "bg-cyan-300/20",
    roomLabel: "Mesa de Speedcubing WCA",
    props: [
      { icon: "🧊", label: "Tapete de cubos" },
      { icon: "⏱️", label: "Cronómetro WCA" },
      { icon: "🔧", label: "Estación de ajuste" },
    ],
  },
  cine: {
    wallGradient: "from-[#3A1E28] to-[#211017]",
    floorPrimary: "#4A232E",
    floorLine: "#291017",
    accentGlow: "bg-rose-300/20",
    roomLabel: "Sala de Proyección y Butacas",
    props: [
      { icon: "🎬", label: "Pantalla principal" },
      { icon: "🪑", label: "Butacas cozy" },
      { icon: "🎭", label: "Cartelera cultural" },
    ],
  },
  banco_oakhaven: {
    wallGradient: "from-[#353024] to-[#201D15]",
    floorPrimary: "#4D4533",
    floorLine: "#2C271C",
    accentGlow: "bg-yellow-300/20",
    roomLabel: "Mostrador y Libro Mayor Privado",
    props: [
      { icon: "🏛️", label: "Mostrador de roble" },
      { icon: "📒", label: "Libro mayor COP" },
      { icon: "🔐", label: "Bóveda privada" },
    ],
  },
  oficina: {
    wallGradient: "from-[#2A333D] to-[#1B222A]",
    floorPrimary: "#523B2B",
    floorLine: "#312117",
    accentGlow: "bg-amber-200/20",
    roomLabel: "Escritorio y Tablero de Proyectos",
    props: [
      { icon: "🖥️", label: "Escritorio de enfoque" },
      { icon: "📌", label: "Tablero Kanban" },
      { icon: "☕", label: "Rincón de pausa" },
    ],
  },
  libreria: {
    wallGradient: "from-[#3B2B22] to-[#241913]",
    floorPrimary: "#5C3D28",
    floorLine: "#352114",
    accentGlow: "bg-orange-300/20",
    roomLabel: "Estanterías y Rincón de Lectura",
    props: [
      { icon: "📖", label: "Sillón de lectura" },
      { icon: "🪵", label: "Estanterías altas" },
      { icon: "✒️", label: "Cuaderno de citas" },
    ],
  },
};

export function getInteriorRoomTheme(buildingId: string): InteriorRoomThemeConfig {
  return (
    INTERIOR_THEMES[buildingId] || {
      wallGradient: "from-[#3A2E2B] to-[#261E1C]",
      floorPrimary: "#5C381E",
      floorLine: "#3A2E2B",
      accentGlow: "bg-amber-400/20",
      roomLabel: "Espacio Interactivo de Oakhaven",
      props: [
        { icon: "🪑", label: "Mesa principal" },
        { icon: "🪴", label: "Rincón cozy" },
        { icon: "🕯️", label: "Lámpara cálida" },
      ],
    }
  );
}

const AMBIENT_MOTION_PREF_KEY = "oakhaven_ambient_motion_v5";

export function loadAmbientMotionPreference(): boolean {
  try {
    const saved = safeLocalStorage.getItem(AMBIENT_MOTION_PREF_KEY);
    if (saved === "true") return true;
    if (saved === "false") return false;
  } catch {
    // Fallback seguro
  }
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return false;
    }
  }
  return true;
}

export function saveAmbientMotionPreference(enabled: boolean): void {
  try {
    safeLocalStorage.setItem(AMBIENT_MOTION_PREF_KEY, String(enabled));
  } catch {
    // Silencioso en entornos sin storage
  }
}

export const DISABLED_AI_SKILLS_STORAGE_KEY = "oakhaven_disabled_ai_skills_v1";

export function loadDisabledAiSkills(): string[] {
  try {
    const raw = safeLocalStorage.getItem(DISABLED_AI_SKILLS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
