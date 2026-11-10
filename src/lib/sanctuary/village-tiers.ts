import type { SkillDomain, SkillSessionRecord } from "@/types/rpg";

export type BuildingVisualTier = 1 | 2 | 3;

export interface BuildingTierInfo {
  tier: BuildingVisualTier;
  tierName: string;
  badge: string;
  facadeDescription: string;
  decorations: string[];
}

export interface VillageResident {
  id: string;
  name: string;
  title: string;
  species: string;
  avatar: string;
  buildingId: string;
  domain: SkillDomain;
  favoriteGift: string;
  greetingQuote: string;
  getDynamicAdvice: (data: {
    skillLevel: number;
    sessionsCount: number;
    lastSessionDetails?: string;
  }) => string;
}

/**
 * Calcula de forma pura y determinista el nivel visual (Tier 1, 2 o 3) de un edificio
 * a partir de las sesiones completadas y el nivel de habilidad alcanzado.
 * No genera GP, ni altera balances; solo determina la apariencia visual.
 */
export function calculateBuildingTier(params: {
  level?: number;
  sessionsCount?: number;
  completedProjectsCount?: number;
}): BuildingTierInfo {
  const level = params.level || 1;
  const sessions = params.sessionsCount || 0;
  const projects = params.completedProjectsCount || 0;

  // Tier 3: Gremio / Santuario Maestro (Nivel 5+ o 10+ sesiones/proyectos)
  if (level >= 5 || sessions >= 10 || projects >= 3) {
    return {
      tier: 3,
      tierName: "Santuario Maestro",
      badge: "⭐ Tier 3",
      facadeDescription: "Casona señorial de cantería con vidrieras, banderas heráldicas y cúpula iluminada.",
      decorations: ["Vidrieras policromadas", "Faroles de hierro forjado", "Trofeos dorados de maestría", "Jardín aromático exterior"],
    };
  }

  // Tier 2: Taller / Estudio Establecido (Nivel 2-4 o 3-9 sesiones)
  if (level >= 2 || sessions >= 3 || projects >= 1) {
    return {
      tier: 2,
      tierName: "Taller Establecido",
      badge: "🌿 Tier 2",
      facadeDescription: "Taller con porche de madera noble, toldo de tela cálida y vitrina de exhibición.",
      decorations: ["Toldo de lona artesanal", "Letrero tallado en roble", "Estantes exteriores de recursos", "Farol cálido de bienvenida"],
    };
  }

  // Tier 1: Cabaña Rústica de Inicio
  return {
    tier: 1,
    tierName: "Cabaña Rústica",
    badge: "🪵 Tier 1",
    facadeDescription: "Cabaña acogedora de troncos y piedra con tejado de tejas de madera.",
    decorations: ["Mesa de trabajo exterior", "Cesta de materiales básicos", "Humo suave de chimenea"],
  };
}

/**
 * Catálogo de Residentes Originales del Pueblo Cozy
 * Funcionan como asistentes que recuerdan la última actividad real y sugieren el siguiente paso.
 */
