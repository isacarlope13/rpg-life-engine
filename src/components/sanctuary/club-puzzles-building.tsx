"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Box,
  Zap,
  GraduationCap,
  BookMarked,
  Play,
  Pause,
  Square,
  RotateCcw,
  Trophy,
  Timer,
  Check,
  Settings2,
  AlertTriangle,
  FileText,
  Sparkles,
  Calendar,
  Award,
  Layers,
} from "lucide-react";
import type {
  RubikCubeType,
  RubikPenalty,
  RubikCubeCatalogItem,
  RubikStats,
  ExtractedCubeSpecsAI,
} from "@/types/rpg";
import { WcaPerformanceCurve } from "@/components/rpg-advanced-widgets";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";

interface ClubPuzzlesBuildingProps {
  cubes: RubikCubeCatalogItem[];
  rubikStats: RubikStats;
  rubikStatsByCube?: Record<string, RubikStats>;
  nextScramble?: string;
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => void | Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
}

export function ClubPuzzlesBuilding({
  cubes = [],
  rubikStats,
  rubikStatsByCube = {},
  nextScramble = "R U R' U' R' F R2 U' R' U' R U R' F'",
  playerLevel = 1,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = false,
  onRefreshState,
  onSubmitDirectSkillSession,
}: ClubPuzzlesBuildingProps) {
  // Submodos
  const [rubikSubMode, setRubikSubMode] = useState<
    "practice" | "study" | "notes" | "arsenal"
  >("practice");

  // Estado del cubo activo y práctica WCA
  const [cubeType, setCubeType] = useState<RubikCubeType>("3x3");
  const [selectedCubeId, setSelectedCubeId] = useState<string>(
    cubes[0]?.id || "cube-1"
  );
  const [rubikPenalty, setRubikPenalty] = useState<RubikPenalty>("NONE");
  const [rubikAlgInput, setRubikAlgInput] = useState<string>("PLL T-Perm / F2L Lookahead");
  const [manualSolveSec, setManualSolveSec] = useState<string>("18.50");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cronómetro WCA para práctica
  const [practiceTimerRunning, setPracticeTimerRunning] = useState(false);
  const [practiceElapsedMs, setPracticeElapsedMs] = useState(0);
  const practiceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Notas del cubo (Arsenal Hardware)
  const [cubeTensionNotes, setCubeTensionNotes] = useState("");
  const [cubeLubeNotes, setCubeLubeNotes] = useState("");
  const [cubeMaintenanceNeeds, setCubeMaintenanceNeeds] = useState("");
  const [cubeAlgsToMaster, setCubeAlgsToMaster] = useState("");
  const [cubeGeneralNotes, setCubeGeneralNotes] = useState("");
  const [cubeNotesSuccessMsg, setCubeNotesSuccessMsg] = useState<string | null>(null);

  // Extracción IA de Cubo
  const [cubeSpecQuery, setCubeSpecQuery] = useState(
    "MoYu WeiLong WRM V10 3x3 Ball-Core UV"
  );
  const [extractingCube, setExtractingCube] = useState(false);
  const [extractedSpecs, setExtractedSpecs] = useState<ExtractedCubeSpecsAI | null>(null);
  const [cubePricePaid, setCubePricePaid] = useState<number>(85000);
  const [cubePurchaseDate, setCubePurchaseDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [cubeStoreSource, setCubeStoreSource] = useState<string>("Tienda Speedcubing");

  // Motor Universal de Sesiones para Estudio
  const {
    session: studySession,
    isRunning: isStudyRunning,
    isPaused: isStudyPaused,
    isActive: isStudyActive,
    elapsedMinutes: studyElapsedMinutes,
    formattedTime: studyFormattedTime,
    startSession: startStudySession,
    pauseSession: pauseStudySession,
    resumeSession: resumeStudySession,
    resetSession: resetStudySession,
    finishSession: finishStudySession,
    updateNotes: updateStudyNotes,
  } = useUniversalSession("rubik", "club_puzzles");

  const [studyFocus, setStudyFocus] = useState("F2L & Lookahead Fluido");

  // Cubo activo hardware
  const activeHardwareCube =
    cubes.find((c) => c.id === selectedCubeId) ||
    cubes.find((c) => c.cube_type === cubeType) ||
    cubes[0];

  // Estadísticas activas por tipo de cubo
  const activeRubikStats =
    rubikStatsByCube[cubeType] || rubikStats || {
      cube_type: cubeType,
      total_solves: 0,
      pb_seconds: null,
      ao5_seconds: null,
      ao12_seconds: null,
      mean_seconds: null,
      recent_solves: [],
    };

  // Cargar notas desde localStorage al cambiar de cubo
  useEffect(() => {
    if (!activeHardwareCube?.id || typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem(`rpg_cube_notebook_${activeHardwareCube.id}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        setCubeTensionNotes(parsed.tensions || "");
        setCubeLubeNotes(parsed.lubes || "");
        setCubeMaintenanceNeeds(parsed.maintenance_needs || "");
        setCubeAlgsToMaster(parsed.algs_to_master || "");
        setCubeGeneralNotes(parsed.custom_notes || "");
      } else {
        setCubeTensionNotes(activeHardwareCube.recommended_setup || "");
        setCubeLubeNotes("");
        setCubeMaintenanceNeeds(activeHardwareCube.maintenance_needs || "");
        setCubeAlgsToMaster("");
        setCubeGeneralNotes(activeHardwareCube.custom_notes || "");
      }
    } catch {
      // fallback
    }
  }, [activeHardwareCube?.id]);

  // Manejo del cronómetro WCA en vivo
  useEffect(() => {
    if (practiceTimerRunning) {
      const start = Date.now() - practiceElapsedMs;
      practiceTimerRef.current = setInterval(() => {
        setPracticeElapsedMs(Date.now() - start);
      }, 10);
    } else if (practiceTimerRef.current) {
      clearInterval(practiceTimerRef.current);
    }
    return () => {
      if (practiceTimerRef.current) clearInterval(practiceTimerRef.current);
    };
  }, [practiceTimerRunning]);

  const togglePracticeTimer = () => {
    if (practiceTimerRunning) {
      setPracticeTimerRunning(false);
      setManualSolveSec((practiceElapsedMs / 1000).toFixed(2));
    } else {
      setPracticeElapsedMs(0);
      setPracticeTimerRunning(true);
    }
  };

  const resetPracticeTimer = () => {
    setPracticeTimerRunning(false);
    setPracticeElapsedMs(0);
  };

  // Guardar solve WCA
  const handleSaveSolve = async () => {
    setIsSubmitting(true);
    try {
      await onSubmitDirectSkillSession({
        domain: "rubik",
        cube_type: cubeType,
        cube_id: activeHardwareCube?.id,
        cube_model: activeHardwareCube?.model_name,
        solve_time_seconds: Number(manualSolveSec) || 18.5,
        penalty: rubikPenalty,
        scramble: nextScramble,
        algorithm_learned: rubikAlgInput,
        duration_minutes: 20,
      });
      await onRefreshState();
      resetPracticeTimer();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar cuaderno de notas
  const handleSaveCubeNotebook = async () => {
    if (!activeHardwareCube?.id) return;
    setIsSubmitting(true);
    const combinedNotes = [
      cubeGeneralNotes.trim(),
      cubeAlgsToMaster.trim() ? `[Casos por dominar]: ${cubeAlgsToMaster.trim()}` : "",
      cubeLubeNotes.trim() ? `[Lubricación]: ${cubeLubeNotes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const payload = {
      tensions: cubeTensionNotes,
      lubes: cubeLubeNotes,
      maintenance_needs: cubeMaintenanceNeeds,
      algs_to_master: cubeAlgsToMaster,
      custom_notes: cubeGeneralNotes,
    };

    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          `rpg_cube_notebook_${activeHardwareCube.id}`,
          JSON.stringify(payload)
        );
      } catch {
        // ignore
      }
    }

    try {
      await onSubmitDirectSkillSession({
        action: "update_cube_notes",
        cube_id: activeHardwareCube.id,
        notes: combinedNotes,
        cube_custom_notes: combinedNotes,
        cube_maintenance_needs: cubeMaintenanceNeeds,
        cube_recommended_setup: cubeTensionNotes,
      });
      setCubeNotesSuccessMsg("¡Notas y mantenimiento del cubo guardados correctamente!");
      setTimeout(() => setCubeNotesSuccessMsg(null), 3500);
      await onRefreshState();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Extracción simulada / asistida de especificaciones
  const handleExtractSpecs = async (queryText?: string) => {
    const q = (queryText || cubeSpecQuery).trim();
    if (!q) return;
    setExtractingCube(true);
    try {
      // Determinación inteligente de especificaciones WCA según modelo
      const is3x3 = /3x3/i.test(q) || !/2x2|4x4|pyra|mega/i.test(q);
      const is2x2 = /2x2/i.test(q);
      const is4x4 = /4x4/i.test(q);
      const isPyra = /pyra/i.test(q);
      const isMega = /mega/i.test(q);

      const targetType: RubikCubeType = is2x2
        ? "2x2"
        : is4x4
        ? "4x4"
        : isPyra
        ? "Pyraminx"
        : isMega
        ? "Megaminx"
        : "3x3";

      const brand = /gan/i.test(q)
        ? "GAN"
        : /moyu/i.test(q)
        ? "MoYu"
        : /qiyi|x-man/i.test(q)
        ? "QiYi"
        : /dayan/i.test(q)
        ? "DaYan"
        : /yj/i.test(q)
        ? "YJ"
        : "MoYu";

      const specs: ExtractedCubeSpecsAI = {
        brand,
        cube_type: targetType,
        model_name: q,
        magnetic_system: /maglev/i.test(q) ? "MagLev + Core Magnets" : "Ball-Core Magnético",
        surface_finish: /uv/i.test(q) ? "UV Coated Brillante" : "Frosted / Mate",
        size_mm: is2x2 ? 50 : is4x4 ? 60 : isPyra ? 95 : isMega ? 72 : 55,
        weight_grams: is2x2 ? 62 : is4x4 ? 92 : isPyra ? 78 : isMega ? 110 : 71,
        recommended_alg_set: is3x3 ? "CFOP Completo (F2L + OLL + PLL)" : is2x2 ? "Ortega / EG-1" : "Yau Method",
        recommended_setup: "Tensión 3, Compresión 2, Lubricante intermedio",
        target_sub_seconds: is3x3 ? 15 : is2x2 ? 4 : is4x4 ? 50 : 10,
        reward_gp_per_solve: is3x3 ? 450 : is2x2 ? 200 : is4x4 ? 800 : 350,
        pb_bonus_gp: is3x3 ? 1500 : 800,
        wca_legal: true,
        specs_compliance_checklist: [
          {
            code: "WCA_REG_3H",
            label: "Cumplimiento Reglamentario WCA",
            requirement: "Colores y pegatinas sin relieves ni marcas distintivas",
            fulfilled: true,
          },
          {
            code: "MAG_CORE_CHECK",
            label: "Alineación Magnética de Núcleo",
            requirement: "Atracción fluida sin bloqueo ni descalibre en capas M",
            fulfilled: true,
          },
        ],
      };

      setExtractedSpecs(specs);
    } finally {
      setExtractingCube(false);
    }
  };

  // Registrar nuevo cubo en Arsenal
  const handleRegisterCube = async () => {
    if (!extractedSpecs) return;
    setIsSubmitting(true);
    try {
      await onSubmitDirectSkillSession({
        action: "register_rubik_cube",
        brand: extractedSpecs.brand,
        model_name: extractedSpecs.model_name,
        cube_type: extractedSpecs.cube_type,
        magnetic_system: extractedSpecs.magnetic_system,
        surface_finish: extractedSpecs.surface_finish,
        size_mm: extractedSpecs.size_mm,
        weight_grams: extractedSpecs.weight_grams,
        recommended_alg_set: extractedSpecs.recommended_alg_set,
        recommended_setup: extractedSpecs.recommended_setup,
        target_sub_seconds: extractedSpecs.target_sub_seconds,
        reward_gp_per_solve: extractedSpecs.reward_gp_per_solve,
        wca_legal: extractedSpecs.wca_legal,
        price_paid: cubePricePaid,
        purchase_date: cubePurchaseDate,
        store_or_source: cubeStoreSource,
      });
      await onRefreshState();
      setExtractedSpecs(null);
      setRubikSubMode("practice");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`space-y-6 transition-all duration-300 ${
        isCozyActive
          ? "rounded-3xl border border-[#5C4033]/40 bg-[#1c1815]/90 p-6 shadow-md text-amber-50"
          : "text-slate-100"
      }`}
    >
      {/* CABECERA PRINCIPAL DEL EDIFICIO */}
      <div
        className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-xl ${
          isCozyActive
            ? "border-cyan-900/40 bg-[#251f1c]/90"
            : "border-cyan-500/30 bg-slate-900/90"
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-2xl shadow-inner">
            🧩
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black tracking-tight text-white">
                Club de Puzzles & Speedcubing WCA
              </h2>
              <span className="rounded-full bg-cyan-500/20 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                Torneo WCA • Grado {skillLevel}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Arsenal de hardware, cronómetro reglamentario, trimmed average Ao5/Ao12 y forja de reflejos.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Single PB</span>
            <p className="font-mono text-xs font-black text-amber-300">
              {activeRubikStats.pb_seconds ? `${activeRubikStats.pb_seconds.toFixed(2)}s` : "--"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Ao5 Oficial</span>
            <p className="font-mono text-xs font-black text-cyan-300">
              {activeRubikStats.ao5_seconds ? `${activeRubikStats.ao5_seconds.toFixed(2)}s` : "--"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-center">
            <span className="text-[10px] uppercase font-semibold text-slate-400">Solves Registrados</span>
            <p className="font-mono text-xs font-black text-emerald-300">
              {activeRubikStats.total_solves || activeRubikStats.recent_solves.length}
            </p>
          </div>
        </div>
      </div>

      {/* BARRA DE NAVEGACIÓN DE SUBMODOS DEL EDIFICIO */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/30 bg-slate-950 p-2.5 shadow-lg">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setRubikSubMode("practice")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              rubikSubMode === "practice"
                ? "bg-cyan-600 text-white shadow-lg shadow-cyan-600/30"
                : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="h-4 w-4" />
            ⚡ Modo 1: Práctica WCA (Speedcubing)
          </button>

          <button
            type="button"
            onClick={() => setRubikSubMode("study")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              rubikSubMode === "study"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            🎓 Modo 2: Estudio & Nuevo Cubo
          </button>

          <button
            type="button"
            onClick={() => setRubikSubMode("notes")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              rubikSubMode === "notes"
                ? "bg-amber-600 text-white shadow-lg shadow-amber-600/30"
                : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
            }`}
          >
            <BookMarked className="h-4 w-4" />
            📓 Cuaderno de Notas & Mantenimiento
          </button>

          <button
            type="button"
            onClick={() => setRubikSubMode("arsenal")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer ${
              rubikSubMode === "arsenal"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30"
                : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
            }`}
          >
            <Box className="h-4 w-4" />
            🧊 Arsenal WCA ({cubes.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400">
            Cubo Activo:
          </span>
          <strong className="text-cyan-300 text-xs">
            {activeHardwareCube?.model_name || "3x3"}
          </strong>
        </div>
      </div>

      {/* =================================================================
          MODO 1: PRÁCTICA WCA & SPEEDCUBING
         ================================================================= */}
      {rubikSubMode === "practice" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Speedcubing Timer & Registro WCA
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {cubes.length > 0 && (
                  <select
                    value={activeHardwareCube?.id || ""}
                    onChange={(e) => {
                      const chosen = cubes.find((c) => c.id === e.target.value);
                      if (chosen) {
                        setSelectedCubeId(chosen.id);
                        setCubeType(chosen.cube_type);
                        setRubikAlgInput(chosen.recommended_alg_set);
                      }
                    }}
                    className="rounded-lg border border-cyan-500/40 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-emerald-300"
                    title="Selecciona el cubo de tu Arsenal"
                  >
                    {cubes.map((c) => (
                      <option key={c.id} value={c.id}>
                        🧊 {c.model_name} ({c.cube_type})
                      </option>
                    ))}
                  </select>
                )}
                <select
                  value={cubeType}
                  onChange={(e) => setCubeType(e.target.value as RubikCubeType)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs font-semibold text-cyan-300"
                >
                  <option value="3x3">Cubo 3x3x3 WCA</option>
                  <option value="2x2">Cubo 2x2x2</option>
                  <option value="4x4">Cubo 4x4x4</option>
                  <option value="Pyraminx">Pyraminx</option>
                  <option value="Megaminx">Megaminx</option>
                </select>
              </div>
            </div>

            {/* SCRAMBLE OFICIAL */}
            <div className="flex items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                  Scramble Oficial Generado ({cubeType}):
                </span>
                <p className="mt-1 font-mono text-sm font-bold tracking-wide text-white select-all">
                  {nextScramble}
                </p>
              </div>
              <button
                type="button"
                onClick={onRefreshState}
                className="rounded-lg bg-indigo-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-200 hover:bg-indigo-500/30 cursor-pointer"
              >
                Nuevo Scramble
              </button>
            </div>

            {/* CRONÓMETRO EN VIVO */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-[#070a12] py-5">
              <span className="font-mono text-4xl font-extrabold text-emerald-400 sm:text-5xl">
                {(practiceElapsedMs / 1000).toFixed(2)}s
              </span>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={togglePracticeTimer}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white cursor-pointer ${
                    practiceTimerRunning
                      ? "bg-rose-600 hover:bg-rose-500"
                      : "bg-emerald-600 hover:bg-emerald-500"
                  }`}
                >
                  {practiceTimerRunning ? (
                    <>
                      <Square className="h-4 w-4" /> Detener Solve
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> Iniciar Cronómetro
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={resetPracticeTimer}
                  className="inline-flex items-center gap-1 rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset
                </button>
              </div>
            </div>

            {/* FORMULARIO PARA GUARDAR SOLVE + PENALIZACIÓN WCA */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs text-slate-400">Tiempo del Solve (s):</label>
                <input
                  type="number"
                  step="0.01"
                  min="0.5"
                  value={manualSolveSec}
                  onChange={(e) => setManualSolveSec(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Penalización WCA:</label>
                <select
                  value={rubikPenalty}
                  onChange={(e) => setRubikPenalty(e.target.value as RubikPenalty)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
                >
                  <option value="NONE">OK (Limpio)</option>
                  <option value="+2">+2s Penalización</option>
                  <option value="DNF">DNF (Did Not Finish)</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Algoritmo / Método:</label>
                <input
                  type="text"
                  value={rubikAlgInput}
                  onChange={(e) => setRubikAlgInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveSolve}
              className="w-full rounded-xl bg-cyan-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "Registrando en WCA Ledger..." : "Registrar Solve WCA (+GP & XP)"}
            </button>
          </div>

          {/* HISTORIAL Y MEDIAS DE RENDIMIENTO */}
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h4 className="text-sm font-bold text-white">Medias Oficiales WCA ({cubeType})</h4>
              <span className="font-mono text-xs text-slate-400">
                Solves: {activeRubikStats.total_solves}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-center">
                <span className="text-[10px] uppercase text-emerald-300">Single PB 🏆</span>
                <p className="mt-1 font-mono text-base font-extrabold text-white">
                  {activeRubikStats.pb_seconds ? `${activeRubikStats.pb_seconds.toFixed(2)}s` : "--"}
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-2.5 text-center">
                <span className="text-[10px] uppercase text-cyan-300">Ao5 Actual</span>
                <p className="mt-1 font-mono text-base font-extrabold text-white">
                  {activeRubikStats.ao5_seconds ? `${activeRubikStats.ao5_seconds.toFixed(2)}s` : "--"}
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5 text-center">
                <span className="text-[10px] uppercase text-amber-300">Ao12 Oficial</span>
                <p className="mt-1 font-mono text-base font-extrabold text-white">
                  {activeRubikStats.ao12_seconds ? `${activeRubikStats.ao12_seconds.toFixed(2)}s` : "--"}
                </p>
              </div>
              <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-2.5 text-center">
                <span className="text-[10px] uppercase text-indigo-300">Media</span>
                <p className="mt-1 font-mono text-base font-extrabold text-white">
                  {activeRubikStats.mean_seconds ? `${activeRubikStats.mean_seconds.toFixed(2)}s` : "--"}
                </p>
              </div>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-300">
                Historial Reciente de Solves ({cubeType}):
              </span>
              <div className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
                {activeRubikStats.recent_solves.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Sin solves aún para {cubeType}. ¡Registra el primero!
                  </p>
                ) : (
                  activeRubikStats.recent_solves.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs"
                    >
                      <div>
                        <span
                          className={`font-mono font-bold ${
                            s.penalty === "DNF" ? "text-rose-400" : "text-emerald-400"
                          }`}
                        >
                          {s.penalty === "DNF"
                            ? `DNF (${s.time_seconds.toFixed(2)}s)`
                            : `${s.time_seconds.toFixed(2)}s`}
                        </span>{" "}
                        {s.penalty === "+2" && (
                          <span className="ml-1 rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-300">
                            +2s
                          </span>
                        )}
                        {s.is_pb && (
                          <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                            PB 🏆
                          </span>
                        )}
                        {s.cube_model && (
                          <span className="ml-1 text-[10px] text-slate-400">
                            • {s.cube_model}
                          </span>
                        )}
                        <p className="text-[10px] font-mono text-slate-400">{s.scramble}</p>
                      </div>
                      {s.algorithm_practiced && (
                        <span className="text-[10px] text-cyan-300">{s.algorithm_practiced}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* CURVA DE RENDIMIENTO WCA */}
            <div className="mt-4">
              <WcaPerformanceCurve
                solves={activeRubikStats.recent_solves || []}
                pbSeconds={activeRubikStats.pb_seconds ?? null}
                ao5Seconds={activeRubikStats.ao5_seconds ?? null}
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================
          MODO 2: ESTUDIO & APRENDIZAJE DE NUEVO CUBO (MOTOR UNIVERSAL)
         ================================================================= */}
      {rubikSubMode === "study" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-xl border border-indigo-500/40 bg-slate-950/80 p-5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-indigo-400" />
                <div>
                  <h4 className="text-base font-bold text-white">
                    Estudio & Dominio de Nuevo Cubo / Algoritmos
                  </h4>
                  <p className="text-xs text-slate-400">
                    Aprende algoritmos, paridades o reconocimiento sin la presión del cronómetro WCA.
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-indigo-300">
                +120 XP • +3.500 GP/bloque
              </span>
            </div>

            {/* TEMPORIZADOR UNIVERSAL EN VIVO */}
            <div className="flex flex-col items-center justify-center rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 to-slate-950 p-6 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                {isStudyRunning
                  ? "● Grabando sesión de estudio en vivo (Motor Universal)"
                  : isStudyPaused
                  ? "⏸ Sesión en Pausa"
                  : "Cronómetro de Estudio en Vivo"}
              </span>
              <span className="mt-2 font-mono text-5xl font-black tracking-tight text-indigo-400 sm:text-6xl">
                {studyFormattedTime}
              </span>
              <p className="mt-1 text-xs text-slate-400">
                {isStudyRunning
                  ? `${studyElapsedMinutes} minutos acumulados para reclamar`
                  : "Presiona iniciar al comenzar a estudiar y finalizar al terminar."}
              </p>

              <div className="mt-4 flex flex-wrap gap-2.5 justify-center">
                {!isStudyActive ? (
                  <CozyButton
                    variant="lake"
                    size="sm"
                    icon={<Play className="h-4 w-4 fill-current" />}
                    onClick={() => startStudySession({ notes: studyFocus })}
                  >
                    Iniciar Sesión de Estudio
                  </CozyButton>
                ) : (
                  <>
                    {isStudyPaused ? (
                      <CozyButton
                        variant="sage"
                        size="sm"
                        icon={<Play className="h-4 w-4 fill-current" />}
                        onClick={resumeStudySession}
                      >
                        Reanudar
                      </CozyButton>
                    ) : (
                      <CozyButton
                        variant="sunlight"
                        size="sm"
                        icon={<Pause className="h-4 w-4" />}
                        onClick={pauseStudySession}
                      >
                        Pausar
                      </CozyButton>
                    )}

                    <CozyButton
                      variant="lake"
                      size="sm"
                      disabled={isSubmitting}
                      icon={<Square className="h-4 w-4 fill-current" />}
                      onClick={async () => {
                        setIsSubmitting(true);
                        try {
                          await finishStudySession({
                            action_type: "rubik_study",
                            details: `Estudio de Cubo / Algoritmos: ${studyFocus}`,
                            cube_model: activeHardwareCube?.model_name,
                            cube_type: cubeType,
                          });
                          await onRefreshState();
                        } finally {
                          setIsSubmitting(false);
                        }
                      }}
                    >
                      Finalizar y Reclamar GP
                    </CozyButton>

                    <CozyButton
                      variant="wood"
                      size="sm"
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      onClick={resetStudySession}
                      aria-label="Reiniciar cronómetro"
                    />
                  </>
                )}
              </div>
            </div>

            {/* SELECCIÓN DE ENFOQUE DE ESTUDIO */}
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-300">
                Enfoque de Estudio:
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  "F2L Lookahead Fluido",
                  "OLL 2-Look Memorización",
                  "PLL T-Perm & J-Perm",
                  "Paridades 4x4 OLL/PLL",
                  "Megaminx Star & S2L",
                  "Pyraminx Oka & V-First",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setStudyFocus(preset);
                      updateStudyNotes(preset);
                    }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer transition ${
                      studyFocus === preset
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/80 p-5 lg:col-span-5">
            <h4 className="text-sm font-bold text-white border-b border-slate-800 pb-3">
              Notas & Conclusiones de Aprendizaje
            </h4>
            <textarea
              rows={6}
              value={studySession?.notes || studyFocus}
              onChange={(e) => updateStudyNotes(e.target.value)}
              placeholder="Anota sensaciones del algoritmo, agarres, regrips o trucos de dedos que descubriste en esta sesión..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder-slate-500"
            />
            <p className="text-[11px] text-slate-400">
              💡 Tus notas se guardan automáticamente en tu historial de sesiones y en el registro general de maestría.
            </p>
          </div>
        </div>
      )}

      {/* =================================================================
          MODO 3: CUADERNO DE NOTAS DEL CUBO (ARSENAL HARDWARE & SETUP LOG)
         ================================================================= */}
      {rubikSubMode === "notes" && (
        <div className="space-y-5 rounded-2xl border border-amber-500/40 bg-slate-950/90 p-5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <BookMarked className="h-5 w-5 text-amber-400" />
                <h4 className="text-base font-bold text-white">
                  Cuaderno de Notas del Cubo: Setup, Mantenimiento & Necesidades
                </h4>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Anota tensiones exactas, lubricantes, necesidades de limpieza o repuestos y casos por dominar.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Seleccionar Cubo:</span>
              <select
                value={activeHardwareCube?.id || ""}
                onChange={(e) => {
                  const chosen = cubes.find((c) => c.id === e.target.value);
                  if (chosen) {
                    setSelectedCubeId(chosen.id);
                    setCubeType(chosen.cube_type);
                  }
                }}
                className="rounded-lg border border-amber-500/40 bg-slate-900 px-3 py-1.5 text-xs font-bold text-amber-300"
              >
                {cubes.map((c) => (
                  <option key={c.id} value={c.id}>
                    🧊 {c.model_name} ({c.cube_type})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {cubeNotesSuccessMsg && (
            <CozyNotification
              variant="success"
              message={cubeNotesSuccessMsg}
              onDismiss={() => setCubeNotesSuccessMsg(null)}
            />
          )}

          {/* FICHA RESUMEN DEL CUBO SELECCIONADO */}
          {activeHardwareCube && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-400">Modelo & Marca:</span>
                <p className="font-bold text-white">{activeHardwareCube.model_name}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Sistema Magnético:</span>
                <p className="font-semibold text-cyan-300">{activeHardwareCube.magnetic_system || "MagLev / Imanes"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Acabado Superficie:</span>
                <p className="font-semibold text-emerald-300">{activeHardwareCube.surface_finish || "UV Coated"}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-400">Peso & Medida:</span>
                <p className="font-mono text-amber-300">
                  {activeHardwareCube.weight_grams || 71}g • {activeHardwareCube.size_mm || 55}mm
                </p>
              </div>
            </div>
          )}

          {/* FORMULARIO EDITABLE DE NOTAS */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Settings2 className="h-3.5 w-3.5 text-cyan-400" />
                ⚙️ Tensiones, Compresión de Resortes & Imanes
              </label>
              <input
                type="text"
                value={cubeTensionNotes}
                onChange={(e) => setCubeTensionNotes(e.target.value)}
                placeholder="Ej: Nivel 3 de compresión, distancia 2, imanes medios..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-blue-400" />
                💧 Lubricación Actual & Historial de Lubes
              </label>
              <input
                type="text"
                value={cubeLubeNotes}
                onChange={(e) => setCubeLubeNotes(e.target.value)}
                placeholder="Ej: Pistas con Lubest Pro / Núcleo con Weight 5..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                🛠️ Necesidades, Mantenimiento & Pendientes del Cubo
              </label>
              <textarea
                rows={3}
                value={cubeMaintenanceNeeds}
                onChange={(e) => setCubeMaintenanceNeeds(e.target.value)}
                placeholder="Ej: Limpieza profunda de pistas; lubricante rápido; cambiar imán flojo..."
                className="w-full rounded-lg border border-rose-500/30 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-400" />
                🎯 Algoritmos y Casos por Dominar con este Cubo
              </label>
              <textarea
                rows={3}
                value={cubeAlgsToMaster}
                onChange={(e) => setCubeAlgsToMaster(e.target.value)}
                placeholder="Ej: G-perm d tarda 2.6s, Ja-perm sin regrip..."
                className="w-full rounded-lg border border-amber-500/30 bg-slate-900 px-3 py-2 text-xs text-white"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-emerald-400" />
              📝 Bitácora Libre, Sensaciones de Giro & Rendimiento
            </label>
            <textarea
              rows={3}
              value={cubeGeneralNotes}
              onChange={(e) => setCubeGeneralNotes(e.target.value)}
              placeholder="Ej: Sensación mantecosa tras el break-in. Corte a 55 grados sin bloqueo..."
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-xs text-slate-400">
              Las notas se sincronizan automáticamente en tu perfil y navegador.
            </span>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveCubeNotebook}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-600/30 hover:bg-amber-500 cursor-pointer"
            >
              <Check className="h-4 w-4" />
              Guardar Notas del Cubo
            </button>
          </div>
        </div>
      )}

      {/* =================================================================
          MODO 4: ARSENAL WCA & EXTRACCIÓN ASISTIDA POR IA
         ================================================================= */}
      {rubikSubMode === "arsenal" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-cyan-500/30 bg-slate-950/90 p-5">
            <h4 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Sparkles className="h-5 w-5 text-cyan-400" />
              Registrar Nuevo Cubo en tu Arsenal (Catálogo & Finanzas)
            </h4>

            {/* BUSCADOR & PRESETS */}
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={cubeSpecQuery}
                onChange={(e) => setCubeSpecQuery(e.target.value)}
                placeholder="Nombre del cubo (ej: GAN 14 MagLev Pro 3x3 UV, MoYu WeiLong WRM V10...)"
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-xs text-white"
              />
              <button
                type="button"
                disabled={extractingCube}
                onClick={() => handleExtractSpecs()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                {extractingCube ? "Extrayendo..." : "Extraer Especificaciones"}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "GAN 14 MagLev Pro 3x3 UV",
                "MoYu WeiLong WRM V10 3x3 Ball-Core UV",
                "YJ MGC 4x4",
                "QiYi X-Man Bell V2 Pyraminx",
                "DaYan Megaminx Pro M",
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setCubeSpecQuery(preset);
                    handleExtractSpecs(preset);
                  }}
                  className="rounded-md border border-slate-800 bg-slate-900/90 px-2 py-1 text-[10px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* FICHA EXTRAÍDA & REGISTRO */}
            {extractedSpecs && (
              <div className="mt-5 space-y-4 rounded-xl border border-cyan-500/30 bg-slate-900/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-cyan-400">
                      {extractedSpecs.brand} • {extractedSpecs.cube_type}
                    </span>
                    <h5 className="text-sm font-bold text-white">
                      {extractedSpecs.model_name}
                    </h5>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40">
                    ✓ WCA Legal para Torneos
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <span className="text-[10px] text-slate-400">Sistema Magnético:</span>
                    <p className="font-semibold text-cyan-300">{extractedSpecs.magnetic_system}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <span className="text-[10px] text-slate-400">Acabado Exterior:</span>
                    <p className="font-semibold text-emerald-300">{extractedSpecs.surface_finish}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <span className="text-[10px] text-slate-400">Medida & Peso:</span>
                    <p className="font-mono text-amber-300">
                      {extractedSpecs.size_mm}mm • {extractedSpecs.weight_grams}g
                    </p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5">
                    <span className="text-[10px] text-slate-400">Recompensa / Solve:</span>
                    <p className="font-mono font-bold text-emerald-400">
                      +{extractedSpecs.reward_gp_per_solve} GP
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-2">
                  <div>
                    <label className="text-xs text-slate-400">Precio Pagado (COP):</label>
                    <input
                      type="number"
                      value={cubePricePaid}
                      onChange={(e) => setCubePricePaid(Number(e.target.value) || 0)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Fecha de Compra:</label>
                    <input
                      type="date"
                      value={cubePurchaseDate}
                      onChange={(e) => setCubePurchaseDate(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Tienda / Origen:</label>
                    <input
                      type="text"
                      value={cubeStoreSource}
                      onChange={(e) => setCubeStoreSource(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRegisterCube}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 cursor-pointer"
                >
                  Registrar Cubo en mi Arsenal (+100 XP)
                </button>
              </div>
            )}
          </div>

          {/* GALERÍA DE CUBOS DEL ARSENAL */}
          <div className="space-y-3">
            <h4 className="text-sm font-bold text-white">Colección de Hardware ({cubes.length} cubos)</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cubes.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 space-y-2 hover:border-cyan-500/40 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                      {c.cube_type}
                    </span>
                    <span className="font-mono text-xs text-emerald-400">
                      +{c.reward_gp_per_solve || 300} GP/solve
                    </span>
                  </div>
                  <h5 className="font-bold text-white text-sm">{c.model_name}</h5>
                  <div className="text-[11px] text-slate-400 space-y-0.5">
                    <p>🧲 {c.magnetic_system || "Magnético"}</p>
                    <p>✨ {c.surface_finish || "UV"}</p>
                    <p>📏 {c.size_mm}mm • ⚖️ {c.weight_grams}g</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
