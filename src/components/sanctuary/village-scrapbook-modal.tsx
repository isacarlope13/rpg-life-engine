"use client";

import React from "react";
import { Image as ImageIcon, Sparkles, Award, Lock, X, Heart, Star } from "lucide-react";

interface ScrapbookEntry {
  id: string;
  title: string;
  location: string;
  unlocked: boolean;
  dateUnlocked?: string;
  icon: string;
  description: string;
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
}

export function VillageScrapbookModal({
  isOpen,
  onClose,
  playerLevel,
  booksCount,
  knittingProjectsCount,
  rubikSolvesCount,
  sessionsCount,
}: VillageScrapbookModalProps) {
  if (!isOpen) return null;

  const MEMORIES: ScrapbookEntry[] = [
    {
      id: "mem_arrival",
      title: "Primera Piedra en Oakhaven",
      location: "Plaza Central",
      unlocked: true,
      dateUnlocked: "Inicio del Viaje",
      icon: "🏡",
      description: "El día en que decidiste que tu progreso diario merecía un refugio amable y libre de estrés.",
      polaroidColor: "from-[#F5E6CA] to-[#EBD5B3]",
    },
    {
      id: "mem_knitting",
      title: "El Primer Ovillo",
      location: "El Atelier de Hilados",
      unlocked: knittingProjectsCount > 0 || playerLevel >= 1,
      dateUnlocked: knittingProjectsCount > 0 ? "Completado" : undefined,
      icon: "🧶",
      description: "Las manos descubrieron el ritmo meditativo de cada puntada, transformando lana en abrigo.",
      polaroidColor: "from-[#FAD2CF] to-[#F3B1AB]",
    },
    {
      id: "mem_reading",
      title: "Tarde de Té y Páginas",
      location: "La Librería & Archivo",
      unlocked: booksCount > 0 || playerLevel >= 2,
      dateUnlocked: booksCount > 0 ? "Completado" : undefined,
      icon: "📚",
      description: "La lluvia golpeando los cristales mientras una historia te transportaba a otros horizontes.",
      polaroidColor: "from-[#D8E8DD] to-[#BFD7C7]",
    },
    {
      id: "mem_study",
      title: "Silencio de Erudito",
      location: "La Biblioteca de Lyra",
      unlocked: playerLevel >= 2 || sessionsCount >= 3,
      dateUnlocked: playerLevel >= 2 ? "Completado" : undefined,
      icon: "🏛️",
      description: "Cuando un concepto denso finalmente cobró sentido en tus apuntes con calma y claridad.",
      polaroidColor: "from-[#DCE3F8] to-[#BAC8F0]",
    },
    {
      id: "mem_rubik",
      title: "Danza de Capas y Colores",
      location: "Club de Puzzles WCA",
      unlocked: rubikSolvesCount > 0 || playerLevel >= 2,
      dateUnlocked: rubikSolvesCount > 0 ? "Completado" : undefined,
      icon: "🧩",
      description: "El cubo giró suavemente en tus dedos, no para competir contra otros, sino para estar presente.",
      polaroidColor: "from-[#D2F0F4] to-[#B3E5EB]",
    },
    {
      id: "mem_observatory",
      title: "Noche de Constelaciones",
      location: "El Observatorio Cósmico",
      unlocked: sessionsCount >= 5 || playerLevel >= 3,
      dateUnlocked: sessionsCount >= 5 ? "Completado" : undefined,
      icon: "🔭",
      description: "Mirar el cielo nocturno y recordar que las prisas del mundo exterior son solo ruido pasajero.",
      polaroidColor: "from-[#EAD7F8] to-[#D5B8EE]",
    },
    {
      id: "mem_garden",
      title: "Gotas sobre la Lavanda",
      location: "Invernadero Botánico",
      unlocked: sessionsCount >= 2 || playerLevel >= 2,
      dateUnlocked: sessionsCount >= 2 ? "Completado" : undefined,
      icon: "🌿",
      description: "Ver florecer el cantero de hábitos tras días de constancia suave y riego paciente.",
      polaroidColor: "from-[#E2EBD8] to-[#C9DAC0]",
    },
    {
      id: "mem_hiking",
      title: "Cima del Mirador del Viento",
      location: "Puesto de Senderismo",
      unlocked: sessionsCount >= 4 || playerLevel >= 3,
      dateUnlocked: sessionsCount >= 4 ? "Completado" : undefined,
      icon: "🥾",
      description: "Los pulmones llenos de aire puro de montaña y una vista infinita sobre todo el valle.",
      polaroidColor: "from-[#F4E2D2] to-[#E3C8B1]",
    },
  ];

  const unlockedCount = MEMORIES.filter((m) => m.unlocked).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl border-4 border-[#5C4033] bg-[#F7F4EB] p-6 sm:p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{
          boxShadow: "0 25px 50px -12px rgba(92, 64, 51, 0.4), inset 0 0 100px rgba(235, 229, 216, 0.6)",
        }}
      >
        {/* BOTÓN DE CIERRE */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-sm font-bold text-[#8C7A6B] hover:text-[#3A2E2B] cursor-pointer"
        >
          ✕ Cerrar Álbum
        </button>

        {/* ENCABEZADO */}
        <div className="border-b-3 border-[#5C4033]/30 pb-5 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-[#5C4033] bg-[#E9C46A]/30 px-3.5 py-1 text-xs font-black text-[#5C4033]">
            📖 Álbum de Recuerdos de Oakhaven
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-[#3A2E2B]">
            Postales & Hitos de la Vida en el Pueblo
          </h2>
          <p className="mt-1 text-xs text-[#7A6B62]">
            Colección de momentos memorables alcanzados a través de tu práctica, lectura y hábitos reales.
          </p>
          <div className="mt-3 inline-block rounded-full bg-[#4E6E58]/15 px-3 py-0.5 text-xs font-black text-[#4E6E58]">
            {unlockedCount} de {MEMORIES.length} Postales Reveladas ⭐
          </div>
        </div>

        {/* REJILLA DE POSTALES POLAROID */}
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MEMORIES.map((mem) => (
            <div
              key={mem.id}
              className={`relative flex flex-col justify-between rounded-2xl border-3 p-4 shadow-md transition duration-300 ${
                mem.unlocked
                  ? "border-[#5C4033] bg-white hover:-translate-y-1 hover:shadow-xl rotate-[-0.5deg] hover:rotate-0"
                  : "border-gray-300 bg-gray-100 opacity-60"
              }`}
            >
              {/* ESPACIO DE LA FOTOGRAFÍA POLAROID */}
              <div
                className={`flex h-36 w-full items-center justify-center rounded-xl border-2 ${
                  mem.unlocked
                    ? `border-[#5C4033]/40 bg-gradient-to-br ${mem.polaroidColor}`
                    : "border-gray-300 bg-gray-200"
                } text-5xl shadow-inner`}
              >
                {mem.unlocked ? mem.icon : <Lock className="h-8 w-8 text-gray-400" />}
              </div>

              {/* PIE DE FOTO TIPO POLAROID */}
              <div className="mt-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase text-[#8C7A6B]">
                    {mem.location}
                  </span>
                  {mem.unlocked && (
                    <span className="text-[9px] font-bold text-[#4E6E58]">✓ Revelada</span>
                  )}
                </div>
                <h4 className="text-sm font-black text-[#3A2E2B]">{mem.title}</h4>
                <p className="text-xs text-[#6B5A4E] leading-relaxed">
                  {mem.unlocked ? mem.description : "Continúa tus actividades diarias para revelar esta postal."}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* PIE DE PÁGINA */}
        <div className="mt-8 pt-4 border-t-2 border-[#5C4033]/20 text-center">
          <p className="text-xs italic text-[#7A6B62]">
            "Cada día en Oakhaven escribe una línea nueva en la historia de tu propia calma."
          </p>
        </div>
      </div>
    </div>
  );
}
