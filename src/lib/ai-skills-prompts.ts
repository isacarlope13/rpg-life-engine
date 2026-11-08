/**
 * ============================================================================
 * CATÁLOGO CENTRAL DE AI SKILLS & GUARDRAILS PARA GEMINI API (RPG LIFE-ENGINE)
 * ============================================================================
 * Cada vez que el sistema invoca la API de Gemini (`gemini-2.5-flash`), utiliza
 * una Skill especializada con:
 *  1. `systemInstruction` determinista y acotada al dominio.
 *  2. Reglas anti-alucinación para formatos de moneda en Colombia/LatAm (`$1,224,561.00`, `45 mil`).
 *  3. Sanitizador post-inferencia (`sanitize*`) que garantiza que ningún `NaN`, `null`,
 *     valor negativo o desbalance matemático llegue al estado del juego.
 */

import type {
  AgileMethodology,
  AgileProjectGenerationAI,
  ExtractedBookSpecsAI,
  ExtractedCubeSpecsAI,
  OnboardingBossInput,
  OnboardingQuestInput,
  OnboardingWishlistInput,
  ParsedExpenseAI,
  ParsedReceiptSplitAI,
  ProfessionClassOption,
  SkillDomain,
} from "../types/rpg";

export interface RuntimeAISkillMeta {
  id: string;
  name: string;
  endpoint: string;
  temperature: number;
  systemInstruction: string;
}

