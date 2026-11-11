"use client";

import React, { useState, useMemo } from "react";
import {
  BookMarked,
  Heart,
  Sparkles,
  Play,
  Pause,
  Square,
  PenTool,
  Calendar,
  Sun,
  Smile,
  CheckCircle2,
  Search,
  Tag,
  Lock,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react";
import type { SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";
import { CozyButton } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

const AVAILABLE_TAGS = [
  "#gratitud",
  "#claridad",
  "#aprendizaje",
  "#calma",
  "#desahogo",
  "#ideas",
  "#salud",
  "#familia",
];

interface JournalingBuildingProps {
  sessions?: SkillSessionRecord[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

export function JournalingBuilding({
  sessions = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: JournalingBuildingProps) {
  const [activeTab, setActiveTab] = useState("write");
  const [mood, setMood] = useState<string>("sereno");
  const [selectedTags, setSelectedTags] = useState<string[]>(["#claridad"]);
  const [gratitude1, setGratitude1] = useState("");
  const [gratitude2, setGratitude2] = useState("");
  const [gratitude3, setGratitude3] = useState("");
  const [journalText, setJournalText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  const soraResident = useMemo(
    () => COZY_VILLAGE_RESIDENTS.find((r) => r.id === "sora"),
    []
  );

  const {
    session,
    elapsedSeconds,
    formattedTime,
    isActive,
    isPaused,
    prepareSession,
    startSession,
    pauseSession,
    resumeSession,
    cancelSession,
    finishSession,
    history,
  } = useUniversalSession({
    targetDomain: "journaling",
    targetBuildingId: "cabana_diario",
  });

  const journalSessions = useMemo(
    () => sessions.filter((s) => s.domain === "journaling"),
    [sessions]
  );
  const totalMinutes = useMemo(
    () => journalSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0),
    [journalSessions]
  );

  const handleToggleTag = (tag: string) => {
    triggerHaptic("light");
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleStartWriting = () => {
    triggerHaptic("medium");
    if (!session) {
      prepareSession({
        objective: `Reflexión del día (${mood})`,
        specializedData: {
          mood,
          tags: selectedTags,
          gratitudeCount: [gratitude1, gratitude2, gratitude3].filter(Boolean).length,
        },
      });
    }
    startSession();
  };

  const handleFinishWriting = async () => {
    triggerHaptic("success");
    const gratitudes = [gratitude1, gratitude2, gratitude3].filter(Boolean);
    const tagsString = selectedTags.join(" ");
    const fullNotes = `Estado: ${mood.toUpperCase()} • ${tagsString}\nGratitud:\n${gratitudes.map((g) => `• ${g}`).join("\n")}\n\nReflexión:\n${journalText}`;

    await finishSession({
      mood,
      tags: selectedTags,
      gratitudes,
      wordCount: journalText.trim().split(/\s+/).filter(Boolean).length,
      notes: fullNotes,
    });

    await onSubmitDirectSkillSession({
      action: "log_skill_session",
      domain: "journaling",
      duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      details: `Reflexión en Cabaña del Diario • Estado: ${mood} • ${tagsString}`,
    });
    await onRefreshState();

    setJournalText("");
    setGratitude1("");
    setGratitude2("");
    setGratitude3("");
  };

  // Filtrado de historial por búsqueda de texto, etiquetas o estado
  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return journalSessions;
    const q = searchQuery.toLowerCase().trim();
    return journalSessions.filter((s) => {
      const details = (s.details || "").toLowerCase();
      const title = (s.title || "").toLowerCase();
      return details.includes(q) || title.includes(q);
    });
  }, [journalSessions, searchQuery]);

  return (
    <BuildingInteriorShell
      buildingId="cabana_diario"
      buildingName="Cabaña del Diario & Reflexión"
      domain="journaling"
      districtName="Distrito del Saber"
      icon="📔"
      tagline="Bitácora Interior, Gratitud Diaria & Claridad Mental Privada"
      playerLevel={playerLevel}
      skillLevel={skillLevel}
      totalGpEarned={totalGpEarned}
      resident={soraResident}
      sessionsCount={journalSessions.length}
      specificMetrics={[
        { label: "Reflexiones", value: journalSessions.length, icon: "📔" },
        { label: "Tiempo de Pausa", value: `${totalMinutes} min`, icon: "⏱️" },
        { label: "Estado Hoy", value: mood, icon: "✨" },
        { label: "Etiquetas", value: selectedTags.length, icon: "🏷️" },
      ]}
      activeSessionBanner={{
        isActive,
        isPaused,
        formattedTime,
        label: `Reflexión en curso • Estado: ${mood} • ${selectedTags.join(" ")}`,
        onViewSession: () => setActiveTab("write"),
      }}
      activeTab={activeTab}
      tabs={[
        {
          id: "write",
          label: "Escribir en la Bitácora",
          icon: <PenTool className="h-4 w-4" />,
        },
        {
          id: "gratitude",
          label: "Jardín de Gratitud",
          icon: <Heart className="h-4 w-4" />,
        },
        {
          id: "history",
          label: "Búsqueda & Entradas",
          icon: <Calendar className="h-4 w-4" />,
          badge: journalSessions.length,
        },
      ]}
      onTabChange={setActiveTab}
      onClose={onClose}
    >
      {/* =========================================================================
          TAB 1: ESCRITURA EN BITÁCORA & PAUSA CONSCIENTE
         ========================================================================= */}
      {activeTab === "write" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Panel Izquierdo: Temporizador & Selector Emocional */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-[#B5838D]">
                Pausa Consciente
              </span>
              <div className="font-mono text-4xl font-black text-[#3A2E2B] text-center bg-[#F7F4EB] py-3 rounded-2xl border-2 border-[#3A2E2B] shadow-inner">
                {formattedTime}
              </div>

              {/* Selector de Estado Emocional */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-[#3A2E2B]">
                  ¿Cómo te sientes en este instante?
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "sereno", label: "Sereno 🌿" },
                    { id: "agradecido", label: "Agradecido ✨" },
                    { id: "reflexivo", label: "Reflexivo 🕯️" },
                    { id: "cansado", label: "Agotado ☁️" },
                    { id: "motivado", label: "Inspirado 💡" },
                    { id: "vulnerable", label: "Vulnerable 🌧️" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMood(m.id);
                        triggerHaptic("light");
                      }}
                      className={`rounded-xl border-2 border-[#3A2E2B] py-1.5 px-2 text-[11px] font-bold transition cursor-pointer text-center ${
                        mood === m.id
                          ? "bg-[#B5838D] text-white shadow-sm font-black"
                          : "bg-[#F7F4EB] text-[#3A2E2B] hover:bg-[#E8DFCF]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector de Etiquetas Temáticas */}
              <div className="space-y-1.5 pt-1">
                <span className="block text-xs font-bold text-[#3A2E2B] flex items-center gap-1">
                  <Tag className="h-3.5 w-3.5 text-[#B5838D]" /> Etiquetas del día:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_TAGS.map((t) => {
                    const isSelected = selectedTags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleToggleTag(t)}
                        className={`rounded-lg border px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                          isSelected
                            ? "border-[#3A2E2B] bg-[#314C3C] text-white"
                            : "border-[#3A2E2B]/20 bg-[#F7F4EB] text-[#795548] hover:bg-[#E8DFCF]"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Controles de Sesión de Escritura */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#3A2E2B]/10">
                {!isActive && !isPaused && (
                  <CozyButton
                    variant="forest"
                    size="md"
                    onClick={handleStartWriting}
                    icon={<Play className="h-4 w-4" />}
                  >
                    Comenzar a Escribir
                  </CozyButton>
                )}
                {isActive && (
                  <CozyButton
                    variant="sunlight"
                    size="md"
                    onClick={() => {
                      pauseSession();
                      triggerHaptic("light");
                    }}
                    icon={<Pause className="h-4 w-4" />}
                  >
                    Pausar Pluma
                  </CozyButton>
                )}
                {isPaused && (
                  <CozyButton
                    variant="forest"
                    size="md"
                    onClick={() => {
                      resumeSession();
                      triggerHaptic("light");
                    }}
                    icon={<Play className="h-4 w-4" />}
                  >
                    Reanudar
                  </CozyButton>
                )}
                {(isActive || isPaused) && (
                  <CozyButton
                    variant="clay"
                    size="md"
                    onClick={handleFinishWriting}
                    icon={<Square className="h-4 w-4" />}
                  >
                    Guardar Entrada Privada
                  </CozyButton>
                )}
              </div>
            </div>

            {/* Panel Derecho: Área de Escritura Libre & Privada */}
            <div className="md:col-span-2 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3 flex flex-col">
              <div className="flex items-center justify-between border-b border-[#3A2E2B]/10 pb-2">
                <span className="text-xs font-black text-[#3A2E2B] flex items-center gap-1.5">
                  <span>🖋️</span> Espacio de Desahogo & Claridad Interior
                </span>
                <span className="text-[10px] text-[#795548] flex items-center gap-1">
                  <Lock className="h-3 w-3 text-emerald-600" /> Entrada 100% Privada
                </span>
              </div>
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="Escribe libremente lo que hoy ocupa tu mente o corazón. Sin juicios, sin métricas que alcanzar..."
                rows={12}
                className="w-full flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-4 text-xs text-[#3A2E2B] placeholder-[#9E9087] focus:outline-none focus:border-[#B5838D] font-sans leading-relaxed resize-none shadow-inner"
              />
              <div className="flex items-center justify-between text-[11px] text-[#795548] pt-1">
                <span>
                  Palabras: {journalText.trim().split(/\s+/).filter(Boolean).length}
                </span>
                <span className="italic">
                  &ldquo;Nombrar lo que sentimos es encontrar la calma.&rdquo; — Sora
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: JARDÍN DE GRATITUD
         ========================================================================= */}
      {activeTab === "gratitude" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4 max-w-2xl mx-auto">
          <div className="text-center space-y-1">
            <span className="text-3xl select-none">✨</span>
            <h3 className="text-base font-black text-[#3A2E2B]">Tres Semillas de Gratitud</h3>
            <p className="text-xs text-[#795548]">
              Anotar pequeños destellos positivos entrena el cerebro para percibir la calma cotidiana.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {[
              {
                val: gratitude1,
                set: setGratitude1,
                num: "1",
                ph: "Una taza de café caliente, una brisa suave...",
              },
              {
                val: gratitude2,
                set: setGratitude2,
                num: "2",
                ph: "Un obstáculo superado o algo que hoy salió bien...",
              },
              {
                val: gratitude3,
                set: setGratitude3,
                num: "3",
                ph: "Un momento de silencio o descanso reconfortante...",
              },
            ].map((g) => (
              <div key={g.num} className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-xs font-black text-[#3A2E2B]">
                  {g.num}
                </span>
                <input
                  type="text"
                  value={g.val}
                  onChange={(e) => g.set(e.target.value)}
                  placeholder={g.ph}
                  className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3.5 py-2 text-xs text-[#3A2E2B] placeholder-[#9E9087] focus:outline-none focus:border-[#B5838D]"
                />
              </div>
            ))}
          </div>

          <div className="pt-3 text-center">
            <CozyButton
              variant="forest"
              size="sm"
              onClick={() => {
                triggerHaptic("success");
                setActiveTab("write");
              }}
            >
              Llevar Gratitud a la Bitácora
            </CozyButton>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: HISTORIAL & BÚSQUEDA DE ENTRADAS ANTERIORES
         ========================================================================= */}
      {activeTab === "history" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-[#3A2E2B]">
                Entradas Registradas en la Cabaña
              </h3>
              <p className="text-xs text-[#795548]">
                Tu archivo íntimo de reflexiones, estados de ánimo y momentos de gratitud.
              </p>
            </div>

            {/* Barra de Búsqueda Instantánea */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#795548]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por texto, tag..."
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] pl-8 pr-3 py-1.5 text-xs text-[#3A2E2B] placeholder-[#9E9087] focus:outline-none focus:border-[#B5838D]"
              />
            </div>
          </div>

          {filteredSessions.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <span className="text-3xl select-none block">🕯️</span>
              <p className="text-xs text-[#795548] italic">
                {searchQuery
                  ? `No se encontraron entradas que coincidan con "${searchQuery}".`
                  : "Aún no hay entradas registradas en la cabaña. ¡Toma tu pluma hoy!"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#3A2E2B]/10">
              {filteredSessions.map((ses, i) => {
                const entryId = ses.id || `entry-${i}`;
                const isExpanded = expandedEntryId === entryId;
                return (
                  <div key={entryId} className="py-3.5 text-xs space-y-2">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedEntryId(isExpanded ? null : entryId)
                      }
                    >
                      <div className="space-y-0.5">
                        <span className="font-bold text-[#3A2E2B] block">
                          {ses.details || "Entrada de bitácora"}
                        </span>
                        <span className="block text-[10px] text-[#795548]">
                          {new Date(
                            ses.timestamp || Date.now()
                          ).toLocaleDateString("es-CO", {
                            dateStyle: "full",
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#B5838D]/15 border border-[#B5838D]/30 px-2.5 py-0.5 text-[11px] font-black text-[#8E5B65]">
                          +{ses.duration_minutes || 10} min
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4 text-[#795548]" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-[#795548]" />
                        )}
                      </div>
                    </div>

                    {/* Vista Expandida de Entrada */}
                    {isExpanded && (
                      <div className="rounded-xl border border-[#3A2E2B]/15 bg-[#F7F4EB] p-3 text-xs text-[#3A2E2B] whitespace-pre-wrap leading-relaxed animate-in fade-in">
                        {ses.details}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </BuildingInteriorShell>
  );
}
