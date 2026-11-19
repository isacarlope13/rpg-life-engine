"use client";

import React, { useState } from "react";
import { Send, Sparkles, Trash2, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";
import type { SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import { CozyModal, CozyCard, CozyButton } from "@/components/cozy/ui";
import { useSessionIdentity } from "@/lib/sanctuary/session-identity";
import { readCinemaEntriesSafe } from "@/lib/sanctuary/cinema-store";
import { readAtelierPatternsSafe } from "@/lib/sanctuary/atelier-patterns-store";
import type { MayorCitation, MayorBuildingLink } from "@/lib/ai/mayor-rowan-engine";

interface MayorsLedgerModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillSummaries?: SkillDomainSummary[];
  recentSessions?: SkillSessionRecord[];
  activeBooksCount?: number;
  activeKnittingProjectsCount?: number;
  onOpenBuilding?: (buildingId: string) => void;
}

interface ChatMessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode?: string;
  citations?: MayorCitation[];
  buildingLinks?: MayorBuildingLink[];
  createdAt: string;
}

const SUGGESTED_QUESTIONS = [
  "¿Cuál fue mi último libro registrado?",
  "¿En qué proyecto de crochet trabajé por última vez?",
  "¿Cuál fue la última película que marqué como vista?",
  "¿Cuánto gasté esta semana?",
  "¿Cuándo entrené por última vez?",
  "¿Cuál fue mi último récord de cubos?",
  "¿Qué proyecto de trabajo dejé pendiente?",
];