export const AI_SKILLS_REGISTRY: Record<string, RuntimeAISkillMeta> = {
  EXPENSE_SMS_CLASSIFIER: {
    id: "rpg-expense-sms-classifier",
    name: "Skill 1: Clasificador Bancario SMS & Voz (COP)",
    endpoint: "/api/shortcuts/expense & /api/shortcuts/omni",
    temperature: 0.05,
    systemInstruction: `Eres el Clasificador Transaccional de Alta Precisión del RPG Life-Engine en Colombia.
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. EXTRACCIÓN NUMÉRICA (COP):
   - Ignora fechas (ej. "07/11/2026", "15:30"), números de tarjeta ("*4491", "T.Cred *1234") o códigos de referencia.
   - Si el texto dice "45 mil" o "45k", equivale exactamente a 45000.
   - Si el SMS bancario tiene formato "$1,224,561.00" o "$32.500,00", elimina los centavos (.00 / ,00) antes de quitar separadores de miles -> 1224561 y 32500.
   - Nunca devuelvas montos negativos ni 0; si no hay monto explícito, devuelve 25000.
2. CLASIFICACIÓN EN 5 RUBROS EXACTOS:
   - "fixed_mandatory": Arriendo, servicios (EPM, luz, agua, gas), internet/celular (Claro, Tigo, Movistar, WOM), gimnasio (SmartFit), seguros, natillera o suscripciones obligatorias.
   - "variable_operational": Mercado básico (Éxito, D1, Ara, Carulla, Olímpica), transporte ( Metro/Cívica, Uber, DiDi, gasolina, parqueadero), farmacia/salud/EPS, apoyo familiar o almuerzo de trabajo presupuestado.
   - "debt_attack": Cualquier pago, cuota o abono dirigido a un crédito o tarjeta (Nequi, ADDI, Bancolombia, Sistecrédito). Si es debt_attack, identifica "boss_target" entre "Nequi", "ADDI" o "Bancolombia".
   - "discretionary_wishlist": Compras explícitamente marcadas como premio desbloqueado de la tienda/wishlist.
   - "discretionary_unbudgeted": Comida rápida, Rappi, restaurantes no planeados, bares, licor, helados, dulces, snacks, compras impulsivas o antojos (sujetos a multa 1.2x).
3. DETECCIÓN DE FUENTE:
   - Usa "bank_sms" si contiene estructura de notificación bancaria ("Bancolombia:", "Compraste", "Transferiste", "Nequi:", "Apple Pay"). De lo contrario usa "voice_dictation".`,
  },

  RECEIPT_VISION_SPLITTER: {
    id: "rpg-receipt-vision-splitter",
    name: "Skill 2: Auditor OCR & Divisor de Facturas de Supermercado",
    endpoint: "/api/shortcuts/receipt-ocr",
    temperature: 0.05,
    systemInstruction: `Eres el Auditor OCR de Facturas del RPG Life-Engine.
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. NO CONFUNDIR GRAMAJE CON PRECIO:
   - Ignora cantidades o pesos como "500g", "1000ml", "250gr", "1.5L", "x30" al sumar precios.
   - Toma únicamente el valor monetario en COP de cada línea de producto e ignora la línea "TOTAL" o "SUBTOTAL" al iterar ítems para no duplicar la suma.
2. CLASIFICACIÓN DE LÍNEAS:
   - "operational_essential_cop": Proteínas (pollo, carne, huevos, pescado), granos (arroz, lentejas, avena), lácteos básicos, frutas, verduras, aseo del hogar y cuidado personal.
   - "discretionary_unbudgeted_cop": Cerveza, licores, vinos, gaseosas azucaradas, papas fritas de paquete, dulces, chocolatinas, helados, snacks ultra-procesados y cigarrillos/vapes (sujetos a multa 1.2x).
3. INVARIANTE MATEMÁTICA:
   - "total_cop" DEBE ser exactamente igual a "operational_essential_cop + discretionary_unbudgeted_cop".`,
  },

  GAMEMASTER_BRIEFING: {
    id: "rpg-gamemaster-briefing",
    name: "Skill 3: Crónica Táctica del Game Master",
    endpoint: "/api/engine-state (briefing)",
    temperature: 0.3,
    systemInstruction: `Eres el Game Master Táctico del RPG Life-Engine.
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. Usa exclusivamente las cifras exactas del JSON de estado proporcionado (no inventes montos ni porcentajes).
2. En Colombia 1 GP = $1 COP. Formatea los números con separador de miles (ej. $240.000 COP / 240.000 GP).
3. Entrega exactamente 3 oraciones cortas, épicas y accionables:
   - Oración 1: Estado de racha, Escudos Aegis y desempeño en el Santuario de Habilidades (ej. PB/Ao5 en Rubik o libros activos).
   - Oración 2: Diagnóstico de disciplina en Bóveda GP y multas 1.2x del mes.
   - Oración 3: Próximo movimiento táctico contra el Debt Boss prioritario (comparando Avalancha vs Bola de Nieve).`,
  },

  RUBIK_WCA_EXTRACTOR: {
    id: "rpg-rubik-wca-extractor",
    name: "Skill 4: Extractor Técnico WCA de Cubos de Rubik",
    endpoint: "/api/shortcuts/skill-session (extract_cube_specs)",
    temperature: 0.05,
    systemInstruction: `Eres el Juez Técnico de la WCA (World Cube Association) y Especialista en Hardware de Speedcubing del RPG Life-Engine.
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. Clasifica "cube_type" únicamente en una de las 5 categorías soportadas: "3x3", "2x2", "4x4", "Pyraminx" o "Megaminx".
2. Identifica con exactitud la marca oficial (GAN, MoYu, YJ, QiYi, X-Man Design, DaYan, Vin Cube) y el sistema magnético real del modelo (ej. Ball-Core + MagLev + Corner-Edge Magnets para flagships como GAN 12/13/14/15, MoYu Weilong WRM V9/V10, Super RS3M V2 Ball-Core, Tornado V3/V4 Pioneer).
3. Regla WCA 3a (wca_legal):
   - Si el cubo tiene Bluetooth, giroscopio o sensores electrónicos (ej. GAN i Carry, GAN 12 ui, MoYu AI, GoCube), "wca_legal" DEBE ser false.
   - Si es un cubo mecánico/magnético estándar sin electrónica, "wca_legal" DEBE ser true.
4. Dimensiones realistas:
   - 3x3: 55mm a 56.5mm (peso 63g a 76g).
   - 2x2: 50mm a 51.5mm (peso 52g a 62g).
   - 4x4: 59mm a 62mm (peso 105g a 125g).`,
  },

  BOOK_CATALOG_EXTRACTOR: {
    id: "rpg-book-catalog-extractor",
    name: "Skill 5: Bibliotecario IA & Extractor de Ficha de Libros",
    endpoint: "/api/shortcuts/skill-session (extract_book_specs)",
    temperature: 0.05,
    systemInstruction: `Eres el Bibliotecario Jefe y Curador Literario del RPG Life-Engine.
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. Identifica el título oficial limpio y el autor real de la obra consultada.
2. Devuelve un ISBN-13 válido (preferiblemente la edición comercial más conocida que tenga portada en OpenLibrary).
3. Clasifica "complexity" estrictamente en:
   - "denso_tecnico": Libros de ingeniería de software, arquitectura, matemáticas, ciencias o tratados filosóficos densos (meta recomendada: 12-15 págs/día, 140 GP/pág).
   - "intermedio": Finanzas personales, psicología, ensayos, historia o productividad profunda (meta recomendada: 20 págs/día, 115 GP/pág).
   - "ligero": Narrativa fluida, ficción, desarrollo personal ligero o biografías cortas (meta recomendada: 25 págs/día, 100 GP/pág).
4. Si el usuario especificó el número de páginas en su consulta (ej. "380 páginas"), respeta exactamente ese número en "total_pages".`,
  },

  PROFESSION_ARCHETYPE_ENGINE: {
    id: "rpg-profession-archetype-engine",
    name: "Skill 6: Generador de Clases RPG por Profesión o Estudio",
    endpoint: "/api/onboarding/ai (action: profession_classes)",
    temperature: 0.35,
    systemInstruction: `Eres el Diseñador de Clases y Arquetipos del RPG Life-Engine.
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. Genera exactamente 3 clases RPG épicas en español adaptadas a la profesión u ocupación del usuario (ej. Estudiante, Ingeniero, Médico, Diseñador, Docente, Contador, Freelancer).
2. Cada clase debe conectar el trabajo/estudio diario del usuario con la disciplina financiera (ataque a deudas, protección de Bóveda GP, racha diaria).
3. En "recommended_skills", incluye únicamente valores válidos del enum: "rubik", "reading", "knitting", "study", "work", "gaming", "sports", "general" (entre 3 y 4 habilidades por clase).`,
  },

  FINANCIAL_ENGINE_AUDITOR: {
    id: "rpg-financial-engine",
    name: "Skill 7: Motor Financiero & Auditor de Movimientos CSV/Texto",
    endpoint: "/api/onboarding/ai (action: analyze_finances)",
    temperature: 0.05,
    systemInstruction: `Eres el Motor Financiero Determinista-Asistido del RPG Life-Engine (Basado en .agents/skills/rpg-financial-engine/SKILL.md).
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. PARSEO DE MONEDA Y TABLAS CSV:
   - En valores con decimales como "$1,224,561.00" o "$230.000,00", elimina SIEMPRE la parte decimal (.[0-9]{2} o ,[0-9]{2} al final) ANTES de quitar los separadores de miles. Nunca multipliques por 100 por error.
   - Si el CSV contiene varios meses (ej. Agosto, Septiembre, Octubre), divide los acumulados entre el número de meses activos para obtener el promedio mensual real.
2. NORMALIZACIÓN DE FRECUENCIA:
   - Diario = x30 | Semanal = x4.33 | Quincenal = x2 | Trimestral = /3 | Semestral = /6 | Anual = /12.
3. DISTINCIÓN DEUDA VS GASTO:
   - "Debo $X en tarjeta/crédito" -> Boss de Deuda en "bosses[]" con saldo total, tasa E.A. y cuota mínima mensual.
   - "Pago $Y de arriendo/internet/seguro" -> Costo Fijo mensual en "fixed_costs[]".
4. INVARIANTE DE FLUJO DE CAJA:
   - La suma de Costos Fijos + Variables Operativos + Tope de Bóveda GP + Ahorro Mensual no debe superar el Ingreso Mensual Neto si existen alternativas de ajuste.`,
  },

  QUEST_ECONOMY_PLANNER: {
    id: "rpg-quest-economy-planner",
    name: "Skill 8: Planificador Económico de Misiones & Tienda de Recompensas",
    endpoint: "/api/onboarding/ai (action: plan_quests_and_rewards)",
    temperature: 0.25,
    systemInstruction: `Eres el Economista de Juego (Game Economy Designer) del RPG Life-Engine.
REGLAS ESTRICTAS PARA EVITAR ERRORES:
1. CALIBRACIÓN MATEMÁTICA DE LA BÓVEDA:
   - El usuario tiene un Tope de Bóveda Mensual de \`vault_cap\` GP.
   - Diseña 1 misión diaria por cada habilidad activa del usuario.
   - La recompensa (\`reward_gp\`) de cada misión debe ser aproximadamente \`Math.round(vault_cap / 28)\` (ajustado por dificultad: easy 0.85x, medium 1.0x, hard 1.25x), de modo que completar ~28 misiones al mes desbloquee el 100% de la Bóveda sin inflación ni escasez.
2. ESCALONAMIENTO DE LA TIENDA (WISHLIST):
   - Genera exactamente 4 recompensas con prioridades 1, 2, 3 y 4:
     * Prioridad 1 (Micro-recompensa semanal): ~8% al 10% de \`vault_cap\`.
     * Prioridad 2 (Hobby / Habilidad): ~20% al 25% de \`vault_cap\`.
     * Prioridad 3 (Experiencia / Salida): ~40% al 45% de \`vault_cap\`.
     * Prioridad 4 (Loot Épico de Temporada): ~75% al 85% de \`vault_cap\`.`,
  },

  AGILE_PROJECT_PLANNER: {
    id: "rpg-agile-project-planner",
    name: "Skill 9: Arquitecto Ágil & Planificador de Proyectos con Gemini",
    endpoint: "/api/shortcuts/skill-session (action: generate_ai_project)",
    temperature: 0.2,
    systemInstruction: `Eres el Master Agile Coach & Tech Lead del RPG Life-Engine.
Tu misión es transformar cualquier meta, problema de negocio, idea o requerimiento de trabajo en un Proyecto Estratégico estructurado con metodología ágil (Scrum, Kanban o Lean) y un tablero estilo Trello con tareas accionables.

REGLAS ESTRICTAS DE CLASIFICACIÓN ÁGIL:
1. ELECCIÓN DE METODOLOGÍA:
   - "scrum": Para proyectos con entregables secuenciales claros, sprints definidos, funcionalidades o lanzamientos de software (ej. "Construir módulo de pagos", "Lanzar sitio web", "Crear bot de trading").
     * Etapas requeridas: ["Backlog", "Sprint Backlog", "En Progreso", "Hecho"]
   - "kanban": Para proyectos de soporte, gestión continua de tareas, procesamiento por demanda o flujos con límite de trabajo en proceso (ej. "Mantenimiento de infraestructura", "Atención de tickets", "Soporte mayorista").
     * Etapas requeridas: ["Por Hacer (To-Do)", "En Proceso (WIP)", "Bloqueado", "Completado"]
   - "lean": Para optimización de procesos repetitivos, reducción de desperdicios (Muda), automatizaciones con scripts/macros y estandarización Kaizen (ej. "Automatización de OPGs mayoristas", "Eliminar cuello de botella en Excel", "Carga masiva de tarifas").
     * Etapas requeridas: ["Identificar Valor", "Mapear Cadena de Flujo", "Optimizar / Automatizar"]

2. DESGLOSE DE TAREAS (TRELLO CARDS):
   - Genera entre 4 y 6 tareas concretas y de alto impacto.
   - Cada tarea debe tener título claro, descripción detallada, criterios de aceptación, estimación en minutos (entre 20 y 90 min) y nivel de prioridad ("low", "medium", "high" o "critical").
   - Distribuye inicialmente las tareas en la primera y segunda columna de la metodología elegida.

3. RESUMEN EJECUTIVO:
   - Redacta una breve síntesis de alto impacto (2 oraciones) explicando el valor del proyecto y por qué se seleccionó esa metodología.`,
  },
};

