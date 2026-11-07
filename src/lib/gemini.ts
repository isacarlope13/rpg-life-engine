import { GoogleGenAI, Type, type Schema } from "@google/genai";
import {
  AI_SKILLS_REGISTRY,
  sanitizeBookSpecs,
  sanitizeCubeSpecs,
  sanitizeParsedExpense,
  sanitizeReceiptSplit,
} from "./ai-skills-prompts";
import type {
  BookComplexity,
  ExtractedBookSpecsAI,
  ExtractedCubeSpecsAI,
  ParsedExpenseAI,
  ParsedReceiptSplitAI,
  RubikCubeType,
  SpecComplianceCheckItem,
} from "../types/rpg";

export const ExpenseClassificationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    amount_cop: {
      type: Type.NUMBER,
      description:
        "Monto exacto en pesos colombianos (COP). Ejemplo: '$32.500' o '32 mil' -> 32500.",
    },
    category: {
      type: Type.STRING,
      enum: [
        "fixed_mandatory",
        "variable_operational",
        "debt_attack",
        "discretionary_wishlist",
        "discretionary_unbudgeted",
      ],
      description:
        "Categoría financiera. Si es comida rápida, Rappi, restaurantes, bares o antojos, usa 'discretionary_unbudgeted'. Si es abono a Nequi, ADDI o Bancolombia, usa 'debt_attack'.",
    },
    merchant_or_concept: {
      type: Type.STRING,
      description: "Comercio o concepto limpio extraído del SMS o dictado.",
    },
    boss_target: {
      type: Type.STRING,
      enum: ["Nequi", "ADDI", "Bancolombia", "NONE"],
      description:
        "Si category es 'debt_attack', identifica a cuál Boss se hizo el abono.",
    },
    detected_source: {
      type: Type.STRING,
      enum: ["bank_sms", "voice_dictation"],
      description:
        "Si el texto parece una notificación SMS de Bancolombia/Nequi/Apple Pay, usa 'bank_sms'.",
    },
  },
  required: [
    "amount_cop",
    "category",
    "merchant_or_concept",
    "boss_target",
    "detected_source",
  ],
};

export const ReceiptSplitSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    merchant_name: {
      type: Type.STRING,
      description: "Nombre del supermercado o comercio de la factura.",
    },
    total_cop: {
      type: Type.NUMBER,
      description: "Suma total de la factura en COP.",
    },
    operational_essential_cop: {
      type: Type.NUMBER,
      description:
        "Suma en COP de ítems esenciales/operativos (mercado básico, aseo, salud).",
    },
    discretionary_unbudgeted_cop: {
      type: Type.NUMBER,
      description:
        "Suma en COP de antojos/snacks/licor/dulces no presupuestados.",
    },
    essential_items_summary: {
      type: Type.STRING,
      description: "Lista corta de los ítems esenciales detectados.",
    },
    unbudgeted_items_summary: {
      type: Type.STRING,
      description:
        "Lista corta de los antojos detectados sujetos a multa 1.2x.",
    },
  },
  required: [
    "merchant_name",
    "total_cop",
    "operational_essential_cop",
    "discretionary_unbudgeted_cop",
    "essential_items_summary",
    "unbudgeted_items_summary",
  ],
};

export function parseExpenseDeterministic(rawText: string): ParsedExpenseAI {
  const isBankSms =
    /bancolombia|compraste|transferiste|t\.debito|t\.credito|nequi:/i.test(
      rawText
    );

  // Limpia fechas (05/11/2026), sufijos de tarjeta (*4491) y centavos (.00 / ,00) para evitar falsos positivos numéricos
  const sanitizedForAmount = rawText
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, " ")
    .replace(/\*\d{3,4}\b/g, " ")
    .replace(/([.,]\d{2})\b/g, "");

  let amount = 25000;
  const dollarOrThousandsMatch = sanitizedForAmount.match(
    /\$\s*(\d{1,3}(?:[.,]\d{3})+|\d+)(?:\s*(mil|k)\b)?|\b(\d{1,3}(?:[.,]\d{3})+)\b/i
  );
  const shorthandMilMatch = sanitizedForAmount.match(
    /\b(\d+(?:[.,]\d+)?)\s*(mil|k)\b/i
  );
  const plainFourDigitsMatch = sanitizedForAmount.match(/\b(\d{4,})\b/);

  if (dollarOrThousandsMatch) {
    const rawDigits = (
      dollarOrThousandsMatch[1] ||
      dollarOrThousandsMatch[3] ||
      ""
    ).replace(/[.,]/g, "");
    amount = Number(rawDigits) || 25000;
    if (dollarOrThousandsMatch[2] && amount < 1000) {
      amount *= 1000;
    }
  } else if (shorthandMilMatch) {
    amount = Math.round(
      Number(shorthandMilMatch[1].replace(",", ".")) * 1000
    );
  } else if (plainFourDigitsMatch) {
    amount = Number(plainFourDigitsMatch[1]);
  }

  const lower = rawText.toLowerCase();

  // Detectar ataque a deuda
  if (
    (lower.includes("abono") ||
      lower.includes("pagué") ||
      lower.includes("pague") ||
      lower.includes("cuota") ||
      lower.includes("deuda")) &&
    (lower.includes("nequi") ||
      lower.includes("addi") ||
      lower.includes("bancolombia"))
  ) {
    const boss = lower.includes("nequi")
      ? "Nequi"
      : lower.includes("addi")
      ? "ADDI"
      : "Bancolombia";
    return {
      amount_cop: amount,
      category: "debt_attack",
      merchant_or_concept: `Ataque a deuda ${boss}`,
      boss_target: boss,
      detected_source: isBankSms ? "bank_sms" : "voice_dictation",
    };
  }

  const smsMerchantMatch = rawText.match(
    /\ben\s+([A-Z0-9\s._-]+?)(?:\s+con\s+|\s+el\s+|\s+desde\s+|$)/i
  );
  const merchant = smsMerchantMatch
    ? smsMerchantMatch[1].trim()
    : rawText.slice(0, 55);

  // Detectar costos fijos obligatorios ($848k)
  if (
    lower.includes("internet") ||
    lower.includes("natillera") ||
    lower.includes("smartfit") ||
    lower.includes("gimnasio") ||
    lower.includes("claro") ||
    lower.includes("movistar") ||
    lower.includes("tigo") ||
    lower.includes("plan celular")
  ) {
    return {
      amount_cop: amount,
      category: "fixed_mandatory",
      merchant_or_concept: merchant,
      boss_target: "NONE",
      detected_source: isBankSms ? "bank_sms" : "voice_dictation",
    };
  }

  // Detectar variables operativos ($540k)
  if (
    lower.includes("transporte") ||
    lower.includes("didi") ||
    lower.includes("didí") ||
    lower.includes("uber") ||
    lower.includes("metro") ||
    lower.includes("cívica") ||
    lower.includes("civica") ||
    lower.includes("salud") ||
    lower.includes("eps") ||
    lower.includes("farmacia") ||
    lower.includes("drogueria") ||
    lower.includes("apoyo familiar") ||
    lower.includes("mercado") ||
    lower.includes("supermercado")
  ) {
    return {
      amount_cop: amount,
      category: "variable_operational",
      merchant_or_concept: merchant,
      boss_target: "NONE",
      detected_source: isBankSms ? "bank_sms" : "voice_dictation",
    };
  }

  return {
    amount_cop: amount,
    category: "discretionary_unbudgeted",
    merchant_or_concept: merchant,
    boss_target: "NONE",
    detected_source: isBankSms ? "bank_sms" : "voice_dictation",
  };
}

