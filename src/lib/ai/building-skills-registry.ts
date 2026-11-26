/**
 * ============================================================================
 * OAKHAVEN AI — REGISTRO DE SKILLS EN RUNTIME Y CONTRATO DE RECURSOS POR EDIFICIO
 * ============================================================================
 * IMPORTANTE:
 * - Las skills de desarrollo en `.agents/skills/<nombre>/SKILL.md` son guías para agentes
 *   de programación en tiempo de desarrollo. NO se ejecutan en producción.
 * - Este archivo define las Skills reales que se ejecutan DENTRO de OakHaven
 *   (Presidente Rowan + los 8 especialistas, uno por edificio definitivo), con
 *   herramientas acotadas, permisos, niveles de autonomía y contrato de recursos.
 */

export type AiAutonomyLevel = 1 | 2 | 3;

export type MayorReadOnlyToolName =
  | "getLastReadBook"
  | "getLastKnittingActivity"
  | "getLastWatchedMedia"
  | "getRecentExpenses"
  | "getLastWorkout"
  | "getRecentCubeSolves"
  | "getPendingWorkProjects"
  | "getStudyProgress"
  | "getVillageSummary";

export type ResourceCategory =
  | "pattern"
  | "diagram"
  | "note"
  | "image"
  | "pdf"
  | "study_guide"
  | "academic_material"
  | "project_spec"
  | "code_snippet"
  | "deliverable"
  | "poster"
  | "review"
  | "watchlist_export"
  | "cultural_link"
  | "bank_statement"
  | "receipt"
  | "budget_sheet"
  | "workout_plan"
  | "algorithm_sheet"
  | "book_quote"
  | "reading_note";

export interface BuildingResourceContract {
  buildingId: string;
  buildingLabel: string;
  allowedCategories: ResourceCategory[];
  allowedMimeTypes: string[];
  maxSizeBytes: number;
  description: string;
}

export interface RuntimeBuildingSkill {
  skillId: string;
  buildingId: string;
  residentId: string;
  name: string;
  role: string;
  description: string;
  specializedInstructions: string;
  allowedTools: MayorReadOnlyToolName[];
  acceptedResourceCategories: ResourceCategory[];
  autonomyLevel: AiAutonomyLevel;
  permissions: {
    canReadOwnUserData: boolean;
    canProposeMutationsWithConfirmation: boolean;
    canExecutePaymentsOrMutateCop: false;
    canMutateGpOrXpDirectly: false;
  };
  providerConfig: {
    provider: "google_genai";
    model: string;
    maxOutputTokens: number;
    temperature: number;
  };
  enabledByDefault: boolean;
}

export const RESOURCE_CONTRACT_BY_BUILDING: Record<string, BuildingResourceContract> = {
  atelier: {
    buildingId: "atelier",
    buildingLabel: "Crochet (Atelier)",
    allowedCategories: ["pattern", "diagram", "note", "image", "pdf"],
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/markdown"],
    maxSizeBytes: 5 * 1024 * 1024,
    description: "Patrones de tejido, diagramas de puntos, notas de vueltas, fotos de avance y PDFs.",
  },
  biblioteca: {
    buildingId: "biblioteca",
    buildingLabel: "Estudio (Academia)",
    allowedCategories: ["study_guide", "academic_material", "note", "pdf", "image"],
    allowedMimeTypes: ["application/pdf", "text/plain", "text/markdown", "image/png", "image/jpeg", "image/webp"],
    maxSizeBytes: 10 * 1024 * 1024,
    description: "Guías de estudio, apuntes, fichas académicas y documentos de referencia.",
  },
  oficina: {
    buildingId: "oficina",
    buildingLabel: "Trabajo (Oficina)",
    allowedCategories: ["project_spec", "code_snippet", "deliverable", "note", "pdf"],
    allowedMimeTypes: ["application/pdf", "text/plain", "text/markdown", "application/json", "image/png", "image/jpeg"],
    maxSizeBytes: 10 * 1024 * 1024,
    description: "Especificaciones, documentos de proyecto, fragmentos de código y entregables.",
  },
  cine: {
    buildingId: "cine",
    buildingLabel: "Cine Boutique",
    allowedCategories: ["poster", "review", "watchlist_export", "cultural_link", "note"],
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown", "application/json"],
    maxSizeBytes: 5 * 1024 * 1024,
    description: "Pósteres, reseñas personales, listas de visionado y enlaces culturales.",
  },
  banco_oakhaven: {
    buildingId: "banco_oakhaven",
    buildingLabel: "Banco de OakHaven",
    allowedCategories: ["bank_statement", "receipt", "budget_sheet"],
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/csv"],
    maxSizeBytes: 8 * 1024 * 1024,
    description: "Extractos bancarios, comprobantes de gasto y hojas de presupuesto (solo lectura/auditoría).",
  },
  gimnasio: {
    buildingId: "gimnasio",
    buildingLabel: "Gym",
    allowedCategories: ["workout_plan", "note", "image", "pdf"],
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown"],
    maxSizeBytes: 5 * 1024 * 1024,
    description: "Rutinas de entrenamiento, notas de técnica y registros de progreso físico.",
  },
  club_puzzles: {
    buildingId: "club_puzzles",
    buildingLabel: "Cubos (Club WCA)",
    allowedCategories: ["algorithm_sheet", "note", "image", "pdf"],
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown"],
    maxSizeBytes: 5 * 1024 * 1024,
    description: "Hojas de algoritmos (F2L/OLL/PLL), notas de calibración y gráficas de tiempos.",
  },
  libreria: {
    buildingId: "libreria",
    buildingLabel: "Lectura (Librería)",
    allowedCategories: ["book_quote", "reading_note", "note", "image", "pdf"],
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "text/plain", "text/markdown", "application/pdf"],
    maxSizeBytes: 5 * 1024 * 1024,
    description: "Citas literarias, notas de lectura, portadas y reseñas de libros.",
  },
};

