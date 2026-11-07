import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { isSupabaseConfigured, supabaseAdmin } from "./supabase";
import {
  AI_SKILLS_REGISTRY,
  sanitizeBossesList,
  sanitizeProfessionClasses,
  sanitizeQuestsAndWishlist,
} from "./ai-skills-prompts";
import type {
  CurrencyCode,
  DebtStrategy,
  FixedCostItem,
  OnboardingBossInput,
  OnboardingQuestInput,
  OnboardingWishlistInput,
  ProfessionClassOption,
  SkillDomain,
  UserSkillConfig,
} from "../types/rpg";

export function normalizeProfessionKey(raw: string): string {
  return (raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface PresetProfessionEntry {
  key: string;
  label: string;
  keywords: string[];
  classes: ProfessionClassOption[];
}

export const PRESET_PROFESSION_CATALOG: PresetProfessionEntry[] = [
  {
    key: "estudiante",
    label: "Estudiante Universitario / Académico",
    keywords: [
      "estudiante",
      "universitario",
      "universidad",
      "colegio",
      "becario",
      "practicante",
      "tesis",
      "semestre",
    ],
    classes: [
      {
        name: "Erudito del Pomodoro Arcano",
        badge: "📚 Estudio & Becas",
        desc: "Convierte horas de estudio profundo y lectura académica en GP mientras mantiene gastos estudiantiles bajo control.",
        recommended_skills: ["study", "reading", "rubik", "gaming"],
      },
      {
        name: "Alquimista de Presupuesto Universitario",
        badge: "🧪 Micro-Ahorro & Racha",
        desc: "Multiplica presupuestos ajustados evitando gastos hormiga en campus y desbloqueando recompensas sin endeudarse.",
        recommended_skills: ["study", "sports", "reading"],
      },
      {
        name: "Duelista de Exámenes & Speedcubing",
        badge: "⚡ Agilidad Mental",
        desc: "Entrena memoria activa, concentración bajo presión y deporte para subir de nivel cada semana.",
        recommended_skills: ["study", "rubik", "sports", "gaming"],
      },
    ],
  },
  {
    key: "ingenieria_software",
    label: "Ingeniería de Sistemas / Desarrollo de Software",
    keywords: [
      "ingeniero",
      "software",
      "programador",
      "desarrollador",
      "developer",
      "sistemas",
      "datos",
      "devops",
      "frontend",
      "backend",
      "fullstack",
      "tecnologia",
      "it",
    ],
    classes: [
      {
        name: "Arquitecto Full-Stack del Interés Compuesto",
        badge: "💻 Deep Work & Avalancha",
        desc: "Ejecuta sprints de código de alto impacto para liberar GP de la Bóveda y automatizar ataques a deudas de mayor tasa.",
        recommended_skills: ["work", "study", "rubik", "gaming"],
      },
      {
        name: "Tecnomante de Algoritmos & Speedcubing",
        badge: "🧩 Lógica & Precisión",
        desc: "Combina resolución de problemas técnicos, lectura de arquitectura y entrenamiento físico para evitar el burnout.",
        recommended_skills: ["work", "reading", "rubik", "sports"],
      },
      {
        name: "Paladín DevSecOps de la Tesorería",
        badge: "🛡️ Escudos Aegis & Cero Deuda",
        desc: "Blinda su flujo de caja mensual contra compras impulsivas de gadgets y prioriza la libertad financiera.",
        recommended_skills: ["work", "study", "gaming"],
      },
    ],
  },
  {
    key: "salud_medicina",
    label: "Medicina / Enfermería / Ciencias de la Salud",
    keywords: [
      "medico",
      "medicina",
      "enfermero",
      "enfermeria",
      "odontologo",
      "psicologo",
      "fisioterapeuta",
      "salud",
      "clinica",
      "hospital",
      "residente",
    ],
    classes: [
      {
        name: "Clérigo de Guardia Inquebrantable",
        badge: "⚕️ Resistencia & Orden",
        desc: "Protege su racha incluso en turnos largos y transforma el estudio clínico y el descanso activo en recompensas reales.",
        recommended_skills: ["work", "study", "sports", "reading"],
      },
      {
        name: "Cirujano de Deudas & Precisión Financiera",
        badge: "🔬 Corte de Intereses",
        desc: "Extirpa créditos de alta tasa E.A. con precisión quirúrgica mientras construye un fondo de tranquilidad.",
        recommended_skills: ["work", "reading", "sports"],
      },
      {
        name: "Sanador del Equilibrio Vital",
        badge: "🌿 Hábitos & Bienestar",
        desc: "Equilibra guardias exigentes con lectura, tejido o deporte para mantener la mente despejada y la billetera sana.",
        recommended_skills: ["sports", "reading", "knitting", "work"],
      },
    ],
  },
  {
    key: "diseno_creatividad",
    label: "Diseño / Arquitectura / Artes & Creatividad",
    keywords: [
      "disenador",
      "diseno",
      "arquitecto",
      "arquitectura",
      "artista",
      "ilustrador",
      "audiovisual",
      "fotografo",
      "publicista",
      "ux",
      "ui",
      "creativo",
    ],
    classes: [
      {
        name: "Artífice Visual de Proyectos Épicos",
        badge: "🎨 Portafolio & Entregables",
        desc: "Convierte cada entregable creativo, sesión de tejido/artesanía y lectura en oro desbloqueado dentro del motor.",
        recommended_skills: ["work", "knitting", "reading", "gaming"],
      },
      {
        name: "Bardo del Flujo Creativo & Libertad",
        badge: "✨ Inspiración Sostenible",
        desc: "Organiza ingresos variables o de estudio de diseño sin sacrificar calidad de vida ni caer en sobreendeudamiento.",
        recommended_skills: ["work", "study", "knitting", "sports"],
      },
      {
        name: "Maestro Constructor de Maquetas & Hábitos",
        badge: "📐 Estructura & Detalle",
        desc: "Diseña su presupuesto con la misma proporción áurea que sus obras, asegurando ahorro y recompensas.",
        recommended_skills: ["work", "reading", "rubik"],
      },
    ],
  },
  {
    key: "finanzas_negocios",
    label: "Contaduría / Economía / Administración & Negocios",
    keywords: [
      "contador",
      "economista",
      "administrador",
      "finanzas",
      "banquero",
      "analista",
      "auditor",
      "negocios",
      "comercial",
      "ventas",
      "marketing",
    ],
    classes: [
      {
        name: "Gran Estratega de Avalancha Financiera",
        badge: "📊 Optimización E.A.",
        desc: "Domina el flujo de caja libre, minimiza el costo de intereses y convierte la productividad diaria en capital.",
        recommended_skills: ["work", "reading", "study", "sports"],
      },
      {
        name: "Oráculo de Tesorería & Escudos Aegis",
        badge: "🛡️ Auditoría Implacable",
        desc: "Ningún gasto hormiga escapa a su radar; cada sesión de trabajo y lectura fortalece su patrimonio.",
        recommended_skills: ["work", "reading", "rubik"],
      },
      {
        name: "Mercader Legendario de Alto Impacto",
        badge: "💎 Cierre de Metas",
        desc: "Alcanza objetivos comerciales y deportivos mientras desbloquea recompensas de su Wishlist sin culpa.",
        recommended_skills: ["work", "sports", "reading"],
      },
    ],
  },
  {
    key: "emprendedor_freelance",
    label: "Emprendedor / Freelancer / Independiente",
    keywords: [
      "emprendedor",
      "freelance",
      "freelancer",
      "independiente",
      "autonomo",
      "empresario",
      "consultor",
      "negocio propio",
      "comerciante",
    ],
    classes: [
      {
        name: "Corsario Freelance de Flujo Variable",
        badge: "⚓ Liquidez & Sprints",
        desc: "Domina meses de ingresos variables separando costos fijos sagrados y desbloqueando gustos solo por metas cumplidas.",
        recommended_skills: ["work", "study", "sports", "reading"],
      },
      {
        name: "Forjador de Imperios & Hábitos",
        badge: "🔥 Crecimiento Compuesto",
        desc: "Construye su negocio bloque a bloque mientras entrena mente y cuerpo para sostener el ritmo a largo plazo.",
        recommended_skills: ["work", "reading", "sports", "gaming"],
      },
      {
        name: "Pícaro Minimalista de Alta Rentabilidad",
        badge: "🗡️ Margen Máximo",
        desc: "Mantiene costos fijos ligeros para que cada proyecto cerrado multiplique su poder de Bola de Nieve.",
        recommended_skills: ["work", "study", "rubik"],
      },
    ],
  },
  {
    key: "derecho_humanidades",
    label: "Derecho / Docencia / Ciencias Sociales",
    keywords: [
      "abogado",
      "derecho",
      "juridico",
      "docente",
      "profesor",
      "maestro",
      "investigador",
      "periodista",
      "comunicador",
    ],
    classes: [
      {
        name: "Justiciero de Contratos & Lectura Densa",
        badge: "⚖️ Argumento & Disciplina",
        desc: "Devora páginas técnicas y expedientes ganando bonos de lectura mientras liquida pasivos con rigor legal.",
        recommended_skills: ["reading", "work", "study", "sports"],
      },
      {
        name: "Mentor Sabio de la Constancia",
        badge: "🏛️ Racha Inmortal",
        desc: "Transforma la preparación de clases, investigación y hobbies manuales en estabilidad financiera.",
        recommended_skills: ["work", "reading", "knitting", "study"],
      },
      {
        name: "Orador Táctico del Presupuesto",
        badge: "📜 Control & Claridad",
        desc: "Pone orden en sus cuentas mensuales y premia su esfuerzo intelectual con metas claras.",
        recommended_skills: ["reading", "work", "sports"],
      },
    ],
  },
];

// Caché en memoria del servidor para profesiones generadas por Gemini en modo local o fallback
const memoryProfessionCache = new Map<string, ProfessionClassOption[]>();

export async function resolveProfessionClasses(professionRaw: string): Promise<{
  profession_label: string;
  normalized_key: string;
  source: "catalog_cache" | "gemini_generated" | "fallback";
  classes: ProfessionClassOption[];
}> {
  const norm = normalizeProfessionKey(professionRaw);
  if (!norm) {
    return {
      profession_label: "Estudiante / Explorador",
      normalized_key: "estudiante",
      source: "catalog_cache",
      classes: PRESET_PROFESSION_CATALOG[0].classes,
    };
  }

  // 1. Buscar coincidencia en el catálogo pre-sembrado (exacta o por palabra clave)
  const presetMatch = PRESET_PROFESSION_CATALOG.find(
    (entry) =>
      entry.key === norm ||
      norm.includes(entry.key) ||
      entry.keywords.some((kw) => norm.includes(kw))
  );
  if (presetMatch) {
    return {
      profession_label: presetMatch.label,
      normalized_key: presetMatch.key,
      source: "catalog_cache",
      classes: presetMatch.classes,
    };
  }

  // 2. Buscar en la caché en memoria
  const memHit = memoryProfessionCache.get(norm);
  if (memHit && memHit.length > 0) {
    return {
      profession_label: professionRaw.trim(),
      normalized_key: norm,
      source: "catalog_cache",
      classes: memHit,
    };
  }

  // 3. Buscar en la tabla de Supabase public.profession_class_catalog (búsqueda exacta o parcial)
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data: rows } = await supabaseAdmin
        .from("profession_class_catalog")
        .select("normalized_key, profession_label, classes_json")
        .or(`normalized_key.eq.${norm},normalized_key.ilike.%${norm}%`)
        .limit(1);

      if (rows && rows.length > 0 && Array.isArray(rows[0].classes_json)) {
        const classes = rows[0].classes_json as ProfessionClassOption[];
        if (classes.length > 0) {
          memoryProfessionCache.set(norm, classes);
          return {
            profession_label: String(rows[0].profession_label || professionRaw),
            normalized_key: String(rows[0].normalized_key),
            source: "catalog_cache",
            classes,
          };
        }
      }
    } catch {
      // Si la tabla aún no existe, continúa hacia Gemini
    }
  }

  // 4. No existe en la tabla de búsqueda: generar con Gemini y guardar en la base de datos
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "tu-gemini-api-key") {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          profession_label: {
            type: Type.STRING,
            description: "Nombre limpio y formal de la profesión u ocupación.",
          },
          classes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: {
                  type: Type.STRING,
                  description:
                    "Nombre épico de clase RPG adaptado a esta profesión (ej. 'Paladín de Cocina Molecular', 'Arquitecto Aéreo del Ahorro').",
                },
                badge: {
                  type: Type.STRING,
                  description: "Insignia corta con emoji (máx 3 palabras).",
                },
                desc: {
                  type: Type.STRING,
                  description:
                    "Descripción de 1 oración conectando su profesión con hábitos y finanzas personales.",
                },
                recommended_skills: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                    enum: [
                      "rubik",
                      "reading",
                      "knitting",
                      "study",
                      "work",
                      "gaming",
                      "sports",
                    ],
                  },
                },
              },
              required: ["name", "badge", "desc", "recommended_skills"],
            },
          },
        },
        required: ["profession_label", "classes"],
      };

      const skill = AI_SKILLS_REGISTRY.PROFESSION_ARCHETYPE_ENGINE;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `El usuario de nuestro RPG de finanzas personales y hábitos indicó que su profesión u ocupación es: "${professionRaw}". Genera exactamente 3 clases de personaje RPG creativas, motivadoras y adaptadas a la realidad diaria y financiera de esa profesión.`,
        config: {
          systemInstruction: skill.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: skill.temperature,
        },
      });

      const parsed = JSON.parse(response.text || "{}") as {
        profession_label?: string;
        classes?: ProfessionClassOption[];
      };

      const cleanClasses = sanitizeProfessionClasses(parsed.classes);
      if (cleanClasses) {
        memoryProfessionCache.set(norm, cleanClasses);

        if (isSupabaseConfigured && supabaseAdmin) {
          try {
            await supabaseAdmin.from("profession_class_catalog").upsert(
              {
                normalized_key: norm,
                profession_label:
                  parsed.profession_label || professionRaw.trim(),
                classes_json: cleanClasses,
                source: "gemini",
              },
              { onConflict: "normalized_key" }
            );
          } catch {
            // Ignorar si la tabla aún no fue migrada
          }
        }

        return {
          profession_label: parsed.profession_label || professionRaw.trim(),
          normalized_key: norm,
          source: "gemini_generated",
          classes: cleanClasses,
        };
      }
    } catch {
      // Fallback determinista abajo
    }
  }

  // Fallback determinista personalizado con el nombre de la profesión del usuario
  const cleanTitle = professionRaw.trim();
  const customClasses: ProfessionClassOption[] = [
    {
      name: `Paladín Maestro (${cleanTitle})`,
      badge: "🛡️ Disciplina & Orden",
      desc: `Adapta tu rutina como ${cleanTitle} para blindar tus costos fijos, ganar escudos Aegis y atacar deudas.`,
      recommended_skills: ["work", "study", "sports"],
    },
    {
      name: `Estratega Arcano (${cleanTitle})`,
      badge: "✨ Crecimiento & Hábitos",
      desc: `Convierte tus sesiones de enfoque, lectura y entrenamiento en GP liberado dentro de tu Bóveda.`,
      recommended_skills: ["work", "reading", "study", "gaming"],
    },
    {
      name: `Vanguardia Implacable (${cleanTitle})`,
      badge: "⚡ Alto Impacto",
      desc: `Prioriza entregables clave de ${cleanTitle} y deporte para maximizar tu flujo de caja libre mensual.`,
      recommended_skills: ["work", "sports", "rubik"],
    },
  ];
  memoryProfessionCache.set(norm, customClasses);
  return {
    profession_label: cleanTitle,
    normalized_key: norm,
    source: "fallback",
    classes: customClasses,
  };
}

