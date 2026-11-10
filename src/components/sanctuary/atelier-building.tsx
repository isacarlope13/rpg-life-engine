"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Scissors,
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Award,
} from "lucide-react";
import type { KnittingProject } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyProgress, CozyNotification } from "@/components/cozy/ui";

interface AtelierBuildingProps {
  projects: KnittingProject[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
}

export function AtelierBuilding({
  projects = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
}: AtelierBuildingProps) {
  // Proyecto seleccionado
  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    return projects[0]?.id || "";
  });

  // Contador de vueltas de la sesión actual
  const [sessionRows, setSessionRows] = useState<number>(0);
  const [stitchesNotes, setStitchesNotes] = useState<string>("");
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Formulario de nuevo proyecto
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectTech, setNewProjectTech] = useState<"Crochet" | "Dos Agujas" | "Amigurumi" | "Telar">("Crochet");
  const [newProjectTargetRows, setNewProjectTargetRows] = useState(60);
  const [newProjectYarn, setNewProjectYarn] = useState("");

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
  } = useUniversalSession("knitting", "atelier");

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const handleStartSession = () => {
    startSession({
      domain: "knitting",
      buildingId: "atelier",
      resourceId: activeProject?.id,
      resourceTitle: activeProject?.name || "Sesión de Tejido",
      objective: `Avanzar ${sessionRows > 0 ? sessionRows : 5} vueltas en ${activeProject?.name || "proyecto"}`,
      initialNotes: stitchesNotes,
    });
    setActionSuccessMsg("🧶 ¡Sesión de tejido iniciada en el Atelier!");
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleIncrementRows = (delta: number) => {
    setSessionRows((prev) => Math.max(0, prev + delta));
  };

  const handleFinishAndSave = async () => {
    try {
      const result = await finishSession({
        project_id: activeProject?.id,
        rows_completed: sessionRows > 0 ? sessionRows : 1,
        stitches_notes: stitchesNotes,
      });

      if (result) {
        setActionSuccessMsg(
          `✨ ¡Sesión completada con éxito! Has registrado ${sessionRows > 0 ? sessionRows : 1} vueltas.`
        );
        setSessionRows(0);
        setStitchesNotes("");
        await onRefreshState();
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Error al finalizar sesión en Atelier:", err);
      setActionSuccessMsg("⚠️ Ocurrió un error al guardar la sesión.");
    }
  };

  const handleCreateNewProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    try {
      await onSubmitDirectSkillSession({
        action: "add_knitting_project",
        knitting_name: newProjectName.trim(),
        knitting_technique: newProjectTech,
        knitting_total_rows: Number(newProjectTargetRows) || 50,
        knitting_yarn_details: newProjectYarn.trim() || "Lana / Hilado estándar",
      });

      setActionSuccessMsg(`🧵 ¡Proyecto "${newProjectName}" forjado con éxito!`);
      setIsCreatingProject(false);
      setNewProjectName("");
      setNewProjectYarn("");
      await onRefreshState();
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch {
      setActionSuccessMsg("⚠️ No se pudo crear el proyecto.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. NAVEGACIÓN SUPERIOR: RETORNO AL PUEBLO & ESTADO */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4A3C31]/40 pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#4A3C31]/50 bg-[#25201C] px-3.5 py-2 text-xs font-bold text-[#EAE4D9] hover:border-[#88A98E]/60 hover:bg-[#2C2420] transition"
        >
          <ArrowLeft className="h-4 w-4 text-[#88A98E]" />
          <span>Volver al Pueblo del Santuario</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#88A98E]/15 border border-[#88A98E]/30 px-2.5 py-1 text-xs font-bold text-[#D8E6DA]">
            NVL {skillLevel} Artesanía
          </span>
          <span className="rounded-lg bg-[#E9C46A]/15 border border-[#E9C46A]/30 px-2.5 py-1 text-xs font-bold text-[#E9C46A]">
            🪙 {totalGpEarned.toLocaleString("es-CO")} GP Liberados
          </span>
          {isCozyActive && (
            <span className="rounded-lg bg-[#88A98E]/20 px-2.5 py-1 text-xs font-bold text-[#D8E6DA] flex items-center gap-1">
              <span>🛡️</span> Buff de Gracia Activo
            </span>
          )}
        </div>
      </div>

      {/* 2. CABECERA ATMOSFÉRICA DEL EDIFICIO */}
      <div className="rounded-2xl border border-[#4A3C31]/50 bg-gradient-to-r from-[#241F1C] via-[#2D2621] to-[#241F1C] p-6 shadow-md text-[#EAE4D9]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#3D332B] text-3xl ring-2 ring-[#88A98E]/40 shadow-inner">
              🧶
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#F4EFE6] tracking-tight">
                  El Atelier de Hilados
                </h1>
                <span className="rounded-md bg-[#88A98E]/20 px-2 py-0.5 text-[11px] font-bold text-[#D8E6DA]">
                  Taller de Artesanía
                </span>
              </div>
              <p className="mt-1 text-xs text-[#C9BEAE] max-w-2xl leading-relaxed">
                Rincón acogedor entre madejas de lana virgen, agujas de bambú y luz de tarde. Aquí el tiempo se mide en vueltas concluidas y piezas forjadas con calma.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#4A3C31]/40 bg-[#1A1715]/70 p-3 text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#A69B8D] tracking-wider block">
              Bono por Proyecto Completado
            </span>
            <span className="font-mono text-lg font-black text-[#E9C46A]">
              +6.000 GP
            </span>
            <span className="block text-[10px] text-[#88A98E] font-medium">
              Directos de tu Bóveda
            </span>
          </div>
        </div>
      </div>

      {/* BANNER DE ÉXITO ESTANDARIZADO */}
      {actionSuccessMsg && (
        <CozyNotification
          variant="success"
          message={actionSuccessMsg}
          onDismiss={() => setActionSuccessMsg(null)}
        />
      )}

      {/* 3. GRID CENTRAL DEL ATELIER: PROYECTOS & ÁREA DE TRABAJO */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* PANEL IZQUIERDO: PROYECTOS ACTIVOS (7 COLUMNAS) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-[#88A98E]" />
              <h2 className="text-sm font-bold text-[#EAE4D9]">
                Proyectos en Telar & Agujas ({projects.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatingProject((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#4A3C31]/60 bg-[#2A231E] px-2.5 py-1 text-xs font-semibold text-[#D8E6DA] hover:border-[#88A98E]/60 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-[#88A98E]" />
              <span>Nuevo Proyecto</span>
            </button>
          </div>

          {/* FORMULARIO DESPLEGABLE DE NUEVO PROYECTO */}
          {isCreatingProject && (
            <form
              onSubmit={handleCreateNewProject}
              className="rounded-xl border border-[#88A98E]/40 bg-[#25201C] p-4 space-y-3 animate-in fade-in duration-200"
            >
              <h3 className="text-xs font-bold text-[#D8E6DA] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#E9C46A]" />
                Urdir Nuevo Proyecto Artesanal
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">
                    Nombre de la pieza:
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Ej. Bufanda Nórdica Mostaza"
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#1A1715] px-2.5 py-1.5 text-xs text-[#EAE4D9] placeholder-[#7D7366] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">
                    Técnica:
                  </label>
                  <select
                    value={newProjectTech}
                    onChange={(e) => setNewProjectTech(e.target.value as typeof newProjectTech)}
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#1A1715] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
                  >
                    <option value="Crochet">Crochet / Ganchillo</option>
                    <option value="Dos Agujas">Dos Agujas / Tricot</option>
                    <option value="Amigurumi">Amigurumi Escultórico</option>
                    <option value="Telar">Telar Manual</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">
                    Meta total de filas/vueltas:
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="1000"
                    required
                    value={newProjectTargetRows}
                    onChange={(e) => setNewProjectTargetRows(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#1A1715] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">
                    Hilado / Gancho:
                  </label>
                  <input
                    type="text"
                    value={newProjectYarn}
                    onChange={(e) => setNewProjectYarn(e.target.value)}
                    placeholder="Ej. Lana Merino 100g, Gancho 4.5mm"
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#1A1715] px-2.5 py-1.5 text-xs text-[#EAE4D9] placeholder-[#7D7366] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreatingProject(false)}
                  className="rounded-lg border border-[#4A3C31] px-3 py-1.5 text-xs text-[#A69B8D] hover:text-[#EAE4D9]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#88A98E] px-4 py-1.5 text-xs font-bold text-[#1E1B18] hover:bg-[#97B89D] shadow"
                >
                  Guardar en el Atelier
                </button>
              </div>
            </form>
          )}

          {/* LISTADO DE PROYECTOS ACTIVOS */}
          <div className="grid grid-cols-1 gap-3">
            {projects.map((proj) => {
              const pct = Math.min(
                100,
                Math.round((proj.completed_rows / Math.max(1, proj.total_rows_target)) * 100)
              );
              const isSelected = (activeProject?.id === proj.id);

              return (
                <div
                  key={proj.id}
                  onClick={() => setSelectedProjectId(proj.id)}
                  className={`rounded-xl border p-4 transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#88A98E]/70 bg-[#28221D] shadow-md ring-1 ring-[#88A98E]/30"
                      : "border-[#4A3C31]/40 bg-[#1F1B18]/70 hover:border-[#4A3C31] hover:bg-[#231F1C]"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#88A98E]/20 px-2 py-0.5 text-[10px] font-bold text-[#D8E6DA]">
                          {proj.technique}
                        </span>
                        {isSelected && (
                          <span className="rounded bg-[#E9C46A]/20 px-1.5 py-0.2 text-[9px] font-bold text-[#E9C46A]">
                            ● En el Bastidor
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 text-sm font-bold text-[#F4EFE6]">
                        {proj.name}
                      </h3>
                      <p className="text-[11px] text-[#A69B8D]">
                        {proj.yarn_details || "Materiales artesanales"}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <span className="font-mono text-xs font-bold text-[#E9C46A]">
                        {proj.completed_rows} / {proj.total_rows_target} vueltas ({pct}%)
                      </span>
                      <div className="mt-2 flex items-center gap-1.5 sm:justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProjectId(proj.id);
                            handleIncrementRows(5);
                          }}
                          className="rounded bg-[#88A98E]/20 px-2.5 py-1 text-[11px] font-semibold text-[#D8E6DA] hover:bg-[#88A98E]/30 cursor-pointer"
                          title="Avanzar 5 vueltas a la sesión"
                        >
                          +5 Vueltas
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Barra de progreso de la pieza */}
                  <div className="mt-3">
                    <CozyProgress
                      value={pct}
                      variant="sage"
                      size="sm"
                      showPercentage={false}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: BANCO DE TRABAJO & MOTOR DE SESIÓN (5 COLUMNAS) */}
        <div className="space-y-4 rounded-2xl border border-[#4A3C31]/50 bg-[#221F1C]/85 p-5 shadow-md lg:col-span-5 text-[#EAE4D9]">
          <div className="flex items-center justify-between border-b border-[#4A3C31]/40 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#88A98E]" />
              <h2 className="text-sm font-bold text-[#EAE4D9]">
                Banco de Trabajo & Sesión
              </h2>
            </div>
            <span className="text-[11px] text-[#A69B8D]">
              Motor Universal
            </span>
          </div>

          {/* CRONÓMETRO DE SESIÓN INTEGRADO */}
          <div className="rounded-xl border border-[#4A3C31]/50 bg-[#1A1715] p-4 text-center">
            <span className="text-[10px] uppercase font-bold text-[#A69B8D] tracking-wider block">
              {isRunning
                ? "● Sesión de Tejido en Curso"
                : isPaused
                ? "⏸ Sesión en Pausa"
                : "Listo para Iniciar"}
            </span>
            <div className="mt-1 font-mono text-3xl font-black text-[#F4EFE6] tracking-tight">
              {formattedTime}
            </div>
            <p className="mt-1 text-[11px] text-[#A69B8D]">
              {activeProject ? activeProject.name : "Selecciona un proyecto a la izquierda"}
            </p>

            {/* CONTROLES DE LA SESIÓN */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              {!isRunning && !isPaused ? (
                <CozyButton
                  variant="sage"
                  size="sm"
                  icon={<Play className="h-4 w-4 fill-current" />}
                  onClick={handleStartSession}
                >
                  Iniciar Sesión de Tejido
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
                    variant="forest"
                    size="sm"
                    disabled={submitting}
                    icon={<Square className="h-3.5 w-3.5 fill-current" />}
                    onClick={handleFinishAndSave}
                  >
                    Finalizar ({elapsedMinutes}m)
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

          {/* CONTADOR TÁCTIL DE VUELTAS (ROW COUNTER) */}
          <div className="rounded-xl border border-[#4A3C31]/40 bg-[#1C1816] p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#D8E6DA] flex items-center gap-1">
                <span>🔢</span> Contador Táctil de Vueltas
              </span>
              <span className="text-[10px] text-[#A69B8D]">
                Vueltas añadidas hoy: <strong>+{sessionRows}</strong>
              </span>
            </div>

            <div className="flex items-center justify-center gap-3 my-3">
              <button
                type="button"
                onClick={() => handleIncrementRows(-1)}
                className="h-10 w-10 rounded-xl border border-[#4A3C31] bg-[#25201C] text-sm font-bold text-[#D8E6DA] hover:bg-[#2F2723] active:scale-95 transition cursor-pointer"
                title="Descontar 1 vuelta"
              >
                -1
              </button>
              <div className="px-5 py-2 rounded-xl bg-[#151210] border border-[#4A3C31]/50 text-center min-w-[100px]">
                <span className="text-[10px] uppercase font-bold text-[#A69B8D] block">
                  Filas Sesión
                </span>
                <span className="font-mono text-2xl font-black text-[#E9C46A]">
                  +{sessionRows}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleIncrementRows(1)}
                className="h-10 w-10 rounded-xl bg-[#88A98E] text-sm font-black text-[#1E1B18] hover:bg-[#97B89D] active:scale-95 transition cursor-pointer shadow"
                title="Añadir 1 vuelta"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => handleIncrementRows(5)}
                className="h-10 w-10 rounded-xl bg-[#88A98E]/20 border border-[#88A98E]/40 text-xs font-bold text-[#D8E6DA] hover:bg-[#88A98E]/30 active:scale-95 transition cursor-pointer"
                title="Añadir 5 vueltas"
              >
                +5
              </button>
            </div>
          </div>

          {/* BITÁCORA DE PUNTADAS & NOTAS DE PATRÓN */}
          <div className="rounded-xl border border-[#4A3C31]/40 bg-[#1C1816] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#D8E6DA] flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-[#E9C46A]" />
                Notas de Patrón & Puntadas
              </label>
              <span className="text-[10px] text-[#A69B8D]">
                Persistente
              </span>
            </div>
            <textarea
              rows={2}
              value={stitchesNotes}
              onChange={(e) => setStitchesNotes(e.target.value)}
              placeholder="Ej. Vuelta 18: 3 puntos altos, 1 disminución. Hilado mostaza..."
              className="w-full rounded-lg border border-[#4A3C31] bg-[#151210] p-2.5 text-xs text-[#EAE4D9] placeholder-[#7D7366] focus:border-[#88A98E] focus:outline-none resize-none"
            />
          </div>

          {/* REGISTRO RÁPIDO SIN CRONÓMETRO */}
          <div className="pt-2 border-t border-[#4A3C31]/30">
            <button
              type="button"
              disabled={submitting || sessionRows === 0}
              onClick={handleFinishAndSave}
              className="w-full rounded-xl bg-[#2D2621] border border-[#88A98E]/40 py-2.5 text-xs font-bold text-[#D8E6DA] hover:bg-[#382F2A] hover:border-[#88A98E] transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              <Award className="h-4 w-4 text-[#E9C46A]" />
              <span>Registrar Avance Directo (+{sessionRows} Vueltas)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
