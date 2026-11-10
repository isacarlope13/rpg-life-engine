"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Lock,
  X,
  Heart,
  Share2,
  Check,
  Copy,
  Compass,
  Award,
  Filter,
} from "lucide-react";
import { triggerHaptic } from "@/lib/offline-sync";

export interface ScrapbookEntry {
  id: string;
  category: "all" | "santuario" | "hitos" | "residentes";
  title: string;
  location: string;
  unlocked: boolean;
  requirementText: string;
  dateUnlocked?: string;
  icon: string;
  stampText: string;
  description: string;
  postcardLetter: string;
  polaroidColor: string;
}

interface VillageScrapbookModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerLevel: number;
  booksCount: number;
  knittingProjectsCount: number;
  rubikSolvesCount: number;
  sessionsCount: number;
  streakDays?: number;
  walletGp?: number;
  vaultGp?: number;
  rubikPb?: number | null;
}

export function VillageScrapbookModal({
  isOpen,
  onClose,
  playerLevel,
  booksCount,
  knittingProjectsCount,
  rubikSolvesCount,
  sessionsCount,
  streakDays = 0,
  walletGp = 0,
  vaultGp = 0,
  rubikPb = null,
}: VillageScrapbookModalProps) {
  const [selectedPostal, setSelectedPostal] = useState<ScrapbookEntry | null>(null);
  const [activeFilter, setActiveFilter] = useState<"all" | "santuario" | "hitos" | "residentes">("all");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const MEMORIES: ScrapbookEntry[] = [
    {
      id: "mem_arrival",
      category: "santuario",
      title: "Primera Piedra en Oakhaven",
      location: "Plaza Mayor",
      unlocked: true,
      requirementText: "Llegar a Valle de Oakhaven",
      dateUnlocked: "Inicio del Viaje",
      icon: "🏡",
      stampText: "FUNDACIÓN DE OAKHAVEN",
      description: "El día en que decidiste que tu progreso diario merecía un refugio amable y libre de estrés.",
      postcardLetter:
        "Querido caminante: Esta tierra respira contigo. Aquí no hay prisas ni deudas morales, solo el dulce sonido de tus hábitos forjando un hogar sereno.",
      polaroidColor: "from-[#F5E6CA] to-[#EBD5B3]",
    },
    {
      id: "mem_knitting",
      category: "residentes",
      title: "El Primer Ovillo de Clara",
      location: "El Atelier de Hilados",
      unlocked: knittingProjectsCount > 0 || playerLevel >= 1,
      requirementText: "Completar 1 fila o proyecto de tejido",
      dateUnlocked: knittingProjectsCount > 0 ? "Completado" : undefined,
      icon: "🧶",
      stampText: "ATELIER ARTESANAL",
      description: "Las manos descubrieron el ritmo meditativo de cada puntada, transformando lana en abrigo.",
      postcardLetter:
        "«Cada punto que tejes es una pequeña pausa de ternura para tu alma. No hay errores, solo caminos nuevos de hilo.» — Clara",
      polaroidColor: "from-[#FAD2CF] to-[#F3B1AB]",
    },
    {
      id: "mem_reading",
      category: "residentes",
      title: "Tarde de Té y Páginas",
      location: "La Librería de Eldrin",
      unlocked: booksCount > 0 || playerLevel >= 2,
      requirementText: "Registrar 1 libro en el catálogo",
      dateUnlocked: booksCount > 0 ? "Completado" : undefined,
      icon: "📚",
      stampText: "ARCHIVO & LIBRERÍA",
      description: "La lluvia golpeando los cristales mientras una historia te transportaba a otros horizontes.",
      postcardLetter:
        "«Un libro abierto es un fuego encendido en medio del invierno. Gracias por enriquecer nuestros estantes.» — Eldrin",
      polaroidColor: "from-[#D8E8DD] to-[#BFD7C7]",
    },
    {
      id: "mem_study",
      category: "residentes",
      title: "Silencio de Erudito",
      location: "La Biblioteca de Lyra",
      unlocked: playerLevel >= 2 || sessionsCount >= 3,
      requirementText: "Alcanzar Nivel 2 o 3 sesiones de estudio",
      dateUnlocked: playerLevel >= 2 ? "Completado" : undefined,
      icon: "🏛️",
      stampText: "CÁTEDRA DE SABIDURÍA",
      description: "Cuando un concepto denso finalmente cobró sentido en tus apuntes con calma y claridad.",
      postcardLetter:
        "«El conocimiento retenido con memoria espaciada florece sin agotarte. Tu mente es un jardín de ideas luminosas.» — Lyra",
      polaroidColor: "from-[#DCE3F8] to-[#BAC8F0]",
    },
    {
      id: "mem_rubik",
      category: "residentes",
      title: "Danza de Capas y Colores",
      location: "Club de Puzzles WCA",
      unlocked: rubikSolvesCount > 0 || playerLevel >= 2,
      requirementText: "Resolver 1 scramble oficial en el club",
      dateUnlocked: rubikSolvesCount > 0 ? "Completado" : undefined,
      icon: "🧩",
      stampText: "WCA SPEEDCUBING",
      description: "El cubo giró suavemente en tus dedos, no para competir contra otros, sino para estar presente.",
      postcardLetter:
        "«¡Fluidez antes de fuerza bruta! Respira en cada F2L y sonríe al terminar el PLL. ¡Gran solve!» — Milo",
      polaroidColor: "from-[#D2F0F4] to-[#B3E5EB]",
    },
    {
      id: "mem_observatory",
      category: "santuario",
      title: "Noche de Constelaciones",
      location: "El Observatorio Cósmico",
      unlocked: sessionsCount >= 5 || playerLevel >= 3,
      requirementText: "Completar 5 sesiones de foco o Nivel 3",
      dateUnlocked: sessionsCount >= 5 ? "Completado" : undefined,
      icon: "🔭",
      stampText: "DOMO ASTRONÓMICO",
      description: "Mirar el cielo nocturno y recordar que las prisas del mundo exterior son solo ruido pasajero.",
      postcardLetter:
        "«En el silencio del observatorio, tus proyectos más profundos cobran forma estelar. Abraza el silencio creador.» — Aura",
      polaroidColor: "from-[#EAD7F8] to-[#D5B8EE]",
    },
    {
      id: "mem_garden",
      category: "santuario",
      title: "Gotas sobre la Lavanda",
      location: "Invernadero Botánico",
      unlocked: sessionsCount >= 2 || playerLevel >= 2,
      requirementText: "2 sesiones de hábitos o Nivel 2",
      dateUnlocked: sessionsCount >= 2 ? "Completado" : undefined,
      icon: "🌿",
      stampText: "BOTÁNICA SILVESTRE",
      description: "Ver florecer el cantero de hábitos tras días de constancia suave y riego paciente.",
      postcardLetter:
        "«La tierra nunca tiene prisa y aun así cada semilla brota a su debido tiempo. Ten paciencia con tus raíces.» — Barnaby",
      polaroidColor: "from-[#E2EBD8] to-[#C9DAC0]",
    },
    {
      id: "mem_hiking",
      category: "santuario",
      title: "Cima del Mirador del Viento",
      location: "Puesto de Senderismo",
      unlocked: sessionsCount >= 4 || playerLevel >= 3,
      requirementText: "4 sesiones de caminata o Nivel 3",
      dateUnlocked: sessionsCount >= 4 ? "Completado" : undefined,
      icon: "🥾",
      stampText: "SENDERO DEL VALLE",
      description: "Los pulmones llenos de aire puro de montaña y una vista infinita sobre todo el valle.",
      postcardLetter:
        "«Cada paso despeja la niebla del camino. Caminar es medicina directa para el corazón.» — Tara",
      polaroidColor: "from-[#F4E2D2] to-[#E3C8B1]",
    },
    {
      id: "mem_cooking",
      category: "residentes",
      title: "El Pan de Fuego Lento",
      location: "La Cocina & Horno",
      unlocked: sessionsCount >= 1 || playerLevel >= 1,
      requirementText: "Completar 1 micro-misión culinaria",
      dateUnlocked: "Completado",
      icon: "🍳",
      stampText: "HORNO ARTESANAL",
      description: "El aroma a pan recién horneado y caldo reconfortante perfumando los rincones del pueblo.",
      postcardLetter:
        "«El buen alimento cocinado con amor apacigua cualquier tormenta interior. ¡Buen provecho, amigo!» — Oliver",
      polaroidColor: "from-[#FFE5D9] to-[#FFCAD4]",
    },
    {
      id: "mem_streak_7",
      category: "hitos",
      title: "La Llama de Siete Días",
      location: "Hito de Constancia",
      unlocked: streakDays >= 7,
      requirementText: "Mantener una racha de 7 días continuos",
      dateUnlocked: streakDays >= 7 ? `${streakDays} Días Racha` : undefined,
      icon: "🔥",
      stampText: "FUEGO SAGRADO",
      description: "Siete días de compromiso sereno sin rendirte ante la inercia ni el desaliento.",
      postcardLetter:
        "Tu constancia es un faro de luz para todo el Valle de Oakhaven. 7 días ininterrumpidos construyendo tu propia vida.",
      polaroidColor: "from-[#FDE2E4] to-[#FFDFD3]",
    },
    {
      id: "mem_speedcube_pb",
      category: "hitos",
      title: "El Giro Relámpago",
      location: "Hito WCA de Milo",
      unlocked: (rubikPb !== null && rubikPb > 0 && rubikPb <= 30) || rubikSolvesCount >= 12,
      requirementText: "Lograr un PB Sub-30 o 12 solves registrados",
      dateUnlocked: rubikPb ? `PB: ${rubikPb.toFixed(2)}s` : undefined,
      icon: "⚡",
      stampText: "RÉCORD DEL VALLE",
      description: "Un instante perfecto donde la memoria muscular y el lookahead resolvieron el cubo casi sin pensar.",
      postcardLetter:
        "¡Qué velocidad y soltura! Los cronómetros del Club de Puzzles registran una marca legendaria para tu historia personal.",
      polaroidColor: "from-[#E0FBFC] to-[#C2DFE3]",
    },
    {
      id: "mem_treasury_master",
      category: "hitos",
      title: "El Guardián del Tesoro",
      location: "Bóveda & Billetera Real",
      unlocked: walletGp + vaultGp >= 5000,
      requirementText: "Acumular 5.000 GP o más entre Billetera y Bóveda",
      dateUnlocked: `${(walletGp + vaultGp).toLocaleString("es-CO")} GP`,
      icon: "🪙",
      stampText: "RESERVA DEL REINO",
      description: "La tranquilidad financiera forjada día a día, libre de gastos impulsivos y protegida con sabiduría.",
      postcardLetter:
        "Has cuidado tu tesoro con temple de hierro. Cada moneda representa tiempo ganado para tus verdaderos propósitos.",
      polaroidColor: "from-[#FFF1C5] to-[#E9D8A6]",
    },
  ];

  const unlockedCount = MEMORIES.filter((m) => m.unlocked).length;
  const progressPercent = Math.round((unlockedCount / MEMORIES.length) * 100);

  const filteredMemories = MEMORIES.filter((m) => {
    if (activeFilter === "all") return true;
    return m.category === activeFilter;
  });

  const handleCopyPostcard = (mem: ScrapbookEntry) => {
    if (!mem.unlocked) return;
    const textToCopy = `📮 POSTAL DE OAKHAVEN: "${mem.title}"\n📍 ${mem.location} • Sello: [${mem.stampText}]\n\n${mem.description}\n\n"${mem.postcardLetter}"\n\n— Revelada en Cozy Living Village 🏰`;

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      triggerHaptic("success");
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Álbum de Recuerdos y Postales de Oakhaven"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl border-4 border-[#3A2E2B] bg-[#F7F4EB] p-5 sm:p-7 shadow-[0_12px_0_#3A2E2B]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* BOTÓN DE CIERRE */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar Álbum"
          className="absolute top-4 right-4 sm:top-6 sm:right-6 rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-2 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] cursor-pointer transition-transform hover:scale-105"
        >
          <X className="h-4 w-4" />
        </button>

        {/* ENCABEZADO ESTILO LIBRO VINTAGE */}
        <div className="border-b-3 border-[#3A2E2B]/20 pb-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#3A2E2B] bg-[#E9C46A] px-3.5 py-1 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B]">
            📖 Álbum Oficial de Oakhaven
          </div>
          <h2 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-[#3A2E2B]">
            Postales & Recuerdos del Santuario
          </h2>
          <p className="mt-1 text-xs text-[#7A6B62] max-w-lg mx-auto">
            Hitos coleccionables revelados a través de tu lectura, tejido, speedcubing, foco y hábitos reales en el reino.
          </p>

          {/* BARRA DE PROGRESO DE COLECCIÓN */}
          <div className="mt-4 max-w-md mx-auto">
            <div className="flex justify-between items-center text-xs font-black text-[#3A2E2B] mb-1.5">
              <span>Colección Revelada</span>
              <span className="text-[#4E6E58]">
                {unlockedCount} / {MEMORIES.length} Postales ({progressPercent}%)
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full border-2 border-[#3A2E2B] bg-[#E8DFCF] p-0.5 overflow-hidden shadow-inner">
              <div
                className="h-full rounded-full bg-[#4E6E58] transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* FILTRO POR CATEGORÍAS */}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {[
              { id: "all", label: "Todas las Postales" },
              { id: "santuario", label: "🏰 Edificios" },
              { id: "residentes", label: "👥 Residentes" },
              { id: "hitos", label: "⭐ Hitos Legendarios" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveFilter(tab.id as typeof activeFilter);
                  triggerHaptic("light");
                }}
                className={`rounded-xl border-2 px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                  activeFilter === tab.id
                    ? "border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] -translate-y-0.5"
                    : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#E8DFCF]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* REJILLA DE POSTALES POLAROID */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredMemories.map((mem) => (
            <div
              key={mem.id}
              onClick={() => {
                if (mem.unlocked) {
                  setSelectedPostal(mem);
                  triggerHaptic("light");
                }
              }}
              className={`relative flex flex-col justify-between rounded-3xl border-4 p-4 shadow-[0_4px_0_#3A2E2B] transition duration-300 ${
                mem.unlocked
                  ? "border-[#3A2E2B] bg-[#FFFDF8] hover:-translate-y-1.5 hover:shadow-[0_8px_0_#3A2E2B] cursor-pointer rotate-[-0.5deg] hover:rotate-0"
                  : "border-[#3A2E2B]/30 bg-[#E8DFCF]/50 opacity-60 cursor-not-allowed"
              }`}
            >
              {/* ESPACIO DE LA FOTOGRAFÍA POLAROID */}
              <div
                className={`relative flex h-36 w-full items-center justify-center rounded-2xl border-2 ${
                  mem.unlocked
                    ? `border-[#3A2E2B]/40 bg-gradient-to-br ${mem.polaroidColor}`
                    : "border-gray-400 bg-gray-200"
                } text-5xl shadow-inner`}
              >
                {mem.unlocked ? (
                  <>
                    <span>{mem.icon}</span>
                    {/* Sello de tinta en esquina */}
                    <span className="absolute bottom-2 right-2 rounded-md border border-[#3A2E2B]/40 bg-white/70 px-1.5 py-0.5 text-[8px] font-mono font-black text-[#3A2E2B] uppercase tracking-tighter">
                      {mem.stampText}
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-500">
                    <Lock className="h-6 w-6" />
                    <span className="text-[10px] font-bold font-sans">Bloqueada</span>
                  </div>
                )}
              </div>

              {/* PIE DE FOTO TIPO POLAROID */}
              <div className="mt-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-[#795548]">
                    {mem.location}
                  </span>
                  {mem.unlocked ? (
                    <span className="rounded-full bg-[#4E6E58]/15 px-2 py-0.5 text-[9px] font-black text-[#4E6E58]">
                      ✓ Revelada
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold text-gray-500">
                      Requisito
                    </span>
                  )}
                </div>

                <h4 className="text-sm font-black text-[#3A2E2B] leading-snug">
                  {mem.title}
                </h4>

                <p className="text-xs text-[#5C4033] leading-relaxed line-clamp-2">
                  {mem.unlocked ? mem.description : mem.requirementText}
                </p>

                {mem.unlocked && (
                  <div className="pt-2 text-right">
                    <span className="text-[10px] font-black text-[#4E6E58] hover:underline">
                      Ver Postal Completa ➜
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* PIE DE PÁGINA */}
        <div className="mt-8 pt-4 border-t-2 border-[#3A2E2B]/20 text-center">
          <p className="text-xs italic text-[#7A6B62]">
            "Cada día en Oakhaven escribe una línea nueva en la historia de tu propia calma."
          </p>
        </div>
      </div>

      {/* MODAL DETALLADO DE POSTAL INDIVIDUAL (POLAROID VINTAGE INSPECTION) */}
      {selectedPostal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4 animate-in fade-in"
          onClick={() => setSelectedPostal(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_12px_0_#3A2E2B] space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Foto Polaroid Ampliada */}
            <div
              className={`relative flex h-48 w-full items-center justify-center rounded-2xl border-3 border-[#3A2E2B] bg-gradient-to-br ${selectedPostal.polaroidColor} text-7xl shadow-inner`}
            >
              <span>{selectedPostal.icon}</span>
              <div className="absolute top-3 left-3 rounded-full border-2 border-[#3A2E2B] bg-white/85 px-3 py-1 text-[10px] font-black text-[#3A2E2B]">
                📮 {selectedPostal.stampText}
              </div>
            </div>

            {/* Contenido Postal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[#795548]">
                <span className="font-bold">📍 {selectedPostal.location}</span>
                <span className="font-black text-[#4E6E58]">Hito Desbloqueado</span>
              </div>

              <h3 className="text-lg font-black text-[#3A2E2B]">
                {selectedPostal.title}
              </h3>

              <p className="text-xs text-[#5C4033] leading-relaxed">
                {selectedPostal.description}
              </p>

              {/* Mensaje Epistolar de Oakhaven */}
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3.5 text-xs italic text-[#3A2E2B] font-medium leading-relaxed shadow-sm">
                "{selectedPostal.postcardLetter}"
              </div>
            </div>

            {/* Acciones de la Postal */}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => handleCopyPostcard(selectedPostal)}
                className="flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#E9C46A] py-2.5 px-3 text-xs font-black text-[#3A2E2B] hover:bg-[#F4A261] shadow-[0_2px_0_#3A2E2B] cursor-pointer flex items-center justify-center gap-1.5 transition-transform active:translate-y-0.5"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-800" /> ¡Copiada al Portapapeles!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copiar Postal
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedPostal(null)}
                className="rounded-2xl border-2 border-[#3A2E2B] bg-[#E8DFCF] py-2.5 px-4 text-xs font-black text-[#3A2E2B] hover:bg-[#D5C6AF] shadow-[0_2px_0_#3A2E2B] cursor-pointer"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
