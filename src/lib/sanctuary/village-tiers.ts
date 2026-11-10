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
  microQuest: {
    title: string;
    description: string;
    targetAction: string;
    estimatedMinutes: number;
    badge: string;
  };
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
    microQuest: {
      title: "Tejido Consciente (3 filas)",
      description: "Avanza 3 filas en tu proyecto activo o practica un punto nuevo.",
      targetAction: "knitting_session",
      estimatedMinutes: 15,
      badge: "🧶 +15 min bienestar",
    },
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
    microQuest: {
      title: "Lectura Serena (5 páginas)",
      description: "Lee 5 páginas de tu libro en curso y anota tu cita favorita.",
      targetAction: "reading_session",
      estimatedMinutes: 15,
      badge: "📚 +15 min lectura",
    },
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
    microQuest: {
      title: "Duelo de Memoria SM-2",
      description: "Repasa 3 tarjetas de memoria espaciada en el atril de estudio.",
      targetAction: "study_review",
      estimatedMinutes: 10,
      badge: "🏛️ +10 min memoria",
    },
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
    microQuest: {
      title: "Práctica Fluida (3 solves)",
      description: "Realiza 3 solves WCA con atención al lookahead y parada suave.",
      targetAction: "rubik_practice",
      estimatedMinutes: 10,
      badge: "🧩 +10 min agilidad",
    },
    getDynamicAdvice: ({ sessionsCount }) => {
      if (sessionsCount > 0) {
        return "El cronómetro WCA y los nuevos scrambles están listos. ¿Vamos por un nuevo PB?";
      }
      return "¡Toma un cubo de tu arsenal y hagamos el primer scramble del día!";
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
    microQuest: {
      title: "Bloque de Foco Ininterrumpido",
      description: "Silencia notificaciones y completa 20 minutos de concentración profunda.",
      targetAction: "deep_work_focus",
      estimatedMinutes: 20,
      badge: "🔭 +20 min foco",
    },
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
    microQuest: {
      title: "Cuidado Consciente de Brotes",
      description: "Dedica 5 minutos a regar, airear la tierra o anotar el estado de tus plantas.",
      targetAction: "gardening_session",
      estimatedMinutes: 5,
      badge: "🌿 +5 min calma",
    },
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
    microQuest: {
      title: "Paseo Despejador (15 min)",
      description: "Caminata al aire libre sin pantallas para oxigenar mente y cuerpo.",
      targetAction: "hiking_session",
      estimatedMinutes: 15,
      badge: "🥾 +15 min caminata",
    },
    getDynamicAdvice: () => {
      return "El sendero hacia las colinas de Oakhaven está despejado hoy. ¿Damos un paseo consciente?";
    },
  },
  {
    id: "oliver",
    name: "Oliver",
    title: "Chef & Alquimista del Fuego Lento",
    species: "Erizo Panadero",
    avatar: "🦔",
    buildingId: "cocina",
    domain: "cooking",
    favoriteGift: "Miel de Azahar & Sal Marina en Escamas",
    greetingQuote: "El buen pan y el caldo reconfortante no admiten prisas; el tiempo y el cariño son los ingredientes secretos.",
    microQuest: {
      title: "Infusión o Alimento Nutritivo",
      description: "Prepara una infusión caliente o un tentempié saludable disfrutando cada bocado con presencia.",
      targetAction: "cooking_session",
      estimatedMinutes: 10,
      badge: "🍳 +10 min bienestar",
    },
    getDynamicAdvice: ({ sessionsCount }) => {
      if (sessionsCount === 0) {
        return "¡Bienvenido a la Cocina de Oakhaven! Encendamos los fogones con calma y preparemos algo reconfortante.";
      }
      return "El horno está tibio y el aroma a hierbas inunda el taller. ¿Qué receta nutritiva cocinamos hoy?";
    },
  },
];

export interface BuildingTrophyItem {
  id: string;
  name: string;
  category: "furniture" | "trophy" | "relic";
  icon: string;
  unlocked: boolean;
  requirement: string;
  flavorText: string;
}

