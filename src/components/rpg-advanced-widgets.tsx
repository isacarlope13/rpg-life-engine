"use client";

import React, { useMemo, useState } from "react";
import {
  Brain,
  Download,
  Upload,
  Sparkles,
  TrendingDown,
  LineChart,
  RotateCcw,
  CheckCircle2,
  Lock,
  Unlock,
  Calendar,
  Smartphone,
  Share2,
  FileSpreadsheet,
  FileText,
  Shield,
  Zap,
} from "lucide-react";
import type {
  ReadingBook,
  RubikSolveEntry,
  SpacedRepetitionCard,
  TalentPerk,
  FixedCostItem,
} from "@/types/rpg";
import type { DemoBoss } from "@/lib/demo-store";
import {
  exportBooksToNotionCsv,
  exportFinancesToCsv,
  exportRubikSolvesCsv,
  exportMasterBackupJson,
  generateIosShortcutFile,
} from "@/lib/exporter";
import { triggerHaptic } from "@/lib/offline-sync";

// ============================================================================
// 1. HEATMAP DE PRODUCTIVIDAD ANUAL DE 365 DÍAS (ESTILO GITHUB)
// ============================================================================
export function AnnualProductivityHeatmap({
  logs = [],
  currentStreak = 0,
}: {
  logs: Array<{ timestamp: string; gp_delta?: number }>;
  currentStreak: number;
}) {
  const { weeks, totalActiveDays, maxSessionsInDay } = useMemo(() => {
    const today = new Date();
    const dayMap = new Map<string, number>();

    logs.forEach((log) => {
      if (log.timestamp) {
        const d = log.timestamp.split("T")[0];
        dayMap.set(d, (dayMap.get(d) || 0) + 1);
      }
    });

    let maxInDay = 1;
    dayMap.forEach((count) => {
      if (count > maxInDay) maxInDay = count;
    });

    // Construir 52 semanas (364 días) hacia atrás
    const weeksList: Array<Array<{ dateStr: string; count: number; level: number }>> = [];
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - 52 * 7 + 1);

    let activeCount = 0;
    const cur = new Date(startDate);
    for (let w = 0; w < 52; w++) {
      const days = [];
      for (let d = 0; d < 7; d++) {
        const dStr = cur.toISOString().split("T")[0];
        const count = dayMap.get(dStr) || 0;
        if (count > 0) activeCount++;
        const level =
          count === 0
            ? 0
            : count === 1
            ? 1
            : count === 2
            ? 2
            : count <= 4
            ? 3
            : 4;
        days.push({ dateStr: dStr, count, level });
        cur.setDate(cur.getDate() + 1);
      }
      weeksList.push(days);
    }

    return {
      weeks: weeksList,
      totalActiveDays: activeCount,
      maxSessionsInDay: maxInDay,
    };
  }, [logs]);

  const levelColor = (lvl: number) => {
    switch (lvl) {
      case 0:
        return "bg-slate-900 border-slate-800";
      case 1:
        return "bg-emerald-950 border-emerald-900 text-emerald-300";
      case 2:
        return "bg-emerald-800 border-emerald-700 text-emerald-200";
      case 3:
        return "bg-emerald-600 border-emerald-500 text-white";
      case 4:
      default:
        return "bg-emerald-400 border-emerald-300 text-emerald-950 font-bold";
    }
  };

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-slate-950/70 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-emerald-400" />
          <h3 className="text-sm font-bold text-white">
            Mapa de Calor de Productividad Anual (365 Días)
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400">
            🔥 Racha Activa:{" "}
            <strong className="text-emerald-400">{currentStreak} días</strong>
          </span>
          <span className="text-slate-400">
            📅 Días Activos:{" "}
            <strong className="text-cyan-300">{totalActiveDays}</strong>
          </span>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Cada casilla representa un día del año. La intensidad verde refleja la cantidad de sesiones de hábitos, lectura y trabajo forjadas.
      </p>

      {/* Grid horizontal con scroll suave en pantallas pequeñas */}
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex gap-1">
          {weeks.map((week, wIdx) => (
            <div key={wIdx} className="flex flex-col gap-1">
              {week.map((day) => (
                <div
                  key={day.dateStr}
                  title={`${day.dateStr}: ${day.count} registro(s)`}
                  className={`h-2.5 w-2.5 rounded-[2px] border transition hover:scale-125 ${levelColor(
                    day.level
                  )}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
        <span>Menos activo</span>
        <div className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-[2px] bg-slate-900 border border-slate-800" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-950 border border-emerald-900" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-800 border border-emerald-700" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-600 border border-emerald-500" />
          <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-400 border border-emerald-300" />
        </div>
        <span>Más activo</span>
      </div>
    </div>
  );
}

// ============================================================================
// 2. CURVA DE RENDIMIENTO WCA RUBIK (SINGLE & AO5 PROGRESSION)
// ============================================================================
export function WcaPerformanceCurve({
  solves = [],
  pbSeconds = null,
  ao5Seconds = null,
}: {
  solves: RubikSolveEntry[];
  pbSeconds: number | null;
  ao5Seconds: number | null;
}) {
  const validSolves = useMemo(() => {
    return solves
      .filter((s) => Number(s.time_seconds) > 0)
      .slice(0, 30)
      .reverse();
  }, [solves]);

  if (validSolves.length < 2) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-400">
        Registra al menos 2 soluciones para visualizar tu curva interactiva de evolución WCA.
      </div>
    );
  }

  const times = validSolves.map((s) => s.time_seconds);
  const minTime = Math.max(5, Math.floor(Math.min(...times) * 0.85));
  const maxTime = Math.ceil(Math.max(...times) * 1.15);
  const range = Math.max(1, maxTime - minTime);

  const width = 600;
  const height = 180;
  const paddingX = 30;
  const paddingY = 25;

  const points = validSolves.map((s, idx) => {
    const x =
      paddingX + (idx / Math.max(1, validSolves.length - 1)) * (width - 2 * paddingX);
    const y =
      height -
      paddingY -
      ((s.time_seconds - minTime) / range) * (height - 2 * paddingY);
    return { x, y, time: s.time_seconds, id: s.id };
  });

  const pathD = points.reduce((acc, pt, idx) => {
    return `${acc} ${idx === 0 ? "M" : "L"} ${pt.x} ${pt.y}`;
  }, "");

  // Línea meta Sub-20
  const sub20Y =
    height - paddingY - ((20 - minTime) / range) * (height - 2 * paddingY);

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/70 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <LineChart className="h-5 w-5 text-cyan-400" />
          <h3 className="text-sm font-bold text-white">
            Curva de Rendimiento WCA (Últimos Solves)
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {pbSeconds && (
            <span className="rounded-md bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono font-bold text-amber-300">
              PB: {pbSeconds.toFixed(2)}s
            </span>
          )}
          {ao5Seconds && (
            <span className="rounded-md bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 font-mono font-bold text-cyan-300">
              Ao5 Actual: {ao5Seconds.toFixed(2)}s
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3">
        Evolución de tiempos individuales con meta de referencia Sub-20.
      </p>

      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto text-slate-400"
        >
          {/* Línea meta Sub-20 */}
          {minTime <= 20 && maxTime >= 20 && (
            <>
              <line
                x1={paddingX}
                y1={sub20Y}
                x2={width - paddingX}
                y2={sub20Y}
                stroke="#10b981"
                strokeDasharray="4 4"
                strokeWidth="1.5"
                opacity="0.6"
              />
              <text
                x={width - paddingX}
                y={sub20Y - 4}
                textAnchor="end"
                fill="#10b981"
                fontSize="10"
                fontWeight="bold"
              >
                Meta Sub-20.0s
              </text>
            </>
          )}

          {/* Trayectoria de Solves */}
          <path
            d={pathD}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Puntos de datos */}
          {points.map((pt) => (
            <g key={pt.id} className="cursor-pointer">
              <circle
                cx={pt.x}
                cy={pt.y}
                r={pt.time === pbSeconds ? "5" : "3.5"}
                fill={pt.time === pbSeconds ? "#f59e0b" : "#22d3ee"}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
        <span>Solves anteriores</span>
        <span>Solve más reciente ({times[times.length - 1]?.toFixed(2)}s)</span>
      </div>
    </div>
  );
}

// ============================================================================
// 3. GRÁFICA DE AMORTIZACIÓN & PROYECCIÓN "DÍA DE LIBERTAD FINANCIERA"
// ============================================================================
export function AmortizationFreedomChart({
  bosses = [],
  monthlyFreeCashflow = 300000,
}: {
  bosses: DemoBoss[];
  monthlyFreeCashflow: number;
}) {
  const { totalDebt, monthsSnowball, monthsMinOnly, payoffDateStr, interestSavedCop } =
    useMemo(() => {
      const debt = bosses.reduce((acc, b) => acc + Math.max(0, b.current_hp), 0);
      const totalMinPayment = bosses.reduce(
        (acc, b) => acc + (b.min_monthly_payment_cop || 0),
        0
      );

      if (debt <= 0) {
        return {
          totalDebt: 0,
          monthsSnowball: 0,
          monthsMinOnly: 0,
          payoffDateStr: "¡Hoy! Eres 100% Libre de Deuda",
          interestSavedCop: 0,
        };
      }

      // Estimación simplificada de meses
      const acceleratedMonthly = totalMinPayment + monthlyFreeCashflow;
      const monthsSnowball = Math.max(
        1,
        Math.ceil(debt / Math.max(1, acceleratedMonthly * 0.9))
      );
      const monthsMinOnly = Math.max(
        monthsSnowball + 2,
        Math.ceil(debt / Math.max(1, totalMinPayment * 0.8))
      );

      const avgInterestEa =
        bosses.reduce((acc, b) => acc + b.interest_rate_ea, 0) /
        Math.max(1, bosses.length);
      const savedInterest = Math.round(
        debt * (avgInterestEa / 100) * ((monthsMinOnly - monthsSnowball) / 12)
      );

      const targetDate = new Date();
      targetDate.setMonth(targetDate.getMonth() + monthsSnowball);
      const payoffStr = targetDate.toLocaleDateString("es-CO", {
        month: "long",
        year: "numeric",
      });

      return {
        totalDebt: debt,
        monthsSnowball,
        monthsMinOnly,
        payoffDateStr: payoffStr,
        interestSavedCop: savedInterest,
      };
    }, [bosses, monthlyFreeCashflow]);

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-slate-950/70 p-5 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5 text-rose-400" />
          <h3 className="text-sm font-bold text-white">
            Proyección de Amortización & Día de Libertad Financiera
          </h3>
        </div>
        <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-300">
          🎯 Meta: {payoffDateStr}
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Comparativa visual de liquidación total: Pago Mínimo pasivo vs Aceleración con Bola de Nieve (+${monthlyFreeCashflow.toLocaleString("es-CO")}/mes).
      </p>

      {/* Barras de comparación */}
      <div className="space-y-3">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-rose-300">
              🔴 Solo Cuota Mínima ({monthsMinOnly} meses)
            </span>
            <span className="text-slate-400 font-mono">
              Amortización pasiva prolongada
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full bg-rose-500/80 rounded-full w-full" />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="font-semibold text-emerald-300">
              ⚡ Bola de Nieve RPG ({monthsSnowball} meses)
            </span>
            <span className="text-emerald-400 font-bold font-mono">
              -{monthsMinOnly - monthsSnowball} meses antes
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{
                width: `${Math.round((monthsSnowball / Math.max(1, monthsMinOnly)) * 100)}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-xs flex items-center justify-between">
        <span className="text-slate-300">
          💰 Ahorro estimado en intereses compuestos:
        </span>
        <strong className="text-emerald-300 font-bold font-mono text-sm">
          +${interestSavedCop.toLocaleString("es-CO")} COP
        </strong>
      </div>
    </div>
  );
}

// ============================================================================
// 4. DUELO DE SABIDURÍA / REPETICIÓN ESPACIADA (SM-2 FLASHCARDS)
// ============================================================================
export function SpacedRepetitionDuelingWidget({
  cards = [],
  onReviewCard,
  onAddCard,
}: {
  cards: SpacedRepetitionCard[];
  onReviewCard: (cardId: string, rating: 1 | 2 | 3 | 4) => Promise<void>;
  onAddCard: (prompt: string, reflection: string, source: string) => Promise<void>;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newPrompt, setNewPrompt] = useState("");
  const [newReflection, setNewReflection] = useState("");
  const [newSource, setNewSource] = useState("");

  const currentCard = cards[activeIdx] || cards[0];

  const handleReview = async (rating: 1 | 2 | 3 | 4) => {
    if (!currentCard) return;
    triggerHaptic(rating >= 3 ? "success" : "medium");
    await onReviewCard(currentCard.id, rating);
    setFlipped(false);
    if (activeIdx < cards.length - 1) {
      setActiveIdx((prev) => prev + 1);
    } else {
      setActiveIdx(0);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrompt.trim() || !newReflection.trim()) return;
    await onAddCard(newPrompt, newReflection, newSource);
    setNewPrompt("");
    setNewReflection("");
    setNewSource("");
    setIsAdding(false);
  };

  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-6 text-center">
        <Brain className="mx-auto h-8 w-8 text-indigo-400 mb-2" />
        <h3 className="font-bold text-white text-sm">Duelo de Memoria SM-2</h3>
        <p className="text-xs text-slate-400 mt-1 mb-3">
          Aún no hay tarjetas de repaso espaciado. Captura citas de libros o conceptos de estudio.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 via-slate-900/90 to-slate-950 p-6 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-indigo-400" />
          <h3 className="text-base font-bold text-white">
            Duelo Matutino de Sabiduría (Algoritmo SM-2)
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-xs font-semibold text-indigo-300">
            Tarjeta {activeIdx + 1} de {cards.length}
          </span>
          <button
            type="button"
            onClick={() => setIsAdding((v) => !v)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            {isAdding ? "✕ Cerrar" : "➕ Nueva"}
          </button>
        </div>
      </div>

      {isAdding ? (
        <form onSubmit={handleCreate} className="space-y-3 p-4 rounded-xl border border-indigo-500/30 bg-slate-950/80 mb-4">
          <h4 className="text-xs font-bold text-indigo-300">Crear Tarjeta de Repaso</h4>
          <input
            type="text"
            required
            placeholder="Pregunta o concepto (Frente)..."
            value={newPrompt}
            onChange={(e) => setNewPrompt(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
          />
          <textarea
            required
            rows={2}
            placeholder="Respuesta, cita o reflexión personal (Reverso)..."
            value={newReflection}
            onChange={(e) => setNewReflection(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Fuente o Libro (Ej. Hábitos Atómicos)..."
            value={newSource}
            onChange={(e) => setNewSource(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
          />
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
          >
            Guardar en Repaso Espaciado
          </button>
        </form>
      ) : (
        currentCard && (
          <div className="space-y-4">
            {/* TARJETA INTERACTIVA FLIP */}
            <div
              onClick={() => {
                triggerHaptic("light");
                setFlipped((f) => !f);
              }}
              className="cursor-pointer min-h-[160px] rounded-xl border border-indigo-500/40 bg-slate-950/90 p-5 transition hover:border-indigo-400 flex flex-col justify-between shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-indigo-400 font-semibold mb-2">
                  <span>📖 {currentCard.source_title}</span>
                  <span>Repetición #{currentCard.repetition}</span>
                </div>
                <h4 className="text-sm font-bold text-white">
                  {currentCard.front_prompt}
                </h4>
                {flipped && (
                  <div className="mt-3 border-t border-slate-800 pt-3 text-xs text-indigo-200 leading-relaxed bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-500/20">
                    💡 <strong>Conocimiento:</strong> {currentCard.back_reflection}
                  </div>
                )}
              </div>
              <p className="mt-3 text-[11px] text-slate-500 text-center font-medium">
                {flipped ? "Toca para ocultar reverso" : "👉 Toca la tarjeta para ver la respuesta / reflexión"}
              </p>
            </div>

            {/* BOTONES DE CALIFICACIÓN SM-2 */}
            {flipped && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 block text-center">
                  ¿Cómo estuvo tu retención? (Calcula el próximo intervalo SM-2):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleReview(1)}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-500/20 cursor-pointer text-center"
                  >
                    1. Olvidado (+15 XP)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(2)}
                    className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 cursor-pointer text-center"
                  >
                    2. Difícil (+35 XP)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(3)}
                    className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 cursor-pointer text-center"
                  >
                    3. Bien (+65 XP)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReview(4)}
                    className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 cursor-pointer text-center"
                  >
                    4. Fácil (+100 XP)
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}

// ============================================================================
// 5. ÁRBOL DE TALENTOS PASIVOS (PERKS RPG POR NIVEL)
// ============================================================================
export function RpgTalentTreeSection({
  playerLevel = 1,
  talentPerks = [],
  unlockedPerks = [],
  onUnlockPerk,
}: {
  playerLevel: number;
  talentPerks: TalentPerk[];
  unlockedPerks: string[];
  onUnlockPerk: (perkId: string) => Promise<void>;
}) {
  const spentPoints = unlockedPerks.length;
  const totalPoints = Math.max(0, playerLevel - 1);
  const availablePoints = Math.max(0, totalPoints - spentPoints);

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-slate-900/90 p-6 shadow-xl text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-400" />
            <h3 className="text-lg font-bold text-white">
              Árbol de Talentos & Perks Pasivos
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Ganas 1 Punto de Talento por cada nivel que asciendes. Desbloquea perks permanentes que amplifican tus recompensas.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-1.5 text-xs font-bold text-amber-300">
          <span>⭐ Puntos Disponibles:</span>
          <span className="text-sm font-extrabold">{availablePoints}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {talentPerks.map((perk) => {
          const isUnlocked = unlockedPerks.includes(perk.id) || perk.is_unlocked;
          const canAfford = availablePoints >= perk.cost_points;

          return (
            <div
              key={perk.id}
              className={`flex flex-col justify-between rounded-xl border p-4 transition ${
                isUnlocked
                  ? "border-emerald-500/60 bg-emerald-950/20 ring-1 ring-emerald-500/40"
                  : canAfford
                  ? "border-amber-500/40 bg-slate-950 hover:border-amber-400"
                  : "border-slate-800 bg-slate-950/60 opacity-60"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">{perk.icon}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      isUnlocked
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-slate-800 text-slate-400"
                    }`}
                  >
                    Tier {perk.tier} · {perk.cost_points} Pts
                  </span>
                </div>
                <h4 className="font-bold text-sm text-white">{perk.name}</h4>
                <span className="inline-block mt-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                  {perk.effect_label}
                </span>
                <p className="mt-2 text-xs text-slate-400 leading-relaxed">
                  {perk.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/80">
                {isUnlocked ? (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" /> Talento Activo
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => {
                      triggerHaptic("success");
                      onUnlockPerk(perk.id);
                    }}
                    className="w-full rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:hover:bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                  >
                    {canAfford ? "Desbloquear Talento 🔓" : "Puntos Insuficientes 🔒"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// 6. CENTRO DE EXPORTACIÓN & CONEXIÓN NOTION / CSV / IOS
// ============================================================================
export function ExportAndNotionHub({
  books = [],
  bosses = [],
  fixedCosts = [],
  solves = [],
  fullState = null,
  apiKey = "mi-token-secreto-rpg-2026",
  onImportBackup,
}: {
  books: ReadingBook[];
  bosses: DemoBoss[];
  fixedCosts: FixedCostItem[];
  solves: RubikSolveEntry[];
  fullState: unknown;
  apiKey?: string;
  onImportBackup: (file: File) => Promise<void>;
}) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://rpg-life-engine.local";

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportBackup(file);
      e.target.value = "";
    }
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">
              Centro de Exportación, Respaldo & Atajos iOS
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Exporta tus bases de datos para Notion / Excel o descarga el archivo maestro de configuración de Atajos de iOS.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Export Libros Notion */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            exportBooksToNotionCsv(books);
          }}
          className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-left hover:border-emerald-500/50 hover:bg-slate-800 cursor-pointer transition shadow"
        >
          <span className="text-2xl">📚</span>
          <div>
            <h4 className="text-xs font-bold text-white">Exportar Libros a Notion</h4>
            <span className="text-[10px] text-slate-400">CSV con portadas, citas y notas</span>
          </div>
        </button>

        {/* Export Finanzas Notion */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            exportFinancesToCsv(bosses, fixedCosts);
          }}
          className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-left hover:border-rose-500/50 hover:bg-slate-800 cursor-pointer transition shadow"
        >
          <span className="text-2xl">💳</span>
          <div>
            <h4 className="text-xs font-bold text-white">Exportar Deudas & Fijos</h4>
            <span className="text-[10px] text-slate-400">CSV con Debt Bosses y amortización</span>
          </div>
        </button>

        {/* Export Rubik CSV */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("medium");
            exportRubikSolvesCsv(solves);
          }}
          className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-left hover:border-cyan-500/50 hover:bg-slate-800 cursor-pointer transition shadow"
        >
          <span className="text-2xl">🧩</span>
          <div>
            <h4 className="text-xs font-bold text-white">Exportar Solves WCA</h4>
            <span className="text-[10px] text-slate-400">CSV con tiempos y scrambles</span>
          </div>
        </button>

        {/* Respaldo Maestro JSON */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("success");
            exportMasterBackupJson(fullState);
          }}
          className="flex items-center gap-3 rounded-xl border border-indigo-500/40 bg-indigo-500/10 p-3 text-left hover:bg-indigo-500/20 cursor-pointer transition shadow"
        >
          <span className="text-2xl">💾</span>
          <div>
            <h4 className="text-xs font-bold text-indigo-300">Respaldo Maestro JSON</h4>
            <span className="text-[10px] text-slate-400">Copia de seguridad total restaurable</span>
          </div>
        </button>

        {/* Atajo iOS Automático */}
        <button
          type="button"
          onClick={() => {
            triggerHaptic("success");
            generateIosShortcutFile(apiKey, origin);
          }}
          className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-left hover:bg-amber-500/20 cursor-pointer transition shadow"
        >
          <span className="text-2xl">📲</span>
          <div>
            <h4 className="text-xs font-bold text-amber-300">Descargar Atajo iOS</h4>
            <span className="text-[10px] text-slate-400">Archivo con API Key pre-configurada</span>
          </div>
        </button>

        {/* Importar Respaldo JSON */}
        <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/80 p-3 text-left hover:border-emerald-500/50 hover:bg-slate-800 cursor-pointer transition shadow">
          <span className="text-2xl">📥</span>
          <div>
            <h4 className="text-xs font-bold text-white">Restaurar Respaldo</h4>
            <span className="text-[10px] text-slate-400">Cargar archivo JSON maestro</span>
          </div>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}
