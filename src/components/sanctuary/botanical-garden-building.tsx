"use client";

import React, { useState } from "react";
import {
  Flower2,
  Sprout,
  Droplets,
  Clock,
  Play,
  Pause,
  Square,
  Sparkles,
  BookOpen,
  Award,
  Plus,
  CheckCircle2,
  Sun,
  ShieldCheck,
} from "lucide-react";
import type { Quest } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";

interface BotanicalGardenBuildingProps {
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  quests?: Quest[];
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

interface PlantSpecimen {
  id: string;
  name: string;
  species: string;
  stage: "seedling" | "growing" | "blooming";
  wateredToday: boolean;
  habitLabel: string;
  bonusGp: number;
  icon: string;
}

interface FieldNote {
  id: string;
  plantName: string;
  date: string;
  moisture: "Húmedo" | "Templado" | "Seco";
  observation: string;
}

const DEFAULT_PLANTS: PlantSpecimen[] = [
  {
    id: "plant_lavender",
    name: "Lavanda de la Serenidad",
    species: "Lavandula angustifolia",
    stage: "blooming",
    wateredToday: false,
    habitLabel: "Pausa consciente de respiración y descanso visual",
    bonusGp: 15,
    icon: "🪻",
  },
  {
    id: "plant_fern",
    name: "Helecho Pluma de Plata",
    species: "Polypodiopsida",
    stage: "growing",
    wateredToday: false,
    habitLabel: "Sesión de foco libre de distracciones",
    bonusGp: 20,
    icon: "🌿",
  },
  {
    id: "plant_sunflower",
    name: "Girasol Matutino",
    species: "Helianthus annuus",
    stage: "blooming",
    wateredToday: false,
    habitLabel: "Luz natural, hidratación matinal y postura",
    bonusGp: 15,
    icon: "🌻",
  },
  {
    id: "plant_mint",
    name: "Menta de la Claridad",
    species: "Mentha spicata",
    stage: "growing",
    wateredToday: false,
    habitLabel: "Infusión tibia y orden de espacio de trabajo",
    bonusGp: 15,
    icon: "🌱",
  },
  {
    id: "plant_clover",
    name: "Trébol Dorado de Racha",
    species: "Trifolium repens",
    stage: "seedling",
    wateredToday: false,
    habitLabel: "Completar la jornada sin castigos ni estrés",
    bonusGp: 25,
    icon: "🍀",
  },
];

const INITIAL_FIELD_NOTES: FieldNote[] = [
  {
    id: "note_1",
    plantName: "Helecho Pluma de Plata",
    date: "Hoy",
    moisture: "Húmedo",
    observation: "Brotaron dos frondas nuevas tras mantener humedad constante y luz tamizada.",
  },
  {
    id: "note_2",
    plantName: "Lavanda de la Serenidad",
    date: "Ayer",
    moisture: "Templado",
    observation: "Aroma suave y espigas firmes. Ideal para acompañar la lectura de la tarde.",
  },
];

export function BotanicalGardenBuilding({
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  quests = [],
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: BotanicalGardenBuildingProps) {
  // Estado del cantero de plantas
  const [plants, setPlants] = useState<PlantSpecimen[]>(DEFAULT_PLANTS);
  const [fieldNotes, setFieldNotes] = useState<FieldNote[]>(INITIAL_FIELD_NOTES);
  const [activeTab, setActiveTab] = useState<"garden" | "notes" | "session">("garden");

  // Formulario de nuevo esqueje / nota de campo
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newPlantName, setNewPlantName] = useState("");
  const [newMoisture, setNewMoisture] = useState<"Húmedo" | "Templado" | "Seco">("Húmedo");
  const [newObservation, setNewObservation] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Motor Universal de Sesión (gardening)
  const {
    session,
    isRunning,
    isPaused,
    formattedTime,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    finishSession,
  } = useUniversalSession("gardening", "pabellon_gardening");

  const [sessionNotes, setSessionNotes] = useState("");

  // Regar una planta (Completar hábito con feedback de bienestar)
  const handleWaterPlant = async (plantId: string) => {
    const targetPlant = plants.find((p) => p.id === plantId);
    if (!targetPlant || targetPlant.wateredToday) return;

    // Vibración suave en dispositivos móviles
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([15, 30, 25]);
    }

    // Actualizar estado visual
    setPlants((prev) =>
      prev.map((p) =>
        p.id === plantId ? { ...p, wateredToday: true, stage: "blooming" } : p
      )
    );

    setFeedbackMsg(`¡Has regado "${targetPlant.name}"! +${targetPlant.bonusGp} GP registrados pacíficamente.`);
    setTimeout(() => setFeedbackMsg(null), 4000);

    // Registrar mediante habit shortcut API
    try {
      const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `water_${Date.now()}`;
      await fetch("/api/shortcuts/habit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          session_domain: "gardening",
          custom_activity: {
            title: `Cuidado Botánico: ${targetPlant.name}`,
            requested_gp: targetPlant.bonusGp,
            earned_xp: 30,
          },
        }),
      });
      await onRefreshState();
    } catch (err) {
      console.warn("[BotanicalGarden] Guardado local ante latencia:", err);
    }
  };

  // Registrar nueva nota de campo
  const handleSaveFieldNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantName.trim() || !newObservation.trim()) return;

    const newNote: FieldNote = {
      id: `fn_${Date.now()}`,
      plantName: newPlantName.trim(),
      date: "Hoy",
      moisture: newMoisture,
      observation: newObservation.trim(),
    };

    setFieldNotes([newNote, ...fieldNotes]);
    setNewPlantName("");
    setNewObservation("");
    setIsAddingNote(false);
    setFeedbackMsg("Esqueje y observación registrados en el Cuaderno de Campo.");
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // Finalizar sesión botánica de calma
  const handleFinishGardeningSession = async () => {
    if (!session) return;
    try {
      await finishSession({
        notes: sessionNotes || "Cuidado de canteros y observación en el invernadero botánico.",
        customPayload: {
          building: "pabellon_gardening",
          plantsCared: plants.filter((p) => p.wateredToday).length,
        },
      });
      await onRefreshState();
      setSessionNotes("");
      setFeedbackMsg("¡Sesión en el Invernadero Botánico completada exitosamente!");
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      console.error("[BotanicalGarden] Error al finalizar sesión:", err);
    }
  };

  const wateredCount = plants.filter((p) => p.wateredToday).length;

  return (
    <div className="space-y-6 text-[#3A2E2B]">
      {/* CABECERA TEMÁTICA DEL INVERNADERO */}
      <div className="rounded-3xl border-3 border-[#5C4033] bg-[#E8EFE9] p-5 sm:p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#38523F] bg-[#4E6E58] text-3xl text-white shadow-inner">
            🌿
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#1F2C23]">Invernadero Botánico & Jardín</h2>
              <span className="rounded-full bg-[#4E6E58]/20 border border-[#4E6E58]/40 px-2.5 py-0.5 text-[10px] font-black text-[#2D4533]">
                Nivel {skillLevel} Botánico
              </span>
            </div>
            <p className="text-xs text-[#4F6854]">
              Canteros vivos de hábitos, esquejes recolectados y sesiones de cuidado libre de culpa.
            </p>
          </div>
        </div>

        {/* CONTADOR DE RIEGO DIARIO & REGRESO */}
        <div className="flex flex-wrap items-center gap-2">
          {onClose && (
            <CozyButton
              variant="wood"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-1.5"
            >
              <span>← Volver al Pueblo</span>
            </CozyButton>
          )}
          <div className="flex items-center gap-2 rounded-2xl border-2 border-[#38523F] bg-[#FFFBF2] px-4 py-2 shadow-sm">
            <Droplets className="h-4 w-4 text-[#2A9D8F]" />
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#7A6B62]">Cantero Hoy</span>
              <p className="text-xs font-black text-[#1F2C23]">
                {wateredCount} / {plants.length} Plantas Regadas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* NOTIFICACIÓN FLOTANTE ESTANDARIZADA */}
      {feedbackMsg && (
        <CozyNotification
          variant="success"
          message={feedbackMsg}
          onDismiss={() => setFeedbackMsg(null)}
        />
      )}

      {/* SELECTOR DE PESTAÑAS */}
      <div className="flex rounded-2xl border-2 border-[#5C4033] bg-[#EBE5D8] p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("garden")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "garden" ? "bg-[#4E6E58] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#4E6E58]"
          }`}
        >
          🌱 Cantero de Hábitos Vivos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("notes")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "notes" ? "bg-[#4E6E58] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#4E6E58]"
          }`}
        >
          📖 Cuaderno de Campo Botánico
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("session")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "session" ? "bg-[#4E6E58] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#4E6E58]"
          }`}
        >
          ⏱️ Temporizador de Cuidados
        </button>
      </div>

      {/* PESTAÑA 1: CANTERO DE HÁBITOS VIVOS */}
      {activeTab === "garden" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plants.map((plant) => (
              <div
                key={plant.id}
                className={`relative flex flex-col justify-between rounded-3xl border-3 border-[#5C4033] p-5 shadow-md transition duration-300 ${
                  plant.wateredToday
                    ? "bg-[#F0F6F1] border-[#38523F]"
                    : "bg-[#FFFBF2] hover:-translate-y-0.5 hover:shadow-lg"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{plant.icon}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                        plant.wateredToday
                          ? "bg-[#4E6E58] text-[#F7F4EB]"
                          : "bg-[#EBE5D8] text-[#7A6B62]"
                      }`}
                    >
                      {plant.wateredToday ? "Florecida ✓" : "Requiere Riego"}
                    </span>
                  </div>

                  <h4 className="mt-3 text-sm font-black text-[#1F2C23]">{plant.name}</h4>
                  <p className="text-[10px] italic text-[#6B7C70]">{plant.species}</p>
                  <p className="mt-2 text-xs font-medium text-[#4A5D50]">
                    "{plant.habitLabel}"
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#5C4033]/20 flex items-center justify-between">
                  <span className="text-xs font-black text-[#4E6E58]">+{plant.bonusGp} GP</span>
                  <button
                    type="button"
                    onClick={() => handleWaterPlant(plant.id)}
                    disabled={plant.wateredToday}
                    className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                      plant.wateredToday
                        ? "border-[#4E6E58] bg-[#E8EFE9] text-[#4E6E58] cursor-default"
                        : "border-[#38523F] bg-[#4E6E58] text-[#F7F4EB] hover:bg-[#3D5645] shadow-sm"
                    }`}
                  >
                    <Droplets className="h-3.5 w-3.5" />
                    {plant.wateredToday ? "Regada Hoy" : "Regar Planta"}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* CONSEJO DE BARNABY EL TEJÓN */}
          <div className="rounded-2xl border-2 border-[#38523F] bg-[#E8EFE9] p-4 flex items-center gap-3">
            <span className="text-3xl">🦡</span>
            <div className="text-xs">
              <span className="font-black text-[#1F2C23]">Barnaby el Tejón Botánico:</span>
              <p className="italic text-[#3E5544]">
                "Las raíces más fuertes se forjan con pequeñas gotas diarias, no con tempestades repentinas. Riega con calma."
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: CUADERNO DE CAMPO BOTÁNICO */}
      {activeTab === "notes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-[#5C4033]">
              Registro de Esquejes & Observaciones
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingNote(!isAddingNote)}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#5C4033] bg-[#E9C46A] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-sm hover:bg-[#F4A261] transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAddingNote ? "Cancelar" : "Nuevo Esqueje / Nota"}
            </button>
          </div>

          {/* FORMULARIO DE NUEVA NOTA */}
          {isAddingNote && (
            <form
              onSubmit={handleSaveFieldNote}
              className="rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 shadow-lg space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-black text-[#1F2C23] uppercase">
                Anotar Esqueje u Observación Botánica
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Nombre de la Planta o Esqueje</label>
                  <input
                    type="text"
                    value={newPlantName}
                    onChange={(e) => setNewPlantName(e.target.value)}
                    placeholder="Ej. Helecho Australiano, Orquídea..."
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Humedad del Sustrato</label>
                  <select
                    value={newMoisture}
                    onChange={(e) => setNewMoisture(e.target.value as "Húmedo" | "Templado" | "Seco")}
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                  >
                    <option value="Húmedo">Húmedo (Niebla / Sombra)</option>
                    <option value="Templado">Templado (Luz indirecta)</option>
                    <option value="Seco">Seco (Drenaje rápido)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7A6B62]">Observación de Cuidado</label>
                <textarea
                  value={newObservation}
                  onChange={(e) => setNewObservation(e.target.value)}
                  placeholder="Detalla cómo responde la planta, si han brotado esquejes o raíces nuevas..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-medium text-[#3A2E2B]"
                  required
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border-2 border-[#38523F] bg-[#4E6E58] px-4 py-2 text-xs font-black text-[#F7F4EB] shadow-md hover:bg-[#3D5645] transition cursor-pointer"
              >
                Guardar en la Bitácora de Campo ✓
              </button>
            </form>
          )}

          {/* LISTA DE NOTAS */}
          <div className="space-y-2.5">
            {fieldNotes.map((note) => (
              <div
                key={note.id}
                className="rounded-2xl border-2 border-[#5C4033]/30 bg-[#FFFBF2] p-4 shadow-sm flex flex-wrap items-start justify-between gap-2"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-[#1F2C23]">{note.plantName}</span>
                    <span className="rounded-full bg-[#EBE5D8] px-2 py-0.5 text-[9px] font-bold text-[#5C4033]">
                      Humedad: {note.moisture}
                    </span>
                  </div>
                  <p className="text-xs text-[#5C4033]">{note.observation}</p>
                </div>
                <span className="text-[10px] font-bold text-[#8C7A6B]">{note.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PESTAÑA 3: TEMPORIZADOR DE CUIDADOS BOTÁNICOS */}
      {activeTab === "session" && (
        <div className="rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-6 shadow-md text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full border-3 border-[#38523F] bg-[#E8EFE9] text-3xl">
            ⏱️
          </div>
          <div>
            <h3 className="text-lg font-black text-[#1F2C23]">
              Sesión de Jardinería & Cuidado Consciente
            </h3>
            <p className="text-xs text-[#7A6B62]">
              Dedica un bloque de tiempo a regar, trasplantar o pasear por la naturaleza sin prisas.
            </p>
          </div>

          <div className="text-4xl font-black text-[#1F2C23] tracking-wider py-2 font-mono">
            {formattedTime}
          </div>

          {/* CONTROLES DEL TEMPORIZADOR */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!isRunning ? (
              <CozyButton
                variant="forest"
                size="md"
                icon={<Play className="h-4 w-4 fill-current" />}
                onClick={() => startSession()}
              >
                Iniciar Sesión de Cuidados
              </CozyButton>
            ) : (
              <>
                {isPaused ? (
                  <CozyButton
                    variant="sunlight"
                    size="sm"
                    icon={<Play className="h-4 w-4 fill-current" />}
                    onClick={() => resumeSession()}
                  >
                    Reanudar
                  </CozyButton>
                ) : (
                  <CozyButton
                    variant="wood"
                    size="sm"
                    icon={<Pause className="h-4 w-4" />}
                    onClick={() => pauseSession()}
                  >
                    Pausar
                  </CozyButton>
                )}
                <CozyButton
                  variant="forest"
                  size="sm"
                  icon={<Square className="h-4 w-4 fill-current" />}
                  onClick={handleFinishGardeningSession}
                >
                  Finalizar y Registrar
                </CozyButton>
                <CozyButton
                  variant="cream"
                  size="sm"
                  onClick={() => resetSession()}
                >
                  Descartar
                </CozyButton>
              </>
            )}
          </div>

          {isRunning && (
            <div className="pt-2 max-w-md mx-auto">
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Notas de la sesión botánica..."
                className="w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-medium text-[#3A2E2B]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