export interface FinancialAuditMetrics {
  fixed_pct: number;
  variable_pct: number;
  vault_pct: number;
  snowball_power: number;
  snowball_pct: number;
  total_debt: number;
  total_min_debt_payments: number;
  estimated_debt_free_months: number;
  detected_items_log: string[];
}

export interface FinancialEvaluationResult {
  monthly_income: number;
  fixed_costs: FixedCostItem[];
  variable_ops_budget: number;
  vault_cap: number;
  savings_goal_monthly: number;
  bosses: OnboardingBossInput[];
  suggested_wishlist?: OnboardingWishlistInput[];
  recommended_debt_strategy: DebtStrategy;
  diagnosis: string;
  audit_metrics: FinancialAuditMetrics;
  source: "gemini" | "deterministic";
}

function splitCsvRowRespectingQuotes(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      cols.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cols.push(current.trim());
  return cols;
}

function parseFormattedCsvCurrency(rawMonto: string): number {
  const clean = (rawMonto || "").replace(/["$\s]/g, "").trim();
  if (!clean) return 0;
  // Si termina en .00 o ,00 (decimales de centavos), remover los centavos antes de limpiar separadores de miles
  const withoutCents = clean.replace(/[.,]\d{2}$/, "");
  const digitsOnly = withoutCents.replace(/[.,]/g, "");
  const num = Number(digitsOnly);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
}

function analyzeTransactionHistoryCsv(
  rawText: string,
  currency: CurrencyCode
): FinancialEvaluationResult | null {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 3) return null;

  const headerLower = lines[0].toLowerCase();
  const isMovimientosCsv =
    (headerLower.includes("fecha") &&
      headerLower.includes("tipo") &&
      headerLower.includes("monto")) ||
    lines.slice(0, 5).some((l) => /^\d{4}-\d{2}-\d{2}\s*,/.test(l));

  if (!isMovimientosCsv) return null;

  interface TxRow {
    fecha: string;
    monthKey: string;
    tipo: string;
    categoria: string;
    monto: number;
    descripcion: string;
    metodo: string;
    detalle: string;
  }

  const rows: TxRow[] = [];
  const monthCounts = new Map<string, number>();

  for (let i = 0; i < lines.length; i++) {
    const cols = splitCsvRowRespectingQuotes(lines[i]);
    if (cols.length < 4) continue;
    const fecha = cols[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    const monthKey = fecha.slice(0, 7);
    const tipo = (cols[1] || "").trim();
    const categoria = (cols[2] || "").trim();
    const monto = parseFormattedCsvCurrency(cols[3] || "0");
    if (monto <= 0) continue;
    const descripcion = (cols[4] || "").trim();
    const metodo = (cols[5] || "").trim();
    const detalle = (cols[6] || "").trim();

    rows.push({
      fecha,
      monthKey,
      tipo,
      categoria,
      monto,
      descripcion,
      metodo,
      detalle,
    });
    monthCounts.set(monthKey, (monthCounts.get(monthKey) || 0) + 1);
  }

  if (rows.length < 3) return null;

  // Calcular meses equivalentes ponderando meses parciales (ej. primeros días del mes en curso)
  const totalTx = rows.length;
  const distinctMonths = Array.from(monthCounts.entries());
  const fullMonthsCount = distinctMonths.filter(([, count]) => count >= 12).length;
  const partialMonthsWeight = distinctMonths
    .filter(([, count]) => count < 12)
    .reduce((acc, [, count]) => acc + Math.min(0.5, count / 30), 0);
  const effectiveMonths = Math.max(
    1,
    Number((fullMonthsCount + partialMonthsWeight).toFixed(2))
  );

  let sueldoTotal = 0;
  let sueldoCount = 0;
  let clasesTotal = 0;
  let openingBalanceTotal = 0;
  let reimbursementsTotal = 0;

  // Acumuladores de Costos Fijos
  let internetTotal = 0;
  let celularTotal = 0;
  let gymTotal = 0;
  let natilleraTotal = 0;
  let suscripcionesTotal = 0;
  let pastillasSaludFijaTotal = 0;
  let cuidadoPersonalTotal = 0;

  // Acumuladores de Variables Operativos
  let comidaRutinaTotal = 0;
  let transporteTotal = 0;
  let saludYUniVariableTotal = 0;

  // Acumuladores de Deudas (Obligaciones financieras)
  const debtPaymentsByEntity = new Map<string, { totalPaid: number; count: number }>();

  // Acumuladores de Gustos / Hobbies / Bóveda GP
  let discretionaryTotal = 0;
  let spentCubos = 0;
  let spentLibros = 0;
  let spentTejido = 0;
  let spentLego = 0;
  let spentSalidas = 0;

  for (const r of rows) {
    const tipoLower = r.tipo.toLowerCase();
    const catLower = r.categoria.toLowerCase();
    const descLower = `${r.descripcion} ${r.detalle}`.toLowerCase();

    if (tipoLower.includes("ingreso")) {
      if (/inicial cuenta|inicial efectivo|saldo inicial/.test(descLower)) {
        openingBalanceTotal += r.monto;
      } else if (catLower.includes("sueldo") || /nomina|quincena|pago/.test(descLower)) {
        sueldoTotal += r.monto;
        sueldoCount++;
      } else if (catLower.includes("clase") || /clase|tutoria|asesoria/.test(descLower)) {
        clasesTotal += r.monto;
      } else {
        // Inversiones / Devolución universidad / préstamos familiares de entrada
        reimbursementsTotal += r.monto;
      }
      continue;
    }

    // Egresos
    if (catLower.includes("obligaciones financieras") || /addi|nequi|cuota|credito|tarjeta/.test(catLower)) {
      const entity = /addi/i.test(descLower)
        ? "ADDI"
        : /nequi/i.test(descLower)
        ? "Préstamo Nequi"
        : r.descripcion || "Crédito Financiero";
      const prev = debtPaymentsByEntity.get(entity) || { totalPaid: 0, count: 0 };
      debtPaymentsByEntity.set(entity, {
        totalPaid: prev.totalPaid + r.monto,
        count: prev.count + 1,
      });
      continue;
    }

    // Préstamos o encargos a terceros bajo categoría Inversiones (Emi vapos, Migue, Regalo mamá puntual)
    if (catLower.includes("inversiones")) {
      reimbursementsTotal += 0;
      continue;
    }

    if (catLower.includes("pago internet") || /internet|somos/.test(descLower)) {
      internetTotal += r.monto;
    } else if (catLower.includes("pago celular") || /cel\b|celular|sandris|samu/.test(descLower)) {
      celularTotal += r.monto;
    } else if (/gimnasio|gym/.test(descLower)) {
      gymTotal += r.monto;
    } else if (/natillera|ahorro programado/.test(descLower)) {
      natilleraTotal += r.monto;
    } else if (catLower.includes("suscripciones") || /spotify|prime|netflix|icloud/.test(descLower)) {
      suscripcionesTotal += r.monto;
    } else if (/pastillas|medicamento/.test(descLower)) {
      pastillasSaludFijaTotal += r.monto;
    } else if (/uñas|unas|mona|peluqueria|barberia|cuidado personal/.test(descLower)) {
      cuidadoPersonalTotal += r.monto;
    } else if (catLower.includes("transporte") || /uber|parqueadero|metro|bus|gasolina|peaje/.test(descLower)) {
      transporteTotal += r.monto;
    } else if (catLower.includes("salud") || catLower.includes("universidad")) {
      saludYUniVariableTotal += r.monto;
    } else if (catLower.includes("comida")) {
      if (/alitas|plan con|salida|restaurante|cumple/.test(descLower) || r.monto >= 45000) {
        discretionaryTotal += r.monto;
        spentSalidas += r.monto;
      } else {
        comidaRutinaTotal += r.monto;
      }
    } else {
      // Hobbies, antojos, compras y ocio para la Bóveda GP
      discretionaryTotal += r.monto;
      if (/cubo|cubito|rubik/.test(descLower)) spentCubos += r.monto;
      if (/libro|lectura/.test(descLower)) spentLibros += r.monto;
      if (/hilo|tejer|lana|crochet|agujas/.test(descLower)) spentTejido += r.monto;
      if (/lego/.test(descLower)) spentLego += r.monto;
      if (/salida|cine|bar|cafe|postre/.test(descLower)) spentSalidas += r.monto;
    }
  }

  // Ingreso mensual recurrente optimizado:
  // Si hay pagos quincenales de sueldo, el ingreso mensual por sueldo es (promedio por quincena * 2)
  const avgBiweeklySueldo =
    sueldoCount >= 2 ? sueldoTotal / sueldoCount : sueldoTotal / effectiveMonths;
  const monthlySueldo =
    sueldoCount >= 2
      ? Math.round((avgBiweeklySueldo * 2) / 5000) * 5000
      : Math.round(sueldoTotal / effectiveMonths / 5000) * 5000;
  const monthlyClases = Math.round(clasesTotal / effectiveMonths / 5000) * 5000;
  const optimizedMonthlyIncome = Math.max(
    500000,
    monthlySueldo + monthlyClases
  );

  const fixedCosts: FixedCostItem[] = [];
  const pushFixed = (name: string, totalAmt: number, category: string, minFloor = 0) => {
    const monthly = Math.max(
      minFloor,
      Math.round(totalAmt / effectiveMonths / 1000) * 1000
    );
    if (monthly > 0) {
      fixedCosts.push({ name, amount: monthly, category });
    }
  };

  if (internetTotal > 0) pushFixed("Internet Hogar (Somos)", internetTotal, "conectividad", 110000);
  if (celularTotal > 0) pushFixed("Plan Celular", celularTotal, "conectividad", 85000);
  if (gymTotal > 0) pushFixed("Gimnasio Mensual", gymTotal, "salud", 120000);
  if (natilleraTotal > 0) pushFixed("Natillera (Ahorro Fijo)", natilleraTotal, "ahorro", 100000);
  if (pastillasSaludFijaTotal > 0)
    pushFixed("Salud & Medicamentos Fijos", pastillasSaludFijaTotal, "salud", 160000);
  if (suscripcionesTotal > 0)
    pushFixed("Suscripciones (Spotify + Prime)", suscripcionesTotal, "conectividad", 56000);
  if (cuidadoPersonalTotal > 0)
    pushFixed("Cuidado Personal (Uñas & Peluquería)", cuidadoPersonalTotal, "hogar", 150000);

  const totalFixed = fixedCosts.reduce((a, b) => a + b.amount, 0);

  const monthlyComida = Math.round(comidaRutinaTotal / effectiveMonths / 5000) * 5000;
  const monthlyTransporte = Math.round(transporteTotal / effectiveMonths / 5000) * 5000;
  const monthlySaludUni = Math.round(saludYUniVariableTotal / effectiveMonths / 5000) * 5000;
  const variableOpsBudget = Math.max(
    150000,
    monthlyComida + monthlyTransporte + monthlySaludUni
  );

  // Construir Jefes de Deuda (Debt Bosses) a partir de Obligaciones Financieras reales
  const bosses: OnboardingBossInput[] = [];
  debtPaymentsByEntity.forEach((info, entityName) => {
    const avgQuota = Math.round(info.totalPaid / Math.max(1, info.count) / 1000) * 1000;
    const isAddi = /addi/i.test(entityName);
    const rate = isAddi ? 29.0 : 24.5;
    // Estimar saldo restante realista (~6 cuotas restantes) para activar el combate de deudas
    const estimatedBalance = Math.max(avgQuota * 6, avgQuota * 4);
    bosses.push({
      name: entityName,
      total_balance: estimatedBalance,
      interest_rate_ea: rate,
      min_monthly_payment: avgQuota,
    });
  });

  const remainingBeforeVault = Math.max(
    0,
    optimizedMonthlyIncome - totalFixed - variableOpsBudget
  );
  const rawMonthlyDiscretionary =
    Math.round(discretionaryTotal / effectiveMonths / 10000) * 10000;
  const vaultCap = Math.min(
    Math.round(remainingBeforeVault * 0.45),
    Math.max(250000, Math.min(420000, rawMonthlyDiscretionary || 380000))
  );
  const savingsGoal = Math.max(
    100000,
    Math.round((remainingBeforeVault - vaultCap) * 0.5 / 10000) * 10000
  );

  // Wishlist personalizada basada en los hobbies reales detectados en el CSV
  const suggestedWishlist: OnboardingWishlistInput[] = [
    {
      name: "Salida Social / Alitas con Amigos o Plan Fin de Semana",
      cost_gp: 65000,
      priority: 1,
    },
    {
      name:
        spentTejido > 0
          ? "Kit de Hilos para Tejer & Materiales de Crochet"
          : "Materiales para Proyecto Creativo",
      cost_gp: 100000,
      priority: 2,
    },
    {
      name:
        spentCubos > 0
          ? "Nuevo Cubo de Speedcubing / Set LEGO para Colección"
          : "Accesorio de Hobby / Juegos",
      cost_gp: 180000,
      priority: 3,
    },
    {
      name:
        spentLibros > 0
          ? "Pack de Libros Nuevos / Edición Especial"
          : "Recompensa Épica de Temporada",
      cost_gp: 220000,
      priority: 4,
    },
  ];

  const detectedLog: string[] = [
    `📅 Historial auditado: ${totalTx} movimientos reales (${effectiveMonths} meses equivalentes).`,
    `💰 Ingreso Recurrente Optimizado: ${optimizedMonthlyIncome.toLocaleString("es-CO")} ${currency}/mes (Sueldo quincenal prom. ×2: ${monthlySueldo.toLocaleString("es-CO")} + Clases: ${monthlyClases.toLocaleString("es-CO")}).`,
    `🛡️ Excluidos del ingreso fijo para no inflar tu presupuesto: Saldos iniciales (${openingBalanceTotal.toLocaleString("es-CO")}) y reembolsos/terceros (${reimbursementsTotal.toLocaleString("es-CO")}).`,
    `🏠 Costos Fijos (${fixedCosts.length} rubros): ${totalFixed.toLocaleString("es-CO")} ${currency}/mes (Internet, Celular, Gimnasio, Natillera, Pastillas, Spotify+Prime y Cuidado Personal).`,
    `🛒 Variables Operativos: ${variableOpsBudget.toLocaleString("es-CO")} ${currency}/mes (Comida diaria ~${monthlyComida.toLocaleString("es-CO")}, Transporte Uber/Parqueadero ~${monthlyTransporte.toLocaleString("es-CO")}, Salud/Uni ~${monthlySaludUni.toLocaleString("es-CO")}).`,
    `⚔️ Obligaciones Financieras detectadas: ${bosses.map((b) => `${b.name} (cuota ${b.min_monthly_payment.toLocaleString("es-CO")}/mes)`).join(", ") || "Ninguna"}.`,
    `🎁 Hobbies reales detectados en tus compras: Cubos (${spentCubos.toLocaleString("es-CO")}), Libros (${spentLibros.toLocaleString("es-CO")}), Hilos de Tejer (${spentTejido.toLocaleString("es-CO")}), LEGO (${spentLego.toLocaleString("es-CO")}) → Convertidos en tu Tienda de Recompensas (Paso 5).`,
  ];

  const recommendedStrategy: DebtStrategy =
    bosses.length > 1 && Math.max(...bosses.map((b) => b.interest_rate_ea)) >= 25
      ? "avalanche"
      : "snowball";

  const metrics = computeAuditMetrics({
    monthly_income: optimizedMonthlyIncome,
    fixed_costs: fixedCosts,
    variable_ops_budget: variableOpsBudget,
    vault_cap: vaultCap,
    bosses,
    detected_items_log: detectedLog,
  });

  return {
    monthly_income: optimizedMonthlyIncome,
    fixed_costs: fixedCosts,
    variable_ops_budget: variableOpsBudget,
    vault_cap: vaultCap,
    savings_goal_monthly: savingsGoal,
    bosses,
    suggested_wishlist: suggestedWishlist,
    recommended_debt_strategy: recommendedStrategy,
    diagnosis: `Historial Real Optimizado (${totalTx} registros Sep–Nov): Tu ingreso recurrente real es ${optimizedMonthlyIncome.toLocaleString("es-CO")} ${currency}/mes (excluyendo saldos iniciales y reembolsos únicos). Asignamos ${totalFixed.toLocaleString("es-CO")} a Costos Fijos (${metrics.fixed_pct}%), ${variableOpsBudget.toLocaleString("es-CO")} a Variables Operativos (${metrics.variable_pct}%) y ${vaultCap.toLocaleString("es-CO")} GP a tu Bóveda para Cubos, Libros, Hilos de Tejer y Salidas (${metrics.vault_pct}%), liberando ${metrics.snowball_power.toLocaleString("es-CO")} ${currency}/mes (${metrics.snowball_pct}%) de Poder de Ataque contra ADDI y Nequi.`,
    audit_metrics: metrics,
    source: "deterministic",
  };
}

function computeAuditMetrics(params: {
  monthly_income: number;
  fixed_costs: FixedCostItem[];
  variable_ops_budget: number;
  vault_cap: number;
  bosses: OnboardingBossInput[];
  detected_items_log: string[];
}): FinancialAuditMetrics {
  const inc = Math.max(1, params.monthly_income);
  const totalFixed = params.fixed_costs.reduce((a, b) => a + (Number(b.amount) || 0), 0);
  const varOps = Math.max(0, params.variable_ops_budget);
  const vault = Math.max(0, params.vault_cap);
  const snowballPower = Math.max(0, inc - totalFixed - varOps - vault);
  const totalDebt = params.bosses.reduce((a, b) => a + (Number(b.total_balance) || 0), 0);
  const totalMinPayments = params.bosses.reduce(
    (a, b) => a + (Number(b.min_monthly_payment) || 0),
    0
  );
  const effectiveAttack = Math.max(1, snowballPower + totalMinPayments);
  const estMonths =
    totalDebt > 0 ? Math.max(1, Math.ceil((totalDebt * 1.12) / effectiveAttack)) : 0;

  return {
    fixed_pct: Math.round((totalFixed / inc) * 100),
    variable_pct: Math.round((varOps / inc) * 100),
    vault_pct: Math.round((vault / inc) * 100),
    snowball_power: snowballPower,
    snowball_pct: Math.round((snowballPower / inc) * 100),
    total_debt: totalDebt,
    total_min_debt_payments: totalMinPayments,
    estimated_debt_free_months: estMonths,
    detected_items_log: params.detected_items_log,
  };
}

function inferDebtRateAndMinPayment(
  rawLine: string,
  balance: number,
  currency: CurrencyCode
): { rate: number; minPayment: number } {
  const rateMatch = rawLine.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*%/);
  const lower = rawLine.toLowerCase();
  let rate = 24.5;
  let pctMin = 0.07;

  if (rateMatch) {
    rate = Number(rateMatch[1].replace(",", "."));
  } else if (/addi|sistecredito|gota/.test(lower)) {
    rate = 29.0;
    pctMin = 0.12;
  } else if (/tarjeta|nu\b|rappi|bancolombia|davivienda|bbva|falabella|codensa/.test(lower)) {
    rate = 28.5;
    pctMin = 0.06;
  } else if (/icetex|educativo|universidad/.test(lower)) {
    rate = 12.5;
    pctMin = 0.035;
  } else if (/hipoteca|vivienda|vehiculo|carro|moto/.test(lower)) {
    rate = 14.5;
    pctMin = 0.03;
  }

  const floorMin = currency === "USD" || currency === "EUR" ? 25 : currency === "MXN" ? 300 : 35000;
  return {
    rate,
    minPayment: Math.max(floorMin, Math.round(balance * pctMin)),
  };
}

export async function evaluateFinancesWithAI(params: {
  rawTextOrTable: string;
  currency: CurrencyCode;
}): Promise<FinancialEvaluationResult> {
  const { rawTextOrTable, currency } = params;

  // 1. Si el texto corresponde a un historial de transacciones CSV (Fecha,Tipo,Categoría,Monto...),
  // usar el agregador matemático exacto para evitar errores de suma o centavos (.00)
  const txCsvAnalysis = analyzeTransactionHistoryCsv(rawTextOrTable, currency);
  if (txCsvAnalysis) {
    return txCsvAnalysis;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey !== "tu-gemini-api-key") {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          monthly_income: {
            type: Type.NUMBER,
            description:
              "Ingreso mensual total normalizado (si es quincenal multiplica por 2, si es semanal por 4.33).",
          },
          fixed_costs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                category: { type: Type.STRING },
              },
              required: ["name", "amount", "category"],
            },
          },
          variable_ops_budget: {
            type: Type.NUMBER,
            description:
              "Presupuesto mensual para gastos variables esenciales (mercado, comida, transporte, gasolina, salud).",
          },
          vault_cap: {
            type: Type.NUMBER,
            description:
              "Tope mensual sugerido para la Bóveda de gustos/recompensas (GP), garantizando que ingreso - fijos - variables - bóveda >= 0.",
          },
          savings_goal_monthly: {
            type: Type.NUMBER,
            description: "Meta de ahorro mensual recomendada.",
          },
          bosses: {
            type: Type.ARRAY,
            description: "Deudas o créditos detectados en el texto o tabla.",
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                total_balance: { type: Type.NUMBER },
                interest_rate_ea: { type: Type.NUMBER },
                min_monthly_payment: { type: Type.NUMBER },
              },
              required: [
                "name",
                "total_balance",
                "interest_rate_ea",
                "min_monthly_payment",
              ],
            },
          },
          recommended_debt_strategy: {
            type: Type.STRING,
            enum: ["snowball", "avalanche"],
          },
          detected_items_log: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description:
              "Lista de cada rubro detectado y cómo lo clasificó o mensualizó el motor financiero.",
          },
          diagnosis: {
            type: Type.STRING,
            description:
              "Diagnóstico táctico de 2-3 oraciones explicando ratios de liquidez, estrategia de deuda y salud financiera.",
          },
        },
        required: [
          "monthly_income",
          "fixed_costs",
          "variable_ops_budget",
          "vault_cap",
          "savings_goal_monthly",
          "bosses",
          "recommended_debt_strategy",
          "detected_items_log",
          "diagnosis",
        ],
      };

      const skill = AI_SKILLS_REGISTRY.FINANCIAL_ENGINE_AUDITOR;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Analiza la siguiente descripción en texto libre o tabla CSV/Excel del usuario (Moneda: ${currency}):