/**
 * Sanitizadores Post-Inferencia para blindar cada respuesta de Gemini
 */
export function sanitizeParsedExpense(
  raw: Partial<ParsedExpenseAI>,
  fallback: ParsedExpenseAI
): ParsedExpenseAI {
  const validCategories: ParsedExpenseAI["category"][] = [
    "fixed_mandatory",
    "variable_operational",
    "debt_attack",
    "discretionary_wishlist",
    "discretionary_unbudgeted",
  ];
  const validBosses: ParsedExpenseAI["boss_target"][] = [
    "Nequi",
    "ADDI",
    "Bancolombia",
    "NONE",
  ];

  const amount = Number(raw.amount_cop);
  const safeAmount =
    Number.isFinite(amount) && amount > 0 && amount < 500_000_000
      ? Math.round(amount)
      : fallback.amount_cop;

  const category = validCategories.includes(
    raw.category as ParsedExpenseAI["category"]
  )
    ? (raw.category as ParsedExpenseAI["category"])
    : fallback.category;

  const bossTarget = validBosses.includes(
    raw.boss_target as ParsedExpenseAI["boss_target"]
  )
    ? (raw.boss_target as ParsedExpenseAI["boss_target"])
    : category === "debt_attack"
    ? fallback.boss_target
    : "NONE";

  return {
    amount_cop: safeAmount,
    category,
    merchant_or_concept:
      (raw.merchant_or_concept || "").trim().slice(0, 80) ||
      fallback.merchant_or_concept,
    boss_target: bossTarget,
    detected_source:
      raw.detected_source === "bank_sms" ||
      raw.detected_source === "voice_dictation"
        ? raw.detected_source
        : fallback.detected_source,
  };
}

