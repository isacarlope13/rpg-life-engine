import { NextResponse } from "next/server";
import { parseExpenseWithGemini } from "@/lib/gemini";
import { requireShortcutUser } from "@/lib/request-auth";
import type { ExpenseCategory, SkillDomain } from "@/types/rpg";

interface OmniCommandDetection {
  intent: "habit_session" | "expense";
  domain?: SkillDomain;
  duration_minutes?: number;
  pages_read?: number;
  rows_completed?: number;
  title?: string;
}

function detectIntentFromText(rawText: string): OmniCommandDetection {
  const lower = rawText.toLowerCase();

  // Si menciona signos de pesos, "pagué", "compré", "gasté", "compraste", "transferiste", "almuerzo", "uber", "addi", "nequi", "cuota" -> es un gasto
  const hasExplicitMoneyWords =
    /\$|\b(pague|pagué|compre|compré|gaste|gasté|compraste|transferiste|abono|cuota|almuerzo|desayuno|cena|uber|didi|parqueadero|mercado|addi|nequi|bancolombia|pastillas|internet|spotify)\b/i.test(
      lower
    );

  // Palabras clave de sesión de habilidad / hábito
  const habitKeywordMatch =
    /\b(lei|leí|lectura|paginas|páginas|teji|tejí|tejido|vueltas|filas|crochet|amigurumi|armé|arme|cubo|rubik|solve|ao5|ao12|estudie|estudié|estudio|pomodoro|trabaje|trabajé|deep work|sprint|entrene|entrené|gimnasio|gym|corri|corrí|deporte|jugue|jugué|partida|rankeds?|videojuegos?|gaming)\b/i.test(
      lower
    );

  if (habitKeywordMatch && !hasExplicitMoneyWords) {
    // Extraer minutos, páginas o vueltas
    const minMatch = lower.match(/(\d+)\s*(?:min|minutos|m\b)/);
    const hourMatch = lower.match(/(\d+(?:[.,]\d+)?)\s*(?:h|hora|horas)\b/);
    const pagesMatch = lower.match(/(\d+)\s*(?:pag|pág|paginas|páginas)/);
    const rowsMatch = lower.match(/(\d+)\s*(?:vueltas|filas)/);

    let duration = minMatch
      ? Number(minMatch[1])
      : hourMatch
      ? Math.round(Number(hourMatch[1].replace(",", ".")) * 60)
      : 30;
    duration = Math.max(5, Math.min(360, duration));

    let domain: SkillDomain = "general";
    let title = "Sesión de Hábito Rápida";

    if (/cubo|rubik|solve|ao5|ao12/.test(lower)) {
      domain = "rubik";
      title = `Cubos de Rubik (${duration} min)`;
    } else if (/lei|leí|lectura|paginas|páginas|libro/.test(lower)) {
      domain = "reading";
      const pages = pagesMatch ? Number(pagesMatch[1]) : 20;
      title = `Sesión de Lectura (+${pages} págs)`;
      return {
        intent: "habit_session",
        domain,
        duration_minutes: duration,
        pages_read: pages,
        title,
      };
    } else if (/teji|tejí|tejido|vueltas|filas|crochet|amigurumi/.test(lower)) {
      domain = "knitting";
      const rows = rowsMatch ? Number(rowsMatch[1]) : 8;
      title = `Sesión de Tejido (+${rows} vueltas)`;
      return {
        intent: "habit_session",
        domain,
        duration_minutes: duration,
        rows_completed: rows,
        title,
      };
    } else if (/estudie|estudié|estudio|pomodoro|clase|examen/.test(lower)) {
      domain = "study";
      title = `Estudio Profundo (${duration} min)`;
    } else if (/trabaje|trabajé|deep work|sprint|entregable/.test(lower)) {
      domain = "work";
      title = `Trabajo Profundo (${duration} min)`;
    } else if (/jugue|jugué|partida|rankeds?|videojuegos?|gaming/.test(lower)) {
      domain = "gaming";
      title = `Sesión Gamer Consciente (${duration} min)`;
    } else if (/entrene|entrené|gimnasio|gym|corri|corrí|deporte|entreno/.test(lower)) {
      domain = "sports";
      title = `Entrenamiento Deportivo (${duration} min)`;
    }

    return {
      intent: "habit_session",
      domain,
      duration_minutes: duration,
      title,
    };
  }

  return { intent: "expense" };
}

