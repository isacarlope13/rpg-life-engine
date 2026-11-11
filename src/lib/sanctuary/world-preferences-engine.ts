/**
 * MOTOR DE PREFERENCIAS DEL MUNDO Y PUEBLO VIVO — OAKHAVEN 4.0 (HITO 4.0.1)
 *
 * Permite a cada usuario activar, pausar o archivar habilidades sin alterar:
 * 1. El historial de sesiones reales.
 * 2. Los saldos de GP y balances económicos.
 * 3. La progresión de niveles y XP acumulada.
 * 4. La infraestructura inmutable del Banco de OakHaven (siempre activo).
 *
 * REGLAS DE CICLO DE VIDA:
 * - 'active': Visible en el mapa interactivo, genera misiones adaptativas y atajos rápidos.
 * - 'paused': Oculto o en reposo visual, sin misiones diarias ni recordatorios que generen culpa.
 * - 'archived': Retirado del paisaje del pueblo, consultable en el Registro Histórico sin pérdida de datos.
 */

import type { SkillDomain } from "../../types/rpg.ts";
import type { VillageBuildingDefinition, BuildingDistrict } from "./village-buildings-registry.ts";
import { safeLocalStorage } from "../storage-safe.ts";

export type SkillLifeCycleState = "active" | "paused" | "archived";

export interface UserSkillPreference {
  domain: SkillDomain;
  status: SkillLifeCycleState;
  customOrder?: number;
  isFavorite?: boolean;
  pausedAt?: string;
  archivedAt?: string;
  notes?: string;
}

export interface VillageWorldConfig {
  userId: string;
  skills: Record<SkillDomain, UserSkillPreference>;
  activeDistrictFilter: BuildingDistrict | "all";
  compactModeEnabled: boolean;
  soundMuted: boolean;
  selectedWeather: "sunny" | "rain" | "autumn" | "night";
  updatedAt: string;
}

export const ALL_SKILL_DOMAINS: SkillDomain[] = [
  "work",
  "reading",
  "knitting",
  "rubik",
  "study",
  "sports",
  "journaling",
  "gardening",
  "drawing",
  "ceramics",
  "hiking",
  "cooking",
  "gaming",
  "general",
];

// Configuración inicial recomendada (equilibrio cozy: trabajo, lectura, bienestar y finanzas)
export function getDefaultWorldConfig(userId = "default_user"): VillageWorldConfig {
  const initialSkills: Record<SkillDomain, UserSkillPreference> = {
    work: { domain: "work", status: "active", isFavorite: true },
    reading: { domain: "reading", status: "active", isFavorite: true },
    knitting: { domain: "knitting", status: "active", isFavorite: false },
    rubik: { domain: "rubik", status: "active", isFavorite: false },
    sports: { domain: "sports", status: "active", isFavorite: true },
    journaling: { domain: "journaling", status: "active", isFavorite: false },
    study: { domain: "study", status: "active", isFavorite: false },
    gardening: { domain: "gardening", status: "active", isFavorite: false },
    drawing: { domain: "drawing", status: "paused", notes: "En reposo" },
    ceramics: { domain: "ceramics", status: "paused", notes: "En reposo" },
    hiking: { domain: "hiking", status: "paused", notes: "En reposo" },
    cooking: { domain: "cooking", status: "active", isFavorite: false },
    gaming: { domain: "gaming", status: "paused", notes: "En reposo" },
    general: { domain: "general", status: "active", isFavorite: false },
  };

  return {
    userId,
    skills: initialSkills,
    activeDistrictFilter: "all",
    compactModeEnabled: false,
    soundMuted: true,
    selectedWeather: "sunny",
    updatedAt: new Date().toISOString(),
  };
}

const STORAGE_KEY_PREFIX = "oakhaven_world_config_";

/**
 * Carga la configuración del mundo del usuario desde almacenamiento seguro.
 */
