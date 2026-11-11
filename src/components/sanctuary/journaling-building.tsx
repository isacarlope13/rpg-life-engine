"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import type { SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { CozyButton } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

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
  const [gratitude1, setGratitude1] = useState("");
  const [gratitude2, setGratitude2] = useState("");
  const [gratitude3, setGratitude3] = useState("");
  const [journalText, setJournalText] = useState("");

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

  const journalSessions = sessions.filter((s) => s.domain === "journaling");
  const totalMinutes = journalSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  const handleStartWriting = () => {
    triggerHaptic("medium");
    if (!session) {
      prepareSession({
        objective: `Reflexión del día (${mood})`,
        specializedData: {
          mood,
          gratitudeCount: [gratitude1, gratitude2, gratitude3].filter(Boolean).length,
        },
      });
    }
    startSession();
  };

  const handleFinishWriting = async () => {
    triggerHaptic("success");
    const gratitudes = [gratitude1, gratitude2, gratitude3].filter(Boolean);
    const fullNotes = `Estado: ${mood.toUpperCase()}\nGratitud:\n${gratitudes.map((g) => `• ${g}`).join("\n")}\n\nReflexión:\n${journalText}`;

    await finishSession({
      mood,
      gratitudes,
      wordCount: journalText.trim().split(/\s+/).filter(Boolean).length,
      notes: fullNotes,
    });

    await onSubmitDirectSkillSession({
      action: "log_skill_session",
      domain: "journaling",
      duration_minutes: Math.max(1, Math.round(elapsedSeconds / 60)),
      details: `Reflexión en Cabaña del Diario • Estado: ${mood}`,
    });
    await onRefreshState();

    setJournalText("");
  };

  return (
    <BuildingInteriorShell
      buildingId="cabana_diario"
      buildingName="Cabaña del Diario & Reflexión"
      domain="journaling"
      districtName="Distrito del Saber"
      icon="📔"
      tagline="Bitácora Interior, Gratitud Diaria & Claridad Mental"
      playerLevel={playerLevel}
      skillLevel={skillLevel}
      totalGpEarned={totalGpEarned}
      specificMetrics={[
        { label: "Reflexiones", value: journalSessions.length, icon: "📔" },
        { label: "Tiempo de Pausa", value: `${totalMinutes} min`, icon: "⏱️" },
        { label: "Estado Hoy", value: mood, icon: "✨" },
      ]}
      activeTab={activeTab}
      tabs={[
        { id: "write", label: "Escribir en la Bitácora", icon: <PenTool className="h-4 w-4" /> },
        { id: "gratitude", label: "Jardín de Gratitud", icon: <Heart className="h-4 w-4" /> },
        { id: "history", label: "Entradas Anteriores", icon: <Calendar className="h-4 w-4" />, badge: journalSessions.length },
      ]}
      onTabChange={setActiveTab}
      onClose={onClose}
    >
      {/* =========================================================================
          TAB 1: ESCRITURA EN BITÁCORA & CRONÓMETRO DE PAUSA CONSCIENTE
         ========================================================================= */}
      {activeTab === "write" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Panel Izquierdo: Temporizador & Estado Emocional */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-[#B5838D]">
                Pausa Consciente
              </span>
              <div className="font-mono text-4xl font-black text-[#3A2E2B] text-center bg-[#F7F4EB] py-3 rounded-2xl border-2 border-[#3A2E2B] shadow-inner">
                {formattedTime}
              </div>

              {/* Selector de Estado */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-[#3A2E2B]">¿Cómo te sientes hoy?</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "sereno", label: "Sereno 🌿" },
                    { id: "agradecido", label: "Agradecido ✨" },
                    { id: "reflexivo", label: "Reflexivo 🕯️" },
                    { id: "cansado", label: "Agotado ☁️" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => { setMood(m.id); triggerHaptic("light"); }}
                      className={`rounded-xl border-2 border-[#3A2E2B] py-1.5 px-2 text-[11px] font-bold transition cursor-pointer text-center ${
                        mood === m.id
                          ? "bg-[#B5838D] text-white shadow-sm"
                          : "bg-[#F7F4EB] text-[#3A2E2B] hover:bg-[#E8DFCF]"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Controles de Sesión */}
              <div className="flex flex-col gap-2 pt-2">
                {!isActive && !isPaused && (
                  <CozyButton variant="forest" size="md" onClick={handleStartWriting} icon={<Play className="h-4 w-4" />}>
                    Comenzar a Escribir
                  </CozyButton>
                )}
                {isActive && (
                  <CozyButton variant="sunlight" size="md" onClick={() => { pauseSession(); triggerHaptic("light"); }} icon={<Pause className="h-4 w-4" />}>
                    Pausar Pluma
                  </CozyButton>
                )}
                {isPaused && (
                  <CozyButton variant="forest" size="md" onClick={() => { resumeSession(); triggerHaptic("light"); }} icon={<Play className="h-4 w-4" />}>
                    Reanudar
                  </CozyButton>
                )}
                {(isActive || isPaused) && (
                  <CozyButton variant="clay" size="md" onClick={handleFinishWriting} icon={<Square className="h-4 w-4" />}>
                    Guardar Entrada
                  </CozyButton>
                )}
              </div>
            </div>

            {/* Panel Derecho: Área de Escritura Libre */}
            <div className="md:col-span-2 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3 flex flex-col">
              <div className="flex items-center justify-between border-b border-[#3A2E2B]/10 pb-2">
                <span className="text-xs font-black text-[#3A2E2B] flex items-center gap-1.5">
                  <span>🖋️</span> Espacio de Desahogo & Claridad
                </span>
                <span className="text-[10px] text-[#795548] italic">Sin correcciones ni juicios</span>
              </div>
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="Escribe libremente lo que hoy ocupa tu mente o corazón..."
                rows={9}
                className="w-full flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-4 text-xs text-[#3A2E2B] placeholder-[#9E9087] focus:outline-none focus:border-[#B5838D] font-sans leading-relaxed resize-none"
              />
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
              { val: gratitude1, set: setGratitude1, num: "1", ph: "Una taza de café caliente, una conversación reconfortante..." },
              { val: gratitude2, set: setGratitude2, num: "2", ph: "Un obstáculo superado o algo que hoy salió bien..." },
              { val: gratitude3, set: setGratitude3, num: "3", ph: "Un momento de silencio o descanso reconfortante..." },
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
        </div>
      )}

      {/* =========================================================================
          TAB 3: HISTORIAL DE ENTRADAS
         ========================================================================= */}
      {activeTab === "history" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <h3 className="text-sm font-black text-[#3A2E2B]">Entradas Registradas</h3>
          {journalSessions.length === 0 ? (
            <p className="text-xs text-[#795548] italic py-4">Aún no hay entradas registradas en la cabaña. ¡Toma tu pluma hoy!</p>
          ) : (
            <div className="divide-y divide-[#3A2E2B]/10">
              {journalSessions.map((ses, i) => (
                <div key={ses.id || i} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#3A2E2B]">{ses.details || "Entrada de bitácora"}</span>
                    <span className="block text-[10px] text-[#795548]">
                      {new Date(ses.timestamp || Date.now()).toLocaleDateString("es-CO", { dateStyle: "medium" })}
                    </span>
                  </div>
                  <span className="rounded-full bg-[#B5838D]/15 border border-[#B5838D]/30 px-2 py-0.5 text-[11px] font-black text-[#8E5B65]">
                    +{ses.duration_minutes || 10} min
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </BuildingInteriorShell>
  );
}