export function sanitizeReceiptSplit(
  raw: Partial<ParsedReceiptSplitAI>,
  fallback: ParsedReceiptSplitAI
): ParsedReceiptSplitAI {
  const essential = Math.max(0, Math.round(Number(raw.operational_essential_cop) || 0));
  const unbudgeted = Math.max(
    0,
    Math.round(Number(raw.discretionary_unbudgeted_cop) || 0)
  );
  if (essential === 0 && unbudgeted === 0) {
    return fallback;
  }
  const total = essential + unbudgeted;
  return {
    merchant_name:
      (raw.merchant_name || "").trim().slice(0, 60) || fallback.merchant_name,
    total_cop: total,
    operational_essential_cop: essential,
    discretionary_unbudgeted_cop: unbudgeted,
    essential_items_summary:
      (raw.essential_items_summary || "").trim() ||
      fallback.essential_items_summary,
    unbudgeted_items_summary:
      (raw.unbudgeted_items_summary || "").trim() ||
      fallback.unbudgeted_items_summary,
  };
}

export function sanitizeCubeSpecs(
  raw: Partial<ExtractedCubeSpecsAI>,
  fallback: ExtractedCubeSpecsAI
): ExtractedCubeSpecsAI {
  const validTypes: ExtractedCubeSpecsAI["cube_type"][] = [
    "3x3",
    "2x2",
    "4x4",
    "Pyraminx",
    "Megaminx",
  ];
  const cubeType = validTypes.includes(
    raw.cube_type as ExtractedCubeSpecsAI["cube_type"]
  )
    ? (raw.cube_type as ExtractedCubeSpecsAI["cube_type"])
    : fallback.cube_type;

  const sizeMm = Number(raw.size_mm);
  const weightGrams = Number(raw.weight_grams);
  const targetSub = Number(raw.target_sub_seconds);
  const rewardGp = Number(raw.reward_gp_per_solve);
  const pbBonus = Number(raw.pb_bonus_gp);

  return {
    ...fallback,
    ...raw,
    cube_type: cubeType,
    brand: (raw.brand || "").trim() || fallback.brand,
    model_name: (raw.model_name || "").trim() || fallback.model_name,
    size_mm:
      Number.isFinite(sizeMm) && sizeMm >= 30 && sizeMm <= 150
        ? Number(sizeMm.toFixed(1))
        : fallback.size_mm,
    weight_grams:
      Number.isFinite(weightGrams) && weightGrams >= 25 && weightGrams <= 350
        ? Math.round(weightGrams)
        : fallback.weight_grams,
    target_sub_seconds:
      Number.isFinite(targetSub) && targetSub >= 2 && targetSub <= 600
        ? Math.round(targetSub)
        : fallback.target_sub_seconds,
    reward_gp_per_solve:
      Number.isFinite(rewardGp) && rewardGp >= 500 && rewardGp <= 50000
        ? Math.round(rewardGp)
        : fallback.reward_gp_per_solve,
    pb_bonus_gp:
      Number.isFinite(pbBonus) && pbBonus >= 500 && pbBonus <= 50000
        ? Math.round(pbBonus)
        : fallback.pb_bonus_gp,
  };
}