export interface ResourceValidationInput {
  buildingId: string;
  resourceCategory: ResourceCategory;
  mimeType: string;
  sizeBytes: number;
  ownerId: string;
  authenticatedUserId: string;
}

export function validateBuildingResourceUpload(
  input: ResourceValidationInput
): { valid: boolean; error?: string } {
  if (!input.authenticatedUserId || input.ownerId !== input.authenticatedUserId) {
    return { valid: false, error: "Propietario inválido o sin autorización para este recurso." };
  }
  const contract = RESOURCE_CONTRACT_BY_BUILDING[input.buildingId];
  if (!contract) {
    return { valid: false, error: `El edificio "${input.buildingId}" no tiene un contrato de recursos activo.` };
  }
  if (!contract.allowedCategories.includes(input.resourceCategory)) {
    return {
      valid: false,
      error: `La categoría "${input.resourceCategory}" no está permitida en ${contract.buildingLabel}.`,
    };
  }
  const normalizedMime = (input.mimeType || "").trim().toLowerCase();
  if (!contract.allowedMimeTypes.includes(normalizedMime)) {
    return {
      valid: false,
      error: `Tipo MIME "${normalizedMime || "desconocido"}" no permitido en ${contract.buildingLabel}.`,
    };
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > contract.maxSizeBytes) {
    return {
      valid: false,
      error: `Tamaño de archivo inválido (máximo ${Math.round(contract.maxSizeBytes / (1024 * 1024))} MB).`,
    };
  }
  return { valid: true };
}

const DEFAULT_PROVIDER = {
  provider: "google_genai" as const,
  model: "gemini-2.5-flash",
  maxOutputTokens: 450,
  temperature: 0.2,
};

export const MAYOR_ROWAN_SKILL: RuntimeBuildingSkill = {
  skillId: "oakhaven.mayor.rowan",
  buildingId: "ayuntamiento",
  residentId: "rowan",
  name: "Presidente Rowan",
  role: "Presidente del Pueblo y Orquestador Central de Conocimiento",
  description:
    "Asistente central de solo lectura conectado a los datos reales del jugador en los 8 edificios. Responde consultas históricas con fecha y fuente verificada sin inventar cifras.",
  specializedInstructions:
    "Responde en español con tono cálido, sereno y preciso. Usa únicamente los datos devueltos por las herramientas verificadas. Indica siempre fecha y origen de cada dato. Si falta un dato o vive solo en localStorage de otro dispositivo, dilo explícitamente. Nunca ejecutes pagos ni modifiques GP, XP o COP.",
  allowedTools: [
    "getLastReadBook",
    "getLastKnittingActivity",
    "getLastWatchedMedia",
    "getRecentExpenses",
    "getLastWorkout",
    "getRecentCubeSolves",
    "getPendingWorkProjects",
    "getStudyProgress",
    "getVillageSummary",
  ],
  acceptedResourceCategories: ["note"],
  autonomyLevel: 1,
  permissions: {
    canReadOwnUserData: true,
    canProposeMutationsWithConfirmation: false,
    canExecutePaymentsOrMutateCop: false,
    canMutateGpOrXpDirectly: false,
  },
  providerConfig: DEFAULT_PROVIDER,
  enabledByDefault: true,
};

