"use client";

import React, { useState } from "react";
import {
  UtensilsCrossed,
  Soup,
  Coffee,
  Clock,
  Play,
  Pause,
  Square,
  Sparkles,
  Plus,
  Flame,
  Award,
  CheckCircle2,
  Heart,
  ArrowLeft,
} from "lucide-react";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";

interface KitchenBuildingProps {
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

interface RecipeItem {
  id: string;
  name: string;
  category: "panaderia" | "infusion" | "plato_caliente" | "desayuno";
  icon: string;
  estimatedMinutes: number;
  ingredients: string;
  bonusGp: number;
  description: string;
  preparedTimes: number;
}

const PRESET_RECIPES: RecipeItem[] = [
  {
    id: "rec_bread",
    name: "Pan Rústico de Masa Madre",
    category: "panaderia",
    icon: "🍞",
    estimatedMinutes: 60,
    ingredients: "Harina integral, agua de manantial, masa madre activa y sal marina",
    bonusGp: 35,
    description: "Corteza crujiente y miga esponjosa forjada con paciencia y fermentación lenta.",
    preparedTimes: 1,
  },
  {
    id: "rec_tea",
    name: "Infusión Serenidad de Oakhaven",
    category: "infusion",
    icon: "🍵",
    estimatedMinutes: 10,
    ingredients: "Flores de manzanilla, hojas de menta fresca y un toque de lavanda",
    bonusGp: 15,
    description: "Taza caliente para desvanecer la tensión del día y calmar el ritmo cardíaco.",
    preparedTimes: 3,
  },
  {
    id: "rec_stew",
    name: "Guiso Campesino de Lentejas y Raíces",
    category: "plato_caliente",
    icon: "🍲",
    estimatedMinutes: 45,
    ingredients: "Lentejas pardinas, calabaza asada, zanahoria, laurel y aceite de oliva",
    bonusGp: 30,
    description: "Plato caliente a fuego suave que nutre el cuerpo tras un largo día de labores.",
    preparedTimes: 2,
  },
  {
    id: "rec_oats",
    name: "Gachas Tibias de Avena y Manzana",
    category: "desayuno",
    icon: "🥣",
    estimatedMinutes: 15,
    ingredients: "Copos de avena fina, bebida vegetal, manzana en cubos, canela y nueces",
    bonusGp: 20,
    description: "Energía constante para empezar la jornada con calidez y sin pesadez.",
    preparedTimes: 4,
  },
];

export function KitchenBuilding({
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: KitchenBuildingProps) {
  const [recipes, setRecipes] = useState<RecipeItem[]>(PRESET_RECIPES);
  const [activeTab, setActiveTab] = useState<"recipes" | "timer" | "alchemy">("recipes");

  // Formulario de nueva receta
  const [isAddingRecipe, setIsAddingRecipe] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [newCategory, setNewCategory] = useState<"panaderia" | "infusion" | "plato_caliente" | "desayuno">("plato_caliente");
  const [newMinutes, setNewMinutes] = useState(30);
  const [newIngredients, setNewIngredients] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Motor Universal de Sesión (cooking)
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
  } = useUniversalSession("cooking", "cocina");

  const [sessionNotes, setSessionNotes] = useState("");

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName.trim()) return;

    const newRecipe: RecipeItem = {
      id: `rec_${Date.now()}`,
      name: newRecipeName.trim(),
      category: newCategory,
      icon: newCategory === "infusion" ? "🍵" : newCategory === "panaderia" ? "🥖" : newCategory === "desayuno" ? "🥣" : "🍲",
      estimatedMinutes: Number(newMinutes),
      ingredients: newIngredients.trim() || "Ingredientes seleccionados con calma",
      bonusGp: Math.round(Number(newMinutes) * 0.75),
      description: newDescription.trim() || "Preparación culinaria consciente en los fogones de Oakhaven.",
      preparedTimes: 0,
    };