export function sanitizeBookSpecs(
  raw: Partial<ExtractedBookSpecsAI>,
  fallback: ExtractedBookSpecsAI
): ExtractedBookSpecsAI {
  const validComplexities: ExtractedBookSpecsAI["complexity"][] = [
    "ligero",
    "intermedio",
    "denso_tecnico",
  ];
  const complexity = validComplexities.includes(
    raw.complexity as ExtractedBookSpecsAI["complexity"]
  )
    ? (raw.complexity as ExtractedBookSpecsAI["complexity"])
    : fallback.complexity;

  const totalPages = Number(raw.total_pages);
  const totalChapters = Number(raw.total_chapters);
  const dailyPages = Number(raw.recommended_daily_pages);
  const gpPerPage = Number(raw.gp_per_page);
  const bonusGp = Number(raw.completion_bonus_gp);

  return {
    ...fallback,
    ...raw,
    title: (raw.title || "").trim() || fallback.title,
    author: (raw.author || "").trim() || fallback.author,
    isbn: (raw.isbn || "").trim() || fallback.isbn,
    complexity,
    total_pages:
      Number.isFinite(totalPages) && totalPages >= 20 && totalPages <= 3000
        ? Math.round(totalPages)
        : fallback.total_pages,
    total_chapters:
      Number.isFinite(totalChapters) && totalChapters >= 1 && totalChapters <= 200
        ? Math.round(totalChapters)
        : fallback.total_chapters,
    recommended_daily_pages:
      Number.isFinite(dailyPages) && dailyPages >= 5 && dailyPages <= 100
        ? Math.round(dailyPages)
        : fallback.recommended_daily_pages,
    gp_per_page:
      Number.isFinite(gpPerPage) && gpPerPage >= 10 && gpPerPage <= 2000
        ? Math.round(gpPerPage)
        : fallback.gp_per_page,
    completion_bonus_gp:
      Number.isFinite(bonusGp) && bonusGp >= 500 && bonusGp <= 100000
        ? Math.round(bonusGp)
        : fallback.completion_bonus_gp,
  };
}

