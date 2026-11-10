"use client";

import React, { useState } from "react";
import {
  Compass,
  Mountain,
  MapPin,
  Clock,
  Play,
  Pause,
  Square,
  CheckCircle2,
  Plus,
  Sparkles,
  Footprints,
  ShieldCheck,
  Backpack,
  Award,
} from "lucide-react";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";

interface HikingOutpostBuildingProps {
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
}

interface TrailRoute {
  id: string;
  name: string;
  distanceKm: number;
  elevationGainM: number;
  difficulty: "Fácil" | "Moderado" | "Exigente";
  description: string;
  completedTimes: number;
}

const PRESET_ROUTES: TrailRoute[] = [
  {
    id: "route_oak",
    name: "Sendero del Roble Viejo",
    distanceKm: 3.5,
    elevationGainM: 110,
    difficulty: "Fácil",
    description: "Caminata circular entre árboles centenarios, ideal para despejar la mente y respirar aire fresco.",
    completedTimes: 2,
  },
  {
    id: "route_waterfall",
    name: "Ruta de las Cascadas de Plata",
    distanceKm: 6.2,
    elevationGainM: 260,
    difficulty: "Moderado",
    description: "Sendero ribereño con sonido constante de agua y suelo de agujas de pino.",
    completedTimes: 1,
  },
  {
    id: "route_summit",
    name: "Ascenso al Mirador del Viento",
    distanceKm: 9.0,
    elevationGainM: 490,
    difficulty: "Exigente",
    description: "Subida panorámica con brisa viva que recompensa con una vista completa de Oakhaven.",
    completedTimes: 0,
  },
];

const INITIAL_GEAR_CHECKLIST = [
  { id: "gear_water", label: "Cantimplora de agua fresca (1L+)", checked: true },
  { id: "gear_windbreaker", label: "Cortavientos ligero o capa térmica", checked: true },
  { id: "gear_snacks", label: "Ración de marcha (frutos secos o fruta)", checked: false },
  { id: "gear_firstaid", label: "Botiquín básico y protector solar", checked: true },
  { id: "gear_shoes", label: "Calzado de suela firme y calcetines secos", checked: true },
];