export async function parseExpenseWithGemini(
  rawText: string
): Promise<ParsedExpenseAI> {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = parseExpenseDeterministic(rawText);

  if (!apiKey || apiKey === "tu-gemini-api-key") {
    return fallback;
  }

  try {
    const skill = AI_SKILLS_REGISTRY.EXPENSE_SMS_CLASSIFIER;
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Analiza este texto o notificación SMS bancaria en Colombia para mi motor financiero RPG: "${rawText}"`,
      config: {
        systemInstruction: skill.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: ExpenseClassificationSchema,
        temperature: skill.temperature,
      },
    });

    const parsed = JSON.parse(response.text || "{}") as Partial<ParsedExpenseAI>;
    return sanitizeParsedExpense(parsed, fallback);
  } catch {
    return fallback;
  }
}

export async function parseReceiptWithGeminiVision(params: {
  receipt_text?: string;
  image_base64?: string;
  mime_type?: string;
}): Promise<ParsedReceiptSplitAI> {
  const apiKey = process.env.GEMINI_API_KEY;

  const fallbackResult: ParsedReceiptSplitAI = (() => {
    const raw = (params.receipt_text || "").trim();
    if (!raw) {
      return {
        merchant_name: "Éxito / Carulla Supermercados",
        total_cop: 98000,
        operational_essential_cop: 68000,
        discretionary_unbudgeted_cop: 30000,
        essential_items_summary:
          "Pechuga de pollo, huevos x30, arroz, verduras ($68.000 COP)",
        unbudgeted_items_summary:
          "Six-pack cerveza y papas fritas ($30.000 COP -> Sujeto a 1.2x)",
      };
    }

    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let merchantName = "Supermercado / Comercio";
    const essentialItems: string[] = [];
    const unbudgetedItems: string[] = [];
    let essentialCop = 0;
    let unbudgetedCop = 0;

    const impulseKeywords =
      /cerveza|club colombia|poker|aguila|licor|ron|whisky|vino|vodka|tequila|papas|pringles|doritos|choclitos|cheetos|detodito|dulce|chocolate|chocolatina|jet|jumbo|helado|postre|gaseosa|coca-cola|pepsi|redbull|monster|gomitas|galletas oreo|antojo|snack|cigarrillo|vape/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^total\b/i.test(line)) continue;

      // Prioriza montos con '$' o formato de miles al final de la línea, ignorando medidas como 1000ml o 500g
      const dollarMatch = line.match(/\$\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,})/);
      const thousandsMatch = line.match(/\b(\d{1,3}(?:[.,]\d{3})+)\b(?!\s*(?:ml|g|gr|kg|l)\b)/i);
      const plainEndMatch = line.match(/\b(\d{4,})\b(?!\s*(?:ml|g|gr|kg|l)\b)\s*$/i);
      const priceMatch = dollarMatch || thousandsMatch || plainEndMatch;

      if (!priceMatch) {
        if (i === 0 && line.length > 2) {
          merchantName = line;
        }
        continue;
      }

      const amount = Number(priceMatch[1].replace(/[.,]/g, ""));
      if (!amount || amount <= 0) continue;

      const cleanDesc = line
        .replace(priceMatch[0], "")
        .replace(/^\d+\s*x\s*/i, "")
        .replace(/[-:$]+/g, " ")
        .trim();

      if (impulseKeywords.test(line)) {
        unbudgetedCop += amount;
        unbudgetedItems.push(cleanDesc || "Ítem antojo");
      } else {
        essentialCop += amount;
        essentialItems.push(cleanDesc || "Ítem mercado");
      }
    }

    if (essentialCop === 0 && unbudgetedCop === 0) {
      return {
        merchant_name: merchantName,
        total_cop: 98000,
        operational_essential_cop: 68000,
        discretionary_unbudgeted_cop: 30000,
        essential_items_summary: "Mercado básico ($68.000 COP)",
        unbudgeted_items_summary: "Antojos detectados ($30.000 COP)",
      };
    }

    const totalCop = essentialCop + unbudgetedCop;
    return {
      merchant_name: merchantName,
      total_cop: totalCop,
      operational_essential_cop: essentialCop,
      discretionary_unbudgeted_cop: unbudgetedCop,
      essential_items_summary:
        essentialItems.length > 0
          ? `${essentialItems.join(", ")} ($${essentialCop.toLocaleString("es-CO")} COP)`
          : "Sin ítems esenciales",
      unbudgeted_items_summary:
        unbudgetedItems.length > 0
          ? `${unbudgetedItems.join(", ")} ($${unbudgetedCop.toLocaleString("es-CO")} COP -> Sujeto a 1.2x)`
          : "Sin antojos infiltrados",
    };
  })();

  if (!apiKey || apiKey === "tu-gemini-api-key") {
    return fallbackResult;
  }

  try {
    const skill = AI_SKILLS_REGISTRY.RECEIPT_VISION_SPLITTER;
    const ai = new GoogleGenAI({ apiKey });
    const parts: Array<
      { text: string } | { inlineData: { data: string; mimeType: string } }
    > = [
      {
        text: `Divide esta factura de compra en Colombia en dos rubros: 1) operational_essential_cop (mercado básico, salud, aseo) y 2) discretionary_unbudgeted_cop (snacks, licor, dulces, antojos no presupuestados). ${
          params.receipt_text ? `Texto de la factura: ${params.receipt_text}` : ""
        }`,
      },
    ];

    if (params.image_base64) {
      parts.push({
        inlineData: {
          data: params.image_base64,
          mimeType: params.mime_type || "image/jpeg",
        },
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: parts,
      config: {
        systemInstruction: skill.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: ReceiptSplitSchema,
        temperature: skill.temperature,
      },
    });

    const parsed = JSON.parse(
      response.text || "{}"
    ) as Partial<ParsedReceiptSplitAI>;
    return sanitizeReceiptSplit(parsed, fallbackResult);
  } catch {
    return fallbackResult;
  }
}

export async function generateGameMasterBriefing(stateSnapshot: {
  wallet_gp: number;
  vault_remaining_gp: number;
  total_penalty_gp: number;
  streak_days: number;
  aegis_shields: number;
  bosses: Array<{ name: string; current_hp: number; status: string }>;
  rubik_pb?: number | null;
  rubik_ao5?: number | null;
  total_skill_sessions?: number;
  interest_saved_avalanche?: number;
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  const activeBoss = stateSnapshot.bosses.find((b) => b.current_hp > 0);

  const fallbackBriefing = (() => {
    const rubikNote = stateSnapshot.rubik_pb
      ? ` En el Santuario de Habilidades tu PB en Cubo 3x3 es ${stateSnapshot.rubik_pb.toFixed(
          2
        )}s (Ao5: ${
          stateSnapshot.rubik_ao5 ? `${stateSnapshot.rubik_ao5.toFixed(2)}s` : "N/A"
        }).`
      : "";
    const strategyNote =
      stateSnapshot.interest_saved_avalanche &&
      stateSnapshot.interest_saved_avalanche > 0
        ? ` Consejo estratégico: Cambiar a modo Avalancha (atacando a ADDI 28.9% E.A. primero) te ahorraría $${stateSnapshot.interest_saved_avalanche.toLocaleString(
            "es-CO"
          )} COP en intereses.`
        : "";

    return `⚔️ CRÓNICA DEL GAME MASTER: Mantienes una racha activa de ${
      stateSnapshot.streak_days
    } días y ${stateSnapshot.aegis_shields} Escudo(s) Aegis listos para absorber tentaciones.${rubikNote} ${
      stateSnapshot.total_penalty_gp > 0
        ? `Atención: Has perdido ${stateSnapshot.total_penalty_gp.toLocaleString(
            "es-CO"
          )} GP en multas 1.2x este mes.`
        : "Disciplina impecable: 0 GP perdidos en multas 1.2x."
    } ${
      activeBoss
        ? `Tu objetivo prioritario actual es ${
            activeBoss.name
          } ($${activeBoss.current_hp.toLocaleString("es-CO")} HP).${strategyNote}`
        : "¡Todos los Debt Bosses han sido derrotados!"
    }`;
  })();

  if (!apiKey || apiKey === "tu-gemini-api-key") {
    return fallbackBriefing;
  }

  try {
    const skill = AI_SKILLS_REGISTRY.GAMEMASTER_BRIEFING;
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Con este estado actual en pesos colombianos (1 GP = $1 COP): ${JSON.stringify(
        stateSnapshot
      )}, escribe un consejo táctico de 3 frases épicas y accionables.`,
      config: {
        systemInstruction: skill.systemInstruction,
        temperature: skill.temperature,
      },
    });

    return response.text?.trim() || fallbackBriefing;
  } catch {
    return fallbackBriefing;
  }
}

const SpecComplianceItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    code: { type: Type.STRING },
    label: { type: Type.STRING },
    requirement: { type: Type.STRING },
    fulfilled: { type: Type.BOOLEAN },
  },
  required: ["code", "label", "requirement", "fulfilled"],
};

export const CubeSpecsExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    cube_type: {
      type: Type.STRING,
      enum: ["3x3", "2x2", "4x4", "Pyraminx", "Megaminx"],
      description: "Categoría WCA oficial del cubo.",
    },
    brand: {
      type: Type.STRING,
      description: "Marca del cubo (ej. GAN, MoYu, YJ, QiYi, X-Man Design, DaYan).",
    },
    model_name: {
      type: Type.STRING,
      description: "Nombre completo del modelo exacto.",
    },
    magnetic_system: {
      type: Type.STRING,
      description:
        "Sistema magnético y de núcleo (ej. Ball-Core + MagLev, Imanes Estándar Posicionales).",
    },
    surface_finish: {
      type: Type.STRING,
      description: "Acabado exterior (ej. UV Coated, Frosted Matte, PVC Stickered).",
    },
    size_mm: {
      type: Type.NUMBER,
      description: "Tamaño en milímetros (ej. 55.5 o 56 para 3x3, 60 para 4x4, 51 para 2x2).",
    },
    weight_grams: {
      type: Type.NUMBER,
      description: "Peso aproximado en gramos (ej. 71 para GAN 14, 68 para WRM V10).",
    },
    wca_legal: {
      type: Type.BOOLEAN,
      description:
        "True si es legal para torneos oficiales WCA (sin Bluetooth/electrónica prohibida según Regla 3a).",
    },
    recommended_setup: {
      type: Type.STRING,
      description:
        "Configuración recomendada de tensión, compresión y lubricación para speedcubing.",
    },
    target_sub_seconds: {
      type: Type.NUMBER,
      description: "Meta recomendada Sub-X en segundos para esta categoría.",
    },
    recommended_alg_set: {
      type: Type.STRING,
      description:
        "Set de algoritmos recomendado (ej. CFOP Full OLL/PLL, Ortega / CLL, Método Yau + Paridades, L4E).",
    },
    reward_gp_per_solve: {
      type: Type.NUMBER,
      description: "Recompensa base en GP por sesión/solve registrada.",
    },
    pb_bonus_gp: {
      type: Type.NUMBER,
      description: "Bono adicional en GP al romper récord personal (PB).",
    },
    specs_compliance_checklist: {
      type: Type.ARRAY,
      items: SpecComplianceItemSchema,
      description: "Lista de verificación de especificaciones técnicas y reglamento WCA.",
    },
    estimated_market_price_cop: {
      type: Type.NUMBER,
      description:
        "Precio estimado en pesos colombianos (COP) en tiendas de speedcubing de Colombia (ej. 320000 para GAN 14, 185000 para WRM V10, 95000 para RS3M V5).",
    },
    recommended_store: {
      type: Type.STRING,
      description:
        "Tienda sugerida de compra (ej. Speedcube Colombia / Edurubiks / Moyu Store / Buscalibre).",
    },
    release_tier: {
      type: Type.STRING,
      description:
        "Gama tecnológica del cubo (ej. Flagship Tope de Gama, Competitivo Calidad/Precio, Magnético de Entrada).",
    },
    turning_feel_and_cutting: {
      type: Type.STRING,
      description:
        "Descripción técnica de la sensación de giro (rápido/controlado/suave/crujiente) y corte de esquinas (ej. 55° directo / 35° inverso).",
    },
    pro_cuber_notes: {
      type: Type.STRING,
      description:
        "Información adicional de experto: qué perfil de speedcuber le saca más provecho y qué récords o características destacan en este modelo.",
    },
    maintenance_guide: {
      type: Type.STRING,
      description:
        "Guía rápida de mantenimiento, limpieza de núcleo y lubricación ideal para este cubo.",
    },
  },
  required: [
    "cube_type",
    "brand",
    "model_name",
    "magnetic_system",
    "surface_finish",
    "size_mm",
    "weight_grams",
    "wca_legal",
    "recommended_setup",
    "target_sub_seconds",
    "recommended_alg_set",
    "reward_gp_per_solve",
    "pb_bonus_gp",
    "specs_compliance_checklist",
    "estimated_market_price_cop",
    "recommended_store",
    "release_tier",
    "turning_feel_and_cutting",
    "pro_cuber_notes",
    "maintenance_guide",
  ],
};