    setRecipes([newRecipe, ...recipes]);
    setNewRecipeName("");
    setNewIngredients("");
    setNewDescription("");
    setIsAddingRecipe(false);
    setFeedbackMsg(`¡Receta "${newRecipe.name}" agregada al Recetario Oficial!`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handlePrepareRecipe = (recipeId: string) => {
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipeId ? { ...r, preparedTimes: r.preparedTimes + 1 } : r
      )
    );
    const target = recipes.find((r) => r.id === recipeId);
    if (target) {
      setFeedbackMsg(`¡Has preparado "${target.name}"! +${target.bonusGp} GP registrados pacíficamente.`);
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleFinishCookingSession = async () => {
    if (!session) return;
    try {
      await finishSession({
        notes: sessionNotes || "Sesión de cocina consciente y nutrición a fuego lento.",
        customPayload: {
          building: "cocina",
          recipesCatalogCount: recipes.length,
        },
      });
      await onRefreshState();
      setSessionNotes("");
      setFeedbackMsg("¡Sesión culinaria completada y registrada exitosamente!");
      setTimeout(() => setFeedbackMsg(null), 4000);
    } catch (err) {
      console.error("[KitchenBuilding] Error al finalizar sesión:", err);
    }
  };

  const totalPreparedCount = recipes.reduce((acc, r) => acc + r.preparedTimes, 0);

  return (
    <div className="space-y-6 text-[#3A2E2B]">
      {/* CABECERA DE LA COCINA */}
      <div className="rounded-3xl border-3 border-[#5C4033] bg-[#F7EBE1] p-5 sm:p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#C46A36] bg-[#E76F51] text-3xl text-white shadow-inner">
            🍳
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-[#35251C]">Cocina & Alquimia Culinaria</h2>
              <span className="rounded-full bg-[#E76F51]/20 border border-[#E76F51]/40 px-2.5 py-0.5 text-[10px] font-black text-[#963E26]">
                Nivel {skillLevel} Alquimista del Sabor
              </span>
            </div>
            <p className="text-xs text-[#7A5B46]">
              Fuego suave, fermentación paciente y alimentos que nutren el espíritu.
            </p>
          </div>
        </div>

        {/* MÉTRICA RÁPIDA & REGRESO */}
        <div className="flex flex-wrap items-center gap-2">
          {onClose && (
            <CozyButton
              variant="wood"
              size="sm"
              onClick={onClose}
              className="flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al Pueblo</span>
            </CozyButton>
          )}
          <div className="flex items-center gap-2 rounded-2xl border-2 border-[#C46A36] bg-[#FFFBF2] px-4 py-2 shadow-sm">
            <Flame className="h-4 w-4 text-[#E76F51]" />
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[#7A6B62]">Elaboraciones</span>
              <p className="text-xs font-black text-[#35251C]">
                {totalPreparedCount} Preparaciones Realizadas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* MENSAJE DE FEEDBACK ESTANDARIZADO */}
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
          onClick={() => setActiveTab("recipes")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "recipes" ? "bg-[#C46A36] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#C46A36]"
          }`}
        >
          📜 Recetario Consciente ({recipes.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("timer")}
          className={`flex-1 rounded-xl py-2 transition cursor-pointer ${
            activeTab === "timer" ? "bg-[#C46A36] text-[#F7F4EB] shadow-sm font-black" : "hover:text-[#C46A36]"
          }`}
        >
          ⏱️ Temporizador de Fogones
        </button>
      </div>

      {/* PESTAÑA 1: RECETARIO */}
      {activeTab === "recipes" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-[#5C4033]">
              Recetas & Elixires de Oakhaven
            </h3>
            <button
              type="button"
              onClick={() => setIsAddingRecipe(!isAddingRecipe)}
              className="inline-flex items-center gap-1 rounded-xl border-2 border-[#5C4033] bg-[#E9C46A] px-3 py-1.5 text-xs font-black text-[#3A2E2B] shadow-sm hover:bg-[#F4A261] transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              {isAddingRecipe ? "Cancelar" : "Nueva Receta"}
            </button>
          </div>

          {/* FORMULARIO DE NUEVA RECETA */}
          {isAddingRecipe && (
            <form
              onSubmit={handleSaveRecipe}
              className="rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 shadow-lg space-y-3 animate-in fade-in"
            >
              <h4 className="text-xs font-black text-[#35251C] uppercase">
                Añadir Receta al Fogón
              </h4>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Nombre de la Receta</label>
                  <input
                    type="text"
                    value={newRecipeName}
                    onChange={(e) => setNewRecipeName(e.target.value)}
                    placeholder="Ej. Sopa de Calabaza y Romero..."
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as "panaderia" | "infusion" | "plato_caliente" | "desayuno")}
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                  >
                    <option value="plato_caliente">Plato Caliente / Guiso</option>
                    <option value="panaderia">Panadería / Masa Madre</option>
                    <option value="infusion">Infusión / Elixir</option>
                    <option value="desayuno">Desayuno Nutritivo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#7A6B62]">Tiempo Estimado (min)</label>
                  <input
                    type="number"
                    value={newMinutes}
                    onChange={(e) => setNewMinutes(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-bold text-[#3A2E2B]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7A6B62]">Ingredientes Principales</label>
                <input
                  type="text"
                  value={newIngredients}
                  onChange={(e) => setNewIngredients(e.target.value)}
                  placeholder="Detalla los alimentos reales..."
                  className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-medium text-[#3A2E2B]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#7A6B62]">Notas de Preparación & Cariño</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Instrucciones breves o sensación al cocinar..."
                  rows={2}
                  className="mt-1 w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-medium text-[#3A2E2B]"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl border-2 border-[#C46A36] bg-[#C46A36] px-4 py-2 text-xs font-black text-[#F7F4EB] shadow-md hover:bg-[#A85526] transition cursor-pointer"
              >
                Guardar en el Recetario ✓
              </button>
            </form>
          )}

          {/* LISTA DE RECETAS */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {recipes.map((recipe) => (
              <div
                key={recipe.id}
                className="flex flex-col justify-between rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-5 shadow-md hover:-translate-y-0.5 hover:shadow-lg transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{recipe.icon}</span>
                      <span className="rounded-full bg-[#EBE5D8] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#C46A36]">
                        {recipe.category.replace("_", " ")}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-[#7A6B62]">
                      {recipe.preparedTimes} veces hecha
                    </span>
                  </div>

                  <h4 className="mt-3 text-sm font-black text-[#35251C]">{recipe.name}</h4>
                  <p className="mt-1 text-[11px] font-semibold text-[#8C5835]">
                    ⏱️ {recipe.estimatedMinutes} minutos de cocción/reposo
                  </p>
                  <p className="mt-1 text-xs italic text-[#7A6B62]">
                    🌱 {recipe.ingredients}
                  </p>
                  <p className="mt-2 text-xs font-medium text-[#4A3D36]">
                    {recipe.description}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#5C4033]/20 flex items-center justify-between">
                  <span className="text-xs font-black text-[#4E6E58]">+{recipe.bonusGp} GP</span>
                  <button
                    type="button"
                    onClick={() => handlePrepareRecipe(recipe.id)}
                    className="inline-flex items-center gap-1 rounded-xl border-2 border-[#C46A36] bg-[#F4A261] px-3.5 py-1.5 text-xs font-black text-[#35251C] shadow-sm hover:bg-[#E76F51] hover:text-white transition cursor-pointer"
                  >
                    Preparar Receta ✓
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* CONSEJO DE OLIVER EL ERIZO */}
          <div className="rounded-2xl border-2 border-[#C46A36] bg-[#F7EBE1] p-4 flex items-center gap-3">
            <span className="text-3xl">🦔</span>
            <div className="text-xs">
              <span className="font-black text-[#35251C]">Oliver el Erizo Panadero:</span>
              <p className="italic text-[#7A5B46]">
                "Cocinar con prisa estropea el pan y agota el ánimo. Cuando amases o remuevas el caldo, enfoca tu atención en el aroma y agradece el alimento."
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PESTAÑA 2: TEMPORIZADOR DE FOGONES */}
      {activeTab === "timer" && (
        <div className="rounded-3xl border-3 border-[#5C4033] bg-[#FFFBF2] p-6 shadow-md text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full border-3 border-[#C46A36] bg-[#F7EBE1] text-3xl">
            ⏱️
          </div>
          <div>
            <h3 className="text-lg font-black text-[#35251C]">
              Temporizador de Fuego Lento & Fermentación
            </h3>
            <p className="text-xs text-[#7A6B62]">
              Acompaña tu tiempo de cocción, preparación de masas o reposo de infusiones con presencia plena.
            </p>
          </div>

          <div className="text-4xl font-black text-[#35251C] tracking-wider py-2 font-mono">
            {formattedTime}
          </div>

          {/* CONTROLES */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!isRunning ? (
              <CozyButton
                variant="clay"
                size="md"
                icon={<Play className="h-4 w-4 fill-current" />}
                onClick={() => startSession()}
              >
                Iniciar Sesión de Cocina
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
                  variant="clay"
                  size="sm"
                  icon={<Square className="h-4 w-4 fill-current" />}
                  onClick={handleFinishCookingSession}
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
                placeholder="Notas de la preparación (aromas, texturas, tiempo de reposo)..."
                className="w-full rounded-xl border-2 border-[#5C4033] bg-white p-2 text-xs font-medium text-[#3A2E2B]"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
