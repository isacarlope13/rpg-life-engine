"use client";

import React, { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import type { SpacedRepetitionCard, SkillSessionRecord } from "@/types/rpg";
import { SpacedRepetitionDuelingWidget } from "@/components/rpg-advanced-widgets";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";

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
}: BibliotecaBuildingProps) {
  // Parámetros de la sesión de estudio
  const [studySubject, setStudySubject] = useState<string>("Desarrollo & Arquitectura");
  const [studyMethod, setStudyMethod] = useState<
    "Deep Study 50/10" | "Pomodoro 25/5" | "Active Recall" | "Técnica Feynman" | "Resolución de Problemas"
  >("Deep Study 50/10");
  const [studyMinutes, setStudyMinutes] = useState<number>(50);
  const [comprehensionRating, setComprehensionRating] = useState<number>(4);
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
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
    startSession({
      domain: "study",
      buildingId: "biblioteca",
      resourceTitle: studySubject,
      objective: `Bloque de ${studyMethod} en ${studySubject}`,
      initialNotes: sessionNotes,
    });
    setActionSuccessMsg("🎓 ¡Sesión de estudio iniciada en La Biblioteca!");
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleFinishAndSave = async () => {
    try {
      const minutesToLog = isRunning || isPaused ? elapsedMinutes : studyMinutes;
      const result = await finishSession({
        subject: studySubject,
        study_method: studyMethod,
        duration_minutes: minutesToLog,
        notes: sessionNotes,
        comprehension_rating: comprehensionRating,
      });

      if (result) {
        setActionSuccessMsg(
          `✨ ¡Bloque de estudio completado! Se registraron ${minutesToLog}m en "${studySubject}".`
        );
        setSessionNotes("");
        await onRefreshState();
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Error al finalizar sesión en Biblioteca:", err);
      setActionSuccessMsg("⚠️ Ocurrió un error al guardar la sesión.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. NAVEGACIÓN SUPERIOR: RETORNO AL PUEBLO */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4A3C31]/40 pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#4A3C31]/50 bg-[#25201C] px-3.5 py-2 text-xs font-bold text-[#EAE4D9] hover:border-[#88A98E]/60 hover:bg-[#2C2420] transition"
        >
          <ArrowLeft className="h-4 w-4 text-[#88A98E]" />
          <span>Volver al Pueblo del Santuario</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#A78BFA]/20 border border-[#A78BFA]/30 px-2.5 py-1 text-xs font-bold text-[#DDD6FE]">
            NVL {skillLevel} Estudio
          </span>
          <span className="rounded-lg bg-[#E9C46A]/15 border border-[#E9C46A]/30 px-2.5 py-1 text-xs font-bold text-[#E9C46A]">
            🪙 {totalGpEarned.toLocaleString("es-CO")} GP Liberados
          </span>
          <span className="rounded-lg bg-[#2E2822] border border-[#4A3C31]/50 px-2.5 py-1 text-xs font-mono font-bold text-[#D8E6DA]">
            ⏱️ {Math.round(totalStudyMinutes / 60)}h {totalStudyMinutes % 60}m acumulados
          </span>
        </div>
      </div>

      {/* 2. CABECERA ATMOSFÉRICA: LA BIBLIOTECA */}
      <div className="rounded-2xl border border-[#453A5A]/60 bg-gradient-to-r from-[#201D28] via-[#2A2337] to-[#201D28] p-6 shadow-md text-[#EAE4D9]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#362D45] text-3xl ring-2 ring-[#A78BFA]/40 shadow-inner">
              🎓
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#F4EFE6] tracking-tight">
                  La Biblioteca del Erudito
                </h1>
                <span className="rounded-md bg-[#A78BFA]/20 px-2 py-0.5 text-[11px] font-bold text-[#DDD6FE]">
                  Estudio Profundo & Memoria
                </span>
              </div>
              <p className="mt-1 text-xs text-[#C9BEAE] max-w-2xl leading-relaxed">
                Mesas de nogal bajo lámparas verdes de banquero. Diseñada para la asimilación conceptual rigurosa, duelos de memoria SM-2 y preparación sin distracciones.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#453A5A]/50 bg-[#16131D]/70 p-3 text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#A69B8D] tracking-wider block">
              Tarjetas Mnemotécnicas
            </span>
            <span className="font-mono text-lg font-black text-[#A78BFA]">
              {cards.length} Flashcards SM-2
            </span>
            <span className="block text-[10px] text-[#88A98E] font-medium">
              Repetición espaciada activa
            </span>
          </div>
        </div>
      </div>

      {/* BANNER DE NOTIFICACIÓN ESTANDARIZADO */}
      {actionSuccessMsg && (
        <CozyNotification
          variant={actionSuccessMsg.includes("⚠️") ? "warning" : "success"}
          message={actionSuccessMsg}
          onDismiss={() => setActionSuccessMsg(null)}
        />
      )}

      {/* 3. WIDGET DE DUELO DE REPETICIÓN ESPACIADA SM-2 */}
      <div className="rounded-2xl border border-[#4A3C31]/50 bg-[#221F1C]/80 p-5 shadow-md">
        <div className="flex items-center justify-between mb-3 border-b border-[#4A3C31]/40 pb-2.5">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-[#A78BFA]" />
            <h2 className="text-sm font-bold text-[#EAE4D9]">
              Duelo de Memoria & Repetición Espaciada SM-2
            </h2>
          </div>
          <span className="text-[11px] text-[#A69B8D]">
            Algoritmo SuperMemo 2
          </span>
        </div>

        <SpacedRepetitionDuelingWidget
          cards={cards}
          onReviewCard={onReviewCard}
          onAddCard={onAddCard}
        />
      </div>

      {/* 4. LAYOUT CENTRAL: BANCO DE ESTUDIO & BITÁCORA */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* PANEL IZQUIERDO: CONFIGURACIÓN DE SESIÓN & CRONÓMETRO (6 COLUMNAS) */}
        <div className="space-y-4 rounded-2xl border border-[#4A3C31]/50 bg-[#221F1C]/85 p-5 shadow-md lg:col-span-6 text-[#EAE4D9]">
          <div className="flex items-center justify-between border-b border-[#4A3C31]/40 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#A78BFA]" />
              <h2 className="text-sm font-bold text-[#EAE4D9]">
                Mesa de Estudio Profundo
              </h2>
            </div>
            <span className="text-[11px] text-[#A69B8D]">
              Motor Universal
            </span>
          </div>

          {/* CRONÓMETRO DE ESTUDIO */}
          <div className="rounded-xl border border-[#453A5A]/50 bg-[#17141E] p-4 text-center">
            <span className="text-[10px] uppercase font-bold text-[#A69B8D] tracking-wider block">
              {isRunning
                ? "● Bloque de Estudio en Curso"
                : isPaused
                ? "⏸ Estudio en Pausa"
                : "Listo para Iniciar"}
            </span>
            <div className="mt-1 font-mono text-3xl font-black text-[#F4EFE6] tracking-tight">
              {formattedTime}
            </div>
            <p className="mt-1 text-[11px] text-[#A69B8D] truncate">
              {studySubject} · {studyMethod}
            </p>

            {/* CONTROLES */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              {!isRunning && !isPaused ? (
                <CozyButton
                  variant="lake"
                  size="sm"
                  icon={<Play className="h-4 w-4 fill-current" />}
                  onClick={handleStartStudy}
                >
                  Iniciar Bloque de Estudio
                </CozyButton>
              ) : (
                <>
                  {isPaused ? (
                    <CozyButton
                      variant="sage"
                      size="sm"
                      icon={<Play className="h-3.5 w-3.5 fill-current" />}
                      onClick={resumeSession}
                    >
                      Reanudar
                    </CozyButton>
                  ) : (
                    <CozyButton
                      variant="sunlight"
                      size="sm"
                      icon={<Pause className="h-3.5 w-3.5" />}
                      onClick={pauseSession}
                    >
                      Pausar
                    </CozyButton>
                  )}

                  <CozyButton
                    variant="lake"
                    size="sm"
                    disabled={submitting}
                    icon={<Square className="h-3.5 w-3.5 fill-current" />}
                    onClick={handleFinishAndSave}
                  >
                    Concluir ({elapsedMinutes}m)
                  </CozyButton>

                  <CozyButton
                    variant="wood"
                    size="sm"
                    icon={<RotateCcw className="h-3 w-3" />}
                    onClick={resetSession}
                    aria-label="Reiniciar cronómetro"
                  />
                </>
              )}
            </div>
          </div>

          {/* MATERIA & MÉTODO */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] text-[#A69B8D] block mb-1">
                Materia / Tema:
              </label>
              <input
                type="text"
                value={studySubject}
                onChange={(e) => setStudySubject(e.target.value)}
                placeholder="Ej. Algoritmos, Finanzas, Neurociencia..."
                className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-3 py-2 text-xs text-[#EAE4D9] focus:border-[#A78BFA] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[#A69B8D] block mb-1">
                  Método de Enfoque:
                </label>
                <select
                  value={studyMethod}
                  onChange={(e) => setStudyMethod(e.target.value as typeof studyMethod)}
                  className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-2.5 py-2 text-xs text-[#EAE4D9] focus:border-[#A78BFA] focus:outline-none"
                >
                  <option value="Deep Study 50/10">Deep Study 50/10</option>
                  <option value="Pomodoro 25/5">Pomodoro 25/5</option>
                  <option value="Active Recall">Active Recall</option>
                  <option value="Técnica Feynman">Técnica Feynman</option>
                  <option value="Resolución de Problemas">Resolución de Problemas</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-[#A69B8D] block mb-1">
                  Meta Duración (minutos):
                </label>
                <input
                  type="number"
                  min="10"
                  max="180"
                  value={studyMinutes}
                  onChange={(e) => setStudyMinutes(Number(e.target.value))}
                  className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-3 py-2 text-xs text-[#EAE4D9] focus:border-[#A78BFA] focus:outline-none"
                />
              </div>
            </div>

            {/* PRESETS RÁPIDOS DE MINUTOS */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[25, 50, 75, 90].map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setStudyMinutes(mins)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    studyMinutes === mins
                      ? "bg-[#A78BFA] text-[#1E1B18] shadow"
                      : "bg-[#25201C] text-[#A69B8D] hover:bg-[#2C2420]"
                  }`}
                >
                  {mins} min
                </button>
              ))}
            </div>

            {/* APUNTES & NOTAS CONCEPTUALES */}
            <div>
              <label className="text-[11px] text-[#A69B8D] block mb-1">
                Apuntes Clave / Resumen de Sesión:
              </label>
              <textarea
                rows={2}
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Conceptos asimilados, dudas o fórmulas clave..."
                className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] p-2.5 text-xs text-[#EAE4D9] placeholder-[#7D7366] focus:border-[#A78BFA] focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* BOTÓN REGISTRAR BLOQUE */}
          <div className="pt-2 border-t border-[#4A3C31]/30">
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinishAndSave}
              className="w-full rounded-xl bg-[#2D2621] border border-[#A78BFA]/40 py-2.5 text-xs font-bold text-[#DDD6FE] hover:bg-[#382F2A] hover:border-[#A78BFA] transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              <Award className="h-4 w-4 text-[#E9C46A]" />
              <span>Registrar Bloque de Estudio ({studyMinutes}m)</span>
            </button>
          </div>
        </div>

        {/* PANEL DERECHO: HISTORIAL & BITÁCORA DE APRENDIZAJE (6 COLUMNAS) */}
        <div className="space-y-4 rounded-2xl border border-[#4A3C31]/50 bg-[#221F1C]/85 p-5 shadow-md lg:col-span-6 text-[#EAE4D9]">
          <div className="flex items-center justify-between border-b border-[#4A3C31]/40 pb-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#88A98E]" />
              <h2 className="text-sm font-bold text-[#EAE4D9]">
                Bitácora de Sesiones de la Biblioteca
              </h2>
            </div>
            <span className="text-[10px] text-[#A69B8D] font-mono">
              {studySessions.length} registros
            </span>
          </div>

          {studySessions.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#A69B8D]">
              <BookOpen className="h-8 w-8 text-[#A69B8D]/40 mx-auto mb-2" />
              <p>Aún no has registrado bloques de estudio en La Biblioteca.</p>
              <p className="text-[10px] text-[#7D7366] mt-0.5">
                Inicia un cronómetro para acumular minutos y forjar maestría.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {studySessions.map((sess) => (
                <div
                  key={sess.id}
                  className="rounded-xl border border-[#4A3C31]/40 bg-[#1A1715] p-3 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded bg-[#A78BFA]/20 px-1.5 py-0.2 text-[9px] font-bold text-[#DDD6FE]">
                        {sess.duration_minutes}m
                      </span>
                      <strong className="text-[#F4EFE6]">{sess.title}</strong>
                    </div>
                    {sess.details && (
                      <p className="text-[11px] text-[#A69B8D] mt-0.5 line-clamp-1">
                        {sess.details}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-[#E9C46A] shrink-0 ml-2">
                    +{sess.gp_earned.toLocaleString("es-CO")} GP
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