export function sanitizeProfessionClasses(
  rawClasses: ProfessionClassOption[] | undefined
): ProfessionClassOption[] | null {
  if (!Array.isArray(rawClasses) || rawClasses.length === 0) return null;
  const validSkills: SkillDomain[] = [
    "rubik",
    "reading",
    "knitting",
    "study",
    "work",
    "gaming",
    "sports",
    "general",
  ];
  const cleaned = rawClasses
    .filter((c) => c && typeof c.name === "string" && c.name.trim().length > 2)
    .slice(0, 4)
    .map((c) => {
      const filteredSkills = Array.isArray(c.recommended_skills)
        ? c.recommended_skills.filter((s): s is SkillDomain =>
            validSkills.includes(s as SkillDomain)
          )
        : [];
      return {
        name: c.name.trim().slice(0, 65),
        badge: (c.badge || "⚔️ Clase Especial").trim().slice(0, 35),
        desc:
          (c.desc || "Arquetipo personalizado para dominar hábitos y finanzas.")
            .trim()
            .slice(0, 220),
        recommended_skills:
          filteredSkills.length > 0
            ? filteredSkills
            : (["work", "study", "reading"] as SkillDomain[]),
      };
    });
  return cleaned.length >= 2 ? cleaned : null;
}

export function sanitizeQuestsAndWishlist(params: {
  quests?: OnboardingQuestInput[];
  wishlist?: OnboardingWishlistInput[];
  vault_cap: number;
}): {
  quests: OnboardingQuestInput[];
  wishlist: OnboardingWishlistInput[];
} | null {
  const { quests, wishlist, vault_cap } = params;
  if (
    !Array.isArray(quests) ||
    quests.length === 0 ||
    !Array.isArray(wishlist) ||
    wishlist.length === 0
  ) {
    return null;
  }
  const safeVault = Math.max(100, Number(vault_cap) || 300000);
  const defaultReward = Math.max(10, Math.round(safeVault / 28));

  const cleanQuests: OnboardingQuestInput[] = quests.slice(0, 10).map((q, idx) => {
    const rewardGp = Number(q.reward_gp);
    const rewardXp = Number(q.reward_xp);
    return {
      code:
        (q.code || `QUEST_AI_${idx + 1}`)
          .toUpperCase()
          .replace(/[^A-Z0-9_]/g, "_")
          .slice(0, 32) || `QUEST_AI_${idx + 1}`,
      title: (q.title || `Misión Diaria #${idx + 1}`).trim().slice(0, 110),
      domain: q.domain || "general",
      difficulty:
        q.difficulty === "easy" ||
        q.difficulty === "medium" ||
        q.difficulty === "hard"
          ? q.difficulty
          : "medium",
      reward_gp:
        Number.isFinite(rewardGp) &&
        rewardGp > 0 &&
        rewardGp <= safeVault * 0.5
          ? Math.round(rewardGp)
          : defaultReward,
      reward_xp:
        Number.isFinite(rewardXp) && rewardXp >= 10 && rewardXp <= 500
          ? Math.round(rewardXp)
          : 100,
    };
  });

  const cleanWishlist: OnboardingWishlistInput[] = wishlist
    .slice(0, 8)
    .map((w, idx) => {
      const costGp = Number(w.cost_gp);
      const fallbackCost = Math.round(safeVault * [0.1, 0.25, 0.45, 0.8][idx % 4]);
      return {
        name: (w.name || `Recompensa #${idx + 1}`).trim().slice(0, 90),
        cost_gp:
          Number.isFinite(costGp) && costGp > 0 && costGp <= safeVault * 3
            ? Math.round(costGp)
            : fallbackCost,
        priority: idx + 1,
      };
    });

  return { quests: cleanQuests, wishlist: cleanWishlist };
}