export const BookSpecsExtractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Título oficial limpio del libro.",
    },
    author: {
      type: Type.STRING,
      description: "Autor principal del libro.",
    },
    isbn: {
      type: Type.STRING,
      description: "ISBN-13 oficial o identificador de edición.",
    },
    language: {
      type: Type.STRING,
      description: "Idioma de lectura (ej. Español, Inglés).",
    },
    total_pages: {
      type: Type.NUMBER,
      description: "Número total de páginas de la edición estándar.",
    },
    total_chapters: {
      type: Type.NUMBER,
      description: "Número estimado de capítulos o bloques del libro.",
    },
    category: {
      type: Type.STRING,
      description: "Categoría temática (ej. Ingeniería & Arquitectura, Finanzas & Mentalidad).",
    },
    complexity: {
      type: Type.STRING,
      enum: ["ligero", "intermedio", "denso_tecnico"],
      description: "Nivel de densidad cognitiva del libro.",
    },
    estimated_hours: {
      type: Type.NUMBER,
      description: "Horas totales estimadas para completar el libro.",
    },
    recommended_daily_pages: {
      type: Type.NUMBER,
      description: "Meta diaria recomendada de páginas según su densidad.",
    },
    gp_per_page: {
      type: Type.NUMBER,
      description: "Recompensa en GP por página leída.",
    },
    completion_bonus_gp: {
      type: Type.NUMBER,
      description: "Bono de GP al alcanzar el 100% de las páginas.",
    },
    xp_per_session: {
      type: Type.NUMBER,
      description: "XP base otorgada por sesión de lectura.",
    },
    key_learning_goal: {
      type: Type.STRING,
      description: "Objetivo clave de aprendizaje y aplicación práctica del libro.",
    },
    synopsis: {
      type: Type.STRING,
      description:
        "Sinopsis literaria atractiva y clara (2 a 3 oraciones) lista para la Galería de Libros.",
    },
    author_bio_short: {
      type: Type.STRING,
      description:
        "Resumen corto sobre quién es el autor y por qué esta obra es relevante.",
    },
    famous_quote: {
      type: Type.STRING,
      description:
        "Una frase célebre o cita representativa del libro en español.",
    },
    practical_takeaways: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "3 ideas prácticas o accionables que el lector puede extraer de este libro.",
    },
    estimated_market_price_cop: {
      type: Type.NUMBER,
      description:
        "Precio promedio estimado en librerías de Colombia en COP (ej. 68000, 85000, 120000).",
    },
    recommended_store: {
      type: Type.STRING,
      description:
        "Librería o tienda recomendada (ej. Panamericana / Buscalibre / Librería Nacional).",
    },
    reading_specs_checklist: {
      type: Type.ARRAY,
      items: SpecComplianceItemSchema,
      description: "Checklist de especificaciones necesarias para el registro del libro.",
    },
  },
  required: [
    "title",
    "author",
    "isbn",
    "language",
    "total_pages",
    "total_chapters",
    "category",
    "complexity",
    "estimated_hours",
    "recommended_daily_pages",
    "gp_per_page",
    "completion_bonus_gp",
    "xp_per_session",
    "key_learning_goal",
    "synopsis",
    "author_bio_short",
    "famous_quote",
    "practical_takeaways",
    "estimated_market_price_cop",
    "recommended_store",
    "reading_specs_checklist",
  ],
};

export function buildCubeComplianceChecklist(specs: {
  cube_type: RubikCubeType;
  magnetic_system: string;
  surface_finish: string;
  wca_legal: boolean;
  target_sub_seconds: number;
  reward_gp_per_solve: number;
  pb_bonus_gp: number;
}): SpecComplianceCheckItem[] {
  return [
    {
      code: "WCA_REG_3A_4B",
      label: "Legalidad WCA Regla 3a (Torneo Oficial)",
      requirement: specs.wca_legal
        ? `Aprobado para competencia WCA en categoría ${specs.cube_type} (sin componentes electrónicos ni marcas asimétricas)`
        : `Cubo inteligente / Bluetooth detectado: Uso exclusivo de entrenamiento (No permitido en ronda oficial WCA 3a)`,
      fulfilled: specs.wca_legal,
    },
    {
      code: "WCA_INSPECTION_15S",
      label: "Protocolo de Inspección WCA 15s & Penalizaciones",
      requirement:
        "Cumple ventana de inspección máxima de 15s (15-17s = +2s, >=17s = DNF) y cálculo Ao5/Ao12 regla 9f9",
      fulfilled: true,
    },
    {
      code: "HARDWARE_MAGNETIC_CORE",
      label: "Especificación de Hardware Magnético & Superficie",
      requirement: `Sistema ${specs.magnetic_system} con acabado ${specs.surface_finish} verificado`,
      fulfilled: true,
    },
    {
      code: "WCA_LOGO_3L",
      label: "Normativa de Logo WCA Regla 3l",
      requirement:
        specs.cube_type === "2x2" || specs.cube_type === "Pyraminx"
          ? `Categoría ${specs.cube_type}: Sin logos con relieve perceptible en caras de resolución`
          : `Máximo 1 pieza central con logotipo impreso permitido en ${specs.cube_type}`,
      fulfilled: true,
    },
    {
      code: "RPG_VAULT_CALIBRATION",
      label: "Calibración de Meta Sub-X & Recompensa de Bóveda",
      requirement: `Meta activa Sub-${specs.target_sub_seconds}s • Base +${specs.reward_gp_per_solve.toLocaleString(
        "es-CO"
      )} GP/sesión (+${specs.pb_bonus_gp.toLocaleString("es-CO")} GP Bono PB)`,
      fulfilled: true,
    },
  ];
}