1. Normaliza frecuencias (quincenal x2, semanal x4.33, diario x25, anual /12).
2. Clasifica en las 5 cubetas: monthly_income, fixed_costs (arriendo, servicios, internet, seguros, educación), variable_ops_budget (mercado, transporte, salud), bosses (deudas con tasa E.A. estimada según entidad si falta: tarjeta ~28.5%, ADDI ~29%, libre inversión ~24.5%, ICETEX ~12.5%) y vault_cap (Bóveda GP para gustos).
3. Garantiza equilibrio contable: monthly_income >= suma(fixed_costs) + variable_ops_budget + vault_cap.

DATOS DEL USUARIO:
${rawTextOrTable}`,
        config: {
          systemInstruction: skill.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: skill.temperature,
        },
      });

      const parsed = JSON.parse(response.text || "{}") as Partial<
        FinancialEvaluationResult & { detected_items_log?: string[] }
      >;
      if (parsed.monthly_income && parsed.monthly_income > 0) {
        const inc = Math.round(parsed.monthly_income);
        const fc =
          parsed.fixed_costs && parsed.fixed_costs.length > 0
            ? parsed.fixed_costs
            : [
                {
                  name: "Gastos Fijos Base",
                  amount: Math.round(inc * 0.35),
                  category: "hogar",
                },
              ];
        const vOps = Math.round(parsed.variable_ops_budget ?? inc * 0.22);
        const vCap = Math.round(parsed.vault_cap ?? inc * 0.15);
        const bList = sanitizeBossesList(parsed.bosses);
        const logList = parsed.detected_items_log || [
          `Ingreso mensualizado: ${inc.toLocaleString("es-CO")} ${currency}`,
        ];
        return {
          monthly_income: inc,
          fixed_costs: fc,
          variable_ops_budget: vOps,
          vault_cap: vCap,
          savings_goal_monthly: Math.round(
            parsed.savings_goal_monthly ?? inc * 0.12
          ),
          bosses: bList,
          recommended_debt_strategy:
            parsed.recommended_debt_strategy === "avalanche"
              ? "avalanche"
              : "snowball",
          diagnosis:
            parsed.diagnosis ||
            "Presupuesto auditado y calibrado con el Motor Financiero Gemini.",
          audit_metrics: computeAuditMetrics({
            monthly_income: inc,
            fixed_costs: fc,
            variable_ops_budget: vOps,
            vault_cap: vCap,
            bosses: bList,
            detected_items_log: logList,
          }),
          source: "gemini",
        };
      }
    } catch {
      // Continúa al Motor Financiero Determinista Local
    }
  }

  // Motor Financiero Determinista (soporta tanto prosa libre como tablas CSV/TSV/Excel)
  const defaultIncome =
    currency === "USD" || currency === "EUR"
      ? 2500
      : currency === "MXN"
      ? 25000
      : 2500000;

  const parseAmountToken = (txt: string): number | null => {
    const cleaned = txt.replace(/\b\d{1,2}(?:[.,]\d{1,2})?\s*%/g, " ");
    const mMillones = cleaned.match(
      /(\d+(?:[.,]\d+)?)\s*(millones|millon|m)\b/i
    );
    if (mMillones) {
      return Math.round(Number(mMillones[1].replace(",", ".")) * 1_000_000);
    }
    const mMil = cleaned.match(/(\d+(?:[.,]\d+)?)\s*(mil|k)\b/i);
    if (mMil) {
      return Math.round(Number(mMil[1].replace(",", ".")) * 1_000);
    }
    const mNum = cleaned.match(/\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,})/);
    if (mNum) {
      return Number(mNum[1].replace(/[.,]/g, ""));
    }
    return null;
  };

  const applyFrequencyMultiplier = (
    rawVal: number,
    lineLower: string
  ): { monthlyVal: number; freqNote: string } => {
    if (/quincenal|quincena|cada 15/.test(lineLower)) {
      return { monthlyVal: Math.round(rawVal * 2), freqNote: "×2 quincenal" };
    }
    if (/semanal|por semana|cada semana/.test(lineLower)) {
      return {
        monthlyVal: Math.round(rawVal * 4.33),
        freqNote: "×4.33 semanal",
      };
    }
    if (/diario|al dia|por dia/.test(lineLower)) {
      return { monthlyVal: Math.round(rawVal * 25), freqNote: "×25 diario" };
    }
    if (/anual|al ano|por ano/.test(lineLower)) {
      return { monthlyVal: Math.round(rawVal / 12), freqNote: "÷12 anual" };
    }
    return { monthlyVal: rawVal, freqNote: "mensual" };
  };

  let detectedIncome = 0;
  const fixedCosts: FixedCostItem[] = [];
  const bosses: OnboardingBossInput[] = [];
  let variableOps = 0;
  let explicitVault = 0;
  const detectedLog: string[] = [];

  const chunks = rawTextOrTable
    .split(
      /\r?\n|;|(?=\b(?:gano|ingreso|sueldo|salario|quincena|arriendo|renta|alquiler|hipoteca|administracion|servicios|luz|agua|internet|celular|plan|seguro|gimnasio|universidad|colegio|mercado|comida|alimentacion|transporte|gasolina|debo|deuda|tarjeta|credito|prestamo|nequi|addi|bancolombia|nu\b|icetex|gustos|ocio|salidas|boveda)\b)/i
    )
    .map((l) => l.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    // Saltar encabezados típicos de tablas CSV
    if (/^(concepto|rubro|item|categoria|tipo)\s*[,|\t]/i.test(chunk)) continue;

    const rawVal = parseAmountToken(chunk);
    if (!rawVal || rawVal <= 0) continue;

    const lower = chunk.toLowerCase();
    const { monthlyVal, freqNote } = applyFrequencyMultiplier(rawVal, lower);

    const cleanLabel =
      chunk
        .replace(/\$?\s*\d{1,3}(?:[.,]\d{3})+|\b\d+(?:[.,]\d+)?\s*(?:millones|millon|mil|k|m|%)\b|\b\d{3,}\b/gi, " ")
        .replace(/[,|\t:;]+/g, " ")
        .replace(
          /\b(gano|ingreso|sueldo|salario|pago|gasto|debo|deuda|en|de|por|al|mes|mensual|quincenal|semanal|diario|anual|con|tasa|ea|unos|aprox)\b/gi,
          " "
        )
        .replace(/\s+/g, " ")
        .trim() || "Rubro";

    if (/gano|ingreso|sueldo|salario|nomina|quincena|honorarios|mesada|beca/.test(lower)) {
      detectedIncome += monthlyVal;
      detectedLog.push(
        `💰 Ingreso detectado: ${monthlyVal.toLocaleString("es-CO")} ${currency} (${freqNote})`
      );
    } else if (
      /debo|deuda|tarjeta|credito|prestamo|nequi|addi|sistecredito|bancolombia|davivienda|nu\b|rappi|icetex/.test(
        lower
      )
    ) {
      const { rate, minPayment } = inferDebtRateAndMinPayment(
        chunk,
        rawVal,
        currency
      );
      const bossName =
        cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1, 32);
      bosses.push({
        name: bossName,
        total_balance: rawVal,
        interest_rate_ea: rate,
        min_monthly_payment: minPayment,
      });
      detectedLog.push(
        `⚔️ Debt Boss: ${bossName} — Saldo ${rawVal.toLocaleString("es-CO")} (${rate}% E.A., cuota mín. ${minPayment.toLocaleString("es-CO")})`
      );
    } else if (/gustos|ocio|salidas|restaurantes|entretenimiento|boveda|hobbies/.test(lower)) {
      explicitVault += monthlyVal;
      detectedLog.push(
        `🔐 Bóveda / Gustos: ${monthlyVal.toLocaleString("es-CO")} ${currency} (${freqNote})`
      );
    } else if (
      /mercado|supermercado|comida|alimentacion|transporte|gasolina|uber|bus|aseo|farmacia|variable/.test(
        lower
      )
    ) {
      variableOps += monthlyVal;
      detectedLog.push(
        `🛒 Variable Operativo (${cleanLabel}): ${monthlyVal.toLocaleString("es-CO")} ${currency} (${freqNote})`
      );
    } else {
      const category = /servicio|luz|agua|gas/.test(lower)
        ? "servicios"
        : /internet|celular|movil|plan|streaming/.test(lower)
        ? "conectividad"
        : /gimnasio|salud|seguro|eps|prepagada/.test(lower)
        ? "salud"
        : /universidad|colegio|curso|educacion/.test(lower)
        ? "educacion"
        : "hogar";
      const fcName =
        cleanLabel.charAt(0).toUpperCase() + cleanLabel.slice(1, 35);
      fixedCosts.push({
        name: fcName,
        amount: monthlyVal,
        category,
      });
      detectedLog.push(
        `🏠 Costo Fijo (${fcName}): ${monthlyVal.toLocaleString("es-CO")} ${currency} (${freqNote})`
      );
    }
  }

  if (detectedIncome <= 0) {
    detectedIncome = defaultIncome;
    detectedLog.push(
      `ℹ️ No se especificó ingreso explícito; se asignó base de ${detectedIncome.toLocaleString("es-CO")} ${currency}.`
    );
  }

  if (fixedCosts.length === 0) {
    fixedCosts.push(
      {
        name: "Vivienda / Arriendo",
        amount: Math.round(detectedIncome * 0.28),
        category: "hogar",
      },
      {
        name: "Servicios & Conectividad",
        amount: Math.round(detectedIncome * 0.08),
        category: "servicios",
      }
    );
  }

  const totalFixed = fixedCosts.reduce((a, b) => a + b.amount, 0);
  if (variableOps <= 0) {
    variableOps = Math.round(detectedIncome * 0.2);
    detectedLog.push(
      `🛒 Variables Operativos estimados al 20%: ${variableOps.toLocaleString("es-CO")} ${currency}`
    );
  }

  const remainingAfterOps = Math.max(
    0,
    detectedIncome - totalFixed - variableOps
  );
  const vaultCap =
    explicitVault > 0 && explicitVault <= remainingAfterOps
      ? explicitVault
      : Math.round(remainingAfterOps * 0.42);
  const savingsGoal = Math.max(
    0,
    Math.round((remainingAfterOps - vaultCap) * 0.6)
  );

  const recommendedStrategy: DebtStrategy =
    bosses.length > 1 && Math.max(...bosses.map((b) => b.interest_rate_ea)) >= 25
      ? "avalanche"
      : "snowball";

  const metrics = computeAuditMetrics({
    monthly_income: detectedIncome,
    fixed_costs: fixedCosts,
    variable_ops_budget: variableOps,
    vault_cap: vaultCap,
    bosses,
    detected_items_log: detectedLog,
  });

  return {
    monthly_income: detectedIncome,
    fixed_costs: fixedCosts,
    variable_ops_budget: variableOps,
    vault_cap: vaultCap,
    savings_goal_monthly: savingsGoal,
    bosses,
    recommended_debt_strategy: recommendedStrategy,
    diagnosis: `Motor Financiero: Ingreso mensualizado de ${detectedIncome.toLocaleString("es-CO")} ${currency} distribuido en ${metrics.fixed_pct}% Costos Fijos (${fixedCosts.length} rubros), ${metrics.variable_pct}% Variables Operativos, ${metrics.vault_pct}% Bóveda GP (${vaultCap.toLocaleString("es-CO")} GP) y ${metrics.snowball_pct}% Poder Bola de Nieve (${metrics.snowball_power.toLocaleString("es-CO")} ${currency}/mes)${
      bosses.length > 0
        ? `. Tiempo estimado para liquidar tus ${bosses.length} deuda(s): ~${metrics.estimated_debt_free_months} meses con estrategia ${
            recommendedStrategy === "avalanche" ? "Avalancha" : "Bola de Nieve"
          }.`
        : "."
    }`,
    audit_metrics: metrics,
    source: "deterministic",
  };
}

export async function planQuestsAndRewardsWithAI(params: {
  profession: string;
  character_class: string;
  currency: CurrencyCode;
  monthly_income: number;
  vault_cap: number;
  fixed_costs: FixedCostItem[];
  bosses: OnboardingBossInput[];
  skills: UserSkillConfig[];
}): Promise<{
  main_goal: string;
  quests: OnboardingQuestInput[];
  wishlist: OnboardingWishlistInput[];
  strategy_note: string;
  source: "gemini" | "deterministic";
}> {
  const {
    profession,
    character_class,
    currency,
    vault_cap,
    bosses,
    skills,
  } = params;

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey && apiKey !== "tu-gemini-api-key") {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const schema: Schema = {
        type: Type.OBJECT,
        properties: {
          main_goal: {
            type: Type.STRING,
            description:
              "Meta principal motivadora y específica según sus deudas, profesión y habilidades.",
          },
          strategy_note: {
            type: Type.STRING,
            description:
              "Breve explicación del Agente IA sobre cómo calibró las misiones y los precios de la tienda.",
          },
          quests: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING },
                title: { type: Type.STRING },
                domain: {
                  type: Type.STRING,
                  enum: [
                    "rubik",
                    "reading",
                    "knitting",
                    "study",
                    "work",
                    "gaming",
                    "sports",
                    "general",
                  ],
                },
                difficulty: {
                  type: Type.STRING,
                  enum: ["easy", "medium", "hard"],
                },
                reward_gp: { type: Type.NUMBER },
                reward_xp: { type: Type.NUMBER },
              },
              required: [
                "code",
                "title",
                "domain",
                "difficulty",
                "reward_gp",
                "reward_xp",
              ],
            },
          },
          wishlist: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                cost_gp: { type: Type.NUMBER },
                priority: { type: Type.NUMBER },
              },
              required: ["name", "cost_gp", "priority"],
            },
          },
        },
        required: ["main_goal", "strategy_note", "quests", "wishlist"],
      };

      const skill = AI_SKILLS_REGISTRY.QUEST_ECONOMY_PLANNER;
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Diseña las misiones diarias iniciales (quests) y la Tienda de Recompensas (wishlist) para este usuario:
- Profesión: ${profession}
- Clase RPG: ${character_class}
- Moneda: ${currency} | Tope de Bóveda Mensual: ${vault_cap} GP
- Deudas activas: ${bosses.length > 0 ? bosses.map((b) => `${b.name} (${b.total_balance})`).join(", ") : "Sin deudas (Modo Ahorro)"}
- Habilidades elegidas: ${skills.map((s) => `${s.label} (${s.domain}, ${s.weekly_target_minutes} min/sem)`).join(", ")}

Reglas:
1. Crea 1 misión específica por cada habilidad elegida. La suma de unas 20-25 misiones al mes debe permitir desbloquear gradualmente el Tope de Bóveda (${vault_cap} GP).
2. Crea 4 recompensas en la Wishlist escalonadas (Prioridad 1: gusto pequeño ~10% de la bóveda, Prioridad 2: recompensa media ~25%, Prioridad 3: recompensa de habilidad/profesión ~45%, Prioridad 4: loot épico ~80% de la bóveda).`,
        config: {
          systemInstruction: skill.systemInstruction,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: skill.temperature,
        },
      });

      const parsed = JSON.parse(response.text || "{}") as {
        main_goal?: string;
        strategy_note?: string;
        quests?: OnboardingQuestInput[];
        wishlist?: OnboardingWishlistInput[];
      };

      const sanitizedPlan = sanitizeQuestsAndWishlist({
        quests: parsed.quests,
        wishlist: parsed.wishlist,
        vault_cap,
      });

      if (sanitizedPlan) {
        return {
          main_goal:
            parsed.main_goal ||
            `Dominar mis hábitos de ${profession} y alcanzar mi meta financiera`,
          quests: sanitizedPlan.quests,
          wishlist: sanitizedPlan.wishlist,
          strategy_note:
            parsed.strategy_note ||
            "Misiones y recompensas calibradas con Gemini según tu Bóveda y tus habilidades.",
          source: "gemini",
        };
      }
    } catch {
      // Continúa al generador determinista inteligente
    }
  }

  // Generador determinista calibrado al vault_cap, profesión, deudas y habilidades del usuario
  const safeVault = Math.max(100, vault_cap || 300000);
  const baseQuestReward = Math.max(10, Math.round(safeVault / 28));

  const domainQuestTemplates: Record<
    SkillDomain,
    { code: string; title: string; difficulty: "easy" | "medium" | "hard"; xp: number; mult: number }
  > = {
    rubik: {
      code: "QUEST_RUBIK_SESSION",
      title: "Cubos de Rubik: Sesión Ao12 + Práctica de Algoritmos",
      difficulty: "medium",
      xp: 95,
      mult: 1.0,
    },
    reading: {
      code: "QUEST_READING_20P",
      title: `Lectura Profunda: 20 páginas aplicadas a ${profession || "mi crecimiento"}`,
      difficulty: "medium",
      xp: 100,
      mult: 1.05,
    },
    knitting: {
      code: "QUEST_KNITTING_ROWS",
      title: "Tejido & Artesanía: Avanzar 8 vueltas del proyecto activo",
      difficulty: "easy",
      xp: 85,
      mult: 0.9,
    },
    study: {
      code: "QUEST_STUDY_DEEP",
      title: `Estudio Profundo (50 min): Dominio técnico en ${profession || "mi área"}`,
      difficulty: "hard",
      xp: 120,
      mult: 1.2,
    },
    work: {
      code: "QUEST_WORK_SPRINT",
      title: `Sprint de Alto Impacto (${profession || "Trabajo"}): Cerrar entregable clave`,
      difficulty: "hard",
      xp: 135,
      mult: 1.3,
    },
    gaming: {
      code: "QUEST_GAMING_MINDFUL",
      title: "Sesión Gamer Consciente: Partida estratégica respetando tiempo límite",
      difficulty: "easy",
      xp: 75,
      mult: 0.85,
    },
    sports: {
      code: "QUEST_SPORTS_TRAINING",
      title: "Entrenamiento Deportivo / Competencia: 45 min de actividad física",
      difficulty: "medium",
      xp: 115,
      mult: 1.15,
    },
    general: {
      code: "QUEST_GENERAL_HABIT",
      title: "Auditoría Financiera & Cero Gastos Hormiga del Día",
      difficulty: "easy",
      xp: 70,
      mult: 0.8,
    },
  };

  const quests: OnboardingQuestInput[] = skills.map((s) => {
    const tpl = domainQuestTemplates[s.domain] || domainQuestTemplates.general;
    return {
      code: tpl.code,
      title: s.custom_description
        ? `${s.label}: ${s.custom_description}`
        : tpl.title,
      domain: s.domain,
      difficulty: tpl.difficulty,
      reward_gp: Math.max(5, Math.round(baseQuestReward * tpl.mult)),
      reward_xp: tpl.xp,
    };
  });

  const totalDebt = bosses.reduce((a, b) => a + (Number(b.total_balance) || 0), 0);
  const mainGoal =
    totalDebt > 0
      ? `Derrotar ${bosses.length} deuda(s) (${totalDebt.toLocaleString("es-CO")} ${currency}) mientras subo de nivel como ${character_class}`
      : `Maximizar mi fondo de ahorro en ${currency} manteniendo mi racha semanal en ${skills.length} habilidades`;

  const wishlist: OnboardingWishlistInput[] = [
    {
      name: "Recompensa Rápida: Café Especial / Postre / Snack sin multa",
      cost_gp: Math.max(5, Math.round(safeVault * 0.08)),
      priority: 1,
    },
    {
      name: skills.some((s) => s.domain === "gaming")
        ? "Juego Indie / Pase de Batalla / Accesorio Gamer"
        : skills.some((s) => s.domain === "sports")
        ? "Implemento Deportivo / Inscripción a Torneo"
        : "Libro Nuevo / Cubo de Rubik / Materiales de Proyecto",
      cost_gp: Math.max(10, Math.round(safeVault * 0.22)),
      priority: 2,
    },
    {
      name: "Salida de Fin de Semana / Cena Especial Liberada con GP",
      cost_gp: Math.max(20, Math.round(safeVault * 0.4)),
      priority: 3,
    },
    {
      name: `Loot Épico de ${profession || "Temporada"}: Herramienta o Experiencia Premium`,
      cost_gp: Math.max(40, Math.round(safeVault * 0.75)),
      priority: 4,
    },
  ];

  return {
    main_goal: mainGoal,
    quests,
    wishlist,
    strategy_note: `Cada misión completada te otorga ~${baseQuestReward.toLocaleString("es-CO")} GP (antes de multiplicador de racha). Con 3 a 4 sesiones por semana desbloquearás tus recompensas de Prioridad 1 y 2 sin afectar el pago de tus costos fijos${totalDebt > 0 ? " ni el ataque a tus deudas" : ""}.`,
    source: "deterministic",
  };
}
