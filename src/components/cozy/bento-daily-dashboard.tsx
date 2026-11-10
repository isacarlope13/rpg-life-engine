"use client";

import React from "react";
import { Maximize2, Compass } from "lucide-react";
import type {
  ReadingBook,
  KnittingProject,
  RubikCubeCatalogItem,
  SkillSessionRecord,
  Quest,
} from "@/types/rpg";
import type { VillageResident } from "@/lib/sanctuary/village-tiers";

interface BentoDailyDashboardProps {
  playerLevel: number;
  currentXp: number;
  streakDays: number;
  walletGp: number;
  vaultGp: number;
  recentSessions: SkillSessionRecord[];
  quests: Quest[];
  readingBooks: ReadingBook[];
  knittingProjects: KnittingProject[];
  rubikCubes: RubikCubeCatalogItem[];
  residents: VillageResident[];
  quickNote: string;
  notesList: string[];
  onQuickNoteChange: (val: string) => void;
  onAddNote: (e: React.FormEvent) => void;
  onDeleteNote: (idx: number) => void;
  onSwitchToVillageMap: () => void;
  onOpenBuilding: (buildingId: string) => void;
  onSelectResident: (resident: VillageResident) => void;
}

export function BentoDailyDashboard({
  playerLevel,
  currentXp,
  streakDays,
  walletGp,
  vaultGp,
  recentSessions,
  quests,
  readingBooks,
  knittingProjects,
  rubikCubes,
  residents,
  quickNote,
  notesList,
  onQuickNoteChange,
  onAddNote,
  onDeleteNote,
  onSwitchToVillageMap,
  onOpenBuilding,
  onSelectResident,
}: BentoDailyDashboardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
      {/* TARJETA 1: RESUMEN DE PROGRESO Y REINO — 7 COLS */}
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
                  Nivel {playerLevel} • {currentXp.toLocaleString("es-CO")} XP acumulados
                </span>
              </div>
            </div>

            <span className="rounded-full border-2 border-[#4E6E58] bg-[#4E6E58]/15 px-3 py-1 text-xs font-black text-[#4E6E58]">
              Racha: {streakDays} Días
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-sm">
              <span className="text-[10px] font-bold text-[#795548] uppercase">Billetera Activa</span>
              <p className="mt-1 font-mono text-base font-black text-[#3A2E2B]">
                {walletGp.toLocaleString("es-CO")} GP
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-sm">
              <span className="text-[10px] font-bold text-[#795548] uppercase">Bóveda de Reserva</span>
              <p className="mt-1 font-mono text-base font-black text-[#4E6E58]">
                {vaultGp.toLocaleString("es-CO")} GP
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-[#795548]">
            {recentSessions.length} actividades reales forjadas
          </span>
          <button
            type="button"
            onClick={onSwitchToVillageMap}
            className="text-xs font-black text-[#4E6E58] hover:underline cursor-pointer"
          >
            Explorar Pueblo y Edificios ➜
          </button>
        </div>
      </div>

      {/* TARJETA 2: MINI PREVIA DEL PUEBLO — 5 COLS */}
      <div className="lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
        <div>
          <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] text-lg">
                🗺️
              </span>
              <div>
                <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                  Pueblo de Oakhaven
                </h3>
                <span className="text-[11px] font-bold text-[#795548]">
                  8 Edificios Especializados
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSwitchToVillageMap}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] p-1.5 text-[#3A2E2B] hover:bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] transition cursor-pointer"
              title="Abrir mapa del pueblo"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          <div className="relative mt-3 h-36 rounded-2xl border-[3px] border-[#3A2E2B] bg-gradient-to-b from-[#80B992] to-[#609972] p-3 shadow-inner flex flex-col justify-between">
            <div className="flex justify-between items-center text-xs font-bold text-[#3A2E2B]">
              <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🧶 Atelier</span>
              <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">📚 Librería</span>
              <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🧩 Puzzles</span>
            </div>
            <div className="flex justify-around items-center text-3xl">
              <span>🏡</span>
              <span>🏰</span>
              <span>🔭</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold text-[#3A2E2B]">
              <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🌿 Botánico</span>
              <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">🏛️ Biblioteca</span>
              <span className="bg-[#FFFDF8] px-2 py-0.5 rounded-lg border border-[#3A2E2B]">💼 Oficina</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs font-bold text-[#795548]">
            Coordenadas: 42°N, 71°O
          </span>
          <button
            type="button"
            onClick={onSwitchToVillageMap}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#4E6E58] px-3.5 py-1.5 text-xs font-black text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B] hover:-translate-y-0.5 cursor-pointer"
          >
            <Compass className="h-3.5 w-3.5" /> Entrar al Pueblo
          </button>
        </div>
      </div>

      {/* TARJETA 3: REGISTRO DE MISIONES REALES — 7 COLS */}
      <div className="lg:col-span-7 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
        <div>
          <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E76F51] text-white shadow-[0_2px_0_#3A2E2B] text-lg">
                📜
              </span>
              <div>
                <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                  Registro de Misiones Diarias
                </h3>
                <span className="text-[11px] font-bold text-[#795548]">
                  Tareas y hábitos con recompensa verificada
                </span>
              </div>
            </div>

            <span className="rounded-full bg-[#E9C46A] border-2 border-[#3A2E2B] px-3 py-0.5 text-xs font-black text-[#3A2E2B]">
              {quests.filter((q) => q.status === "completed").length} / {quests.length} Listas
            </span>
          </div>

          <div className="mt-3.5 space-y-2.5">
            {quests.length === 0 ? (
              <p className="text-xs text-[#7A6B62] py-4 text-center">
                ¡No hay misiones pendientes para hoy! Revisa tu cronograma.
              </p>
            ) : (
              quests.slice(0, 4).map((quest) => (
                <div
                  key={quest.id}
                  className={`rounded-2xl border-[3px] border-[#3A2E2B] p-3 shadow-[0_2px_0_#3A2E2B] flex items-center justify-between gap-3 ${
                    quest.status === "completed"
                      ? "bg-[#EAF3ED] opacity-75"
                      : "bg-[#F7F4EB]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">
                      {quest.status === "completed" ? "✅" : "⚔️"}
                    </span>
                    <div>
                      <h4 className={`text-xs font-black text-[#3A2E2B] ${quest.status === "completed" ? "line-through" : ""}`}>
                        {quest.title}
                      </h4>
                      <span className="text-[10px] font-bold text-[#795548]">
                        +{quest.reward_gp.toLocaleString("es-CO")} GP • {quest.domain}
                      </span>
                    </div>
                  </div>
                  <span className="rounded-lg bg-[#EBE5D8] px-2 py-0.5 font-mono text-[10px] font-bold text-[#3A2E2B]">
                    {quest.status === "completed" ? "Completada" : "En curso"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 text-xs font-bold text-[#795548] flex justify-between">
          <span>Recompensas deterministas de la Bóveda</span>
          <span className="text-[#4E6E58]">Buff de Gracia Activo</span>
        </div>
      </div>

      {/* TARJETA 4: COLECCIONES REALES — 5 COLS */}
      <div className="lg:col-span-5 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-col justify-between hover:-translate-y-0.5 transition-transform">
        <div>
          <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] text-lg">
                🏺
              </span>
              <div>
                <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                  Colecciones del Santuario
                </h3>
                <span className="text-[11px] font-bold text-[#795548]">
                  Catálogos de recursos reales
                </span>
              </div>
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-3">
            {/* Libros */}
            <div
              onClick={() => onOpenBuilding("libreria")}
              className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
            >
              <span className="text-2xl">📚</span>
              <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">La Librería</h4>
              <span className="font-mono text-xs font-bold text-[#4E6E58]">
                {readingBooks.length} Libros
              </span>
            </div>

            {/* Tejido */}
            <div
              onClick={() => onOpenBuilding("atelier")}
              className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
            >
              <span className="text-2xl">🧶</span>
              <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">El Atelier</h4>
              <span className="font-mono text-xs font-bold text-[#E76F51]">
                {knittingProjects.length} Proyectos
              </span>
            </div>

            {/* Speedcubing */}
            <div
              onClick={() => onOpenBuilding("club_puzzles")}
              className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
            >
              <span className="text-2xl">🧩</span>
              <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">Arsenal WCA</h4>
              <span className="font-mono text-xs font-bold text-[#06B6D4]">
                {rubikCubes.length || 1} Cubos
              </span>
            </div>

            {/* Observatorio */}
            <div
              onClick={() => onOpenBuilding("observatorio")}
              className="rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] hover:-translate-y-0.5 transition cursor-pointer"
            >
              <span className="text-2xl">🔭</span>
              <h4 className="mt-1 text-xs font-black text-[#3A2E2B]">Observatorio</h4>
              <span className="font-mono text-xs font-bold text-[#A855F7]">
                Deep Work
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t-2 border-[#3A2E2B]/10 text-xs font-bold text-[#795548] flex justify-between">
          <span>Haz clic en una colección para abrir su edificio</span>
        </div>
      </div>

      {/* TARJETA 5: COMPAÑEROS & RESIDENTES ASISTENTES — 12 COLS */}
      <div className="lg:col-span-12 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] hover:-translate-y-0.5 transition-transform">
        <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E9C46A] shadow-[0_2px_0_#3A2E2B] text-lg">
              👥
            </span>
            <div>
              <h3 className="text-sm font-black text-[#3A2E2B] uppercase tracking-wide">
                Compañeros del Pueblo (Residentes Asistentes)
              </h3>
              <span className="text-[11px] font-bold text-[#795548]">
                Te recuerdan tu última sesión real y preparan tus herramientas
              </span>
            </div>
          </div>

          <span className="rounded-full border-2 border-[#3A2E2B] bg-[#E8DFCF] px-3 py-1 text-xs font-black text-[#3A2E2B]">
            {residents.length} Asistentes Activos
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {residents.map((resident) => (
            <div
              key={resident.id}
              onClick={() => onSelectResident(resident)}
              className="group rounded-2xl border-[3px] border-[#3A2E2B] bg-[#F7F4EB] p-3 shadow-[0_2px_0_#3A2E2B] text-center hover:-translate-y-1 hover:shadow-[0_4px_0_#3A2E2B] transition-all cursor-pointer"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#3A2E2B] bg-[#FFFDF8] text-2xl group-hover:scale-110 transition-transform">
                {resident.avatar}
              </div>
              <h4 className="mt-1.5 text-xs font-black text-[#3A2E2B]">
                {resident.name}
              </h4>
              <span className="block text-[9px] font-bold text-[#795548]">
                {resident.title}
              </span>
              <p className="mt-1 text-[9px] italic text-[#5C4033] line-clamp-1">
                "{resident.greetingQuote}"
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* TARJETA 6: BITÁCORA DE NOTAS RÁPIDAS — 12 COLS */}
      <div className="lg:col-span-12 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B]">
        <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">✍️</span>
            <h3 className="text-sm font-black text-[#3A2E2B]">
              Bitácora & Recordatorios de Oakhaven
            </h3>
          </div>
        </div>

        <form onSubmit={onAddNote} className="mt-3 flex gap-2">
          <input
            type="text"
            value={quickNote}
            onChange={(e) => onQuickNoteChange(e.target.value)}
            placeholder="Anota una idea o recordatorio rápido..."
            className="flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-4 py-2 text-xs text-[#3A2E2B] focus:outline-none focus:border-[#4E6E58]"
          />
          <button
            type="submit"
            className="rounded-2xl border-2 border-[#3A2E2B] bg-[#4E6E58] px-4 py-2 text-xs font-black text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] hover:bg-[#3D5645] cursor-pointer"
          >
            Anotar
          </button>
        </form>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {notesList.map((note, idx) => (
            <div
              key={idx}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs text-[#3A2E2B] flex items-center justify-between gap-2"
            >
              <span className="line-clamp-2">📌 {note}</span>
              <button
                type="button"
                onClick={() => onDeleteNote(idx)}
                className="text-[10px] text-[#795548] hover:text-red-700 font-bold shrink-0 cursor-pointer"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
