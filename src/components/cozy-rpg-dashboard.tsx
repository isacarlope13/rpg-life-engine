"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Home,
  LayoutGrid,
  Scroll,
  Archive,
  Users,
  Image as ImageIcon,
  Palette,
  FileText,
  Sun,
  CloudSun,
  CloudRain,
  MapPin,
  Sparkles,
  CheckCircle2,
  Fish,
  Bug,
  Compass,
  Hammer,
  Pickaxe,
  Heart,
  Copy,
  Check,
  ChevronRight,
  Maximize2,
  X,
  Volume2,
  TreePine,
  Coffee,
  Coins,
  Shield,
  Apple,
} from "lucide-react";

// Tipos de datos para el Cozy RPG Dashboard
export type NavItem =
  | "home"
  | "overview"
  | "quests"
  | "collections"
  | "party"
  | "gallery"
  | "design"
  | "notes";

export interface QuestItem {
  id: string;
  title: string;
  category: "gather" | "build" | "explore" | "craft";
  icon: string;
  current: number;
  total: number;
  reward: number; // Bell-coins / Oro
  completed: boolean;
}

export interface CollectionCategory {
  id: string;
  name: string;
  icon: string;
  current: number;
  total: number;
  color: string;
}

export interface ResidentNpc {
  id: string;
  name: string;
  role: string;
  species: string;
  avatar: string;
  friendshipHearts: number; // 1 a 5
  favoriteGift: string;
  quote: string;
}

