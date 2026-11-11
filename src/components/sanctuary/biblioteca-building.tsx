"use client";

import React, { useState } from "react";
import {
  GraduationCap,
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Brain,
  Timer,
  Layers,
  Award,
  History,
  Plus,
} from "lucide-react";
import type { SpacedRepetitionCard, SkillSessionRecord } from "@/types/rpg";
import { SpacedRepetitionDuelingWidget } from "@/components/rpg-advanced-widgets";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { triggerHaptic } from "@/lib/offline-sync";
import { SmartCaptureWidget } from "@/components/sanctuary/smart-capture-widget";
import { SkillResourceHubPanel } from "@/components/sanctuary/skill-resource-hub-panel";

interface BibliotecaBuildingProps {
  cards: SpacedRepetitionCard[];
  sessions?: SkillSessionRecord[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onReviewCard: (cardId: string, rating: 1 | 2 | 3 | 4) => Promise<void>;
  onAddCard: (prompt: string, reflection: string, source: string) => Promise<void>;
  onClose?: () => void;
}

export function BibliotecaBuilding({
  cards = [],
  sessions = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onReviewCard,
  onAddCard,
  onClose,
}: BibliotecaBuildingProps) {
  const [activeTab, setActiveTab] = useState<"estudio" | "repasos" | "materias" | "historial">("estudio");

  // Parámetros de la sesión de estudio
  const [studySubject, setStudySubject] = useState<string>("Desarrollo & Arquitectura");
  const [studyMethod, setStudyMethod] = useState<
    "Deep Study 50/10" | "Pomodoro 25/5" | "Active Recall" | "Técnica Feynman" | "Resolución de Problemas"
  >("Deep Study 50/10");
  const [studyMinutes, setStudyMinutes] = useState<number>(50);
  const [comprehensionRating, setComprehensionRating] = useState<number>(4);
  const [exercisesCount, setExercisesCount] = useState<number>(0);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Formulario de nueva flashcard
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardPrompt, setNewCardPrompt] = useState("");
  const [newCardReflection, setNewCardReflection] = useState("");
  const [newCardSource, setNewCardSource] = useState("");

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
    isActive,
    formattedTime,
    elapsedMinutes,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    finishSession,
    submitting,
  } = useUniversalSession("study", "biblioteca");

  const studySessions = sessions.filter((s) => s.domain === "study");
  const totalStudyMinutes = studySessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0);

  const handleStartStudy = () => {
    triggerHaptic("light");
    startSession({
      domain: "study",
      buildingId: "biblioteca",
      resourceTitle: studySubject,
      objective: `Bloque de ${studyMethod} en ${studySubject}`,
      initialNotes: sessionNotes,
    });
    setNotification({
      type: "success",
      message: "🎓 ¡Sesión de estudio iniciada! Concentración en atril de estudio.",
    });
  };

  const handleFinishAndSave = async () => {
    triggerHaptic("medium");
    try {
      const minutesToLog = isRunning || isPaused ? elapsedMinutes : studyMinutes;
      const result = await finishSession({
        subject: studySubject,
        study_method: studyMethod,
        duration_minutes: minutesToLog,
        notes: sessionNotes,
        comprehension_rating: comprehensionRating,
        exercises_completed: exercisesCount > 0 ? exercisesCount : undefined,
      });

      if (result) {
        setNotification({
          type: "success",
          message: `✨ ¡Bloque de estudio completado! Se registraron ${minutesToLog}m en "${studySubject}".`,
        });
        setSessionNotes("");
        setExercisesCount(0);
        await onRefreshState();
      }
    } catch (err) {
      console.error("Error al finalizar sesión en Biblioteca:", err);
      setNotification({
        type: "error",
        message: "Ocurrió un error al guardar la sesión de estudio.",
      });
    }
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardPrompt.trim() || !newCardReflection.trim()) return;

    try {
      await onAddCard(newCardPrompt.trim(), newCardReflection.trim(), newCardSource.trim() || studySubject);
      setNotification({
        type: "success",
        message: "🧠 ¡Tarjeta de memoria espaciada forjada en el atril!",
      });
      setIsAddingCard(false);
      setNewCardPrompt("");
      setNewCardReflection("");
      setNewCardSource("");
      await onRefreshState();
    } catch {
      setNotification({
        type: "error",
        message: "No se pudo guardar la tarjeta.",
      });
    }
  };

  return (
    <BuildingInteriorShell
      buildingId="biblioteca"
      buildingName="La Gran Biblioteca del Erudito"
      domain="study"
      districtName="Distrito del Saber"
      icon="🏛️"
      tagline="Atriles de nogal, duelos de memoria espaciada SM-2 y forja de conocimiento duradero."
      playerLevel={playerLevel}
      skillLevel={skillLevel}
      totalGpEarned={totalGpEarned}
      specificMetrics={[
        { label: "Tarjetas SM-2", value: cards.length },
        { label: "Horas de Estudio", value: `${Math.round(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m` },
      ]}
      lastSessionSummary={
        studySubject ? `Continuar estudio de "${studySubject}" (${studyMethod})` : undefined
      }
      continueActionLabel="Iniciar bloque de estudio"
      onContinueLastSession={() => {
        setActiveTab("estudio");
        handleStartStudy();
      }}
      activeTab={activeTab}
      tabs={[
        { id: "estudio", label: "Sesión de Estudio", icon: <GraduationCap className="h-3.5 w-3.5" /> },
        { id: "repasos", label: "Repasos SM-2", icon: <Brain className="h-3.5 w-3.5" />, badge: cards.length },
        { id: "materias", label: "Materias & Temas", icon: <Layers className="h-3.5 w-3.5" /> },
        { id: "historial", label: "Historial de Estudio", icon: <History className="h-3.5 w-3.5" />, badge: studySessions.length },
      ]}
      onTabChange={(tabId) => setActiveTab(tabId as typeof activeTab)}
      onClose={onClose}
    >
      {notification && (
        <div className="mb-4">
          <CozyNotification
            variant={notification.type}
            title={notification.type === "success" ? "¡Éxito!" : "Aviso"}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* =======================================================================
          TAB 1: SESIÓN DE ESTUDIO ACTIVA
         ======================================================================= */}
      {activeTab === "estudio" && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase text-[#795548] tracking-wider block">
                  Atril Principal de Cátedra
                </span>
                <h3 className="text-base font-black text-[#3A2E2B]">
                  Configuración del Bloque de Estudio
                </h3>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#795548] block">
                  Materia o Tema:
                </label>
                <input
                  type="text"
                  value={studySubject}
                  onChange={(e) => setStudySubject(e.target.value)}
                  placeholder="Ej. Algoritmos, Arquitectura Hexagonal, Inglés..."
                  className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-[#795548] block">
                  Método de Aprendizaje:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Deep Study 50/10", "Pomodoro 25/5", "Active Recall", "Técnica Feynman"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setStudyMethod(m)}
                      className={`rounded-xl border-2 p-2 text-left text-xs font-bold transition cursor-pointer ${
                        studyMethod === m
                          ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                          : "border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cronómetro Universal */}
              <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
                  {isRunning ? "⏱️ Sesión de Estudio Activa" : isPaused ? "⏸️ En Pausa" : "🎓 Listo para Estudiar"}
                </span>

                <div className="font-mono text-4xl sm:text-5xl font-black text-[#3A2E2B] tracking-tight">
                  {formattedTime}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {!isActive ? (
                    <CozyButton
                      variant="forest"
                      size="md"
                      onClick={handleStartStudy}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Comenzar Bloque de Estudio
                    </CozyButton>
                  ) : (
                    <>
                      {isRunning ? (
                        <CozyButton
                          variant="clay"
                          size="md"
                          onClick={() => {
                            triggerHaptic("light");
                            pauseSession();
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </CozyButton>
                      ) : (
                        <CozyButton
                          variant="forest"
                          size="md"
                          onClick={() => {
                            triggerHaptic("light");
                            resumeSession();
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Play className="h-4 w-4" />
                          Reanudar
                        </CozyButton>
                      )}

                      <CozyButton
                        variant="sunlight"
                        size="md"
                        disabled={submitting}
                        onClick={handleFinishAndSave}
                        className="flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {submitting ? "Guardando..." : "Finalizar & Registrar"}
                      </CozyButton>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("warning");
                          resetSession();
                        }}
                        className="text-xs font-bold text-red-700 underline hover:text-red-900 cursor-pointer ml-2"
                      >
                        Descartar
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 space-y-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-[#77936A]" />
                Apuntes & Reflexiones del Bloque
              </h4>

              <textarea
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Anota las conclusiones clave, dudas resueltas o conceptos que debas repasar..."
                rows={5}
                className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs font-medium text-[#3A2E2B] placeholder:text-[#795548]/60 outline-none"
              />

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-[#795548] uppercase block">
                  Autoevaluación de Comprensión (1 - 5):
                </label>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setComprehensionRating(star)}
                      className={`flex-1 rounded-xl border-2 py-1 text-xs font-bold transition cursor-pointer ${
                        comprehensionRating >= star
                          ? "border-[#3A2E2B] bg-[#E7D69C] text-[#3A2E2B]"
                          : "border-[#3A2E2B] bg-[#FFFDF8] text-[#795548]"
                      }`}
                    >
                      ★ {star}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contador de Ejercicios Resueltos */}
              <div className="pt-2 border-t border-[#3A2E2B]/15 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-[#795548]">
                  <span>Ejercicios / Problemas Resueltos:</span>
                  <span className="font-mono text-sm font-black text-[#3A2E2B]">
                    {exercisesCount}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExercisesCount((prev) => Math.max(0, prev - 1))}
                    className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] py-1 text-xs font-bold text-[#3A2E2B] hover:bg-[#E7D69C]"
                  >
                    -1
                  </button>
                  <button
                    type="button"
                    onClick={() => setExercisesCount((prev) => prev + 1)}
                    className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#314C3C] py-1 text-xs font-bold text-white hover:bg-[#3E5F4C]"
                  >
                    +1
                  </button>
                  <button
                    type="button"
                    onClick={() => setExercisesCount((prev) => prev + 5)}
                    className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] py-1 text-xs font-bold text-[#3A2E2B] hover:bg-[#F2E3B3]"
                  >
                    +5
                  </button>
                </div>
              </div>
            </div>

            {/* Smart Capture para Estudio */}
            <SmartCaptureWidget
              domain="study"
              context={{
                domain: "study",
                activeStudy: {
                  subject: studySubject,
                  topic: studyMethod,
                  spacedCardsDueCount: cards.length,
                },
              }}
              notes={sessionNotes}
              onNotesChange={setSessionNotes}
              onApplySuggestedValues={(vals) => {
                if (vals.notes) {
                  setSessionNotes((prev) => (prev ? `${prev} • ${vals.notes}` : vals.notes || ""));
                }
              }}
            />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: REPASOS SM-2 (DUELO DE FLASHCARDS)
         ======================================================================= */}
      {activeTab === "repasos" && (
        <div className="space-y-4">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/15 pb-2">
              <div>
                <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                  Duelo Mnemotécnico de Repetición Espaciada SM-2
                </h4>
                <p className="text-xs text-[#795548]">
                  Consolida conceptos a largo plazo sin saturación mediante el algoritmo SuperMemo-2.
                </p>
              </div>
              <span className="rounded-full bg-[#E7D69C] px-3 py-1 text-xs font-black text-[#3A2E2B] border border-[#3A2E2B]">
                {cards.length} Tarjetas en Rotación
              </span>
            </div>

            <SpacedRepetitionDuelingWidget
              cards={cards}
              onReviewCard={onReviewCard}
              onAddCard={onAddCard}
            />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: MATERIAS, CURSOS & NUEVA TARJETA
         ======================================================================= */}
      {activeTab === "materias" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
              Banco de Materias & Fichas Nemotécnicas
            </h4>
            <CozyButton
              variant="forest"
              size="sm"
              onClick={() => setIsAddingCard(!isAddingCard)}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isAddingCard ? "Cerrar" : "Crear Flashcard"}</span>
            </CozyButton>
          </div>

          {isAddingCard && (
            <form onSubmit={handleCreateCard} className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-3">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                Nueva Ficha de Repaso SM-2
              </h4>
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Pregunta o concepto clave *"
                  value={newCardPrompt}
                  onChange={(e) => setNewCardPrompt(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <textarea
                  required
                  placeholder="Respuesta, fórmula o reflexión a recordar *"
                  rows={3}
                  value={newCardReflection}
                  onChange={(e) => setNewCardReflection(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs font-medium text-[#3A2E2B] outline-none"
                />
                <input
                  type="text"
                  placeholder="Materia o Fuente (opcional)"
                  value={newCardSource}
                  onChange={(e) => setNewCardSource(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <CozyButton variant="wood" size="sm" type="button" onClick={() => setIsAddingCard(false)}>
                  Cancelar
                </CozyButton>
                <CozyButton variant="forest" size="sm" type="submit">
                  Forjar Tarjeta ➜
                </CozyButton>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.slice(0, 6).map((c) => (
              <div key={c.id} className="rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_3px_0_#3A2E2B] space-y-2">
                <span className="text-[10px] font-black uppercase text-[#77936A] tracking-wider block">
                  {c.source_title || "Materia General"}
                </span>
                <h4 className="text-xs font-black text-[#3A2E2B]">
                  {c.front_prompt}
                </h4>
                <p className="text-[11px] text-[#795548] line-clamp-2 italic">
                  {c.back_reflection}
                </p>
                <div className="flex justify-between items-center text-[9px] font-bold text-[#795548] border-t border-[#3A2E2B]/15 pt-1.5">
                  <span>Factor Facilidad: {c.ease_factor.toFixed(2)}</span>
                  <span>Intervalo: {c.interval_days} días</span>
                </div>
              </div>
            ))}
          </div>

          {/* BÓVEDA DE RECURSOS, GUÍAS & PAPERS DE ESTUDIO */}
          <div className="pt-4 border-t-2 border-[#D8B48A]/40">
            <SkillResourceHubPanel domain="study" />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: HISTORIAL DE SESIONES DE ESTUDIO
         ======================================================================= */}
      {activeTab === "historial" && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
            Historial de Sesiones en La Gran Biblioteca
          </h4>

          {studySessions.length === 0 ? (
            <div className="text-center py-8 text-xs text-[#795548]">
              Aún no has registrado sesiones de estudio. ¡Inicia un bloque de cátedra!
            </div>
          ) : (
            <div className="divide-y divide-[#3A2E2B]/15">
              {studySessions.map((ses) => (
                <div key={ses.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-black text-[#3A2E2B] block">
                      {ses.title}
                    </span>
                    <span className="text-[10px] text-[#795548]">
                      {ses.details} • {new Date(ses.timestamp).toLocaleDateString("es-CO")}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-[#314C3C]">
                      +{ses.gp_earned} GP
                    </span>
                    <span className="text-[10px] text-[#795548] block">
                      {ses.duration_minutes} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </BuildingInteriorShell>
  );
}
