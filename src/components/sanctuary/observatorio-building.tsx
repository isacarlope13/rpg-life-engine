"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Compass,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Eye,
  Flame,
  Volume2,
  VolumeX,
  Target,
  Clock,
  Award,
} from "lucide-react";
import type { SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";

interface ObservatorioBuildingProps {
  sessions?: SkillSessionRecord[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => void | Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
}

export function ObservatorioBuilding({
  sessions = [],
  playerLevel = 1,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = false,
  onRefreshState,
  onSubmitDirectSkillSession,
}: ObservatorioBuildingProps) {
  // Enfoque / preset
  const [focusMode, setFocusMode] = useState<"pomodoro" | "deep" | "flow">("pomodoro");
  const [targetGoal, setTargetGoal] = useState<string>("Arquitectura & Resolución de Bloqueos");
  const [distractions, setDistractions] = useState<string[]>([]);
  const [distractionInput, setDistractionInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ambientAudioActive, setAmbientAudioActive] = useState(false);

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
    isActive,
    elapsedMinutes,
    formattedTime,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    finishSession,
    updateNotes,
  } = useUniversalSession("general", "observatorio");

  const focusPresets = [
    { id: "pomodoro", name: "Pomodoro Clásico", time: "25 min", xp: 80, gp: 2500 },
    { id: "deep", name: "Deep Work Sprint", time: "50 min", xp: 160, gp: 5000 },
    { id: "flow", name: "Flow State Cósmico", time: "90 min", xp: 300, gp: 9000 },
  ];

  const handleAddDistraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!distractionInput.trim()) return;
    setDistractions((prev) => [...prev, distractionInput.trim()]);
    setDistractionInput("");
  };

  const handleFinishFocusSession = async () => {
    setIsSubmitting(true);
    try {
      await finishSession({
        domain: "general",
        action_type: "deep_work_focus",
        details: `Enfoque en Observatorio: ${targetGoal}${
          distractions.length > 0 ? ` (Distracciones repelidas: ${distractions.length})` : ""
        }`,
        focus_mode: focusMode,
        target_goal: targetGoal,
        distractions_logged: distractions,
      });
      await onRefreshState();
      setDistractions([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const recentFocusSessions = sessions.filter(
    (s) =>
      s.domain === "general" ||
      s.details?.toLowerCase().includes("enfoque") ||
      s.details?.toLowerCase().includes("focus")
  );

  return (
    <div
      className={`space-y-6 transition-all duration-300 ${
        isCozyActive
          ? "rounded-3xl border border-[#5C4033]/40 bg-[#19161e]/90 p-6 shadow-md text-purple-100"
          : "text-slate-100"
      }`}
    >
      {/* CABECERA OBSERVATORIO */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-xl ${
          isCozyActive
            ? "border-purple-900/40 bg-[#241c2c]/90"
            : "border-purple-500/30 bg-slate-900/90"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/20 border border-purple-500/40 text-purple-300 text-2xl shadow-inner">
            🔭
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white">
                El Observatorio Cósmico: Deep Work & Enfoque
              </h2>
              <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2.5 py-0.5 text-[10px] font-bold text-purple-300">
                Santuario de Concentración • Grado {skillLevel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Cero distracciones, pulsos circadianos de máxima concentración y forja de resultados profundos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Total Ganado</span>
            <p className="font-mono text-xs font-black text-purple-300">
              +{totalGpEarned.toLocaleString("es-CO")} GP
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Sesiones Foco</span>
            <p className="font-mono text-xs font-black text-emerald-300">
              {recentFocusSessions.length}
            </p>
          </div>
        </div>
      </div>

      {/* CUERPO PRINCIPAL DEL OBSERVATORIO */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* TEMPORIZADOR Y CONTROL DE SESIÓN */}
        <div className="space-y-5 rounded-2xl border border-purple-500/30 bg-slate-950/90 p-6 lg:col-span-7 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <h3 className="text-base font-bold text-white">Cámara de Silencio & Enfoque</h3>
            </div>

            {/* Selector de Modos de Enfoque */}
            <div className="flex flex-wrap gap-1.5">
              {focusPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setFocusMode(preset.id as "pomodoro" | "deep" | "flow")}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold cursor-pointer transition ${
                    focusMode === preset.id
                      ? "border border-purple-500 bg-purple-600/30 text-purple-200 shadow-md shadow-purple-600/20"
                      : "border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                  }`}
                >
                  {preset.name} ({preset.time})
                </button>
              ))}
            </div>
          </div>

          {/* TEMPORIZADOR EN VIVO */}
          <div className="flex flex-col items-center justify-center rounded-2xl border border-purple-500/20 bg-gradient-to-b from-purple-950/30 via-slate-950 to-slate-950 py-8 text-center">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-300 uppercase tracking-widest">
              <Flame className="h-4 w-4 text-purple-400 animate-pulse" />
              {isRunning
                ? "● Modo Deep Work Activo — Cero Distracciones"
                : isPaused
                ? "⏸ Enfoque en Pausa"
                : "Listo para Iniciar Bloque de Foco"}
            </div>

            <span className="mt-3 font-mono text-6xl font-black tracking-tight text-white sm:text-7xl">
              {formattedTime}
            </span>

            <p className="mt-2 text-xs text-slate-400">
              {isRunning
                ? `${elapsedMinutes} minutos de concentración acumulados`
                : "Entra en la zona y silencia cualquier notificación externa."}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {!isActive ? (
                <button
                  type="button"
                  onClick={() => startSession({ notes: targetGoal })}
                  className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-purple-600/40 hover:bg-purple-500 cursor-pointer"
                >
                  <Play className="h-4 w-4" /> Comenzar Sesión de Enfoque
                </button>
              ) : (
                <>
                  {isPaused ? (
                    <button
                      type="button"
                      onClick={resumeSession}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 cursor-pointer"
                    >
                      <Play className="h-4 w-4" /> Reanudar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={pauseSession}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-500 cursor-pointer"
                    >
                      <Pause className="h-4 w-4" /> Pausar
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleFinishFocusSession}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-5 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-purple-500/20 hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    <Square className="h-4 w-4" /> Finalizar y Reclamar Recompensas
                  </button>

                  <button
                    type="button"
                    onClick={resetSession}
                    className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reset
                  </button>
                </>
              )}
            </div>
          </div>

          {/* OBJETIVO DE LA SESIÓN */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Target className="h-4 w-4 text-purple-400" />
              Objetivo Crítico de este Bloque:
            </label>
            <input
              type="text"
              value={targetGoal}
              onChange={(e) => setTargetGoal(e.target.value)}
              placeholder="¿Qué único resultado tangible vas a completar en este bloque?"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-white"
            />
          </div>

          {/* NOTAS DE SESIÓN */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">
              Bitácora & Resultados del Bloque:
            </label>
            <textarea
              rows={3}
              value={session?.notes || ""}
              onChange={(e) => updateNotes(e.target.value)}
              placeholder="Anota descubrimientos, avances de código o arquitectura alcanzados..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white"
            />
          </div>
        </div>

        {/* ESCUDO DE DISTRACCIONES & MÉTRICAS */}
        <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
          {/* CONTROL DE DISTRACCIONES (PARKING LOT) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-rose-400" />
                Escudo Antipensamientos / Distracciones
              </h4>
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                {distractions.length} repelidas
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Si te surge una idea, mensaje o tarea pendiente que no sea tu objetivo actual, anótala aquí inmediatamente y vuelve a tu foco.
            </p>

            <form onSubmit={handleAddDistraction} className="flex gap-2">
              <input
                type="text"
                value={distractionInput}
                onChange={(e) => setDistractionInput(e.target.value)}
                placeholder="Anota la distracción para atender después..."
                className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white"
              />
              <button
                type="submit"
                className="rounded-lg bg-rose-600/30 border border-rose-500/40 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-600/50 cursor-pointer"
              >
                Parquear
              </button>
            </form>

            <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
              {distractions.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">Mente despejada sin distracciones.</p>
              ) : (
                distractions.map((d, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300"
                  >
                    <span>🛡️ {d}</span>
                    <button
                      type="button"
                      onClick={() => setDistractions((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-[10px] text-slate-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* HISTORIAL RECIENTE DE FOCO */}
          <div className="space-y-2.5 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold text-slate-300">Historial de Sesiones de Concentración</h4>
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {recentFocusSessions.length === 0 ? (
                <p className="text-xs text-slate-500">Sin sesiones registradas aún en el Observatorio.</p>
              ) : (
                recentFocusSessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-2.5 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-white">{s.details || "Sesión de Enfoque"}</p>
                      <span className="text-[10px] text-slate-400 font-mono">
                        ⏱️ {s.duration_minutes || 25} min • {s.timestamp?.slice(0, 10)}
                      </span>
                    </div>
                    <span className="font-mono font-bold text-purple-300">
                      +{s.gp_earned.toLocaleString("es-CO")} GP
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
