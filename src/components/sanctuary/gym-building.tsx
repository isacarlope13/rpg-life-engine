"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Dumbbell,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Square,
  Sparkles,
  Droplets,
  HeartPulse,
  Flame,
  Award,
  Plus,
  Minus,
  CheckCircle2,
  Calendar,
  Timer,
  Trash2,
  BookOpen,
  Info,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import type { SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { ResidentAssistantWidget } from "@/components/sanctuary/resident-assistant-widget";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";
import { CozyButton, CozyCard } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

import {
  type GymSetRecord,
  type GymRoutineKey,
  GYM_ROUTINES_CATALOG,
  RPE_DESCRIPTIONS,
  calculateWorkoutMetrics,
} from "@/lib/sanctuary/gym-engine";

interface GymBuildingProps {
  sessions?: SkillSessionRecord[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

export function GymBuilding({
  sessions = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: GymBuildingProps) {
  const [activeTab, setActiveTab] = useState("session");
  const [selectedRoutineKey, setSelectedRoutineKey] = useState<GymRoutineKey>("fuerza");
  const [selectedExerciseName, setSelectedExerciseName] = useState("Sentadilla Goblet");
  const [waterGlasses, setWaterGlasses] = useState(2);
  const [intensityRating, setIntensityRating] = useState<"suave" | "moderada" | "intensa">("moderada");

  // Temporizador de descanso integrado
  const [restTimeLeft, setRestTimeLeft] = useState<number>(0);
  const [restPresetSecs, setRestPresetSecs] = useState<number>(90);
  const [isResting, setIsResting] = useState<boolean>(false);

  // Series interactivas de la sesión
  const [workoutSets, setWorkoutSets] = useState<GymSetRecord[]>([
    {
      id: "set-1",
      exerciseName: "Sentadilla Goblet",
      setNumber: 1,
      reps: 10,
      weightKg: 16,
      rpe: 7,
      completed: true,
    },
    {
      id: "set-2",
      exerciseName: "Sentadilla Goblet",
      setNumber: 2,
      reps: 10,
      weightKg: 16,
      rpe: 8,
      completed: true,
    },
    {
      id: "set-3",
      exerciseName: "Sentadilla Goblet",
      setNumber: 3,
      reps: 8,
      weightKg: 18,
      rpe: 8,
      completed: false,
    },
  ]);

  // Residente asociado: Bruno
  const brunoResident = useMemo(
    () => COZY_VILLAGE_RESIDENTS.find((r) => r.id === "bruno"),
    []
  );

  // Motor universal de sesiones con persistencia e idempotencia
  const {
    session,
    elapsedSeconds,
    formattedTime,
    isActive,
    isRunning,
    isPaused,
    prepareSession,
    startSession,
    pauseSession,
    resumeSession,
    cancelSession,
    finishSession,
    history,
  } = useUniversalSession({
    targetDomain: "sports",
    targetBuildingId: "gimnasio",
  });

  const sportsSessions = useMemo(
    () => sessions.filter((s) => s.domain === "sports"),
    [sessions]
  );
  const totalMinutes = useMemo(
    () => sportsSessions.reduce((acc, s) => acc + (s.duration_minutes || 0), 0),
    [sportsSessions]
  );

  // Cálculos de volumen (tonelaje = sum(reps * weightKg)), series completadas y RPE promedio
  const workoutMetrics = useMemo(() => calculateWorkoutMetrics(workoutSets), [workoutSets]);

  // Manejo del contador de descanso (Rest Timer)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isResting && restTimeLeft > 0) {
      interval = setInterval(() => {
        setRestTimeLeft((prev) => {
          if (prev <= 1) {
            setIsResting(false);
            triggerHaptic("success");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (restTimeLeft === 0) {
      setIsResting(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isResting, restTimeLeft]);

  const startRestTimer = (seconds: number) => {
    setRestPresetSecs(seconds);
    setRestTimeLeft(seconds);
    setIsResting(true);
    triggerHaptic("medium");
  };

  const toggleRestTimer = () => {
    if (isResting) {
      setIsResting(false);
      triggerHaptic("light");
    } else {
      if (restTimeLeft === 0) {
        setRestTimeLeft(restPresetSecs);
      }
      setIsResting(true);
      triggerHaptic("light");
    }
  };

  const resetRestTimer = () => {
    setIsResting(false);
    setRestTimeLeft(0);
    triggerHaptic("light");
  };

  // Manejadores de series
  const handleToggleSetCompleted = (setId: string) => {
    triggerHaptic("light");
    setWorkoutSets((prev) =>
      prev.map((set) => {
        if (set.id === setId) {
          const nextCompleted = !set.completed;
          if (nextCompleted && !isResting) {
            // Auto-iniciar descanso con el preset de la rutina actual
            const defaultRest =
              GYM_ROUTINES_CATALOG[selectedRoutineKey]?.defaultRestSecs || 90;
            setRestPresetSecs(defaultRest);
            setRestTimeLeft(defaultRest);
            setIsResting(true);
          }
          return { ...set, completed: nextCompleted };
        }
        return set;
      })
    );
  };

  const handleAddSet = () => {
    triggerHaptic("light");
    const currentSets = workoutSets.filter(
      (s) => s.exerciseName === selectedExerciseName
    );
    const lastSet = currentSets[currentSets.length - 1];

    const newSet: GymSetRecord = {
      id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      exerciseName: selectedExerciseName,
      setNumber: currentSets.length + 1,
      reps: lastSet ? lastSet.reps : 10,
      weightKg: lastSet ? lastSet.weightKg : 16,
      rpe: lastSet ? lastSet.rpe : 8,
      completed: false,
    };
    setWorkoutSets((prev) => [...prev, newSet]);
  };

  const handleUpdateSet = (
    setId: string,
    field: keyof GymSetRecord,
    val: number
  ) => {
    setWorkoutSets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, [field]: val } : s))
    );
  };

  const handleDeleteSet = (setId: string) => {
    triggerHaptic("warning");
    setWorkoutSets((prev) => prev.filter((s) => s.id !== setId));
  };

  const handleSelectRoutine = (key: GymRoutineKey) => {
    triggerHaptic("light");
    setSelectedRoutineKey(key);
    const routine = GYM_ROUTINES_CATALOG[key];
    if (routine && routine.exercises.length > 0) {
      setSelectedExerciseName(routine.exercises[0].name);
    }
  };

  const handleLoadRoutineIntoSession = (key: GymRoutineKey) => {
    triggerHaptic("medium");
    setSelectedRoutineKey(key);
    const routine = GYM_ROUTINES_CATALOG[key];
    const initialExercise = routine.exercises[0];
    setSelectedExerciseName(initialExercise.name);

    // Pre-cargar 3 series recomendadas para este ejercicio
    const newSets: GymSetRecord[] = [
      {
        id: `set-${Date.now()}-1`,
        exerciseName: initialExercise.name,
        setNumber: 1,
        reps: initialExercise.defaultReps,
        weightKg: initialExercise.defaultWeightKg,
        rpe: 7,
        completed: false,
      },
      {
        id: `set-${Date.now()}-2`,
        exerciseName: initialExercise.name,
        setNumber: 2,
        reps: initialExercise.defaultReps,
        weightKg: initialExercise.defaultWeightKg,
        rpe: 8,
        completed: false,
      },
      {
        id: `set-${Date.now()}-3`,
        exerciseName: initialExercise.name,
        setNumber: 3,
        reps: initialExercise.defaultReps,
        weightKg: initialExercise.defaultWeightKg,
        rpe: 8,
        completed: false,
      },
    ];
    setWorkoutSets(newSets);
    setActiveTab("session");
  };

  // Ciclo de vida de la sesión (useUniversalSession)
  const handleStartWorkout = () => {
    triggerHaptic("medium");
    if (!session) {
      prepareSession({
        objective: `Entrenamiento: ${GYM_ROUTINES_CATALOG[selectedRoutineKey].name}`,
        specializedData: {
          routine: selectedRoutineKey,
          routineName: GYM_ROUTINES_CATALOG[selectedRoutineKey].name,
          exercise: selectedExerciseName,
          setsCount: workoutMetrics.completedCount,
          totalVolumeKg: workoutMetrics.totalVolumeKg,
          avgRpe: workoutMetrics.avgRpe,
          waterGlasses,
          intensity: intensityRating,
        },
      });
    }
    startSession();
  };

  const handleFinishWorkout = async () => {
    triggerHaptic("success");
    const activeRoutine = GYM_ROUTINES_CATALOG[selectedRoutineKey];
    const durationMins = Math.max(1, Math.round(elapsedSeconds / 60));

    await finishSession({
      routine: selectedRoutineKey,
      routineName: activeRoutine.name,
      exercise: selectedExerciseName,
      sets: workoutSets,
      completedSetsCount: workoutMetrics.completedCount,
      totalVolumeKg: workoutMetrics.totalVolumeKg,
      avgRpe: workoutMetrics.avgRpe,
      waterGlasses,
      intensity: intensityRating,
    });

    const detailsStr = `${activeRoutine.name}: ${workoutMetrics.completedCount} series completadas (${workoutMetrics.totalVolumeKg} kg volumen acumulado, RPE prom. ${workoutMetrics.avgRpe})`;

    await onSubmitDirectSkillSession({
      action: "log_skill_session",
      domain: "sports",
      duration_minutes: durationMins,
      details: detailsStr,
      intensity: intensityRating,
    });

    await onRefreshState();
  };

  const activeRoutine = GYM_ROUTINES_CATALOG[selectedRoutineKey];

  const stations: InteriorStationDefinition[] = [
    {
      id: "session",
      name: "Sala de Fuerza & Cronómetro",
      shortName: "Entrenamiento",
      icon: "🏋️",
      badge: isActive ? (isPaused ? "⏸️" : "⏱️") : undefined,
      badgeVariant: isRunning ? "success" : "info",
      hotkey: "1",
      description: "Área de pesas: cronómetro de series, descansos, repeticiones y control de hidratación.",
    },
    {
      id: "routines",
      name: "Pizarra de Rutinas & Ejercicios",
      shortName: "Rutinas",
      icon: "📋",
      hotkey: "2",
      description: "Planes de entrenamiento: Push/Pull/Legs, Hipertrofia, Calistenia y series recomendadas.",
    },
    {
      id: "resources",
      name: "Guía Técnica & Escala RPE",
      shortName: "Guía & RPE",
      icon: "📊",
      hotkey: "3",
      description: "Escala de esfuerzo percibido, técnica limpia, respiración y sobrecarga progresiva.",
    },
    {
      id: "history",
      name: "Historial de Tonelaje & Logros",
      shortName: "Historial",
      icon: "🏆",
      badge: sportsSessions.length,
      hotkey: "4",
      description: "Bitácora de entrenamientos: volumen total levantado, sesiones y GP forjados.",
    },
    {
      id: "boran",
      name: "Rincón de Boran el Guardián",
      shortName: "Consejo Boran",
      icon: "🦡",
      hotkey: "5",
      description: "Asesoría de fuerza de Boran el Tejón, calentamiento articular y descanso consciente.",
    },
  ];

  return (
    <LivingInteriorRoom
      buildingId="gimnasio"
      buildingName="Gimnasio de Fuerza & Resistencia"
      domain="sports"
      districtName="Naturaleza & Vitalidad"
      icon="🏋️"
      tagline="Entrenamiento Funcional, Sobrecarga Progresiva & Fortaleza Corporal"
      resident={brunoResident}
      stations={stations}
      activeStationId={activeTab}
      onSelectStation={(id) => setActiveTab(id)}
      onClose={onClose}
      activeSessionBanner={{
        isActive,
        isPaused,
        formattedTime,
        label: `${activeRoutine.name} • ${selectedExerciseName}`,
        onViewSession: () => setActiveTab("session"),
      }}
      metrics={[
        { label: "Entrenamientos", value: sportsSessions.length, icon: "🏋️" },
        { label: "Tiempo Activo", value: `${totalMinutes} min`, icon: "⏱️" },
        {
          label: "Volumen Hoy",
          value: `${workoutMetrics.totalVolumeKg.toLocaleString("es-CO")} kg`,
          icon: "⚡",
        },
        { label: "Hidratación", value: `${waterGlasses} vasos`, icon: "💧" },
      ]}
      roomTheme={{
        wallColor: "#3B2D26",
        floorPattern: "wood",
        ambientWarmth: "fireplace",
      }}
    >
      {/* =========================================================================
          TAB 1: ENTRENAMIENTO & ESFUERZO ACTIVO
         ========================================================================= */}
      {activeTab === "session" && (
        <div className="space-y-6">
          {/* Fila Superior: Cronómetro Universal + Selector de Enfoque */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cronómetro Universal con Control de Sesión */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 sm:p-6 shadow-[0_6px_0_#3A2E2B] flex flex-col items-center justify-center text-center space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-[#314C3C]">
                Temporizador de Esfuerzo Consciente
              </span>
              <div className="font-mono text-4xl sm:text-5xl font-black text-[#3A2E2B] tracking-tight bg-[#F7F4EB] px-6 py-3 rounded-2xl border-3 border-[#3A2E2B] shadow-inner">
                {formattedTime}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block h-3 w-3 rounded-full ${
                    isActive
                      ? "bg-emerald-500 animate-pulse"
                      : isPaused
                      ? "bg-amber-500"
                      : "bg-slate-300"
                  }`}
                />
                <span className="text-xs font-bold text-[#795548]">
                  {isActive
                    ? "Entrenamiento en curso..."
                    : isPaused
                    ? "En pausa (recuperación activa)"
                    : "Listo para iniciar"}
                </span>
              </div>

              {/* Botones de Control de Sesión */}
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                {!isActive && !isPaused && (
                  <CozyButton
                    variant="forest"
                    size="md"
                    onClick={handleStartWorkout}
                    icon={<Play className="h-4 w-4" />}
                  >
                    Iniciar Entrenamiento
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
                    Pausar
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
                    onClick={handleFinishWorkout}
                    icon={<Square className="h-4 w-4" />}
                  >
                    Finalizar Sesión
                  </CozyButton>
                )}
                {(isActive || isPaused) && (
                  <button
                    type="button"
                    onClick={() => {
                      cancelSession();
                      triggerHaptic("warning");
                    }}
                    className="text-xs font-bold text-rose-700 hover:text-rose-900 transition underline cursor-pointer px-2 py-1"
                  >
                    Descartar
                  </button>
                )}
              </div>
            </div>

            {/* Selector de Rutina Activa & Hidratación */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 sm:p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-[#3A2E2B] flex items-center gap-2">
                  <span>🎯</span> Enfoque de la Rutina
                </h3>
                <span className="text-[10px] font-black uppercase text-[#314C3C] bg-[#EAF3ED] px-2 py-0.5 rounded-full border border-[#314C3C]/20">
                  {activeRoutine.name}
                </span>
              </div>

              {/* Botones de Selección de Rutina */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(
                  Object.keys(GYM_ROUTINES_CATALOG) as GymRoutineKey[]
                ).map((k) => {
                  const r = GYM_ROUTINES_CATALOG[k];
                  const isSel = selectedRoutineKey === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => handleSelectRoutine(k)}
                      className={`rounded-2xl border-2 border-[#3A2E2B] p-2 text-center text-xs font-black transition cursor-pointer ${
                        isSel
                          ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_3px_0_#1A2B20] -translate-y-0.5"
                          : "bg-[#F7F4EB] text-[#3A2E2B] hover:bg-[#E8DFCF]"
                      }`}
                    >
                      <span className="block text-xl mb-0.5">{r.icon}</span>
                      <span className="truncate block text-[11px]">{r.id}</span>
                    </button>
                  );
                })}
              </div>

              {/* Selector de Ejercicio dentro de la Rutina */}
              <div className="border-t border-[#3A2E2B]/10 pt-3 space-y-1.5">
                <label className="block text-xs font-black text-[#3A2E2B]">
                  Ejercicio Principal:
                </label>
                <select
                  value={selectedExerciseName}
                  onChange={(e) => {
                    setSelectedExerciseName(e.target.value);
                    triggerHaptic("light");
                  }}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-2 text-xs font-bold text-[#3A2E2B] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#314C3C]"
                >
                  {activeRoutine.exercises.map((ex) => (
                    <option key={ex.name} value={ex.name}>
                      {ex.name} — {ex.targetMuscle}
                    </option>
                  ))}
                </select>
              </div>

              {/* Control de Hidratación */}
              <div className="flex items-center justify-between border-t border-[#3A2E2B]/10 pt-3">
                <div>
                  <span className="block text-xs font-black text-[#3A2E2B]">
                    Hidratación Consciente
                  </span>
                  <span className="text-[10px] text-[#795548]">
                    Vasos de agua (250 ml cada uno)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWaterGlasses(Math.max(0, waterGlasses - 1));
                      triggerHaptic("light");
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] font-bold text-sm hover:bg-[#E8DFCF] cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-12 text-center font-mono text-sm font-black text-[#3A2E2B]">
                    💧 {waterGlasses}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setWaterGlasses(waterGlasses + 1);
                      triggerHaptic("light");
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] font-bold text-sm hover:bg-[#E8DFCF] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Temporizador de Descanso Interactivo (Rest Timer) */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#EAF3ED] p-5 shadow-[0_5px_0_#3A2E2B] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#314C3C] text-2xl text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]">
                ⏳
              </span>
              <div>
                <span className="text-[10px] font-black uppercase text-[#314C3C] tracking-wider block">
                  Temporizador de Descanso entre Series
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-2xl font-black text-[#2A4331]">
                    {restTimeLeft > 0
                      ? `${Math.floor(restTimeLeft / 60)}:${(restTimeLeft % 60)
                          .toString()
                          .padStart(2, "0")}`
                      : "0:00"}
                  </span>
                  <span className="text-xs text-[#5D4037]">
                    {isResting
                      ? "Descanso en curso (respira hondo)"
                      : "Listo para iniciar descanso"}
                  </span>
                </div>
              </div>
            </div>

            {/* Presets & Controles de Descanso */}
            <div className="flex flex-wrap items-center gap-2">
              {[60, 90, 120, 180].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => startRestTimer(sec)}
                  className={`rounded-xl border-2 border-[#3A2E2B] px-2.5 py-1 text-xs font-black transition cursor-pointer ${
                    restPresetSecs === sec && (isResting || restTimeLeft > 0)
                      ? "bg-[#314C3C] text-[#FFFDF8]"
                      : "bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#F4EEDC]"
                  }`}
                >
                  {sec}s
                </button>
              ))}

              <button
                type="button"
                onClick={toggleRestTimer}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-3 py-1 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#F4EEDC] cursor-pointer"
              >
                {isResting ? "Pausar" : "Iniciar"}
              </button>

              <button
                type="button"
                onClick={resetRestTimer}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-1.5 text-xs text-[#795548] hover:bg-[#F4EEDC] cursor-pointer"
                title="Reiniciar descanso"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Tabla Interactiva de Series (Sets, Repeticiones, Peso, RPE & Checkmark) */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 sm:p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-[#3A2E2B] flex items-center gap-2">
                  <span>📋</span> Registro de Series: {selectedExerciseName}
                </h3>
                <p className="text-xs text-[#795548]">
                  Completa cada serie, ajusta repeticiones, carga en kg y esfuerzo percibido (RPE).
                </p>
              </div>

              <CozyButton
                variant="forest"
                size="sm"
                onClick={handleAddSet}
                icon={<Plus className="h-4 w-4" />}
              >
                Agregar Serie
              </CozyButton>
            </div>

            {/* Cabecera y Filas de Series */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[540px]">
                <thead>
                  <tr className="border-b-2 border-[#3A2E2B]/20 text-[11px] font-black text-[#795548] uppercase tracking-wider">
                    <th className="py-2 px-3 w-14">Serie</th>
                    <th className="py-2 px-3">Repeticiones</th>
                    <th className="py-2 px-3">Peso (kg)</th>
                    <th className="py-2 px-3">RPE (1-10)</th>
                    <th className="py-2 px-3 text-center w-24">Estado</th>
                    <th className="py-2 px-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3A2E2B]/10 text-xs">
                  {workoutSets.map((set, idx) => (
                    <tr
                      key={set.id}
                      className={`transition ${
                        set.completed
                          ? "bg-[#EAF3ED]/60 font-semibold text-[#2A4331]"
                          : "hover:bg-[#F4EEDC]/40"
                      }`}
                    >
                      {/* Número de Serie */}
                      <td className="py-3 px-3 font-mono font-black text-[#3A2E2B]">
                        #{idx + 1}
                      </td>

                      {/* Repeticiones */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSet(
                                set.id,
                                "reps",
                                Math.max(1, set.reps - 1)
                              )
                            }
                            className="h-6 w-6 rounded-lg border border-[#3A2E2B] bg-[#F7F4EB] flex items-center justify-center font-bold text-xs hover:bg-[#E8DFCF]"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            value={set.reps}
                            onChange={(e) =>
                              handleUpdateSet(
                                set.id,
                                "reps",
                                Math.max(1, parseInt(e.target.value) || 1)
                              )
                            }
                            className="w-12 text-center font-mono font-bold rounded-lg border border-[#3A2E2B] bg-[#FFFDF8] py-0.5"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSet(set.id, "reps", set.reps + 1)
                            }
                            className="h-6 w-6 rounded-lg border border-[#3A2E2B] bg-[#F7F4EB] flex items-center justify-center font-bold text-xs hover:bg-[#E8DFCF]"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Peso en kg */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSet(
                                set.id,
                                "weightKg",
                                Math.max(0, set.weightKg - 2)
                              )
                            }
                            className="h-6 w-6 rounded-lg border border-[#3A2E2B] bg-[#F7F4EB] flex items-center justify-center font-bold text-xs hover:bg-[#E8DFCF]"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            step="0.5"
                            value={set.weightKg}
                            onChange={(e) =>
                              handleUpdateSet(
                                set.id,
                                "weightKg",
                                Math.max(0, parseFloat(e.target.value) || 0)
                              )
                            }
                            className="w-14 text-center font-mono font-bold rounded-lg border border-[#3A2E2B] bg-[#FFFDF8] py-0.5"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateSet(
                                set.id,
                                "weightKg",
                                set.weightKg + 2
                              )
                            }
                            className="h-6 w-6 rounded-lg border border-[#3A2E2B] bg-[#F7F4EB] flex items-center justify-center font-bold text-xs hover:bg-[#E8DFCF]"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* RPE (Escala Borg 1-10) */}
                      <td className="py-3 px-3">
                        <select
                          value={set.rpe}
                          onChange={(e) =>
                            handleUpdateSet(
                              set.id,
                              "rpe",
                              parseInt(e.target.value) || 7
                            )
                          }
                          className="rounded-lg border border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1 text-xs font-bold text-[#3A2E2B]"
                        >
                          {[5, 6, 7, 8, 9, 10].map((r) => (
                            <option key={r} value={r}>
                              RPE {r} ({RPE_DESCRIPTIONS[r]?.split("(")[1]?.replace(")", "") || "esfuerzo"})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Checkbox de Finalización */}
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleSetCompleted(set.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border-2 font-black text-xs transition cursor-pointer ${
                            set.completed
                              ? "border-[#314C3C] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                              : "border-[#3A2E2B] bg-[#F7F4EB] text-[#795548] hover:bg-[#E8DFCF]"
                          }`}
                        >
                          <CheckCircle2
                            className={`h-3.5 w-3.5 ${
                              set.completed ? "text-[#FFFDF8]" : "text-gray-400"
                            }`}
                          />
                          <span>{set.completed ? "Lista" : "Hacer"}</span>
                        </button>
                      </td>

                      {/* Eliminar Serie */}
                      <td className="py-3 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteSet(set.id)}
                          className="text-[#795548] hover:text-rose-600 transition p-1"
                          title="Eliminar serie"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Resumen Métrico de la Sesión en Curso */}
            <div className="grid grid-cols-3 gap-3 border-t-2 border-[#3A2E2B]/10 pt-3">
              <div className="text-center bg-[#F7F4EB] p-2.5 rounded-2xl border border-[#3A2E2B]/20">
                <span className="text-[10px] font-bold text-[#795548] uppercase block">
                  Series Listas
                </span>
                <span className="font-mono text-base font-black text-[#3A2E2B]">
                  {workoutMetrics.completedCount} / {workoutMetrics.totalCount}
                </span>
              </div>

              <div className="text-center bg-[#F7F4EB] p-2.5 rounded-2xl border border-[#3A2E2B]/20">
                <span className="text-[10px] font-bold text-[#795548] uppercase block">
                  Tonelaje Movido
                </span>
                <span className="font-mono text-base font-black text-[#314C3C]">
                  {workoutMetrics.totalVolumeKg.toLocaleString("es-CO")} kg
                </span>
              </div>

              <div className="text-center bg-[#F7F4EB] p-2.5 rounded-2xl border border-[#3A2E2B]/20">
                <span className="text-[10px] font-bold text-[#795548] uppercase block">
                  RPE Medio
                </span>
                <span className="font-mono text-base font-black text-[#3A2E2B]">
                  {workoutMetrics.avgRpe} / 10
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: CATÁLOGO DE RUTINAS & EJERCICIOS
         ========================================================================= */}
      {activeTab === "routines" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {(
              Object.keys(GYM_ROUTINES_CATALOG) as GymRoutineKey[]
            ).map((k) => {
              const routine = GYM_ROUTINES_CATALOG[k];
              const isCurrent = selectedRoutineKey === k;
              return (
                <div
                  key={k}
                  className={`rounded-3xl border-4 border-[#3A2E2B] p-5 space-y-3.5 transition ${
                    isCurrent
                      ? "bg-[#FFFDF8] shadow-[0_6px_0_#3A2E2B] ring-2 ring-[#314C3C]"
                      : "bg-[#FFFDF8] shadow-[0_4px_0_#3A2E2B]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B]">
                        {routine.icon}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-[#3A2E2B]">
                          {routine.name}
                        </h4>
                        <span className="text-[10px] font-bold text-[#795548]">
                          Descanso sugerido: {routine.defaultRestSecs}s
                        </span>
                      </div>
                    </div>
                    {isCurrent && (
                      <span className="rounded-full bg-[#314C3C] text-[#FFFDF8] text-[9px] font-black px-2 py-0.5">
                        Activa
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#5D4037] leading-relaxed">
                    {routine.tagline}
                  </p>

                  {/* Lista de Ejercicios de la Rutina */}
                  <div className="space-y-2 border-t border-[#3A2E2B]/10 pt-2.5">
                    {routine.exercises.map((ex) => (
                      <div
                        key={ex.name}
                        className="rounded-xl border border-[#3A2E2B]/20 bg-[#F7F4EB] p-2.5 flex items-center justify-between gap-2"
                      >
                        <div>
                          <span className="text-xs font-black text-[#3A2E2B] block">
                            {ex.name}
                          </span>
                          <span className="text-[10px] text-[#795548] line-clamp-1">
                            {ex.description}
                          </span>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold text-[#314C3C] bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#314C3C]/20">
                          {ex.targetMuscle.split(",")[0]}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Botón de Cargar en Sesión Activa */}
                  <CozyButton
                    variant={isCurrent ? "forest" : "wood"}
                    size="sm"
                    onClick={() => handleLoadRoutineIntoSession(k)}
                    className="w-full flex items-center justify-center gap-1.5"
                  >
                    <span>Cargar esta Rutina en la Sesión</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </CozyButton>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: GUÍA DE ENTRENAMIENTO, ESCALA RPE & HIDRATACIÓN
         ========================================================================= */}
      {activeTab === "resources" && (
        <div className="space-y-6">
          {/* Tarjeta de la Escala RPE (Borg Modificada) */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B]">
                📊
              </span>
              <div>
                <h3 className="text-base font-black text-[#3A2E2B]">
                  Escala RPE de Esfuerzo Percibido (Borg Modificada)
                </h3>
                <p className="text-xs text-[#795548]">
                  Mide la intensidad del esfuerzo basándote en las repeticiones en reserva (RIR).
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { rpe: 10, title: "RPE 10: Esfuerzo Máximo", desc: "0 repeticiones en reserva. No podías hacer ni una más con buena técnica.", color: "border-rose-400 bg-rose-50 text-rose-900" },
                { rpe: 9, title: "RPE 9: Muy Exigente", desc: "1 repetición en reserva. Esfuerzo alto, ideal para series pico o de fuerza.", color: "border-amber-400 bg-amber-50 text-amber-900" },
                { rpe: 8, title: "RPE 8: Sobrecarga Óptima", desc: "2 repeticiones en reserva. Zona dorada para hipertrofia y progreso constante.", color: "border-emerald-400 bg-emerald-50 text-emerald-900" },
                { rpe: 7, title: "RPE 7: Moderadamente Duro", desc: "3 repeticiones en reserva. Excelente para series de calentamiento pesado y técnica.", color: "border-blue-400 bg-blue-50 text-blue-900" },
              ].map((item) => (
                <div
                  key={item.rpe}
                  className={`rounded-2xl border-2 p-3.5 space-y-1 ${item.color}`}
                >
                  <span className="text-xs font-black block">{item.title}</span>
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Ficha de Bruno: Principios de Fortaleza Serena */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#314C3C] text-2xl text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]">
                🦡
              </span>
              <div>
                <h4 className="text-sm font-black text-[#3A2E2B]">
                  Los 3 Principios de Bruno para el Gimnasio
                </h4>
                <p className="text-xs text-[#795548]">
                  Filosofía de longevidad articular y fuerza sostenible
                </p>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 text-xs text-[#5D4037]">
              <div className="p-3 rounded-2xl bg-[#F7F4EB] border border-[#3A2E2B]/15">
                <strong className="text-[#3A2E2B] block mb-0.5">
                  1. Técnica antes de Carga (Ego Cero)
                </strong>
                Una sentadilla profunda y controlada con 20 kg construye más tejido útil y salud articular que una media repetición con 80 kg.
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F4EB] border border-[#3A2E2B]/15">
                <strong className="text-[#3A2E2B] block mb-0.5">
                  2. Descanso es donde Crecemos
                </strong>
                Respeta los 90 a 120 segundos de pausa entre series pesadas. La recuperación de ATP y fosfocreatina asegura que cada serie tenga calidad motora.
              </div>
              <div className="p-3 rounded-2xl bg-[#F7F4EB] border border-[#3A2E2B]/15">
                <strong className="text-[#3A2E2B] block mb-0.5">
                  3. Constancia sobre Intensidad Esporádica
                </strong>
                Tres entrenamientos de 30 minutos a la semana vencen por goleada a una paliza de 2 horas una vez al mes. Haz que el movimiento sea tu refugio diario.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: HISTORIAL DE ENTRENAMIENTOS & TONELAJE
         ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-[#3A2E2B]">
                  Historial de Sesiones en el Gimnasio
                </h3>
                <p className="text-xs text-[#795548]">
                  Registro cronológico de entrenamientos de fuerza, cardio y movilidad.
                </p>
              </div>
              <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/30 px-3 py-1 text-xs font-black text-[#314C3C]">
                {sportsSessions.length} Registros
              </span>
            </div>

            {sportsSessions.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <span className="text-4xl select-none block">🏋️</span>
                <p className="text-xs text-[#795548] italic">
                  Aún no hay entrenamientos registrados. ¡Selecciona una rutina y completa tu primera serie!
                </p>
                <CozyButton
                  variant="forest"
                  size="sm"
                  onClick={() => setActiveTab("session")}
                >
                  Ir al Entrenamiento Activo
                </CozyButton>
              </div>
            ) : (
              <div className="divide-y divide-[#3A2E2B]/10">
                {sportsSessions.map((ses, i) => (
                  <div
                    key={ses.id || i}
                    className="py-3.5 flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <span className="font-bold text-[#3A2E2B] block">
                        {ses.details || "Entrenamiento general"}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] text-[#795548]">
                        <span>
                          {new Date(
                            ses.timestamp || Date.now()
                          ).toLocaleDateString("es-CO", {
                            dateStyle: "medium",
                          })}
                        </span>
                        <span>•</span>
                        <span className="capitalize">
                          Intensidad: {(ses as { intensity?: string }).intensity || "moderada"}
                        </span>
                      </div>
                    </div>
                    <span className="rounded-full bg-[#314C3C]/15 border border-[#314C3C]/30 px-2.5 py-1 text-xs font-black text-[#314C3C]">
                      +{ses.duration_minutes || 15} min
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {/* =========================================================================
          ESTACIÓN 5: RINCÓN DE BORAN EL GUARDIÁN
         ========================================================================= */}
      {activeTab === "boran" && (
        <div className="space-y-4">
          <ResidentAssistantWidget
            context={{
              residentId: "bruno",
              buildingId: "gimnasio",
              domain: "sports",
              recentSessions: sportsSessions,
            }}
            onPrepareSession={(prepared) => {
              setActiveTab("session");
            }}
          />
        </div>
      )}
    </LivingInteriorRoom>
  );
}
