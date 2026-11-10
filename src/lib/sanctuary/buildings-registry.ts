import type { SanctuaryBuildingDefinition } from "./types";
import type { SkillDomain } from "@/types/rpg";

/**
 * REGISTRO CENTRAL DE EDIFICIOS DEL SANTUARIO — COZY PIXEL ART TOWN
 * Desacoplado y extensible: los 6 edificios nucleares y los 8 pabellones complementarios.
 */
export const SANCTUARY_BUILDINGS: SanctuaryBuildingDefinition[] = [
  // 1. EL ATELIER (TEJIDO & ARTESANÍA)
  {
    id: "atelier",
    domain: "knitting",
    name: "El Atelier de Hilados",
    subtitle: "Taller artesanal de tejido, crochet, telar y patronaje",
    category: "artesania",
    badge: "🧶 Atelier",
    pixelArtIcon: "🧶",
    route: "/skills/knitting",
    defaultMinutes: 45,
    lore: "Rincón acogedor entre madejas de lana virgen, agujas de bambú y luz de tarde. Aquí el tiempo se mide en vueltas concluidas y piezas forjadas con calma.",
    specializedFeatures: [
      "Contador de vueltas táctil (+1, +5, -1)",
      "Bitácora de puntadas y aumentos",
      "Control de proyectos (progreso fraccionario)",
      "Bono determinista de +6.000 GP al culminar proyecto",
    ],
    colorTheme: {
      bgMuted: "bg-[#25201C]",
      borderMuted: "border-[#4A3C31]",
      accentSage: "text-[#88A98E]",
      goldText: "text-[#E9C46A]",
    },
  },

  // 2. LA LIBRERÍA (COLECCIÓN & LECTURA)
  {
    id: "libreria",
    domain: "reading",
    name: "La Librería & Archivo",
    subtitle: "Colección personal de tomos, estantería y lectura serena",
    category: "intelecto",
    badge: "📖 Librería",
    pixelArtIcon: "📖",
    route: "/skills/reading",
    defaultMinutes: 30,
    lore: "Estanterías de roble que huelen a papel añejo y encuadernaciones de cuero. Cada página leída nutre tu perspectiva y forja sabiduría inmutable.",
    specializedFeatures: [
      "Estantería interactiva con portadas",
      "Captura rápida de frases célebres (+250 GP)",
      "Calculadora de páginas leídas hoy",
      "Curador con IA para extracción de ISBN",
    ],
    colorTheme: {
      bgMuted: "bg-[#1E231F]",
      borderMuted: "border-[#3B4D3F]",
      accentSage: "text-[#88A98E]",
      goldText: "text-[#E9C46A]",
    },
  },

  // 3. LA BIBLIOTECA (ESTUDIO & MEMORIA)
  {
    id: "biblioteca",
    domain: "study",
    name: "La Biblioteca del Erudito",
    subtitle: "Estudio profundo, materias y repetición espaciada SM-2",
    category: "intelecto",
    badge: "🎓 Biblioteca",
    pixelArtIcon: "🎓",
    route: "/skills/study",
    defaultMinutes: 50,
    lore: "Mesas de nogal bajo lámparas verdes de banquero. Diseñada para la asimilación conceptual rigurosa y duelos de memoria sin distracciones.",
    specializedFeatures: [
      "Pomodoro 25/5 y Deep Study 50/10",
      "Duelo de Repetición Espaciada SM-2",
      "Clasificación por Materias y Temas",
      "Active Recall y autoevaluación",
    ],
    colorTheme: {
      bgMuted: "bg-[#201D28]",
      borderMuted: "border-[#453A5A]",
      accentSage: "text-[#A78BFA]",
      goldText: "text-[#E9C46A]",
    },
  },

  // 4. LA OFICINA (TRABAJO & AGILE)
  {
    id: "oficina",
    domain: "work",
    name: "La Oficina Estratégica",
    subtitle: "Gestión de proyectos laborales, Kanban y entregables de impacto",
    category: "enfoque",
    badge: "💼 Oficina",
    pixelArtIcon: "💼",
    route: "/skills/work",
    defaultMinutes: 45,
    lore: "Centro de mando táctico para transformar el caos operativo en entregables concretos mediante Scrum, Kanban y sprints de alto rendimiento.",
    specializedFeatures: [
      "Tablero Kanban por etapas ágiles",
      "Control de Tareas y Prioridades",
      "Multiplicador de GP por Alto Impacto",
      "Generador de proyectos con IA Gemini",
    ],
    colorTheme: {
      bgMuted: "bg-[#1B232E]",
      borderMuted: "border-[#32455A]",
      accentSage: "text-[#60A5FA]",
      goldText: "text-[#E9C46A]",
    },
  },

  // 5. EL OBSERVATORIO (DEEP WORK & CONCENTRACIÓN)
  {
    id: "observatorio",
    domain: "general",
    name: "El Observatorio de Enfoque",
    subtitle: "Cúpula de alta concentración, cero fricción y métricas de claridad",
    category: "enfoque",
    badge: "🔭 Observatorio",
    pixelArtIcon: "🔭",
    route: "/skills/general",
    defaultMinutes: 60,
    lore: "Ubicado en la colina más alta del pueblo bajo la bóveda celeste. Un santuario libre de notificaciones para sesiones de flujo cognitivo absoluto.",
    specializedFeatures: [
      "Temporizador de Enfoque Cero Distracciones",
      "Contador de Interrupciones mitigadas",
      "Calificación de Claridad Post-Sesión",
      "Sincronización directa con Notion",
    ],
    colorTheme: {
      bgMuted: "bg-[#1A2228]",
      borderMuted: "border-[#314856]",
      accentSage: "text-[#38BDF8]",
      goldText: "text-[#E9C46A]",
    },
  },

  // 6. EL CLUB DE PUZZLES (SPEEDCUBING WCA)
  {
    id: "club_puzzles",
    domain: "rubik",
    name: "El Club de Speedcubing",
    subtitle: "Entrenamiento oficial WCA, scrambles y arsenal de cubos",
    category: "maestria",
    badge: "🧊 Club Puzzles",
    pixelArtIcon: "🧊",
    route: "/skills/rubik",
    defaultMinutes: 30,
    lore: "Giro magnético, lubricantes de silicona y cronómetros digitales. El templo de la destreza visomotora y la resolución de algoritmos WCA.",
    specializedFeatures: [
      "Cronómetro WCA con barra espaciadora",
      "Generación de scrambles oficiales",
      "Cálculo estricto de Ao5 y Ao12",
      "Ficha técnica y arsenal físico",
    ],
    colorTheme: {
      bgMuted: "bg-[#182329]",
      borderMuted: "border-[#2D4552]",
      accentSage: "text-[#2DD4BF]",
      goldText: "text-[#E9C46A]",
    },
  },

  // --- PABELLONES COMPLEMENTARIOS DEL SANTUARIO ---
  {
    id: "invernadero",
    domain: "gardening",
    name: "Invernadero Botánico",
    subtitle: "Cuidado vegetal consciente, riego y propagación",
    category: "bienestar",
    badge: "🌱 Invernadero",
    pixelArtIcon: "🌱",
    route: "/skills/gardening",
    defaultMinutes: 30,
    lore: "Bajo los paneles de vidrio templado crecen esquejes y flores aromáticas. La paciencia de la naturaleza como remedio contra la prisa.",
    specializedFeatures: ["Bitácora de riego", "Propagación de esquejes", "Pausa restaurativa"],
    colorTheme: { bgMuted: "bg-[#1F271E]", borderMuted: "border-[#3B4D3F]", accentSage: "text-[#88A98E]", goldText: "text-[#E9C46A]" },
  },
  {
    id: "taller_arte",
    domain: "drawing",
    name: "Taller de Ilustración & Bocetos",
    subtitle: "Sketchbook, acuarela y exploración plástica libre",
    category: "artesania",
    badge: "🎨 Taller Arte",
    pixelArtIcon: "🎨",
    route: "/skills/drawing",
    defaultMinutes: 45,
    lore: "Caballetes, carboncillos y manchas de tinta. Crear por el puro placer del trazo sin la tiranía del resultado final.",
    specializedFeatures: ["Temporizador de bocetos", "Galería de estudios", "Técnica sin perfeccionismo"],
    colorTheme: { bgMuted: "bg-[#27211E]", borderMuted: "border-[#4D3F3B]", accentSage: "text-[#F87171]", goldText: "text-[#E9C46A]" },
  },
  {
    id: "alfareria",
    domain: "ceramics",
    name: "Taller de Arcilla & Cerámica",
    subtitle: "Modelado manual, texturas táctiles y secado",
    category: "artesania",
    badge: "🏺 Alfarería",
    pixelArtIcon: "🏺",
    route: "/skills/ceramics",
    defaultMinutes: 60,
    lore: "Barro húmedo, torno giratorio y conexión sensorial con la tierra. La artesanía más elemental para reconectar las manos con la materia.",
    specializedFeatures: ["Registro de piezas", "Estado de secado y horneado", "Tiempo táctil"],
    colorTheme: { bgMuted: "bg-[#29221D]", borderMuted: "border-[#4D3E35]", accentSage: "text-[#FB923C]", goldText: "text-[#E9C46A]" },
  },
  {
    id: "puesto_guias",
    domain: "hiking",
    name: "Puesto de Senderismo & Montaña",
    subtitle: "Caminatas conscientes, exploración urbana y pasos activos",
    category: "bienestar",
    badge: "🥾 Senderismo",
    pixelArtIcon: "🥾",
    route: "/skills/hiking",
    defaultMinutes: 40,
    lore: "Botas de travesía, mapas de senderos y cantimploras de metal. Desconexión digital mediante el movimiento continuo a cielo abierto.",
    specializedFeatures: ["Contador de pasos/distancia", "Notas de fauna y clima", "Desconexión de pantallas"],
    colorTheme: { bgMuted: "bg-[#25231D]", borderMuted: "border-[#4D4537]", accentSage: "text-[#A3E635]", goldText: "text-[#E9C46A]" },
  },
  {
    id: "cocina",
    domain: "cooking",
    name: "Cocina & Laboratorio Experimental",
    subtitle: "Nutrición consciente, panadería y alquimia culinaria",
    category: "artesania",
    badge: "🍳 Cocina",
    pixelArtIcon: "🍳",
    route: "/skills/cooking",
    defaultMinutes: 45,
    lore: "Especias molidas, sartenes de hierro y fuego lento. El placer de cocinar con calma y nutrir el cuerpo con ingredientes reales.",
    specializedFeatures: ["Fichas de recetas", "Tiempo de fermentación/cocción", "Notas de cata"],
    colorTheme: { bgMuted: "bg-[#27201D]", borderMuted: "border-[#4E3F39]", accentSage: "text-[#FBBF24]", goldText: "text-[#E9C46A]" },
  },
  {
    id: "santuario_zen",
    domain: "journaling",
    name: "Santuario de Journaling & Zen",
    subtitle: "Introspección libre de culpa, victorias y balance mental",
    category: "bienestar",
    badge: "✍️ Journaling",
    pixelArtIcon: "✍️",
    route: "/skills/journaling",
    defaultMinutes: 20,
    lore: "Velas de cera de abejas y silencio apacible. Tu bitácora para asentar victorias diarias y soltar el ruido del mundo.",
    specializedFeatures: ["Preguntas guiadas", "Registro de victorias libres de culpa", "Reflexión del día"],
    colorTheme: { bgMuted: "bg-[#222026]", borderMuted: "border-[#423C4D]", accentSage: "text-[#C084FC]", goldText: "text-[#E9C46A]" },
  },
  {
    id: "arcade",
    domain: "gaming",
    name: "Salón Arcade Consciente",
    subtitle: "Partidas estratégicas, límite anti-tilt y notas de juego",
    category: "maestria",
    badge: "🎮 Arcade",
    pixelArtIcon: "🎮",
    route: "/skills/gaming",
    defaultMinutes: 40,
    lore: "Jugar con presencia, foco y sin caer en el bucle tóxico. El disfrute del desafío mecánico con temporizador de corte consciente.",
    specializedFeatures: ["Alarma Anti-Tilt a los 40m", "Notas de estrategia de juego", "Registro de partidas"],
    colorTheme: { bgMuted: "bg-[#1E1D28]", borderMuted: "border-[#3A374F]", accentSage: "text-[#818CF8]", goldText: "text-[#E9C46A]" },
  },
  {
    id: "dojo",
    domain: "sports",
    name: "Dojo & Acondicionamiento Físico",
    subtitle: "Fuerza, movilidad, carrera y seguimiento de intensidad",
    category: "bienestar",
    badge: "🏅 Dojo",
    pixelArtIcon: "🏅",
    route: "/skills/sports",
    defaultMinutes: 50,
    lore: "Tatami y pesas libres. Forjar la armadura física del aventurero para sostener la energía mental en todas las demás misiones.",
    specializedFeatures: ["Nivel de esfuerzo percibido", "Duración e hidratación", "Multiplicador de vigor"],
    colorTheme: { bgMuted: "bg-[#261E1E]", borderMuted: "border-[#4F3939]", accentSage: "text-[#F87171]", goldText: "text-[#E9C46A]" },
  },
];

export function getBuildingByDomain(domain: SkillDomain): SanctuaryBuildingDefinition {
  const match = SANCTUARY_BUILDINGS.find((b) => b.domain === domain);
  return (
    match ||
    SANCTUARY_BUILDINGS.find((b) => b.id === "observatorio") ||
    SANCTUARY_BUILDINGS[0]
  );
}

export function getBuildingById(id: string): SanctuaryBuildingDefinition | undefined {
  return SANCTUARY_BUILDINGS.find((b) => b.id === id);
}
