import type { SkillDomain } from "@/types/rpg";

export type BuildingCategory =
  | "artesania"
  | "intelecto"
  | "enfoque"
  | "maestria"
  | "bienestar";

export interface SanctuaryBuildingDefinition {
  id: string;
  domain: SkillDomain;
  name: string;
  subtitle: string;
  category: BuildingCategory;
  badge: string;
  pixelArtIcon: string;
  route: string;
  defaultMinutes: number;
  lore: string;
  specializedFeatures: string[];
  colorTheme: {
    bgMuted: string;
    borderMuted: string;
    accentSage: string;
    goldText: string;
  };
}

export interface UniversalSessionState {
  sessionId: string;
  domain: SkillDomain;
  buildingId: string;
  status: "idle" | "running" | "paused" | "completed";
  startedAt: string;
  elapsedSeconds: number;
  isPaused: boolean;
  associatedResourceId?: string;
  associatedResourceTitle?: string;
  sessionObjective?: string;
  notes: string;
  clarityRating?: number;
  specializedData?: Record<string, unknown>;
}

export interface KnittingSessionPayload {
  projectId?: string;
  projectName?: string;
  technique?: string;
  rowsCompleted: number;
  stitchesNotes?: string;
  durationMinutes: number;
  photoEvidenceUrl?: string;
}