export function getBuildingTrophies(
  buildingId: string,
  stats: {
    level?: number;
    sessionsCount?: number;
    booksRead?: number;
    knittingRows?: number;
    rubikPb?: number | null;
    focusMinutes?: number;
  }
): BuildingTrophyItem[] {
  const level = stats.level || 1;
  const sessions = stats.sessionsCount || 0;
  const books = stats.booksRead || 0;
  const rows = stats.knittingRows || 0;
  const pb = stats.rubikPb;
  const focusMins = stats.focusMinutes || 0;

  switch (buildingId) {
    case "atelier":
      return [
        {
          id: "at_loom",
          name: "Telar Rústico de Roble",
          category: "furniture",
          icon: "🪵",
          unlocked: sessions >= 1 || rows >= 1,
          requirement: "1+ sesión o fila de tejido",
          flavorText: "Telar tradicional para montar las primeras urdimbres de proyectos cálidos.",
        },
        {
          id: "at_basket",
          name: "Cesta de Ovillos Merino",
          category: "furniture",
          icon: "🧺",
          unlocked: rows >= 25 || sessions >= 3,
          requirement: "25+ filas tejidas",
          flavorText: "Hebras suaves teñidas a mano con extractos botánicos de la colina.",
        },
        {
          id: "at_tapestry",
          name: "Tapiz del Gran Artesano",
          category: "trophy",
          icon: "🏆",
          unlocked: rows >= 80 || level >= 3,
          requirement: "80+ filas tejidas o Nivel 3+",
          flavorText: "Tapiz decorativo tejido con paciencia que ilumina la entrada del Atelier.",
        },
      ];
    case "libreria":
      return [
        {
          id: "lib_lectern",
          name: "Atril de Roble para Lectura",
          category: "furniture",
          icon: "📖",
          unlocked: books >= 1 || sessions >= 1,
          requirement: "1+ libro en catálogo o 1+ sesión",
          flavorText: "Soporte inclinado perfecto para sumergirse en historias sin fatiga cervical.",
        },
        {
          id: "lib_lantern",
          name: "Farol de Forja de Medianoche",
          category: "furniture",
          icon: "🏮",
          unlocked: sessions >= 3,
          requirement: "3+ sesiones de lectura",
          flavorText: "Proyecta una luz cálida ámbar ideal para leer en las noches de lluvia.",
        },
        {
          id: "lib_seal",
          name: "Sello Dorado del Archivero",
          category: "trophy",
          icon: "📜",
          unlocked: books >= 2 || level >= 3,
          requirement: "2+ libros o Nivel 3+",
          flavorText: "Distinción que premia la disciplina de completar lecturas de principio a fin.",
        },
      ];
    case "biblioteca":
      return [
        {
          id: "bib_desk",
          name: "Pupitre de Roble con Tintero",
          category: "furniture",
          icon: "🖋️",
          unlocked: sessions >= 1,
          requirement: "1+ sesión de estudio",
          flavorText: "Espacio despejado con tintero índigo listo para repasos de memoria activa.",
        },
        {
          id: "bib_hourglass",
          name: "Reloj de Arena Pomodoro",
          category: "furniture",
          icon: "⏳",
          unlocked: sessions >= 3,
          requirement: "3+ sesiones o repasos SM-2",
          flavorText: "Mide intervalos de estudio y descanso con arena de cuarzo de la cantera.",
        },
        {
          id: "bib_codex",
          name: "Códice de la Sabiduría",
          category: "trophy",
          icon: "🏛️",
          unlocked: level >= 3 || sessions >= 7,
          requirement: "Nivel 3+ o 7+ sesiones de estudio",
          flavorText: "Volumen encuadernado en cuero que atestigua conceptos dominados.",
        },
      ];
    case "club_puzzles":
      return [
        {
          id: "pz_mat",
          name: "Tapete de Speedcubing WCA",
          category: "furniture",
          icon: "🟩",
          unlocked: sessions >= 1,
          requirement: "1+ solve o sesión de cubos",
          flavorText: "Superficie de neopreno con amortiguación para paradas seguras de cronómetro.",
        },
        {
          id: "pz_display",
          name: "Marcador de Récords Digital",
          category: "furniture",
          icon: "⏱️",
          unlocked: pb !== null && pb !== undefined,
          requirement: "Primer Single PB registrado",
          flavorText: "Pantalla con dígitos esmeralda que conmemora tu mejor solve personal.",
        },
        {
          id: "pz_cup",
          name: "Copa Dorada de Torneo",
          category: "trophy",
          icon: "🥇",
          unlocked: (pb !== null && pb !== undefined && pb < 25) || level >= 3,
          requirement: "Single PB < 25s o Nivel 3+",
          flavorText: "Galardón de torneo que celebra la velocidad, el lookahead y la calma mental.",
        },
      ];
    case "observatorio":
      return [
        {
          id: "obs_cushion",
          name: "Almohadón Zen de Meditación",
          category: "furniture",
          icon: "🧘",
          unlocked: sessions >= 1,
          requirement: "1+ sesión de foco",
          flavorText: "Asiento de lino natural para entrar en la zona con postura alineada.",
        },
        {
          id: "obs_sphere",
          name: "Esfera Armilar de Latón",
          category: "furniture",
          icon: "🪐",
          unlocked: sessions >= 3 || focusMins >= 60,
          requirement: "3+ sesiones de Deep Work",
          flavorText: "Modelo astronómico que gira en silencio evocando la constancia del cosmos.",
        },
        {
          id: "obs_prism",
          name: "Prisma Cósmico de Claridad",
          category: "trophy",
          icon: "💎",
          unlocked: level >= 3 || focusMins >= 120,
          requirement: "Nivel 3+ o 120+ min de foco",
          flavorText: "Cristal puro que refracta la luz cuando la mente alcanza la calma imperturbable.",
        },
      ];
    case "pabellon_gardening":
    case "gardening":
      return [
        {
          id: "gar_watering_can",
          name: "Regadera de Cobre Forjado",
          category: "furniture",
          icon: "🪴",
          unlocked: sessions >= 1,
          requirement: "1+ sesión botánica o de riego",
          flavorText: "Regadera artesanal que distribuye gotas finas sin maltratar las plántulas tiernas.",
        },
        {
          id: "gar_terrarium",
          name: "Terrario de Musgo y Cuarzo",
          category: "furniture",
          icon: "🌿",
          unlocked: sessions >= 3 || level >= 2,
          requirement: "3+ sesiones o Nivel 2+",
          flavorText: "Microecosistema sellado donde florece el equilibrio paciente de la flora.",
        },
        {
          id: "gar_bonsai",
          name: "Bonsái Centenario de Roble",
          category: "trophy",
          icon: "🌳",
          unlocked: sessions >= 6 || level >= 3,
          requirement: "6+ sesiones botánicas o Nivel 3+",
          flavorText: "Árbol miniatura podado con esmero que simboliza la paciencia y el ritmo orgánico.",
        },
        {
          id: "gar_golden_orchid",
          name: "Orquídea Solar de Oakhaven",
          category: "relic",
          icon: "🌸",
          unlocked: sessions >= 10 || level >= 4,
          requirement: "10+ sesiones o Nivel 4+",
          flavorText: "Especie botánica legendaria que florece únicamente bajo cuidados diarios constantes.",
        },
      ];
    case "pabellon_hiking":
    case "hiking":
      return [
        {
          id: "hik_boots",
          name: "Botas de Cuero Curtido",
          category: "furniture",
          icon: "🥾",
          unlocked: sessions >= 1,
          requirement: "1+ ruta o caminata registrada",
          flavorText: "Calzado artesanal resistente adaptado a los senderos de montaña de Oakhaven.",
        },
        {
          id: "hik_compass",
          name: "Brújula de Latón Envejecido",
          category: "furniture",
          icon: "🧭",
          unlocked: sessions >= 3 || level >= 2,
          requirement: "3+ salidas o Nivel 2+",
          flavorText: "Instrumento confiable que orienta el paso en cualquier senda boscosa.",
        },
        {
          id: "hik_staff",
          name: "Bastón de Fresno Tallado",
          category: "trophy",
          icon: "🦯",
          unlocked: sessions >= 6 || level >= 3,
          requirement: "6+ salidas de senderismo o Nivel 3+",
          flavorText: "Apoyo tallado en madera noble que atestigua cientos de pasos de montaña.",
        },
        {
          id: "hik_summit_flag",
          name: "Estandarte del Mirador del Viento",
          category: "relic",
          icon: "🚩",
          unlocked: sessions >= 10 || level >= 4,
          requirement: "10+ salidas o Nivel 4+",
          flavorText: "Hito conmemorativo que celebra coronar las cumbres altas del valle.",
        },
      ];
    case "cocina":
    case "cooking":
      return [
        {
          id: "cook_spoon",
          name: "Cuchara de Olivo Tallada",
          category: "furniture",
          icon: "🥄",
          unlocked: sessions >= 1,
          requirement: "1+ receta o infusión preparada",
          flavorText: "Utensilio tradicional tallado a mano para remover caldos y salsas a fuego suave.",
        },
        {
          id: "cook_pot",
          name: "Olla de Hierro Fundido Esmaltada",
          category: "furniture",
          icon: "🍲",
          unlocked: sessions >= 3 || level >= 2,
          requirement: "3+ preparaciones o Nivel 2+",
          flavorText: "Conserva el calor con gentileza y distribuye la temperatura de forma homogénea.",
        },
        {
          id: "cook_grinder",
          name: "Mortero de Granito y Especias",
          category: "trophy",
          icon: "🥣",
          unlocked: sessions >= 6 || level >= 3,
          requirement: "6+ recetas conscientes o Nivel 3+",
          flavorText: "Herramienta noble para moler semillas, pimientas y hierbas aromáticas.",
        },
        {
          id: "cook_cauldron",
          name: "Caldero Dorado del Alquimista",
          category: "relic",
          icon: "🍯",
          unlocked: sessions >= 10 || level >= 4,
          requirement: "10+ sesiones culinarias o Nivel 4+",
          flavorText: "Distinción legendaria que reconoce la cocina como acto de amor y nutrición consciente.",
        },
      ];
    default:
      return [
        {
          id: "gen_chair",
          name: "Sillón de Descanso Rústico",
          category: "furniture",
          icon: "🪑",
          unlocked: true,
          requirement: "Disponible desde el inicio",
          flavorText: "Mobiliario básico para tomar una pausa y disfrutar de la serenidad del pueblo.",
        },
      ];
  }
}