export function sanitizeBossesList(
  bosses: OnboardingBossInput[] | undefined
): OnboardingBossInput[] {
  if (!Array.isArray(bosses)) return [];
  return bosses
    .filter((b) => b && Number(b.total_balance) > 0)
    .map((b) => {
      const total = Math.round(Number(b.total_balance));
      const rate = Number(b.interest_rate_ea);
      const minPay = Number(b.min_monthly_payment);
      return {
        name: (b.name || "Deuda Activa").trim().slice(0, 50),
        total_balance: total,
        interest_rate_ea:
          Number.isFinite(rate) && rate >= 0 && rate <= 120
            ? Number(rate.toFixed(2))
            : 24.0,
        min_monthly_payment:
          Number.isFinite(minPay) && minPay > 0 && minPay <= total
            ? Math.round(minPay)
            : Math.max(10, Math.round(total * 0.08)),
      };
    });
}

export function sanitizeAgileProjectAI(
  raw: Partial<AgileProjectGenerationAI>,
  fallbackQuery: string
): AgileProjectGenerationAI {
  const allowedMeths: AgileMethodology[] = ["scrum", "kanban", "lean"];
  let meth: AgileMethodology = "scrum";
  if (raw.methodology && allowedMeths.includes(raw.methodology)) {
    meth = raw.methodology;
  } else {
    const qLower = (fallbackQuery || "").toLowerCase();
    if (
      qLower.includes("opg") ||
      qLower.includes("macro") ||
      qLower.includes("automatiz") ||
      qLower.includes("proceso") ||
      qLower.includes("excel")
    ) {
      meth = "lean";
    } else if (
      qLower.includes("soporte") ||
      qLower.includes("ticket") ||
      qLower.includes("mantenimiento")
    ) {
      meth = "kanban";
    }
  }

  const defaultStages: Record<AgileMethodology, string[]> = {
    none: ["Por Hacer", "En Proceso", "Hecho"],
    scrum: ["Backlog", "Sprint Backlog", "En Progreso", "Hecho"],
    kanban: ["Por Hacer (To-Do)", "En Proceso (WIP)", "Bloqueado", "Completado"],
    lean: [
      "Identificar Valor",
      "Mapear Cadena de Flujo",
      "Optimizar / Automatizar",
    ],
  };

  const stages = defaultStages[meth];
  const firstStage = stages[0];
  const secondStage = stages[1] || stages[0];

  const cleanName =
    (raw.name || "").trim() ||
    fallbackQuery.trim() ||
    "Proyecto Estratégico Ágil";

  const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const cleanTasks = rawTasks.slice(0, 8).map((t, idx) => {
    const priority =
      t.priority === "critical" ||
      t.priority === "high" ||
      t.priority === "medium" ||
      t.priority === "low"
        ? t.priority
        : idx === 0
        ? "high"
        : "medium";

    const stage = stages.includes(t.stage)
      ? t.stage
      : idx % 2 === 0
      ? firstStage
      : secondStage;

    const mins = Number(t.estimated_minutes);
    const estimatedMinutes =
      Number.isFinite(mins) && mins >= 10 && mins <= 240 ? Math.round(mins) : 45;

    return {
      title: (t.title || `Tarea #${idx + 1}`).trim().slice(0, 100),
      description: (
        t.description ||
        `Entregable técnico para avanzar en la etapa ${stage}.`
      ).trim(),
      stage,
      priority,
      estimated_minutes: estimatedMinutes,
      acceptance_criteria: t.acceptance_criteria?.trim(),
    };
  });

  // Si no se generaron tareas, creamos tareas por defecto según la metodología
  if (cleanTasks.length === 0) {
    if (meth === "scrum") {
      cleanTasks.push(
        {
          title: "Levantamiento de Requerimientos & Criterios de Aceptación",
          description: "Definir alcance, dependencias e historias de usuario clave.",
          stage: "Backlog",
          priority: "high",
          estimated_minutes: 45,
          acceptance_criteria: "Historias redactadas en formato Como / Quiero / Para.",
        },
        {
          title: "Diseño de Arquitectura y Sprint Backlog",
          description: "Estructurar componentes, endpoints y backlog del Sprint 1.",
          stage: "Sprint Backlog",
          priority: "high",
          estimated_minutes: 60,
          acceptance_criteria: "Diagrama de flujo y tareas priorizadas.",
        },
        {
          title: "Construcción del Núcleo Funcional (MVP)",
          description: "Implementar lógica principal y validaciones del sistema.",
          stage: "Sprint Backlog",
          priority: "critical",
          estimated_minutes: 90,
          acceptance_criteria: "Código funcional con pruebas unitarias.",
        },
        {
          title: "Pruebas de Integración y Despliegue",
          description: "Verificar rendimiento y desplegar entregable a producción.",
          stage: "Backlog",
          priority: "medium",
          estimated_minutes: 40,
          acceptance_criteria: "Despliegue verificado y checklist completado.",
        }
      );
    } else if (meth === "lean") {
      cleanTasks.push(
        {
          title: "Identificación de Desperdicios y Pasos Manuales (Muda)",
          description: "Diagnosticar cuellos de botella en la operativa actual.",
          stage: "Identificar Valor",
          priority: "high",
          estimated_minutes: 45,
          acceptance_criteria: "Lista de 3 procesos con mayor tiempo muerto.",
        },
        {
          title: "Mapeo de la Cadena de Valor (Value Stream Mapping)",
          description: "Documentar flujo desde la solicitud hasta la entrega.",
          stage: "Mapear Cadena de Flujo",
          priority: "high",
          estimated_minutes: 60,
          acceptance_criteria: "Mapa de flujo con tiempos de espera identificados.",
        },
        {
          title: "Automatización de Tareas Repetitivas con Scripts / Macros",
          description: "Desarrollar script para automatizar validaciones y cargas.",
          stage: "Optimizar / Automatizar",
          priority: "critical",
          estimated_minutes: 90,
          acceptance_criteria: "Proceso manual reducido en al menos 60% del tiempo.",
        }
      );
    } else {
      cleanTasks.push(
        {
          title: "Definición de Entradas y Criterios WIP",
          description: "Organizar cola de pedidos y fijar límite WIP máximo de 2 tareas simultáneas.",
          stage: "Por Hacer (To-Do)",
          priority: "high",
          estimated_minutes: 40,
          acceptance_criteria: "Límites visuales y etiquetas asignadas.",
        },
        {
          title: "Ejecución de Tarea Prioritaria #1",
          description: "Resolver primer entregable sin iniciar tareas paralelas.",
          stage: "En Proceso (WIP)",
          priority: "critical",
          estimated_minutes: 60,
          acceptance_criteria: "Tarea entregada y verificada.",
        },
        {
          title: "Resolución de Bloqueos & Retroalimentación",
          description: "Identificar fricciones y ajustar el tiempo de ciclo continuo.",
          stage: "Por Hacer (To-Do)",
          priority: "medium",
          estimated_minutes: 45,
          acceptance_criteria: "Cero dependencias bloqueantes activas.",
        }
      );
    }
  }

  return {
    name: cleanName,
    description:
      (raw.description || "").trim() ||
      `Proyecto estratégico diseñado bajo metodología ${meth.toUpperCase()} para maximizar la ejecución y eliminar fricción.`,
    methodology: meth,
    suggested_stages: stages,
    tasks: cleanTasks,
    executive_summary:
      (raw.executive_summary || "").trim() ||
      `Proyecto estructurado con ${cleanTasks.length} tarjetas en metodología ${meth.toUpperCase()}. Diseñado para completarse en bloques Deep Work de alta concentración.`,
  };
}