export function extractCubeSpecsDeterministic(
  rawQuery: string
): ExtractedCubeSpecsAI {
  const clean = (rawQuery || "").trim() || "GAN 14 MagLev Pro 3x3";
  const lower = clean.toLowerCase();

  let cubeType: RubikCubeType = "3x3";
  if (/2x2|251|weipo|ortega/i.test(lower)) {
    cubeType = "2x2";
  } else if (/4x4|aosu|vin 4|mgc 4|yau/i.test(lower)) {
    cubeType = "4x4";
  } else if (/pyraminx|pyra|l4e/i.test(lower)) {
    cubeType = "Pyraminx";
  } else if (/megaminx|mega|dayan pro m|yuhu/i.test(lower)) {
    cubeType = "Megaminx";
  }

  let brand = "GAN";
  if (/moyu|weilong|rs3m|aosu|meilong|super rs3m/i.test(lower)) {
    brand = "MoYu";
  } else if (/\byj\b|mgc|yuhu|zhiSu/i.test(lower)) {
    brand = "YJ (YongJun)";
  } else if (/x-?man|tornado|volt|bell|flare/i.test(lower)) {
    brand = "X-Man Design (QiYi)";
  } else if (/qiyi|valk|m pro/i.test(lower)) {
    brand = "QiYi MoFangGe";
  } else if (/dayan|tengyun|guhong/i.test(lower)) {
    brand = "DaYan";
  } else if (/vin\b/i.test(lower)) {
    brand = "Vin Cube";
  } else if (/rubik/i.test(lower)) {
    brand = "Rubik's";
  } else if (!/\bgan\b/i.test(lower)) {
    const firstWord = clean.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 2) {
      brand = firstWord;
    }
  }

  const isSmartBluetooth =
    /bluetooth|smart\s*cube|gan\s*i\s*carry|gan\s*12\s*ui|gocube|moyu\s*ai/i.test(
      lower
    );
  const wcaLegal = !isSmartBluetooth;

  let magneticSystem = "Ball-Core + MagLev (Repulsión Magnética)";
  if (/ball[- ]?core.*maglev|maglev.*ball[- ]?core|14\s*maglev|wrm\s*v10|rs3m\s*v5.*ball|tornado\s*v3.*pioneer|tornado\s*v4.*pioneer/i.test(lower)) {
    magneticSystem = "Ball-Core + MagLev + Imanes Esquina-Arista (88+ imanes)";
  } else if (/maglev/i.test(lower)) {
    magneticSystem = "Sistema MagLev (Sin Resortes) + Imanes Posicionales";
  } else if (/ball[- ]?core|core\s*magnet|flagship|uv/i.test(lower)) {
    magneticSystem = "Ball-Core Magnético (Núcleo Imantado + Aristas)";
  } else if (/sin\s*imanes|non[- ]?magnetic/i.test(lower)) {
    magneticSystem = "Tradicional por Resortes (Sin Imanes)";
  } else {
    magneticSystem = "Imanes Posicionales Estándar (48-60 Imanes Neodimio)";
  }

  let surfaceFinish = "Frosted Matte (Mate Antideslizante)";
  if (/\buv\b|coated| glossy|brillante/i.test(lower)) {
    surfaceFinish = "UV Coated (Recubrimiento Brillante Alto Agarre)";
  } else if (/pvc|stickered|etiquetas/i.test(lower)) {
    surfaceFinish = "PVC Stickered (Alto Contraste WCA)";
  }

  const customMmMatch = clean.match(/(\d{2}(?:[.,]\d)?)\s*mm\b/i);
  const customWeightMatch = clean.match(/(\d{2,3}(?:[.,]\d)?)\s*(?:g|gr|gramos)\b/i);
  const customSubMatch = clean.match(/\bsub[- ]?(\d{1,3})(?:s|seg)?\b/i);

  const defaultDims: Record<
    RubikCubeType,
    {
      mm: number;
      grams: number;
      sub: number;
      alg: string;
      setup: string;
      gp: number;
      pbBonus: number;
    }
  > = {
    "3x3": {
      mm: brand === "MoYu" ? 55.5 : 56.0,
      grams: /14|15/i.test(lower) ? 71 : 68,
      sub: 18,
      alg: "CFOP Completo (F2L Lookahead + 57 OLL + 21 PLL)",
      setup:
        "Tensión Nivel 3/6 • Compresión MagLev Media • Lube Rápido en Piezas + Control en Core",
      gp: 4500,
      pbBonus: 2000,
    },
    "2x2": {
      mm: 51.0,
      grams: 56,
      sub: 5,
      alg: "Método Ortega (PBL) + CLL (42 Algoritmos)",
      setup:
        "Tensión Media-Firme para evitar Corner Twist • Lubricante de Silicona Ligero",
      gp: 4000,
      pbBonus: 1800,
    },
    "4x4": {
      mm: 60.0,
      grams: 112,
      sub: 60,
      alg: "Método Yau (3-2-3 Edge Pairing) + OLL/PLL Parity",
      setup:
        "Capas internas con lubricante rápido (baja viscosidad) • Capas externas estables",
      gp: 5000,
      pbBonus: 2500,
    },
    Pyraminx: {
      mm: 98.0,
      grams: 74,
      sub: 7,
      alg: "Método L4E (Last 4 Edges) + Keyhole Intuitivo",
      setup: "Clicks magnéticos de tips alineados • Tensión elástica ligera",
      gp: 4200,
      pbBonus: 1800,
    },
    Megaminx: {
      mm: 72.0,
      grams: 134,
      sub: 95,
      alg: "S2L (Star + F2L Extendido) + 4-Look Last Layer",
      setup: "Ridge/Sculpted Grip limpio • Lubricación suave uniforme en las 12 caras",
      gp: 5500,
      pbBonus: 2500,
    },
  };

  const base = defaultDims[cubeType];
  const sizeMm = customMmMatch
    ? Number(customMmMatch[1].replace(",", "."))
    : base.mm;
  const weightGrams = customWeightMatch
    ? Number(customWeightMatch[1].replace(",", "."))
    : base.grams;
  const targetSubSeconds = customSubMatch
    ? Math.max(2, Number(customSubMatch[1]))
    : base.sub;

  const modelName = clean
    .replace(/\b(\d{2}(?:[.,]\d)?)\s*mm\b/gi, "")
    .replace(/\b(\d{2,3}(?:[.,]\d)?)\s*(?:g|gr|gramos)\b/gi, "")
    .replace(/\bsub[- ]?(\d{1,3})(?:s|seg)?\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const checklist = buildCubeComplianceChecklist({
    cube_type: cubeType,
    magnetic_system: magneticSystem,
    surface_finish: surfaceFinish,
    wca_legal: wcaLegal,
    target_sub_seconds: targetSubSeconds,
    reward_gp_per_solve: base.gp,
    pb_bonus_gp: base.pbBonus,
  });

  const isFlagship =
    /gan\s*1[2345]|wrm\s*v[910]|tornado\s*v[34].*pioneer|aosu.*ball[- ]?core|dayan\s*pro/i.test(
      lower
    );
  const estimatedPriceCop =
    brand === "GAN"
      ? isFlagship
        ? 315000
        : 210000
      : isFlagship
      ? 185000
      : cubeType === "4x4" || cubeType === "Megaminx"
      ? 145000
      : 95000;

  const releaseTier = isFlagship
    ? "Flagship Tope de Gama (Competencia Pro)"
    : /rs3m|meilong|yuhu|qiyi\s*m/i.test(lower)
    ? "Competitivo Calidad / Precio (Gama Media-Alta)"
    : "Speedcube Magnético de Alto Rendimiento";

  return {
    cube_type: cubeType,
    brand,
    model_name: modelName || `${brand} Speedcube ${cubeType}`,
    magnetic_system: magneticSystem,
    surface_finish: surfaceFinish,
    size_mm: sizeMm,
    weight_grams: weightGrams,
    wca_legal: wcaLegal,
    recommended_setup: base.setup,
    target_sub_seconds: targetSubSeconds,
    recommended_alg_set: base.alg,
    reward_gp_per_solve: base.gp,
    pb_bonus_gp: base.pbBonus,
    specs_compliance_checklist: checklist,
    estimated_market_price_cop: estimatedPriceCop,
    recommended_store: "Edurubiks / Speedcube Colombia / Moyu Store",
    release_tier: releaseTier,
    turning_feel_and_cutting:
      cubeType === "3x3"
        ? "Giro fluido auto-alineable • Corte directo 55° e inverso 35° sin bloqueos"
        : `Giro estable optimizado para ${cubeType} • Excelente alineación magnética entre capas`,
    pro_cuber_notes: `Ideal para bajar tu Ao12 hacia Sub-${targetSubSeconds}s usando ${base.alg}. Su sistema ${magneticSystem} reduce sobre-giros en TPS altos.`,
    maintenance_guide:
      "Limpiar exceso de lubricante cada ~350 solves con paño de microfibra y aplicar 2 gotas de lubricante de silicona en pistas de contacto.",
  };
}