export function CozyRpgDashboard() {
  const [activeTab, setActiveTab] = useState<NavItem>("home");
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [weatherIndex, setWeatherIndex] = useState(0);
  const [copiedSaveCode, setCopiedSaveCode] = useState(false);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);
  const [selectedResident, setSelectedResident] = useState<ResidentNpc | null>(null);

  // Mascota interactiva
  const petDialogues = [
    "¡Buenos días, Guardián! La brisa en el huerto huele a manzanas frescas. 🍎",
    "¡Has avanzado un montón en las misiones de hoy! Recuerda descansar un rato. ☕",
    "¡El río del norte tiene cardúmenes dorados hoy! Prepara la caña de pescar. 🎣",
    "¡Oakhaven tiene una calificación de 4.8 estrellas! Todos los aldeanos están felices. ⭐",
    "¡Mira hacia arriba! Las nubes tienen forma de dragón dormilón hoy. ☁️",
  ];
  const [petDialogueIndex, setPetDialogueIndex] = useState(0);
  const [petClickAnim, setPetClickAnim] = useState(false);

  // Misiones interactivas
  const [quests, setQuests] = useState<QuestItem[]>([
    {
      id: "q1",
      title: "Recolectar manzanas silvestres en el Huerto del Roble",
      category: "gather",
      icon: "🍎",
      current: 4,
      total: 5,
      reward: 150,
      completed: false,
    },
    {
      id: "q2",
      title: "Construir puente de troncos sobre el Río Esmeralda",
      category: "build",
      icon: "🪵",
      current: 68,
      total: 100,
      reward: 500,
      completed: false,
    },
    {
      id: "q3",
      title: "Explorar las ruinas cubiertas de musgo en la Colina Este",
      category: "explore",
      icon: "🧭",
      current: 2,
      total: 3,
      reward: 300,
      completed: false,
    },
    {
      id: "q4",
      title: "Hornear pan de bayas para el festival comunal",
      category: "craft",
      icon: "🥖",
      current: 1,
      total: 2,
      reward: 200,
      completed: false,
    },
  ]);

  // Colecciones del museo / reino
  const [collections, setCollections] = useState<CollectionCategory[]>([
    { id: "fish", name: "Peces de Río & Mar", icon: "🐟", current: 43, total: 80, color: "#4E6E58" },
    { id: "bugs", name: "Insectos & Mariposas", icon: "🦋", current: 29, total: 50, color: "#E9C46A" },
    { id: "fossils", name: "Fósiles & Reliquias", icon: "🏺", current: 14, total: 30, color: "#D4A373" },
    { id: "recipes", name: "Recetas de Taller", icon: "📜", current: 62, total: 100, color: "#E76F51" },
  ]);

  // Compañeros y habitantes
  const residents: ResidentNpc[] = [
    {
      id: "npc1",
      name: "Barnaby",
      role: "Maestro Botánico",
      species: "Tejón Erudito",
      avatar: "🦡",
      friendshipHearts: 5,
      favoriteGift: "Semillas de Lavanda Silvestre",
      quote: "Las plantas crecen mejor cuando se les habla con calma y paciencia.",
    },
    {
      id: "npc2",
      name: "Flora",
      role: "Guardiana del Huerto",
      species: "Coneja Aventurera",
      avatar: "🐇",
      friendshipHearts: 4,
      favoriteGift: "Té de Menta y Miel",
      quote: "¡El rocío matutino es el mejor fertilizante para el espíritu!",
    },
    {
      id: "npc3",
      name: "Grimble",
      role: "Herrero Mayor",
      species: "Oso Artesano",
      avatar: "🐻",
      friendshipHearts: 4,
      favoriteGift: "Mineral de Cobre Pulido",
      quote: "Golpea el yunque con ritmo; el hierro sabe cuando estás distraído.",
    },
    {
      id: "npc4",
      name: "Pip",
      role: "Cartero Real",
      species: "Zorro Veloz",
      avatar: "🦊",
      friendshipHearts: 5,
      favoriteGift: "Pan tostado con mermelada",
      quote: "¡Ninguna colina es muy empinada si llevas cartas de buenos amigos!",
    },
    {
      id: "npc5",
      name: "Lyra",
      role: "Bibliotecaria Mística",
      species: "Búho Astrónomo",
      avatar: "🦉",
      friendshipHearts: 3,
      favoriteGift: "Pergamino Encantado",
      quote: "Las estrellas de esta noche tienen mucho que contarnos sobre el invierno.",
    },
  ];

  const saveCode = "DA-4892-0193-OAK";

  // Climas interactivos
  const weathers = [
    { label: "Soleado & Cálido", icon: Sun, temp: "22°C", desc: "Brisa dulce de colina" },
    { label: "Llovizna Mágica", icon: CloudRain, temp: "18°C", desc: "Ideal para pescar carpas" },
    { label: "Parcialmente Nublado", icon: CloudSun, temp: "20°C", desc: "Perfecto para recolectar bayas" },
  ];

  // Reloj y fecha en vivo
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
      setCurrentDate(
        now.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Función para avanzar progreso de una misión
  const handleAdvanceQuest = (id: string) => {
    setQuests((prev) =>
      prev.map((q) => {
        if (q.id === id && !q.completed) {
          const nextVal = Math.min(q.total, q.current + 1);
          return {
            ...q,
            current: nextVal,
            completed: nextVal >= q.total,
          };
        }
        return q;
      })
    );
  };

  // Copiar código de isla
  const handleCopyCode = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(saveCode);
      setCopiedSaveCode(true);
      setTimeout(() => setCopiedSaveCode(false), 2500);
    }
  };

  // Click en mascota
  const handlePetClick = () => {
    setPetClickAnim(true);
    setPetDialogueIndex((prev) => (prev + 1) % petDialogues.length);
    setTimeout(() => setPetClickAnim(false), 300);
  };

  const activeWeather = weathers[weatherIndex];
  const WeatherIcon = activeWeather.icon;

  return (
    <div className="min-h-screen bg-[#F7F4EB] text-[#3A2E2B] font-sans antialiased selection:bg-[#E9C46A]/40 pb-12">
      {/* =========================================================================
          CONTENEDOR MAESTRO (SIDEBAR FIJO + CONTENIDO BENTO)
         ========================================================================= */}
      <div className="mx-auto max-w-[1550px] p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* =====================================================================
              1. SIDEBAR IZQUIERDO: MARCO DE MADERA & MENÚ INVENTARIO
             ===================================================================== */}
          <aside className="lg:col-span-3 xl:col-span-3 space-y-6">
            {/* Cabecera: Letrero de madera con clavos rústicos */}
            <div className="relative rounded-3xl border-4 border-[#3A2E2B] bg-[#E8DFCF] p-5 shadow-[0_6px_0_#3A2E2B] transition-transform hover:-translate-y-0.5">
              {/* Tornillos/remaches rústicos en las esquinas */}
              <span className="absolute top-2.5 left-3 text-xs opacity-70">🔩</span>
              <span className="absolute top-2.5 right-3 text-xs opacity-70">🔩</span>
              <span className="absolute bottom-2.5 left-3 text-xs opacity-70">🔩</span>
              <span className="absolute bottom-2.5 right-3 text-xs opacity-70">🔩</span>

              <div className="text-center">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#E9C46A] shadow-[0_3px_0_#3A2E2B] mb-2 text-2xl">
                  🏰
                </div>
                <span className="block text-[11px] font-extrabold tracking-wider uppercase text-[#4E6E58]">
                  Bienvenido al Reino
                </span>
                <h1 className="text-xl font-black text-[#3A2E2B] tracking-tight">
                  Valle de Oakhaven
                </h1>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[#4E6E58]/15 px-3 py-1 border-2 border-[#4E6E58]/30 text-xs font-black text-[#4E6E58]">
                  <Sparkles className="h-3.5 w-3.5" /> Temporada de Otoño
                </div>
              </div>
            </div>

            {/* Menú de Navegación estilo Inventario de Consola */}
            <nav className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-3 shadow-[0_6px_0_#3A2E2B]">
              <div className="px-3 py-2 border-b-2 border-[#3A2E2B]/10 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#795548]">
                  Bolsa de Aventura
                </span>
                <span className="text-xs">🎒</span>
              </div>

              <div className="mt-2 space-y-1.5">
                {[
                  { id: "home", label: "Inicio (Hem)", icon: Home, badge: "Activo" },
                  { id: "overview", label: "Resumen (Översikt)", icon: LayoutGrid, badge: "4.8★" },
                  { id: "quests", label: "Misiones (Uppgifter)", icon: Scroll, badge: `${quests.filter(q => !q.completed).length}` },
                  { id: "collections", label: "Colecciones (Samlingar)", icon: Archive, badge: "148" },
                  { id: "party", label: "Compañeros (Invånare)", icon: Users, badge: "5" },
                  { id: "gallery", label: "Galería (Bilder)", icon: ImageIcon, badge: null },
                  { id: "design", label: "Taller & Diseño", icon: Palette, badge: null },
                  { id: "notes", label: "Bitácora (Anteckningar)", icon: FileText, badge: "3" },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id as NavItem)}
                      className={`w-full group flex items-center justify-between rounded-2xl border-[3px] px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                        isActive
                          ? "border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_4px_0_#3A2E2B] -translate-y-0.5"
                          : "border-transparent bg-transparent text-[#3A2E2B] hover:border-[#3A2E2B]/30 hover:bg-[#F2ECE1] hover:-translate-y-0.5 hover:shadow-[0_2px_0_#3A2E2B]/20"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-xl border-2 transition-transform group-hover:scale-110 ${
                            isActive
                              ? "border-[#FFFDF8] bg-[#3D5745] text-[#FFFDF8]"
                              : "border-[#3A2E2B]/30 bg-[#E8DFCF] text-[#3A2E2B]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="text-left font-extrabold">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black border ${
                            isActive
                              ? "border-[#FFFDF8] bg-[#E9C46A] text-[#3A2E2B]"
                              : "border-[#3A2E2B]/20 bg-[#E8DFCF] text-[#5C4033]"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Mascota Interactiva del Reino */}
            <div
              onClick={handlePetClick}
              className={`group relative rounded-3xl border-4 border-[#3A2E2B] bg-[#FFF5E4] p-4 shadow-[0_6px_0_#3A2E2B] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_8px_0_#3A2E2B] select-none ${
                petClickAnim ? "scale-95" : ""
              }`}
              title="¡Haz clic en Pip para escuchar un consejo del reino!"
            >
              {/* Bocadillo de diálogo estilo RPG cómico */}
              <div className="relative mb-3 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-xs leading-relaxed text-[#3A2E2B] font-bold shadow-[0_2px_0_#3A2E2B]">
                <p>{petDialogues[petDialogueIndex]}</p>
                {/* Flecha del bocadillo */}
                <div className="absolute -bottom-2 left-6 h-3 w-3 rotate-45 border-b-2 border-r-2 border-[#3A2E2B] bg-[#FFFDF8]" />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#E9C46A] shadow-[0_3px_0_#3A2E2B] text-3xl group-hover:rotate-6 transition-transform">
                    🦊
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#4E6E58] border border-[#3A2E2B] text-[9px] text-white">
                      💬
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-[#3A2E2B]">Pip el Guardián</h4>
                    <span className="text-[11px] font-bold text-[#795548]">Espíritu de Bosque</span>
                  </div>
                </div>

                <span className="rounded-xl border border-[#3A2E2B]/20 bg-[#E8DFCF] px-2.5 py-1 text-[10px] font-black text-[#4E6E58]">
                  Tócame ✨
                </span>
              </div>
            </div>

            {/* Acceso rápido a volver al dashboard principal */}
            <div className="text-center">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#3A2E2B] bg-[#E8DFCF] px-4 py-2 text-xs font-black text-[#3A2E2B] shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 transition-all"
              >
                ← Volver al Dashboard Principal
              </Link>
            </div>
          </aside>

          {/* =====================================================================
              2. ÁREA PRINCIPAL DERECHA (HEADER FLOTANTE + BENTO GRID)
             ===================================================================== */}
          <main className="lg:col-span-9 xl:col-span-9 space-y-6">
            
            {/* ===================================================================
                BARRA SUPERIOR (HEADER): WIDGET PERGAMINO CLIMA, FECHA Y RELOJ
               =================================================================== */}
            <header className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] flex flex-wrap items-center justify-between gap-4">
              
              {/* Izquierda: Fecha & Nombre del Viajero */}
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B] text-xl">
                  📜
                </span>
                <div>
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#795548]">
                    Bitácora del Reino
                  </span>
                  <h2 className="text-sm sm:text-base font-black text-[#3A2E2B] capitalize">
                    {currentDate || "Cargando fecha..."}
                  </h2>
                </div>
              </div>

              {/* Centro: Clima interactivo toggleable */}
              <button
                type="button"
                onClick={() => setWeatherIndex((prev) => (prev + 1) % weathers.length)}
                className="flex items-center gap-3 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] px-3.5 py-2 shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer"
                title="Haz clic para alternar previsión meteorológica"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E9C46A] border-2 border-[#3A2E2B] text-[#3A2E2B]">
                  <WeatherIcon className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-[#3A2E2B]">{activeWeather.label}</span>
                    <span className="rounded bg-[#4E6E58]/15 px-1.5 py-0.2 text-[10px] font-black text-[#4E6E58]">
                      {activeWeather.temp}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-[#795548]">{activeWeather.desc}</span>
                </div>
              </button>

              {/* Derecha: Monedas Bell-Coins y Reloj Digital en Vivo */}
              <div className="flex items-center gap-3">
                {/* Monedas del Reino */}
                <div className="flex items-center gap-2 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#E9C46A] px-3.5 py-2 text-[#3A2E2B] shadow-[0_3px_0_#3A2E2B]">
                  <Coins className="h-4 w-4" />
                  <span className="font-mono text-xs sm:text-sm font-black">
                    12,450 <span className="text-[10px]">BELLS</span>
                  </span>
                </div>

                {/* Reloj Digital en Vivo */}
                <div className="flex items-center gap-2 rounded-2xl border-[3px] border-[#3A2E2B] bg-[#3A2E2B] px-3.5 py-2 text-[#F7F4EB] shadow-[0_3px_0_#5C4033]">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-mono text-xs sm:text-sm font-black tracking-wider">
                    {currentTime || "--:--:--"}
                  </span>
                </div>
              </div>
            </header>

            {/* ===================================================================
                3. BENTO GRID MODULAR (ESTÉTICA RPG DE CONSOLA / ANIMAL CROSSING)
               =================================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">

              {/* =================================================================
                  TARJETA 1: RESUMEN DE LA ISLA/REINO (OVERVIEW) — 7 COLS
                 ================================================================= */}
              <div className="lg:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] text-lg">
                        ⭐
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                          Estado del Reino (Översikt)
                        </h3>
                        <span className="text-[11px] font-bold text-[#795548]">
                          Evaluación de la Liga de Gobernadores
                        </span>
                      </div>
                    </div>

                    <span className="rounded-full border-2 border-[#4E6E58] bg-[#4E6E58]/15 px-3 py-1 text-xs font-black text-[#4E6E58]">
                      Nivel Flotante IV
                    </span>
                  </div>

                  {/* Fila Central: Puntuación en Estrellas Doradas & Código de Guardado */}
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Estrellas Doradas */}
                    <div className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3.5 shadow-[0_3px_0_#3A2E2B]">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#795548]">
                        Calificación del Mundo
                      </span>
                      <div className="mt-1 flex items-center gap-1.5 text-[#E9C46A] text-xl drop-shadow-sm">
                        <span>★</span>
                        <span>★</span>
                        <span>★</span>
                        <span>★</span>
                        <span className="text-[#3A2E2B]/30">★</span>
                        <span className="ml-2 font-mono text-sm font-black text-[#3A2E2B]">
                          4.8 / 5.0
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-[#5C4033]">
                        Ambiente pacífico, jardines floridos y cero deudas activas.
                      </p>
                    </div>

                    {/* Código de Guardado / Island Dream Address */}
                    <div className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3.5 shadow-[0_3px_0_#3A2E2B]">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#795548]">
                        Código de Guardado (Saveslot)
                      </span>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-mono text-xs sm:text-sm font-black text-[#3A2E2B] bg-[#FFFDF8] border-2 border-[#3A2E2B]/20 rounded-xl px-2.5 py-1">
                          {saveCode}
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] px-2.5 py-1 text-[11px] font-bold text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] transition cursor-pointer"
                          title="Copiar código para compartir mundo"
                        >
                          {copiedSaveCode ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-700" />
                              <span>Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copiar</span>
                            </>
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] font-semibold text-[#5C4033]">
                        Permite a otros aventureros visitar tu santuario en sueños.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pie de la tarjeta: Contador rápido de Habitantes y Aliados */}
                <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#795548] uppercase tracking-wider">
                      Habitantes del Reino:
                    </span>
                    <div className="flex items-center gap-1">
                      {residents.map((res) => (
                        <span
                          key={res.id}
                          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#3A2E2B] bg-[#E8DFCF] text-xs shadow-sm hover:scale-110 transition-transform cursor-pointer"
                          title={`${res.name} (${res.role})`}
                        >
                          {res.avatar}
                        </span>
                      ))}
                      <span className="ml-1 text-xs font-black text-[#4E6E58]">
                        {residents.length}/10 Puestos
                      </span>
                    </div>
                  </div>

                  <span className="rounded-xl border border-[#3A2E2B]/20 bg-[#4E6E58]/10 px-2.5 py-1 text-[11px] font-bold text-[#4E6E58]">
                    Armonía Comunal: 98%
                  </span>
                </div>
              </div>

              {/* =================================================================
                  TARJETA 2: VISTA DEL MAPA DEL MUNDO (MIN Ö) — 5 COLS
                 ================================================================= */}
              <div className="lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] text-lg">
                        🗺️
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                          Mapa del Reino (Min ö)
                        </h3>
                        <span className="text-[11px] font-bold text-[#795548]">
                          Vista Cenital y Cuadrantes
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsMapModalOpen(true)}
                      className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] transition cursor-pointer"
                      title="Ver mapa en pantalla completa"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Gráfico Cenital Estilizado de la Isla/Reino */}
                  <div className="relative mt-3 h-40 rounded-2xl border-[3px] border-[#3A2E2B] bg-gradient-to-b from-[#80B992] to-[#609972] p-3 shadow-inner overflow-hidden select-none">
                    {/* Efecto de río estilizado */}
                    <div className="absolute top-0 bottom-0 left-1/3 w-8 bg-[#80CED7] border-x-2 border-[#3A2E2B]/30 rotate-12 opacity-80" />
                    
                    {/* Marcadores de cuadrantes / POIs */}
                    <div className="relative z-10 h-full flex flex-col justify-between">
                      <div className="flex justify-between items-start">
                        <span className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2 py-0.5 text-[10px] font-black shadow-[0_2px_0_#3A2E2B]">
                          🌲 Bosque Susurrante
                        </span>
                        <span className="rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] px-2 py-0.5 text-[10px] font-black shadow-[0_2px_0_#3A2E2B]">
                          🏰 Plaza Mayor
                        </span>
                      </div>

                      <div className="flex justify-around items-center">
                        <span className="text-2xl animate-bounce">⛺</span>
                        <span className="text-2xl">🏡</span>
                        <span className="text-2xl">🌾</span>
                      </div>

                      <div className="flex justify-between items-end">
                        <span className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2 py-0.5 text-[10px] font-black shadow-[0_2px_0_#3A2E2B]">
                          🎣 Muelle Sur
                        </span>
                        <span className="rounded-xl border-2 border-[#3A2E2B] bg-[#E76F51] text-white px-2 py-0.5 text-[10px] font-black shadow-[0_2px_0_#3A2E2B]">
                          ⛰️ Cantera
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#795548]">
                    Coordenadas: 42°N, 71°O
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsMapModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#4E6E58] px-3.5 py-1.5 text-xs font-black text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer"
                  >
                    <Compass className="h-3.5 w-3.5" /> Explorar Mapa
                  </button>
                </div>
              </div>

              {/* =================================================================
                  TARJETA 3: LISTADO DE MISIONES (QUEST LOG / UPPGIFTER) — 7 COLS
                 ================================================================= */}
              <div className="lg:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E76F51] text-white shadow-[0_2px_0_#3A2E2B] text-lg">
                        📜
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                          Registro de Misiones (Uppgifter)
                        </h3>
                        <span className="text-[11px] font-bold text-[#795548]">
                          Tareas con recompensa y feedback fraccionario
                        </span>
                      </div>
                    </div>

                    <span className="rounded-full bg-[#E9C46A] border-2 border-[#3A2E2B] px-3 py-0.5 text-xs font-black text-[#3A2E2B] shadow-sm">
                      {quests.filter((q) => q.completed).length} / {quests.length} Completadas
                    </span>
                  </div>

                  {/* Listado Vertical de Misiones con Barras de Progreso Fraccionarias */}
                  <div className="mt-3.5 space-y-3">
                    {quests.map((quest) => {
                      const pct = Math.round((quest.current / quest.total) * 100);

                      return (
                        <div
                          key={quest.id}
                          className={`group rounded-2xl border-[3px] border-[#3A2E2B] p-3.5 shadow-[0_3px_0_#3A2E2B] transition-all ${
                            quest.completed
                              ? "bg-[#EAF3ED] opacity-80"
                              : "bg-[#F7F4EB] hover:-translate-y-0.5"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] shadow-sm text-lg shrink-0">
                                {quest.icon}
                              </span>
                              <div>
                                <h4
                                  className={`text-xs sm:text-sm font-extrabold text-[#3A2E2B] ${
                                    quest.completed ? "line-through text-[#795548]" : ""
                                  }`}
                                >
                                  {quest.title}
                                </h4>
                                <span className="text-[10px] font-bold text-[#795548] uppercase tracking-wider">
                                  Recompensa: +{quest.reward} Bells
                                </span>
                              </div>
                            </div>

                            {/* Botón de acción / avance rápido (+1) */}
                            <button
                              type="button"
                              disabled={quest.completed}
                              onClick={() => handleAdvanceQuest(quest.id)}
                              className={`shrink-0 flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] px-2.5 py-1 text-xs font-black shadow-[0_2px_0_#3A2E2B] transition cursor-pointer disabled:opacity-50 ${
                                quest.completed
                                  ? "bg-[#4E6E58] text-white"
                                  : "bg-[#E9C46A] text-[#3A2E2B] hover:bg-[#F4A261] active:translate-y-0.5"
                              }`}
                            >
                              {quest.completed ? (
                                <>
                                  <Check className="h-3.5 w-3.5" />
                                  <span>Hecho</span>
                                </>
                              ) : (
                                <>
                                  <span>+1 Avance</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Barra de Progreso Fraccionaria Fluida */}
                          <div className="mt-3 flex items-center gap-3">
                            <div className="flex-1 h-3 rounded-full border-2 border-[#3A2E2B] bg-[#FFFDF8] overflow-hidden p-0.5">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  quest.completed ? "bg-[#4E6E58]" : "bg-[#E9C46A]"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs font-black text-[#3A2E2B] shrink-0">
                              {quest.current}/{quest.total}{" "}
                              <span className="text-[10px] text-[#795548]">({pct}%)</span>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 flex items-center justify-between text-xs font-bold text-[#795548]">
                  <span>Las misiones se renuevan diariamente a las 06:00 AM</span>
                  <span className="text-[#4E6E58]">¡Completar 4 otorga +1 Estrella!</span>
                </div>
              </div>

              {/* =================================================================
                  TARJETA 4: COLECCIONABLES (SAMLINGAR / MUSEO) — 5 COLS
                 ================================================================= */}
              <div className="lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
                <div>
                  <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] text-lg">
                        🏺
                      </span>
                      <div>
                        <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                          Coleccionables (Samlingar)
                        </h3>
                        <span className="text-[11px] font-bold text-[#795548]">
                          Archivo del Museo y Enciclopedia
                        </span>
                      </div>
                    </div>

                    <span className="text-xs font-black text-[#4E6E58]">
                      Total: 148 Especies
                    </span>
                  </div>

                  {/* Cuadrícula Compacta 2x2 de Contadores Individuales */}
                  <div className="mt-3.5 grid grid-cols-2 gap-3">
                    {collections.map((cat) => {
                      const pct = Math.round((cat.current / cat.total) * 100);

                      return (
                        <div
                          key={cat.id}
                          className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 transition-transform"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{cat.icon}</span>
                            <span className="font-mono text-xs font-black text-[#3A2E2B]">
                              {cat.current}/{cat.total}
                            </span>
                          </div>

                          <h4 className="mt-2 text-xs font-black text-[#3A2E2B] truncate">
                            {cat.name}
                          </h4>

                          {/* Mini Barra de progreso */}
                          <div className="mt-2 h-2 rounded-full border border-[#3A2E2B] bg-[#FFFDF8] overflow-hidden p-0.2">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: cat.color,
                              }}
                            />
                          </div>

                          <span className="mt-1 block text-right font-mono text-[9px] font-bold text-[#795548]">
                            {pct}% catalogado
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Bonificación por donación */}
                  <div className="mt-3 rounded-2xl border-2 border-[#4E6E58]/30 bg-[#4E6E58]/10 p-3 flex items-center gap-3">
                    <span className="text-xl">🏆</span>
                    <div>
                      <h5 className="text-xs font-black text-[#4E6E58]">Próximo Hito: Galería Marina</h5>
                      <p className="text-[10px] text-[#5C4033] font-semibold">
                        Dona 7 peces más a Barnaby para desbloquear el Acuario Submarino.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 flex items-center justify-between text-xs font-bold text-[#795548]">
                  <span>Conservador: Barnaby el Tejón</span>
                  <span className="text-[#3A2E2B] font-black cursor-pointer hover:underline">
                    Ver Registro ➔
                  </span>
                </div>
              </div>

              {/* =================================================================
                  TARJETA 5: COMPAÑEROS & ALDEANOS (INVÅNARE / PARTY) — 12 COLS
                 ================================================================= */}
              <div className="lg:col-span-12 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] hover:-translate-y-0.5 transition-transform">
                <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] text-lg">
                      👥
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                        Compañeros & Habitantes (Invånare)
                      </h3>
                      <span className="text-[11px] font-bold text-[#795548]">
                        Nivel de amistad, regalos predilectos y diálogo
                      </span>
                    </div>
                  </div>

                  <span className="rounded-full border-2 border-[#3A2E2B] bg-[#E8DFCF] px-3 py-1 text-xs font-black text-[#3A2E2B]">
                    5 Residentes Registrados
                  </span>
                </div>

                {/* Cuadrícula Horizontal de Avatares Circulares */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {residents.map((resident) => (
                    <div
                      key={resident.id}
                      onClick={() => setSelectedResident(resident)}
                      className="group rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3.5 shadow-[0_3px_0_#3A2E2B] text-center hover:-translate-y-1 hover:shadow-[0_5px_0_#3A2E2B] transition-all cursor-pointer"
                    >
                      {/* Avatar circular con marco de madera */}
                      <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border-[3px] border-[#3A2E2B] bg-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] text-3xl group-hover:rotate-6 transition-transform">
                        {resident.avatar}
                      </div>

                      <h4 className="mt-2 text-xs sm:text-sm font-black text-[#3A2E2B]">
                        {resident.name}
                      </h4>
                      <span className="block text-[10px] font-bold text-[#795548]">
                        {resident.role}
                      </span>

                      {/* Corazones de amistad */}
                      <div className="mt-1.5 flex items-center justify-center gap-0.5 text-[#E76F51] text-xs">
                        {[1, 2, 3, 4, 5].map((h) => (
                          <span key={h}>
                            {h <= resident.friendshipHearts ? "❤️" : "🤍"}
                          </span>
                        ))}
                      </div>

                      <p className="mt-2 text-[10px] text-[#5C4033] line-clamp-1 italic font-medium">
                        &ldquo;{resident.quote}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>

      {/* =========================================================================
          MODAL DE MAPA COMPLETO (OVERLAY ESTILO PERGAMINO)
         ========================================================================= */}
      {isMapModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A2E2B]/70 backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsMapModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_8px_0_#3A2E2B] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🗺️</span>
                <h3 className="text-base font-black text-[#3A2E2B]">
                  Mapa Topográfico Completo: Isla de Oakhaven
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#80B992] p-6 text-center space-y-4 shadow-inner">
              <p className="text-xs font-black text-[#3A2E2B] bg-[#FFFDF8] border-2 border-[#3A2E2B] rounded-xl px-4 py-2 inline-block shadow-[0_2px_0_#3A2E2B]">
                📍 Cuadrante Central: Plaza Mayor, Tienda de Artesanías & Huerto Comunitario
              </p>

              <div className="grid grid-cols-3 gap-3 py-4 text-xs font-bold text-[#3A2E2B]">
                <div className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8]/90 p-3 shadow-sm">
                  <span className="text-2xl block mb-1">🌲</span>
                  Bosque Norte (Madera)
                </div>
                <div className="rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] p-3 shadow-sm">
                  <span className="text-2xl block mb-1">🏰</span>
                  Plaza & Ayuntamiento
                </div>
                <div className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8]/90 p-3 shadow-sm">
                  <span className="text-2xl block mb-1">⛰️</span>
                  Minas del Este (Cobre)
                </div>
                <div className="rounded-xl border-2 border-[#3A2E2B] bg-[#80CED7] p-3 shadow-sm">
                  <span className="text-2xl block mb-1">🎣</span>
                  Río Esmeralda (Pesca)
                </div>
                <div className="rounded-xl border-2 border-[#3A2E2B] bg-[#EAF3ED] p-3 shadow-sm">
                  <span className="text-2xl block mb-1">🏡</span>
                  Casas de Vecinos
                </div>
                <div className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFF5E4] p-3 shadow-sm">
                  <span className="text-2xl block mb-1">🏖️</span>
                  Playa Sur & Conchas
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsMapModalOpen(false)}
                className="rounded-2xl border-2 border-[#3A2E2B] bg-[#4E6E58] px-5 py-2 text-xs font-black text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer"
              >
                Cerrar Mapa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL DETALLE DE COMPAÑERO / NPC
         ========================================================================= */}
      {selectedResident && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#3A2E2B]/70 backdrop-blur-sm animate-in fade-in"
          onClick={() => setSelectedResident(null)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_8px_0_#3A2E2B] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-3xl">{selectedResident.avatar}</span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B]">{selectedResident.name}</h3>
                  <span className="text-[10px] font-bold text-[#795548]">{selectedResident.role} ({selectedResident.species})</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedResident(null)}
                className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-4 space-y-2.5 shadow-[0_3px_0_#3A2E2B]">
              <div>
                <span className="text-[10px] font-black uppercase text-[#795548]">Regalo Predilecto:</span>
                <p className="text-xs font-bold text-[#3A2E2B]">🎁 {selectedResident.favoriteGift}</p>
              </div>

              <div>
                <span className="text-[10px] font-black uppercase text-[#795548]">Nivel de Amistad:</span>
                <div className="flex items-center gap-1 text-sm text-[#E76F51]">
                  {[1, 2, 3, 4, 5].map((h) => (
                    <span key={h}>{h <= selectedResident.friendshipHearts ? "❤️" : "🤍"}</span>
                  ))}
                  <span className="ml-2 font-mono text-xs font-bold text-[#3A2E2B]">
                    {selectedResident.friendshipHearts}/5 Corazones
                  </span>
                </div>
              </div>

              <div className="pt-1">
                <span className="text-[10px] font-black uppercase text-[#795548]">Lema de Vida:</span>
                <p className="text-xs italic font-semibold text-[#5C4033] bg-[#FFFDF8] p-2.5 rounded-xl border border-[#3A2E2B]/20 mt-1">
                  &ldquo;{selectedResident.quote}&rdquo;
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                alert(`¡Le has regalado ${selectedResident.favoriteGift} a ${selectedResident.name}! Ha sonreído con alegría. (+100 XP de Amistad)`);
                setSelectedResident(null);
              }}
              className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#E9C46A] py-2.5 text-xs font-black text-[#3A2E2B] shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 active:translate-y-0 transition cursor-pointer"
            >
              🎁 Entregar Regalo Diario
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
