import type { SkillDomain, SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";

export type BuildingDistrict = "plaza" | "saber" | "artes" | "naturaleza";

export interface VillageBuildingDefinition {
  id: string; // Identificador estable
  name: string;
  domain: SkillDomain;
  district: BuildingDistrict;
  tagline: string;
  description: string;
  icon: string;
  accentColor: string;
  borderColor: string;
  bgGradient: string;
  residentId: string;
  // Posicionamiento en el mapa interactivo (porcentajes de plano 0-100%)
  mapCoordinates: {
    x: number; // 0-100% horizontal
    y: number; // 0-100% vertical
    row: number; // Posición de cuadrícula para renderizado accesible
    col: number;
  };
  // Indicador de actividad viva
  getPendingActivity: (context: {
    skillSummary?: SkillDomainSummary;
    buildingSessions?: SkillSessionRecord[];
    activeBooksCount?: number;
    activeKnittingProjectsCount?: number;
    rubikSolvesCount?: number;
    spacedCardsDueCount?: number;
  }) => {
    hasPending: boolean;
    label?: string;
    count?: number;
    urgency?: "normal" | "highlight";
  };
}

export const VILLAGE_BUILDINGS_CATALOG: VillageBuildingDefinition[] = [
  {
    id: "oficina",
    name: "Torre de Gestión & Oficina",
    domain: "work",
    district: "plaza",
    tagline: "Sprints, Scrum & Tareas Estratégicas",
    description: "Espacio central de mando para proyectos ágiles, bloques Pomodoro y foco profesional.",
    icon: "💼",
    accentColor: "#4361EE",
    borderColor: "#3046C4",
    bgGradient: "from-[#1C2338] to-[#101524]",
    residentId: "aura",
    mapCoordinates: { x: 50, y: 46, row: 2, col: 2 },
    getPendingActivity: ({ buildingSessions = [] }) => {
      // Si hoy no se ha registrado trabajo, se resalta como disponible
      const hasToday = buildingSessions.some((s) => {
        const d = new Date(s.timestamp || Date.now());
        const now = new Date();
        return d.toDateString() === now.toDateString();
      });
      return {
        hasPending: !hasToday,
        label: !hasToday ? "Sprint disponible" : undefined,
        urgency: "normal",
      };
    },
  },
  {
    id: "libreria",
    name: "La Librería & Archivo Antiguo",
    domain: "reading",
    district: "saber",
    tagline: "Libros, Lectura Serena & Resúmenes",
    description: "Estantes de roble antiguo donde cada tomo leído forja sabiduría canónica y tranquilidad.",
    icon: "📚",
    accentColor: "#2A9D8F",
    borderColor: "#1E6B61",
    bgGradient: "from-[#222E28] to-[#171F1B]",
    residentId: "eldrin",
    mapCoordinates: { x: 26, y: 32, row: 1, col: 1 },
    getPendingActivity: ({ activeBooksCount = 0 }) => {
      return {
        hasPending: activeBooksCount > 0,
        label: activeBooksCount > 0 ? `${activeBooksCount} libro${activeBooksCount > 1 ? "s" : ""} en curso` : undefined,
        count: activeBooksCount,
        urgency: "highlight",
      };
    },
  },
  {
    id: "biblioteca",
    name: "La Gran Biblioteca del Erudito",
    domain: "study",
    district: "saber",
    tagline: "Academia, Repetición Espaciada SM-2 & Cátedra",
    description: "Atriles de estudio y ficheros nemotécnicos para consolidar aprendizajes duraderos sin memorización forzada.",
    icon: "🏛️",
    accentColor: "#6366F1",
    borderColor: "#4F46E5",
    bgGradient: "from-[#1E2436] to-[#121624]",
    residentId: "lyra",
    mapCoordinates: { x: 74, y: 30, row: 1, col: 3 },
    getPendingActivity: ({ spacedCardsDueCount = 0 }) => {
      return {
        hasPending: spacedCardsDueCount > 0,
        label: spacedCardsDueCount > 0 ? `${spacedCardsDueCount} repaso${spacedCardsDueCount > 1 ? "s" : ""} SM-2` : undefined,
        count: spacedCardsDueCount,
        urgency: spacedCardsDueCount > 0 ? "highlight" : "normal",
      };
    },
  },
  {
    id: "club_puzzles",
    name: "Club de Puzzles WCA",
    domain: "rubik",
    district: "saber",
    tagline: "Speedcubing Oficial, Ao5 & Scrambles WCA",
    description: "Mesas de competición con tapetes Stackmat, cronómetros profesionales y scrambles de precisión.",
    icon: "🧩",
    accentColor: "#06B6D4",
    borderColor: "#0891B2",
    bgGradient: "from-[#162B34] to-[#0E1D24]",
    residentId: "milo",
    mapCoordinates: { x: 80, y: 55, row: 2, col: 3 },
    getPendingActivity: ({ rubikSolvesCount = 0 }) => {
      return {
        hasPending: rubikSolvesCount > 0,
        label: rubikSolvesCount > 0 ? `${rubikSolvesCount} solves registrados` : undefined,
        count: rubikSolvesCount,
        urgency: "normal",
      };
    },
  },
  {
    id: "observatorio",
    name: "El Observatorio Cósmico",
    domain: "general",
    district: "saber",
    tagline: "Deep Work, Enfoque Silencioso & Meditación",
    description: "Cúpula astronómica en lo alto de la colina norte. Un refugio blindado de ruido exterior para concentrarse.",
    icon: "🔭",
    accentColor: "#A855F7",
    borderColor: "#7E22CE",
    bgGradient: "from-[#281834] to-[#190F22]",
    residentId: "aura",
    mapCoordinates: { x: 50, y: 15, row: 1, col: 2 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Foco profundo disponible",
      urgency: "normal",
    }),
  },
  {
    id: "atelier",
    name: "El Atelier de Hilados & Textil",
    domain: "knitting",
    district: "artes",
    tagline: "Tejido Artesanal, Patrones & Lana Merino",
    description: "Cestas de ovillos, husos de madera y telares donde cada hilada se traduce en presencia plena.",
    icon: "🧶",
    accentColor: "#E76F51",
    borderColor: "#C28448",
    bgGradient: "from-[#3A2E2B] to-[#251E1C]",
    residentId: "clara",
    mapCoordinates: { x: 20, y: 55, row: 2, col: 1 },
    getPendingActivity: ({ activeKnittingProjectsCount = 0 }) => {
      return {
        hasPending: activeKnittingProjectsCount > 0,
        label: activeKnittingProjectsCount > 0 ? `${activeKnittingProjectsCount} proyecto${activeKnittingProjectsCount > 1 ? "s" : ""} en telar` : undefined,
        count: activeKnittingProjectsCount,
        urgency: "highlight",
      };
    },
  },
  {
    id: "pabellon_gardening",
    name: "Invernadero & Jardín Botánico",
    domain: "gardening",
    district: "naturaleza",
    tagline: "Plantas, Semilleros & Cuidado Silvestre",
    description: "Estructura de cristal y madera rodeada de bancales de hierbas aromáticas, brotes y tierra húmeda.",
    icon: "🌿",
    accentColor: "#4E6E58",
    borderColor: "#38523F",
    bgGradient: "from-[#1F2C23] to-[#141E17]",
    residentId: "barnaby",
    mapCoordinates: { x: 30, y: 78, row: 3, col: 1 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Huerto en calma",
      urgency: "normal",
    }),
  },
  {
    id: "pabellon_hiking",
    name: "Puesto de Senderismo & Refugio",
    domain: "hiking",
    district: "naturaleza",
    tagline: "Rutas de Montaña, Pasos Conscientes & Aire Puro",
    description: "Refugio rústico de piedra con mapas topográficos, cantimploras y bastones para reconectar con el camino.",
    icon: "🥾",
    accentColor: "#D4A373",
    borderColor: "#8C5835",
    bgGradient: "from-[#35251C] to-[#201610]",
    residentId: "tara",
    mapCoordinates: { x: 72, y: 76, row: 3, col: 3 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Sendero despejado",
      urgency: "normal",
    }),
  },
  {
    id: "cocina",
    name: "Cocina Comunitaria & Fogón",
    domain: "cooking",
    district: "artes",
    tagline: "Alimentación Nutritiva, Infusiones & Pan Lento",
    description: "Hornos de leña y cazuelas de cobre donde se cocinan alimentos saludables y reconfortantes.",
    icon: "🍳",
    accentColor: "#E76F51",
    borderColor: "#C46A36",
    bgGradient: "from-[#35251C] to-[#20150F]",
    residentId: "oliver",
    mapCoordinates: { x: 50, y: 78, row: 3, col: 2 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Fogón encendido",
      urgency: "normal",
    }),
  },
];

/**
 * Obtiene la definición de un edificio por su ID estable.
 */
export function getBuildingById(id: string): VillageBuildingDefinition | undefined {
  return VILLAGE_BUILDINGS_CATALOG.find((b) => b.id === id);
}

/**
 * Obtiene la definición de un edificio por su dominio de habilidad canónico.
 */
export function getBuildingByDomain(domain: SkillDomain): VillageBuildingDefinition | undefined {
  return VILLAGE_BUILDINGS_CATALOG.find((b) => b.domain === domain);
}

/**
 * Filtra los edificios según el distrito del pueblo.
 */
export function filterBuildingsByDistrict(district: BuildingDistrict | "all"): VillageBuildingDefinition[] {
  if (district === "all") return VILLAGE_BUILDINGS_CATALOG;
  return VILLAGE_BUILDINGS_CATALOG.filter((b) => b.district === district);
}