export async function POST(req: Request) {
  try {
    const authCtx = await requireShortcutUser(req);
    if (!authCtx.ok) return authCtx.response;
    const { store } = authCtx;

    const body = (await req.json().catch(() => ({}))) as {
      text?: string;
      raw_text?: string;
      use_aegis_shield?: boolean;
      idempotency_key?: string;
    };

    const rawText = (body.text || body.raw_text || "").trim();
    if (!rawText) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Envía 'text' con tu comando de voz, WhatsApp o SMS (ej. 'Almuerzo 26 mil' o 'Leí 20 páginas').",
        },
        { status: 400 }
      );
    }

    const detected = detectIntentFromText(rawText);

    // FLUJO 1: Es una sesión de hábito / habilidad dictada desde el celular
    if (detected.intent === "habit_session" && detected.domain) {
      const skillRes = store.logSkillSession({
        domain: detected.domain,
        duration_minutes: detected.duration_minutes || 30,
        title: detected.title,
        pages_read: detected.pages_read,
        rows_completed: detected.rows_completed,
        notes: `Registrado desde Comando Rápido Móvil: "${rawText}"`,
        idempotency_key: body.idempotency_key,
      });

      const tts = `¡Hábito registrado! ${skillRes.session.title}. Liberaste ${skillRes.reward_impact.transferred_gp.toLocaleString("es-CO")} GP de tu Bóveda con racha de ${store.current_streak_days} días (${store.streak_multiplier}x).`;

      return NextResponse.json(
        {
          success: true,
          intent: "habit_session",
          domain: detected.domain,
          title: skillRes.session.title,
          gp_delta: skillRes.reward_impact.transferred_gp,
          xp_earned: skillRes.session.xp_earned,
          treasury_snapshot: {
            wallet_gp: store.wallet_gp,
            vault_remaining_gp: store.vault_remaining_gp,
            streak_days: store.current_streak_days,
            streak_multiplier: store.streak_multiplier,
            aegis_shields: store.aegis_shields,
          },
          shortcut_tts_message: tts,
        },
        { status: 201 }
      );
    }

    // FLUJO 2: Es un gasto, pago fijo o abono a deuda (SMS, Apple Pay, Voz o Botón)
    const aiParsed = await parseExpenseWithGemini(rawText);
    const lower = rawText.toLowerCase();

    // Refinar clasificación con las categorías reales del CSV del usuario
    let category: ExpenseCategory = aiParsed.category;
    let bossName: string | null =
      aiParsed.boss_target !== "NONE" ? aiParsed.boss_target : null;

    // Verificar si coincide con alguno de los Jefes de Deuda personalizados del usuario
    const matchedBoss = store.bosses.find((b) =>
      lower.includes(b.name.toLowerCase())
    );
    if (
      matchedBoss &&
      (/abono|pague|pagué|cuota|deuda|addi|nequi/.test(lower) ||
        category === "debt_attack")
    ) {
      category = "debt_attack";
      bossName = matchedBoss.name;
    } else if (
      /almuerzo|desayuno|mercado|uber|parqueadero|transporte|cita medica|universidad|papeleria/.test(
        lower
      ) &&
      aiParsed.amount_cop <= 55000
    ) {
      category = "variable_operational";
    } else if (
      /internet|somos|celular|sandris|gimnasio|natillera|pastillas|spotify|prime|uñas|unas|mona/.test(
        lower
      )
    ) {
      category = "fixed_mandatory";
    }

    const impact = store.recordTransaction({
      amount_cop: aiParsed.amount_cop,
      category,
      merchant_or_concept: aiParsed.merchant_or_concept || rawText,
      boss_name: bossName,
      use_aegis_shield: body.use_aegis_shield ?? true,
      idempotency_key: body.idempotency_key,
    });

    const tts =
      category === "debt_attack"
        ? `¡Ataque directo a ${bossName || "tu deuda"} por ${aiParsed.amount_cop.toLocaleString("es-CO")} pesos! ${impact.combo_summary}.`
        : category === "discretionary_unbudgeted"
        ? impact.aegis_shield_used
          ? `Escudo Aegis activado en ${aiParsed.merchant_or_concept}. Bloqueó la multa del 20 por ciento y descontó ${impact.wallet_gp_deducted.toLocaleString("es-CO")} GP.`
          : `Gasto de Bóveda en ${aiParsed.merchant_or_concept}: se descontaron ${impact.wallet_gp_deducted.toLocaleString("es-CO")} GP.`
        : `Registrado en ${
            category === "fixed_mandatory"
              ? "Costos Fijos"
              : "Variables Operativos"
          }: ${aiParsed.merchant_or_concept} por ${aiParsed.amount_cop.toLocaleString("es-CO")} pesos.`;

    return NextResponse.json(
      {
        success: true,
        intent: "expense",
        category,
        amount_cop: aiParsed.amount_cop,
        merchant_or_concept: aiParsed.merchant_or_concept,
        boss_name: bossName,
        rpg_impact: impact,
        treasury_snapshot: {
          wallet_gp: store.wallet_gp,
          vault_remaining_gp: store.vault_remaining_gp,
          streak_days: store.current_streak_days,
          streak_multiplier: store.streak_multiplier,
          aegis_shields: store.aegis_shields,
        },
        shortcut_tts_message: tts,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error inesperado";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