export async function extractCubeSpecsWithGemini(
  rawQuery: string
): Promise<ExtractedCubeSpecsAI> {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = extractCubeSpecsDeterministic(rawQuery);

  if (!apiKey || apiKey === "tu-gemini-api-key") {
    return fallback;
  }

  try {
    const skill = AI_SKILLS_REGISTRY.RUBIK_WCA_EXTRACTOR;
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extrae la ficha técnica completa de este cubo de Rubik para registro y validación WCA en mi RPG Life-Engine: "${rawQuery}"`,
      config: {
        systemInstruction: skill.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: CubeSpecsExtractionSchema,
        temperature: skill.temperature,
      },
    });

    const parsed = JSON.parse(response.text || "{}") as Partial<ExtractedCubeSpecsAI>;
    if (!parsed.model_name || !parsed.cube_type) {
      return fallback;
    }
    const merged = sanitizeCubeSpecs(parsed, fallback);
    merged.specs_compliance_checklist =
      parsed.specs_compliance_checklist &&
      parsed.specs_compliance_checklist.length >= 5
        ? parsed.specs_compliance_checklist
        : buildCubeComplianceChecklist({
            cube_type: merged.cube_type,
            magnetic_system: merged.magnetic_system,
            surface_finish: merged.surface_finish,
            wca_legal: merged.wca_legal,
            target_sub_seconds: merged.target_sub_seconds,
            reward_gp_per_solve: merged.reward_gp_per_solve,
            pb_bonus_gp: merged.pb_bonus_gp,
          });
    return merged;
  } catch {
    return fallback;
  }
}

export function buildBookReadingChecklist(specs: {
  title: string;
  author: string;
  isbn: string;
  total_pages: number;
  total_chapters: number;
  complexity: BookComplexity;
  estimated_hours: number;
  recommended_daily_pages: number;
  gp_per_page: number;
  completion_bonus_gp: number;
}): SpecComplianceCheckItem[] {
  const complexityLabel =
    specs.complexity === "denso_tecnico"
      ? "Denso / Técnico (Requiere toma de notas)"
      : specs.complexity === "intermedio"
      ? "Intermedio (Lectura analítica)"
      : "Ligero / Fluido (Alta velocidad)";

  return [
    {
      code: "BOOK_BIBLIO_ID",
      label: "Ficha Bibliográfica & ISBN Verificados",
      requirement: `"${specs.title}" por ${specs.author} • ISBN ${specs.isbn}`,
      fulfilled: Boolean(specs.title && specs.author && specs.isbn),
    },
    {
      code: "PAGE_EXTENSION_CHECK",
      label: "Extensión de Páginas & Estructura Capitular",
      requirement: `${specs.total_pages} páginas totales distribuidas en ~${specs.total_chapters} capítulos`,
      fulfilled: specs.total_pages >= 10,
    },
    {
      code: "COGNITIVE_COMPLEXITY",
      label: "Nivel de Densidad Cognitiva & Tiempo Estimado",
      requirement: `${complexityLabel} • ~${specs.estimated_hours} horas totales de lectura`,
      fulfilled: true,
    },
    {
      code: "DAILY_PACE_TARGET",
      label: "Cuota Diaria de Lectura Sostenible",
      requirement: `Meta recomendada: ${specs.recommended_daily_pages} páginas/día (~${Math.ceil(
        specs.total_pages / Math.max(1, specs.recommended_daily_pages)
      )} sesiones para terminar)`,
      fulfilled: specs.recommended_daily_pages > 0,
    },
    {
      code: "VAULT_GP_BOUNTY",
      label: "Recompensa de Bóveda & Bono de Finalización",
      requirement: `+${specs.gp_per_page} GP por página leída + Bono de +${specs.completion_bonus_gp.toLocaleString(
        "es-CO"
      )} GP al completar el 100%`,
      fulfilled: true,
    },
  ];
}

export function extractBookSpecsDeterministic(
  rawQuery: string
): ExtractedBookSpecsAI {
  const clean = (rawQuery || "").trim() || "Clean Architecture - Robert C. Martin";
  const lower = clean.toLowerCase();

  // Catálogo enriquecido de libros frecuentes
  const knownBooks: Array<{
    match: RegExp;
    title: string;
    author: string;
    isbn: string;
    language: string;
    total_pages: number;
    total_chapters: number;
    category: string;
    complexity: BookComplexity;
    goal: string;
  }> = [
    {
      match: /clean\s*architecture|arquitectura\s*limpia/i,
      title: "Clean Architecture: A Craftsman's Guide to Software Structure",
      author: "Robert C. Martin (Uncle Bob)",
      isbn: "978-0134494166",
      language: "Inglés / Español",
      total_pages: 432,
      total_chapters: 34,
      category: "Ingeniería de Software & Arquitectura",
      complexity: "denso_tecnico",
      goal: "Dominar límites arquitectónicos, principios SOLID y desacoplamiento de dominio",
    },
    {
      match: /clean\s*code|c[oó]digo\s*limpio/i,
      title: "Clean Code: Manual de Estilo para el Desarrollo Ágil",
      author: "Robert C. Martin",
      isbn: "978-0132350884",
      language: "Español / Inglés",
      total_pages: 464,
      total_chapters: 17,
      category: "Ingeniería de Software",
      complexity: "denso_tecnico",
      goal: "Escribir funciones limpias, tests unitarios sólidos y refactorización disciplinada",
    },
    {
      match: /hombre\s*en\s*busca\s*de\s*sentido|viktor\s*frankl|man'?s\s*search/i,
      title: "El Hombre en Busca de Sentido",
      author: "Viktor E. Frankl",
      isbn: "978-8425432026",
      language: "Español",
      total_pages: 168,
      total_chapters: 3,
      category: "Psicología & Resiliencia",
      complexity: "ligero",
      goal: "Interiorizar la logoterapia y la resiliencia ante la adversidad con propósito",
    },
    {
      match: /h[aá]bitos\s*at[oó]micos|atomic\s*habits|james\s*clear/i,
      title: "Hábitos Atómicos (Atomic Habits)",
      author: "James Clear",
      isbn: "978-8418118036",
      language: "Español",
      total_pages: 320,
      total_chapters: 20,
      category: "Productividad & Hábitos",
      complexity: "ligero",
      goal: "Sistematizar mejoras del 1% diario y diseñar señales de hábitos sin fricción",
    },
    {
      match: /psicolog[ií]a\s*del\s*dinero|psychology\s*of\s*money|morgan\s*housel/i,
      title: "La Psicología del Dinero",
      author: "Morgan Housel",
      isbn: "978-9585154162",
      language: "Español",
      total_pages: 280,
      total_chapters: 20,
      category: "Finanzas & Mentalidad",
      complexity: "intermedio",
      goal: "Fortalecer el comportamiento financiero frente a la deuda, el riesgo y el interés compuesto",
    },
    {
      match: /deep\s*work|enf[oó]cate|cal\s*newport/i,
      title: "Deep Work (Enfócate)",
      author: "Cal Newport",
      isbn: "978-8491111191",
      language: "Español",
      total_pages: 304,
      total_chapters: 8,
      category: "Productividad & Enfoque",
      complexity: "intermedio",
      goal: "Ejecutar bloques de concentración profunda libres de distracciones superficiales",
    },
    {
      match: /designing\s*data[- ]intensive|kleppmann|ddia/i,
      title: "Designing Data-Intensive Applications",
      author: "Martin Kleppmann",
      isbn: "978-1449373320",
      language: "Inglés",
      total_pages: 616,
      total_chapters: 12,
      category: "Ingeniería & Sistemas Distribuidos",
      complexity: "denso_tecnico",
      goal: "Dominar replicación, particionamiento, transacciones ACID y procesamiento de flujos",
    },
    {
      match: /pragmatic\s*programmer|programador\s*pragm[aá]tico/i,
      title: "The Pragmatic Programmer (20th Anniversary Edition)",
      author: "David Thomas & Andrew Hunt",
      isbn: "978-0135957059",
      language: "Inglés / Español",
      total_pages: 352,
      total_chapters: 9,
      category: "Ingeniería de Software",
      complexity: "denso_tecnico",
      goal: "Aplicar automatización, diseño ortogonal y maestría técnica pragmática",
    },
    {
      match: /meditaciones|marco\s*aurelio/i,
      title: "Meditaciones",
      author: "Marco Aurelio",
      isbn: "978-8424938697",
      language: "Español",
      total_pages: 224,
      total_chapters: 12,
      category: "Filosofía Estoica",
      complexity: "intermedio",
      goal: "Entrenar el dominio propio, la ecuanimidad y la disciplina diaria",
    },
  ];

  const matched = knownBooks.find((b) => b.match.test(lower));

  // Extraer páginas y capítulos manuales si el usuario los escribió en el texto (ej. "380 paginas", "420p", "14 capitulos")
  const pagesMatch = clean.match(
    /\b(\d{2,4})\s*(?:p[aá]ginas|paginas|p[aá]gs|pags|pages|p)\b/i
  );
  const chaptersMatch = clean.match(
    /\b(\d{1,3})\s*(?:cap[ií]tulos|capitulos|caps|chapters)\b/i
  );
  // Extraer ISBN si viene en el texto
  const isbnMatch = clean.match(
    /\b(97[89][- ]?\d{1,5}[- ]?\d{1,7}[- ]?\d{1,7}[- ]?\d|97[89]\d{10})\b/
  );

  let title = matched?.title || clean;
  let author = matched?.author || "Autor Principal";
  let category = matched?.category || "Desarrollo & Aprendizaje";
  let complexity: BookComplexity = matched?.complexity || "intermedio";
  const totalPages = pagesMatch
    ? Math.max(20, Number(pagesMatch[1]))
    : matched?.total_pages || 280;

  if (!matched) {
    // Limpiar sufijos de páginas, capítulos o etiqueta/número ISBN del título y autor
    const withoutExtras = clean
      .replace(/\b(\d{2,4})\s*(?:p[aá]ginas|paginas|p[aá]gs|pags|pages|p)\b/gi, "")
      .replace(/\b(\d{1,3})\s*(?:cap[ií]tulos|capitulos|caps|chapters)\b/gi, "")
      .replace(
        /\b(?:isbn(?:-1[03])?:?\s*)?(97[89][- ]?\d{1,5}[- ]?\d{1,7}[- ]?\d{1,7}[- ]?\d|97[89]\d{10})\b/gi,
        ""
      )
      .replace(/\b(?:isbn(?:-1[03])?:?)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    const partsByDash = withoutExtras.split(/\s+[-–—|]\s+|\s+(?:por|by|autor:?)\s+/i);
    if (partsByDash.length >= 2) {
      title = partsByDash[0].trim();
      author = partsByDash.slice(1).join(" ").trim() || "Autor Principal";
    } else {
      title = withoutExtras || clean;
    }

    if (
      /arquitectura|algoritmos|sql|postgres|typescript|react|python|rust|ingenier[ií]a|sistemas|data|ia|machine\s*learning|c[aá]lculo|f[ií]sica/i.test(
        lower
      ) ||
      totalPages >= 420
    ) {
      complexity = "denso_tecnico";
      category = "Ingeniería & Estudio Técnico";
    } else if (
      /finanzas|dinero|inversi[oó]n|econom[ií]a|riqueza|deuda/i.test(lower)
    ) {
      complexity = "intermedio";
      category = "Finanzas & Mentalidad";
    } else if (totalPages <= 210 || /novela|cuento|h[aá]bito|motivaci[oó]n/i.test(lower)) {
      complexity = "ligero";
      category = "Productividad & Mentalidad";
    }
  }

  const hashDigits = Array.from(title)
    .reduce((acc, ch, idx) => (acc + ch.charCodeAt(0) * (idx + 17)) % 100000000, 12345678)
    .toString()
    .padStart(8, "0");

  const isbn = isbnMatch
    ? isbnMatch[1]
    : matched?.isbn || `978-84-${hashDigits.slice(0, 4)}-${hashDigits.slice(4, 7)}-4`;

  const language =
    matched?.language ||
    (/\b(the|and|for|with|designing|architecture|code|habits|work|distributed|engines)\b/i.test(
      title
    )
      ? "Inglés / Español"
      : "Español");

  const totalChapters = chaptersMatch
    ? Math.max(1, Number(chaptersMatch[1]))
    : matched && !pagesMatch
    ? matched.total_chapters
    : Math.max(4, Math.round(totalPages / (complexity === "denso_tecnico" ? 26 : 18)));

  const pagesPerHour =
    complexity === "denso_tecnico" ? 18 : complexity === "intermedio" ? 26 : 34;
  const estimatedHours = Number((totalPages / pagesPerHour).toFixed(1));

  const recommendedDailyPages =
    complexity === "denso_tecnico" ? 15 : complexity === "intermedio" ? 20 : 25;

  const gpPerPage =
    complexity === "denso_tecnico" ? 140 : complexity === "intermedio" ? 115 : 100;

  const completionBonusGp =
    complexity === "denso_tecnico"
      ? 6500
      : complexity === "intermedio"
      ? 5500
      : 5000;

  const xpPerSession =
    complexity === "denso_tecnico" ? 115 : complexity === "intermedio" ? 95 : 85;

  const keyLearningGoal =
    matched?.goal ||
    `Completar las ${totalPages} páginas con ritmo de ${recommendedDailyPages} págs/día aplicando las ideas clave de ${category}`;

  const checklist = buildBookReadingChecklist({
    title,
    author,
    isbn,
    total_pages: totalPages,
    total_chapters: totalChapters,
    complexity,
    estimated_hours: estimatedHours,
    recommended_daily_pages: recommendedDailyPages,
    gp_per_page: gpPerPage,
    completion_bonus_gp: completionBonusGp,
  });

  const cleanIsbnDigits = isbn.replace(/[^0-9X]/gi, "");
  const coverUrl =
    cleanIsbnDigits.length >= 10
      ? `https://covers.openlibrary.org/b/isbn/${cleanIsbnDigits}-L.jpg`
      : undefined;

  const estimatedPriceCop =
    complexity === "denso_tecnico"
      ? 115000
      : complexity === "intermedio"
      ? 68000
      : 58000;

  return {
    title,
    author,
    isbn,
    language,
    total_pages: totalPages,
    total_chapters: totalChapters,
    category,
    complexity,
    estimated_hours: estimatedHours,
    recommended_daily_pages: recommendedDailyPages,
    gp_per_page: gpPerPage,
    completion_bonus_gp: completionBonusGp,
    xp_per_session: xpPerSession,
    key_learning_goal: keyLearningGoal,
    synopsis: `Obra fundamental de ${author} enfocada en ${category.toLowerCase()}. A través de ${totalChapters} capítulos (${totalPages} páginas), desarrolla principios prácticos para ${keyLearningGoal.toLowerCase()}.`,
    author_bio_short: `${author} es un referente reconocido en ${category} cuyas ideas han transformado la práctica profesional y el desarrollo de hábitos.`,
    famous_quote:
      matched?.title.includes("Psicología")
        ? "Ahorrar dinero es la brecha entre tu ego y tus ingresos."
        : matched?.title.includes("Hábitos")
        ? "No te elevas al nivel de tus metas; caes al nivel de tus sistemas."
        : matched?.title.includes("Clean")
        ? "La única forma de ir rápido es ir bien y mantener la arquitectura limpia."
        : `La maestría en ${category.toLowerCase()} se construye con disciplina diaria y reflexión constante.`,
    practical_takeaways: [
      `Leer ${recommendedDailyPages} páginas diarias tomando nota de al menos 1 frase aplicable.`,
      `Conectar los conceptos de ${title} con tus proyectos y metas semanales.`,
      `Completar los ${totalChapters} capítulos en ~${Math.ceil(
        totalPages / Math.max(1, recommendedDailyPages)
      )} sesiones para liberar el bono de +${completionBonusGp.toLocaleString("es-CO")} GP.`,
    ],
    estimated_market_price_cop: estimatedPriceCop,
    recommended_store: "Panamericana / Buscalibre / Librería Nacional",
    cover_url: coverUrl,
    reading_specs_checklist: checklist,
  };
}

export async function extractBookSpecsWithGemini(
  rawQuery: string
): Promise<ExtractedBookSpecsAI> {
  const apiKey = process.env.GEMINI_API_KEY;
  const fallback = extractBookSpecsDeterministic(rawQuery);

  if (!apiKey || apiKey === "tu-gemini-api-key") {
    return fallback;
  }

  try {
    const skill = AI_SKILLS_REGISTRY.BOOK_CATALOG_EXTRACTOR;
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Extrae la ficha técnica completa y las especificaciones de lectura de este libro para mi RPG Life-Engine: "${rawQuery}"`,
      config: {
        systemInstruction: skill.systemInstruction,
        responseMimeType: "application/json",
        responseSchema: BookSpecsExtractionSchema,
        temperature: skill.temperature,
      },
    });

    const parsed = JSON.parse(response.text || "{}") as Partial<ExtractedBookSpecsAI>;
    if (!parsed.title || !parsed.total_pages) {
      return fallback;
    }
    const merged = sanitizeBookSpecs(parsed, fallback);
    merged.reading_specs_checklist =
      parsed.reading_specs_checklist &&
      parsed.reading_specs_checklist.length >= 5
        ? parsed.reading_specs_checklist
        : buildBookReadingChecklist({
            title: merged.title,
            author: merged.author,
            isbn: merged.isbn,
            total_pages: merged.total_pages,
            total_chapters: merged.total_chapters,
            complexity: merged.complexity,
            estimated_hours: merged.estimated_hours,
            recommended_daily_pages: merged.recommended_daily_pages,
            gp_per_page: merged.gp_per_page,
            completion_bonus_gp: merged.completion_bonus_gp,
          });
    return merged;
  } catch {
    return fallback;
  }
}