export const COZY_VILLAGE_RESIDENTS: VillageResident[] = [
  {
    id: "clara",
    name: "Clara",
    title: "Maestra Tejedora",
    species: "Liebre Artesana",
    avatar: "🐇",
    buildingId: "atelier",
    domain: "knitting",
    favoriteGift: "Madejas de Lana Merino & Té de Manzanilla",
    greetingQuote: "El ritmo de las agujas aquieta la mente. Cada punto cuenta una historia.",
    getDynamicAdvice: ({ sessionsCount, lastSessionDetails }) => {
      if (sessionsCount === 0) {
        return "¡Bienvenido al Atelier! Montemos los primeros puntos de tu proyecto artesanal.";
      }
      return lastSessionDetails
        ? `Recuerdo tu avance: "${lastSessionDetails}". ¿Hacemos unas cuantas filas hoy?`
        : "Tus agujas y el telar están listos para continuar cuando gustes.";
    },
  },
  {
    id: "eldrin",
    name: "Eldrin",
    title: "Archivero Mayor",
    species: "Tejón Lector",
    avatar: "🦡",
    buildingId: "libreria",
    domain: "reading",
    favoriteGift: "Marcadores de Cuero Grabado & Café de Bellota",
    greetingQuote: "Un buen libro no se devora con prisa; se saborea página tras página.",
    getDynamicAdvice: ({ sessionsCount }) => {
      if (sessionsCount === 0) {
        return "Los estantes de la Librería esperan tu primer libro. ¿Qué historia comenzamos hoy?";
      }
      return `Tienes ${sessionsCount} sesiones registradas en tus estantes. ¡Excelente constancia lectora!`;
    },
  },
  {
    id: "lyra",
    name: "Lyra",
    title: "Erudita de la Cátedra",
    species: "Búho Sabio",
    avatar: "🦉",
    buildingId: "biblioteca",
    domain: "study",
    favoriteGift: "Tinta Índigo & Pergaminos Iluminados",
    greetingQuote: "El conocimiento retenido en la memoria espaciada florece sin esfuerzo.",
    getDynamicAdvice: ({ skillLevel }) => {
      return `Tu intelecto alcanza el Grado ${skillLevel}. Las tarjetas de memoria SM-2 te esperan en el atril.`;
    },
  },
  {
    id: "milo",
    name: "Milo",
    title: "Campeón de Reflejos WCA",
    species: "Ardilla Speedcuber",
    avatar: "🐿️",
    buildingId: "club_puzzles",
    domain: "rubik",
    favoriteGift: "Lubricante de Silicona Veloz & Cronómetros Pro",
    greetingQuote: "¡La fluidez en el F2L supera a la fuerza bruta! Respira antes de la inspección.",
    getDynamicAdvice: ({ sessionsCount }) => {
      return sessionsCount > 0
        ? "El cronómetro WCA y los nuevos scrambles están listos. ¿Vamos por un nuevo PB?"
        : "¡Toma un cubo de tu arsenal y hagamos el primer scramble del día!";
    },
  },
  {
    id: "aura",
    name: "Aura",
    title: "Vigía del Silencio Cósmico",
    species: "Gata Astrónoma",
    avatar: "🐈‍⬛",
    buildingId: "observatorio",
    domain: "general",
    favoriteGift: "Cristales de Amatista & Infusión de Lavanda",
    greetingQuote: "Cuando acallas el ruido externo, las ideas más brillantes encuentran su cauce.",
    getDynamicAdvice: () => {
      return "El domo cósmico está en calma. Activa tu bloque de Deep Work y deja las distracciones fuera.";
    },
  },
  {
    id: "barnaby",
    name: "Barnaby",
    title: "Custodio del Huerto",
    species: "Oso Botánico",
    avatar: "🐻",
    buildingId: "pabellon_gardening",
    domain: "gardening",
    favoriteGift: "Semillas Silvestres & Agua de Lluvia",
    greetingQuote: "La tierra nunca tiene prisa, y aun así todo florece en su tiempo perfecto.",
    getDynamicAdvice: () => {
      return "El rocío de la mañana nutrió los brotes. Respira hondo y conecta con la calma vegetal.";
    },
  },
  {
    id: "tara",
    name: "Tara",
    title: "Guía de Senderos",
    species: "Zorra Andarina",
    avatar: "🦊",
    buildingId: "pabellon_hiking",
    domain: "hiking",
    favoriteGift: "Cantimplora de Cobre & Frutos Secos",
    greetingQuote: "Cada paso despeja la niebla del camino. Caminar es medicina para el alma.",
    getDynamicAdvice: () => {
      return "El sendero hacia las colinas de Oakhaven está despejado hoy. ¿Damos un paseo consciente?";
    },
  },
];
