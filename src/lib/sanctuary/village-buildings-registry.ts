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
  // ==========================================
  // 1. PLAZA CENTRAL & TRABAJO
  // ==========================================
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
    mapCoordinates: { x: 50, y: 45, row: 2, col: 2 },
    getPendingActivity: ({ buildingSessions = [] }) => {
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

  // ==========================================
  // 2. DISTRITO DEL SABER & FOCO
  // ==========================================
  {
    id: "cabana_diario",
    name: "Cabaña del Diario & Reflexión",
    domain: "journaling",
    district: "saber",
    tagline: "Bitácora Interior, Gratitud & Balance Emocional",
    description: "Acogedora cabaña de madera junto a un riachuelo para pausar, escribir y ordenar la mente.",
    icon: "📔",
    accentColor: "#B5838D",
    borderColor: "#8E5B65",
    bgGradient: "from-[#2A2024] to-[#1A1417]",
    residentId: "sora",
    mapCoordinates: { x: 12, y: 34, row: 1, col: 0 },
    getPendingActivity: ({ buildingSessions = [] }) => {
      const hasToday = buildingSessions.some((s) => {
        const d = new Date(s.timestamp || Date.now());
        const now = new Date();
        return d.toDateString() === now.toDateString();
      });
      return {
        hasPending: !hasToday,
        label: !hasToday ? "Reflexión del día" : undefined,
        urgency: "highlight",
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
    mapCoordinates: { x: 28, y: 32, row: 1, col: 1 },
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
    mapCoordinates: { x: 50, y: 16, row: 1, col: 2 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Foco profundo disponible",
      urgency: "normal",
    }),
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
    mapCoordinates: { x: 82, y: 54, row: 2, col: 4 },
    getPendingActivity: ({ rubikSolvesCount = 0 }) => {
      return {
        hasPending: rubikSolvesCount > 0,
        label: rubikSolvesCount > 0 ? `${rubikSolvesCount} solves registrados` : undefined,
        count: rubikSolvesCount,
        urgency: "normal",
      };
    },
  },

  // ==========================================
  // 3. DISTRITO DE ARTES & OFICIOS
  // ==========================================
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
    mapCoordinates: { x: 18, y: 54, row: 2, col: 0 },
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
    id: "estudio_arte",
    name: "Estudio de Ilustración & Dibujo",
    domain: "drawing",
    district: "artes",
    tagline: "Bocetos, Acuarelas & Trazo Consciente",
    description: "Caballetes con luz natural, pinceles de cerdas suaves y lienzos para expresar creatividad visual.",
    icon: "🎨",
    accentColor: "#E07A5F",
    borderColor: "#A84C35",
    bgGradient: "from-[#32211C] to-[#1D1411]",
    residentId: "maya",
    mapCoordinates: { x: 36, y: 54, row: 2, col: 1 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Lienzo en blanco listo",
      urgency: "normal",
    }),
  },
  {
    id: "ludoteca",
    name: "Salón Recreativo & Ludoteca",
    domain: "gaming",
    district: "artes",
    tagline: "Juegos Estratégicos, Desafíos & Concentración",
    description: "Rincón retro de tableros, puzzles lógicos y desafíos recreativos para ejercitar el ingenio.",
    icon: "🎮",
    accentColor: "#F4A261",
    borderColor: "#B86C2E",
    bgGradient: "from-[#332517] to-[#1E160D]",
    residentId: "felix",
    mapCoordinates: { x: 65, y: 46, row: 2, col: 3 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Partida disponible",
      urgency: "normal",
    }),
  },
  {
    id: "taller_ceramica",
    name: "Taller de Alfarería & Cerámica",
    domain: "ceramics",
    district: "artes",
    tagline: "Torno, Arcilla Húmeda & Cocción Lenta",
    description: "Torno tradicional donde moldear piezas de barro para cultivar la paciencia y el tacto.",
    icon: "🏺",
    accentColor: "#DDA15E",
    borderColor: "#9B6B38",
    bgGradient: "from-[#2C2117] to-[#19130D]",
    residentId: "hugo",
    mapCoordinates: { x: 14, y: 76, row: 3, col: 0 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Torno preparado",
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

  // ==========================================
  // 4. DISTRITO DE NATURALEZA & VITALIDAD
  // ==========================================
  {
    id: "invernadero",
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
    mapCoordinates: { x: 32, y: 78, row: 3, col: 1 },
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
    mapCoordinates: { x: 69, y: 78, row: 3, col: 3 },
    getPendingActivity: () => ({
      hasPending: true,
      label: "Sendero despejado",
      urgency: "normal",
    }),
  },
  {
    id: "gimnasio",
    name: "Gimnasio de Fuerza & Resistencia",
    domain: "sports",
    district: "naturaleza",
    tagline: "Entrenamiento Funcional, Movilidad & Fortaleza",
    description: "Área abierta al aire libre con barras de roble, mancuernas de piedra y colchonetas de lona para cuidar el cuerpo.",
    icon: "🏋️",
    accentColor: "#588157",
    borderColor: "#3A5A40",
    bgGradient: "from-[#1D2B1F] to-[#121B13]",
    residentId: "bruno",
    mapCoordinates: { x: 87, y: 75, row: 3, col: 4 },
    getPendingActivity: ({ buildingSessions = [] }) => {
      const hasToday = buildingSessions.some((s) => {
        const d = new Date(s.timestamp || Date.now());
        const now = new Date();
        return d.toDateString() === now.toDateString();
      });
      return {
        hasPending: !hasToday,
        label: !hasToday ? "Entrenamiento pendiente" : undefined,
        urgency: "highlight",
      };
    },
  },
];

/**
 * Obtiene la definición de un edificio por su ID estable (soporta alias retrocompatibles como 'pabellon_gardening').
 */
export function getBuildingById(id: string): VillageBuildingDefinition | undefined {
  if (id === "pabellon_gardening" || id === "invernadero") {
    return VILLAGE_BUILDINGS_CATALOG.find((b) => b.id === "invernadero" || b.id === "pabellon_gardening");
  }
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