export function MayorsLedgerModal({
  isOpen,
  onClose,
  skillSummaries = [],
  recentSessions = [],
  onOpenBuilding,
}: MayorsLedgerModalProps) {
  const sessionOwner = useSessionIdentity();
  const [activeTab, setActiveTab] = useState<"rowan" | "ledger">("rowan");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [geminiEnabled, setGeminiEnabled] = useState(true);

  if (!isOpen) return null;

  const handleAskRowan = async (rawQuestion?: string) => {
    const text = (rawQuestion ?? question).trim();
    if (!text || loading) return;

    setErrorMsg(null);
    setLoading(true);
    const userMsg: ChatMessageItem = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMsg].slice(-10);
    setMessages(nextHistory);
    if (!rawQuestion) setQuestion("");

    try {
      const cinemaEntries = readCinemaEntriesSafe(sessionOwner);
      const localPatterns = readAtelierPatternsSafe(sessionOwner);

      const res = await fetch("/api/ai/mayor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: nextHistory.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          ai_enabled: geminiEnabled,
          local_snapshot: {
            cinemaEntries,
            localPatternProjectsCount: Object.keys(localPatterns).length,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "No se pudo consultar al Presidente Rowan.");
        return;
      }

      const assistantMsg: ChatMessageItem = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        mode: data.mode,
        citations: data.citations || [],
        buildingLinks: data.buildingLinks || [],
        createdAt: data.generated_at || new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg].slice(-10));
    } catch {
      setErrorMsg("Error de conexión al consultar el Ayuntamiento. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  // Cálculo determinista de estación según el mes actual
  const month = new Date().getMonth();
  const seasonInfo =
    month >= 2 && month <= 4
      ? { name: "Primavera Floreciente", icon: "🌸", climate: "Brisa templada y brotes verdes", bonus: "+10% Expansión Creativa" }
      : month >= 5 && month <= 7
      ? { name: "Verano Cálido", icon: "🌻", climate: "Días largos y sol resplandeciente", bonus: "+10% Energía en Movimiento" }
      : month >= 8 && month <= 10
      ? { name: "Otoño Dorado", icon: "🍂", climate: "Viento fresco y hojas de arce", bonus: "+10% Retención en Lectura" }
      : { name: "Invierno Acogedor", icon: "❄️", climate: "Hogar tibio y descanso reparador", bonus: "+10% Concentración en Tejido" };

  const totalSessions = skillSummaries.reduce((acc, s) => acc + (s.sessions_count || 0), 0) || recentSessions.length;
  const totalGp = skillSummaries.reduce((acc, s) => acc + (s.total_gp_earned || 0), 0);

  const dayOfWeek = new Date().getDay();
  const DECREES = [
    "Decreto del Silencio Dulce: Toda pausa deliberada es una semilla para el enfoque de mañana.",
    "Proclama del Tejedor: Cada fila completada, por pequeña que sea, abriga el espíritu comunitario.",
    "Bando de la Curiosidad: La biblioteca del erudito permanece abierta para cualquier pregunta sincera.",
    "Edicto de la Calma: Queda terminantemente prohibido medir el propio valor únicamente por la velocidad.",
    "Ordenanza del Descanso: Una infusión tibia y tres respiraciones profundas son válidas como tarea prioritaria.",
    "Tratado de la Paciencia: Los árboles más antiguos de Oakhaven crecieron anillo por anillo sin prisa.",
    "Fiesta de la Gratitud: Reconoce hoy un pequeño avance que hiciste esta semana.",
  ];
  const activeDecree = DECREES[dayOfWeek % DECREES.length];

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ayuntamiento de OakHaven"
      subtitle="Presidente Rowan • Conocimiento Verificado & Bitácora del Pueblo"
      icon="🏛️"
      headerVariant="wood"
      maxWidth="2xl"
    >
      <div className="space-y-4 text-[#3A2E2B]">
        {/* Selector de pestañas del Ayuntamiento */}
        <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("rowan")}
            className={`rounded-2xl border-2 px-3.5 py-2 text-xs font-black cursor-pointer transition-colors ${
              activeTab === "rowan"
                ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#F4EEDC]"
            }`}
          >
            🦉 Consultar al Presidente Rowan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`rounded-2xl border-2 px-3.5 py-2 text-xs font-black cursor-pointer transition-colors ${
              activeTab === "ledger"
                ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#F4EEDC]"
            }`}
          >
            📜 Bitácora del Pueblo
          </button>
        </div>

        {/* =====================================================================
            PESTAÑA 1: PRESIDENTE ROWAN (ASISTENTE CENTRAL DE SOLO LECTURA)
           ===================================================================== */}
        {activeTab === "rowan" && (
          <div className="space-y-3">
            {/* Cabecera de Rowan */}
            <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F4EEDC] p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B]">
                  🦉
                </span>
                <div>
                  <h4 className="text-sm font-black text-[#3A2E2B]">Presidente Rowan</h4>
                  <p className="text-[11px] text-[#5C4033]">
                    Solo lectura (Nivel 1) • Consulta tus datos reales con fecha y fuente sin inventar cifras.
                  </p>
                </div>
              </div>

              <label className="inline-flex items-center gap-1.5 rounded-xl border border-[#3A2E2B]/30 bg-[#FFFDF8] px-2.5 py-1 text-[10px] font-bold text-[#3A2E2B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={geminiEnabled}
                  onChange={(e) => setGeminiEnabled(e.target.checked)}
                />
                <Sparkles className="h-3 w-3 text-[#C88973]" />
                <span>Pulido IA</span>
              </label>
            </div>

            {/* Preguntas sugeridas */}
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => handleAskRowan(q)}
                  className="rounded-full border border-[#3A2E2B]/35 bg-[#FFFDF8] px-2.5 py-1 text-[11px] font-bold text-[#5C381E] hover:bg-[#E7D69C]/45 cursor-pointer disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Historial conversacional */}
            <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3.5 min-h-[190px] max-h-[300px] overflow-y-auto space-y-3">
              {messages.length === 0 ? (
                <div className="py-6 text-center space-y-1.5">
                  <p className="text-xs font-black text-[#3A2E2B]">
                    &ldquo;Bienvenido al Ayuntamiento. Pregúntame sobre tus libros, proyectos de crochet, cine, gastos, gym, cubos o trabajo.&rdquo;
                  </p>
                  <p className="text-[10px] text-[#795548] inline-flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#314C3C]" />
                    Nunca ejecuto pagos ni altero tus saldos COP, GP o XP.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-2xl p-3 text-xs space-y-2 ${
                      msg.role === "user"
                        ? "bg-[#314C3C] text-[#FFFDF8] ml-6"
                        : "bg-[#F4EEDC] text-[#3A2E2B] border border-[#3A2E2B]/25 mr-4"
                    }`}
                  >
                    <p className="whitespace-pre-line leading-relaxed font-medium">{msg.content}</p>

                    {msg.role === "assistant" && msg.citations && msg.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#3A2E2B]/15">
                        {msg.citations.map((c, idx) => (
                          <span
                            key={`${msg.id}-c-${idx}`}
                            className="rounded-lg bg-[#FFFDF8] border border-[#3A2E2B]/20 px-2 py-0.5 text-[10px] font-bold text-[#5C4033]"
                          >
                            Origen: {c.source} •{" "}
                            {new Date(c.asOf).toLocaleTimeString("es-CO", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.role === "assistant" &&
                      msg.buildingLinks &&
                      msg.buildingLinks.length > 0 &&
                      onOpenBuilding && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {msg.buildingLinks.map((link) => (
                            <button
                              key={`${msg.id}-${link.buildingId}`}
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenBuilding(link.buildingId);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-2.5 py-1 text-[10px] font-black text-[#3A2E2B] hover:bg-[#F2E3B3] cursor-pointer"
                            >
                              <span>{link.icon}</span>
                              <span>{link.label}</span>
                              <ExternalLink className="h-3 w-3" />
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                ))
              )}

              {loading && (
                <div className="rounded-2xl bg-[#F4EEDC] border border-[#3A2E2B]/20 p-3 text-xs font-bold text-[#795548]">
                  🦉 Rowan está consultando tus registros verificados...
                </div>
              )}
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl border border-amber-700 bg-amber-50 p-2.5 text-xs font-bold text-amber-950 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Campo de pregunta */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAskRowan();
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                maxLength={600}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Pregúntale a Rowan sobre tus actividades reales..."
                aria-label="Pregunta para el Presidente Rowan"
                className="flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3.5 py-2.5 text-xs font-bold text-[#3A2E2B] outline-none"
              />
              <CozyButton
                type="submit"
                variant="forest"
                size="md"
                disabled={loading || !question.trim()}
                className="flex items-center gap-1.5 px-4"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Preguntar</span>
              </CozyButton>
            </form>

            {/* Política explícita de retención */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-[#795548]">
              <span>
                Retención: historial temporal en memoria de esta sesión (máx. 10 turnos, no se guarda en BD).
              </span>
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  className="inline-flex items-center gap-1 font-bold text-[#5C381E] hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" />
                  Limpiar conversación
                </button>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            PESTAÑA 2: BITÁCORA OFICIAL DEL PUEBLO (CONSERVADA)
           ===================================================================== */}
        {activeTab === "ledger" && (
          <div className="space-y-4">
            <CozyCard variant="cream" shadow="sm" className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl select-none">{seasonInfo.icon}</span>
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#795548]">Estación Vigente</span>
                    <h4 className="text-sm font-black text-[#3A2E2B]">{seasonInfo.name}</h4>
                    <p className="text-xs text-[#5C4033]">{seasonInfo.climate}</p>
                  </div>
                </div>
                <div className="rounded-xl border-2 border-[#314C3C]/40 bg-[#77936A]/20 px-3 py-1.5 text-right">
                  <span className="text-[10px] font-bold text-[#314C3C]">Armonía Estacional</span>
                  <p className="text-xs font-black text-[#314C3C]">{seasonInfo.bonus}</p>
                </div>
              </div>
            </CozyCard>

            <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C]/40 p-4 text-center shadow-[0_3px_0_#3A2E2B]">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#795548] block">
                📜 Decreto del Presidente Rowan
              </span>
              <p className="mt-1.5 text-xs font-semibold italic text-[#3A2E2B]">
                &ldquo;{activeDecree}&rdquo;
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-center shadow-[0_3px_0_#3A2E2B]">
                <span className="text-lg">⭐</span>
                <span className="block text-base font-black text-[#3A2E2B]">5.0 / 5.0</span>
                <span className="text-[10px] font-bold text-[#795548]">Satisfacción Vecinal</span>
              </div>
              <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-center shadow-[0_3px_0_#3A2E2B]">
                <span className="text-lg">🌱</span>
                <span className="block text-base font-black text-[#3A2E2B]">{totalSessions}</span>
                <span className="text-[10px] font-bold text-[#795548]">Sesiones de Calma</span>
              </div>
              <div className="col-span-2 sm:col-span-1 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-center shadow-[0_3px_0_#3A2E2B]">
                <span className="text-lg">💰</span>
                <span className="block text-base font-black text-[#314C3C]">
                  +{totalGp.toLocaleString("es-CO")} GP
                </span>
                <span className="text-[10px] font-bold text-[#795548]">Riqueza Forjada</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-[#795548] mb-2">
                👥 Censo Comunitario de Residentes ({COZY_VILLAGE_RESIDENTS.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {COZY_VILLAGE_RESIDENTS.map((res) => (
                  <div
                    key={res.id}
                    className="flex items-center justify-between rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-2.5 px-3 shadow-[0_2px_0_#3A2E2B]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{res.avatar}</span>
                      <div>
                        <span className="text-xs font-black text-[#3A2E2B]">{res.name}</span>
                        <span className="ml-1.5 text-[10px] font-bold text-[#795548]">
                          ({res.species} • {res.title})
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full border border-[#77936A] bg-[#77936A]/20 px-2 py-0.5 text-[10px] font-extrabold text-[#314C3C]">
                      En su Puesto ✓
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pt-1 text-center">
          <CozyButton variant="wood" size="md" onClick={onClose}>
            Cerrar Ayuntamiento
          </CozyButton>
        </div>
      </div>
    </CozyModal>
  );
}