export function HikingOutpostBuilding({
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
}: HikingOutpostBuildingProps) {
  const [routes, setRoutes] = useState<TrailRoute[]>(PRESET_ROUTES);
  const [gearList, setGearList] = useState(INITIAL_GEAR_CHECKLIST);
  const [activeTab, setActiveTab] = useState<"routes" | "gear" | "session">("routes");

  // Formulario de nueva ruta
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRouteName, setNewRouteName] = useState("");
  const [newDistance, setNewDistance] = useState(4.0);
  const [newElevation, setNewElevation] = useState(150);
  const [newDifficulty, setNewDifficulty] = useState<"Fácil" | "Moderado" | "Exigente">("Fácil");
  const [newDescription, setNewDescription] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Motor Universal de Sesión (hiking)
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
  } = useUniversalSession("hiking", "pabellon_hiking");

  const [sessionNotes, setSessionNotes] = useState("");

  const toggleGear = (gearId: string) => {
    setGearList((prev) =>
      prev.map((g) => (g.id === gearId ? { ...g, checked: !g.checked } : g))
    );
  };

  const handleSaveRoute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName.trim()) return;

    const newRoute: TrailRoute = {
      id: `route_${Date.now()}`,
      name: newRouteName.trim(),
      distanceKm: Number(newDistance),
      elevationGainM: Number(newElevation),
      difficulty: newDifficulty,
      description: newDescription.trim() || "Ruta de conexión natural registrada por el usuario.",
      completedTimes: 0,
    };

    setRoutes([newRoute, ...routes]);
    setNewRouteName("");
    setNewDescription("");
    setIsAddingRoute(false);
    setFeedbackMsg(`¡Ruta "${newRoute.name}" añadida a la bitácora del puesto!`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleFinishHikingSession = async () => {
    if (!session) return;
    try {
      await finishSession({
        notes: sessionNotes || "Caminata de conexión con la naturaleza por los senderos de Oakhaven.",
        customPayload: {
          building: "pabellon_hiking",
          gearCheckedCount: gearList.filter((g) => g.checked).length,
        },
      });
      await onRefreshState();
      setSessionNotes("");
      setFeedbackMsg("¡Paseo de senderismo completado y registrado con éxito!");
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      console.error("[HikingOutpost] Error al finalizar sesión:", err);
    }
  };

  const gearReadyCount = gearList.filter((g) => g.checked).length;
  const totalKmWalked = routes.reduce((acc, r) => acc + r.distanceKm * r.completedTimes, 0);

  return (
    <div className="space-y-6 text-[#3A2E2B]">
      {/* CABECERA TEMÁTICA DEL PUESTO */}
      <div className="rounded-3xl border-3 border-[#5C4033] bg-[#EFE4D6] p-5 sm:p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#8C5835] bg-[#D4A373] text-3xl shadow-inner">
            🥾
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#35251C]">Puesto de Senderismo & Rutas</h2>
              <span className="rounded-full bg-[#8C5835]/20 border border-[#8C5835]/40 px-2.5 py-0.5 text-[10px] font-black text-[#5C381E]">
                Nivel {skillLevel} Montañero
              </span>
            </div>
            <p className="text-xs text-[#7A5B46]">
              Exploración consciente, preparación de mochila y caminatas que oxigenan el cuerpo.
            </p>
          </div>
        </div>

        {/* MÉTRICAS RÁPIDAS DE SENDERISMO */}
        <div className="flex items-center gap-2 rounded-2xl border-2 border-[#8C5835] bg-[#FFFBF2] px-4 py-2 shadow-sm">
          <Footprints className="h-4 w-4 text-[#C46A36]" />
          <div>
            <span className="text-[10px] font-extrabold uppercase text-[#7A6B62]">Recorrido Total</span>
            <p className="text-xs font-black text-[#35251C]">
              {totalKmWalked.toFixed(1)} km Caminados
            </p>
          </div>
        </div>
      </div>

      {/* MENSAJE DE FEEDBACK */}
      {feedbackMsg && (
        <div className="rounded-2xl border-2 border-[#8C5835] bg-[#F7EBDD] p-3 text-center text-xs font-black text-[#5C381E] shadow-sm animate-in fade-in">
          🥾 {feedbackMsg}
        </div>
      )}

      {/* PESTAÑAS DE NAVEGACIÓN */}
      <div className="flex rounded-2xl border-2 border-[#5C4033] bg-[#EBE5D8] p-1 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab("routes")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "routes" ? "bg-[#8C5835] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#8C5835]"
          }`}
        >
          🗺️ Bitácora de Senderos
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("gear")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "gear" ? "bg-[#8C5835] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#8C5835]"
          }`}
        >
          🎒 Preparación de Mochila ({gearReadyCount}/{gearList.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("session")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "session" ? "bg-[#8C5835] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#8C5835]"
          }`}
        >
          ⏱️ Temporizador de Marcha
        </button>
      </div>

      {/* PESTAÑA 1: BITÁCORA DE SENDEROS */}
      {activeTab === "routes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-[#5C4033]">
              Senderos & Rutas Disponibles
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingRoute(!isAddingRoute)}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#5C4033] bg-[#E9C46A] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-sm hover:bg-[#F4A261] transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAddingRoute ? "Cancelar" : "Registrar Nueva Ruta"}
            </button>
          </div>

          {/* FORMULARIO DE NUEVA RUTA */}
          {isAddingRoute && (
            <form
              onSubmit={handleSaveRoute}
              className="rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 shadow-lg space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-black text-[#35251C] uppercase">
                Añadir Sendero Personalizado
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Nombre de la Ruta</label>
                  <input
                    type="text"
                    value={newRouteName}
                    onChange={(e) => setNewRouteName(e.target.value)}
                    placeholder="Ej. Bosque de los Sauces..."
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Distancia (km)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newDistance}
                    onChange={(e) => setNewDistance(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Dificultad</label>
                  <select
                    value={newDifficulty}
                    onChange={(e) => setNewDifficulty(e.target.value as "Fácil" | "Moderado" | "Exigente")}
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                  >
                    <option value="Fácil">Fácil (Paseo llano)</option>
                    <option value="Moderado">Moderado (Ondulado)</option>
                    <option value="Exigente">Exigente (Ascenso escarpado)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7A6B62]">Breve Descripción del Entorno</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Tipo de vegetación, puntos de agua, sombra..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-medium text-[#3A2E2B]"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border-2 border-[#8C5835] bg-[#8C5835] px-4 py-2 text-xs font-black text-[#F7F4EB] shadow-md hover:bg-[#6E4226] transition cursor-pointer"
              >
                Añadir Sendero al Mapa ✓
              </button>
            </form>
          )}

          {/* LISTA DE RUTAS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => (
              <div
                key={route.id}
                className="flex flex-col justify-between rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-[#EBE5D8] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#8C5835]">
                      {route.difficulty}
                    </span>
                    <span className="text-[10px] font-bold text-[#7A6B62]">
                      {route.completedTimes} salidas hechas
                    </span>
                  </div>

                  <h4 className="mt-2.5 text-sm font-black text-[#35251C]">{route.name}</h4>
                  <div className="mt-1 flex items-center gap-3 text-xs font-bold text-[#8C5835]">
                    <span>📍 {route.distanceKm} km</span>
                    <span>⛰️ +{route.elevationGainM}m</span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-[#6B5A4E]">
                    {route.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#5C4033]/20 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-[#4E6E58]">
                    +{(route.distanceKm * 10).toFixed(0)} GP Estimados
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setRoutes((prev) =>
                        prev.map((r) =>
                          r.id === route.id ? { ...r, completedTimes: r.completedTimes + 1 } : r
                        )
                      );
                      setFeedbackMsg(`¡Ruta "${route.name}" registrada! Pasos completados.`);
                      setTimeout(() => setFeedbackMsg(null), 3500);
                    }}
                    className="rounded-xl border-2 border-[#8C5835] bg-[#D4A373] px-3 py-1.5 text-xs font-black text-[#35251C] shadow-sm hover:bg-[#C28448] transition cursor-pointer"
                  >
                    Completar Ruta ✓
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* CONSEJO DE TARA LA ZORRA MONTAÑESA */}
          <div className="rounded-2xl border-2 border-[#8C5835] bg-[#EFE4D6] p-4 flex items-center gap-3">
            <span className="text-3xl">🦊</span>
            <div className="text-xs">
              <span className="font-black text-[#35251C]">Tara la Zorra Montañesa:</span>
              <p className="italic text-[#6B503D]">
                "La cima nunca es la meta real; la meta es regresar a casa con los pulmones limpios y la mente serena. Camina a tu propio compás."
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: PREPARACIÓN DE MOCHILA */}
      {activeTab === "gear" && (
        <div className="space-y-4">
          <div className="rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 sm:p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#5C4033]/20 pb-3">
              <div>
                <h3 className="text-sm font-black uppercase text-[#35251C]">
                  Equipo Esencial para el Sendero
                </h3>
                <p className="text-xs text-[#7A6B62]">
                  Un paseo tranquilo comienza con la tranquilidad de tener lo necesario en la mochila.
                </p>
              </div>
              <span className="rounded-full bg-[#EBE5D8] px-3 py-1 text-xs font-black text-[#8C5835]">
                {gearReadyCount === gearList.length ? "¡Mochila Lista! 🎒" : `${gearReadyCount}/${gearList.length} Empacado`}
              </span>
            </div>

            <div className="space-y-2.5">
              {gearList.map((gear) => (
                <div
                  key={gear.id}
                  onClick={() => toggleGear(gear.id)}
                  className={`flex items-center justify-between rounded-2xl border-2 p-3 px-4 transition cursor-pointer ${
                    gear.checked
                      ? "border-[#4E6E58] bg-[#F0F6F1]"
                      : "border-[#5C4033]/30 bg-white hover:bg-[#FDF9F0]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 ${
                        gear.checked
                          ? "border-[#4E6E58] bg-[#4E6E58] text-white"
                          : "border-[#5C4033]/40 bg-white"
                      }`}
                    >
                      {gear.checked && <CheckCircle2 className="h-4 w-4" />}
                    </div>
                    <span
                      className={`text-xs font-bold ${
                        gear.checked ? "text-[#1F2C23]" : "text-[#5C4033]"
                      }`}
                    >
                      {gear.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-extrabold text-[#7A6B62]">
                    {gear.checked ? "En la mochila" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 3: TEMPORIZADOR DE MARCHA */}
      {activeTab === "session" && (
        <div className="rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-6 shadow-md text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full border-3 border-[#8C5835] bg-[#EFE4D6] text-3xl">
            ⏱️
          </div>
          <div>
            <h3 className="text-lg font-black text-[#35251C]">
              Sesión de Marcha & Senderismo
            </h3>
            <p className="text-xs text-[#7A6B62]">
              Activa el cronómetro mientras sales a caminar, subir escaleras o pasear por el parque.
            </p>
          </div>

          <div className="text-4xl font-black text-[#35251C] tracking-wider py-2 font-mono">
            {formattedTime}
          </div>

          {/* CONTROLES */}
          <div className="flex justify-center gap-3">
            {!isRunning ? (
              <button
                type="button"
                onClick={() => startSession()}
                className="inline-flex items-center gap-2 rounded-2xl border-3 border-[#8C5835] bg-[#8C5835] px-5 py-2.5 text-xs font-black text-[#F7F4EB] shadow-md hover:bg-[#6E4226] transition cursor-pointer"
              >
                <Play className="h-4 w-4" /> Iniciar Marcha
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    type="button"
                    onClick={() => resumeSession()}
                    className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#5C4033] bg-[#E9C46A] px-4 py-2 text-xs font-black text-[#3A2E2B] cursor-pointer"
                  >
                    <Play className="h-4 w-4" /> Reanudar
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => pauseSession()}
                    className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#5C4033] bg-[#EBE5D8] px-4 py-2 text-xs font-black text-[#3A2E2B] cursor-pointer"
                  >
                    <Pause className="h-4 w-4" /> Pausar
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleFinishHikingSession}
                  className="inline-flex items-center gap-1.5 rounded-2xl border-3 border-[#8C5835] bg-[#8C5835] px-4 py-2 text-xs font-black text-[#F7F4EB] shadow-md hover:bg-[#6E4226] cursor-pointer"
                >
                  <Square className="h-4 w-4" /> Finalizar y Registrar
                </button>
                <button
                  type="button"
                  onClick={() => resetSession()}
                  className="rounded-2xl border-2 border-red-300 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  Descartar
                </button>
              </>
            )}
          </div>

          {isRunning && (
            <div className="pt-2 max-w-md mx-auto">
              <input
                type="text"
                value={sessionNotes}
                onChange={(e) => setSessionNotes(e.target.value)}
                placeholder="Notas de la caminata (ej. sendero tranquilo, buen clima)..."
                className="w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-medium text-[#3A2E2B]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