export const BUILDING_SPECIALIST_SKILLS: RuntimeBuildingSkill[] = [
  {
    skillId: "oakhaven.specialist.banco.silas",
    buildingId: "banco_oakhaven",
    residentId: "silas",
    name: "Silas",
    role: "Especialista en Finanzas Personales",
    description: "Audita flujo quincenal, gastos recientes y presupuesto de forma determinista.",
    specializedInstructions: "Explica cifras reales en COP sin emitir juicios ni ejecutar pagos o transferencias.",
    allowedTools: ["getRecentExpenses", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.banco_oakhaven.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
  {
    skillId: "oakhaven.specialist.estudio.lyra",
    buildingId: "biblioteca",
    residentId: "lyra",
    name: "Lyra",
    role: "Tutora Académica",
    description: "Acompaña sesiones de estudio, materias y repasos espaciados SM-2.",
    specializedInstructions: "Resume avances de estudio y sugiere bloques sostenibles sin presión.",
    allowedTools: ["getStudyProgress", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.biblioteca.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
  {
    skillId: "oakhaven.specialist.trabajo.aura",
    buildingId: "oficina",
    residentId: "aura",
    name: "Aura",
    role: "Especialista en Proyectos y Programación",
    description: "Organiza proyectos pendientes, entregables y sesiones de foco profesional.",
    specializedInstructions: "Prioriza claridad en entregables sin inventar ingresos en COP por horas trabajadas.",
    allowedTools: ["getPendingWorkProjects", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.oficina.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
  {
    skillId: "oakhaven.specialist.gym.bruno",
    buildingId: "gimnasio",
    residentId: "bruno",
    name: "Bruno",
    role: "Entrenador de Vitalidad",
    description: "Sigue historial de entrenamientos, intensidad RPE y descanso sin culpa.",
    specializedInstructions: "Celebra la constancia y recuerda que descansar es parte del entrenamiento.",
    allowedTools: ["getLastWorkout", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.gimnasio.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
  {
    skillId: "oakhaven.specialist.cubos.milo",
    buildingId: "club_puzzles",
    residentId: "milo",
    name: "Milo",
    role: "Entrenador WCA",
    description: "Analiza tiempos de cubos, PB, Ao5/Ao12 y práctica de algoritmos.",
    specializedInstructions: "Reporta tiempos reales con precisión de centésimas sin inventar récords.",
    allowedTools: ["getRecentCubeSolves", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.club_puzzles.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
  {
    skillId: "oakhaven.specialist.lectura.eldrin",
    buildingId: "libreria",
    residentId: "eldrin",
    name: "Eldrin",
    role: "Especialista Literario",
    description: "Acompaña tu biblioteca personal, libros en curso, terminados y citas.",
    specializedInstructions: "Distingue entre libro agregado recientemente, lectura reciente y libro terminado.",
    allowedTools: ["getLastReadBook", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.libreria.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
  {
    skillId: "oakhaven.specialist.cine.nora",
    buildingId: "cine",
    residentId: "nora",
    name: "Nora",
    role: "Curadora Cultural de Cine y Musicales",
    description: "Acompaña tu cartelera personal de películas, series y musicales sin presión.",
    specializedInstructions: "Consulta tu catálogo de Cine y advierte si el dato vive solo en el navegador local.",
    allowedTools: ["getLastWatchedMedia", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.cine.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
  {
    skillId: "oakhaven.specialist.crochet.clara",
    buildingId: "atelier",
    residentId: "clara",
    name: "Clara",
    role: "Maestra de Tejido",
    description: "Sigue proyectos de crochet, vueltas completadas, patrones y sesiones en el Atelier.",
    specializedInstructions:
      "Reporta vueltas exactas y proyecto activo sin exigir velocidad ni cronómetro. Domina el Filet Crochet desde nivel principiante absoluto (explicando sin jerga qué es una casilla abierta/llena y cómo leer en zigzag de abajo hacia arriba) hasta patrones históricos de Antique Pattern Library (Priscilla, Kirchmaier, Anne Orr, DMC, Richardson, Lacis): gráficos con cuadros sólidos, gráficos antiguos con cruces (X), técnicas Lacet/Bar, mallas de 3 y 4, aumentos/disminuciones escalonadas y equivalencia de hilos mercerizados antiguos (#10–#80) a ganchillos modernos.",
    allowedTools: ["getLastKnittingActivity", "getVillageSummary"],
    acceptedResourceCategories: RESOURCE_CONTRACT_BY_BUILDING.atelier.allowedCategories,
    autonomyLevel: 1,
    permissions: {
      canReadOwnUserData: true,
      canProposeMutationsWithConfirmation: true,
      canExecutePaymentsOrMutateCop: false,
      canMutateGpOrXpDirectly: false,
    },
    providerConfig: DEFAULT_PROVIDER,
    enabledByDefault: true,
  },
];

export const ALL_RUNTIME_SKILLS: RuntimeBuildingSkill[] = [
  MAYOR_ROWAN_SKILL,
  ...BUILDING_SPECIALIST_SKILLS,
];

export function getSkillByBuildingId(buildingId: string): RuntimeBuildingSkill | undefined {
  return ALL_RUNTIME_SKILLS.find((s) => s.buildingId === buildingId);
}