export function loadWorldPreferences(userId = "default_user"): VillageWorldConfig {
  try {
    const raw = safeLocalStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<VillageWorldConfig>;
      const defaults = getDefaultWorldConfig(userId);

      // Combinar asegurando que todos los dominios existan
      const mergedSkills = { ...defaults.skills };
      if (parsed.skills) {
        for (const dom of ALL_SKILL_DOMAINS) {
          if (parsed.skills[dom]) {
            mergedSkills[dom] = {
              ...mergedSkills[dom],
              ...parsed.skills[dom],
              domain: dom, // Invariante de tipado
            };
          }
        }
      }

      return {
        ...defaults,
        ...parsed,
        userId,
        skills: mergedSkills,
      };
    }
  } catch (err) {
    console.warn("[world-preferences-engine] Error al cargar preferencias, usando por defecto:", err);
  }

  return getDefaultWorldConfig(userId);
}

/**
 * Persiste la configuración del mundo de forma segura.
 */
export function saveWorldPreferences(config: VillageWorldConfig): void {
  try {
    const payload: VillageWorldConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    safeLocalStorage.setItem(
      `${STORAGE_KEY_PREFIX}${config.userId || "default_user"}`,
      JSON.stringify(payload)
    );
  } catch (err) {
    console.error("[world-preferences-engine] Error al guardar preferencias:", err);
  }
}

/**
 * Modifica el estado de ciclo de vida de una habilidad (active | paused | archived).
 * INVARIANTE: El dominio 'work' asociado al Banco de OakHaven no puede ser destruido.
 */
export function updateSkillStatus(
  config: VillageWorldConfig,
  domain: SkillDomain,
  newStatus: SkillLifeCycleState,
  notes?: string
): VillageWorldConfig {
  const currentPref = config.skills[domain] || {
    domain,
    status: "active",
  };

  const now = new Date().toISOString();
  const updatedPref: UserSkillPreference = {
    ...currentPref,
    status: newStatus,
    notes: notes !== undefined ? notes : currentPref.notes,
    pausedAt: newStatus === "paused" ? now : newStatus === "active" ? undefined : currentPref.pausedAt,
    archivedAt: newStatus === "archived" ? now : newStatus === "active" ? undefined : currentPref.archivedAt,
  };

  const nextConfig: VillageWorldConfig = {
    ...config,
    skills: {
      ...config.skills,
      [domain]: updatedPref,
    },
    updatedAt: now,
  };

  saveWorldPreferences(nextConfig);
  return nextConfig;
}

/**
 * Filtra los edificios del pueblo que deben renderizarse en el mapa activo.
 * INVARIANTE DE SEGURIDAD:
 * El 'banco_oakhaven' es infraestructura soberana del reino y SIEMPRE está presente.
 */
export function filterVisibleBuildings(
  buildings: VillageBuildingDefinition[],
  config: VillageWorldConfig
): VillageBuildingDefinition[] {
  return buildings.filter((building) => {
    // 1. El Banco de OakHaven es inmutable y siempre visible
    if (building.id === "banco_oakhaven" || building.id === "banco") {
      return true;
    }

    // 2. Para otros edificios, verificar preferencia del usuario
    const pref = config.skills[building.domain];
    if (!pref) return true; // Por defecto activo si no hay registro

    return pref.status === "active";
  });
}

/**
 * Obtiene la lista de dominios de habilidad estrictamente activos para la generación de misiones.
 * Excluye explícitamente dominios pausados o archivados para no saturar al usuario ni inducir culpa.
 */
export function getActiveSkillDomains(config: VillageWorldConfig): SkillDomain[] {
  return ALL_SKILL_DOMAINS.filter((dom) => {
    const pref = config.skills[dom];
    return pref ? pref.status === "active" : true;
  });
}

/**
 * Obtiene métricas del estado del mundo del usuario (activas, pausadas, archivadas).
 */
export function getSkillLifecycleMetrics(config: VillageWorldConfig): {
  totalCount: number;
  activeCount: number;
  pausedCount: number;
  archivedCount: number;
} {
  let activeCount = 0;
  let pausedCount = 0;
  let archivedCount = 0;

  for (const dom of ALL_SKILL_DOMAINS) {
    const pref = config.skills[dom];
    const status = pref?.status || "active";
    if (status === "active") activeCount++;
    else if (status === "paused") pausedCount++;
    else if (status === "archived") archivedCount++;
  }

  return {
    totalCount: ALL_SKILL_DOMAINS.length,
    activeCount,
    pausedCount,
    archivedCount,
  };
}
