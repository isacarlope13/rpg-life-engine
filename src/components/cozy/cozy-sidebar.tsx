"use client";

import React from "react";
import Link from "next/link";
import {
  Sparkles,
  Home,
  Compass,
  Scroll,
  Archive,
  Users,
  FileText,
  Zap,
} from "lucide-react";

export type NavItem =
  | "home"
  | "village"
  | "quests"
  | "collections"
  | "party"
  | "notes";

interface CozySidebarProps {
  playerLevel: number;
  streakDays: number;
  activeTab: NavItem;
  onTabChange: (tab: NavItem) => void;
  questsCount: number;
  collectionsCount: number;
  residentsCount: number;
  notesCount: number;
}

export function CozySidebar({
  playerLevel,
  streakDays,
  activeTab,
  onTabChange,
  questsCount,
  collectionsCount,
  residentsCount,
  notesCount,
}: CozySidebarProps) {
  const NAV_ITEMS = [
    { id: "home", label: "Inicio (Hem)", icon: Home, badge: "Bento" },
    { id: "village", label: "Pueblo Vivo (By)", icon: Compass, badge: "8 Edificios" },
    { id: "quests", label: "Misiones (Uppgifter)", icon: Scroll, badge: `${questsCount}` },
    { id: "collections", label: "Colecciones (Samlingar)", icon: Archive, badge: `${collectionsCount}` },
    { id: "party", label: "Compañeros (Invånare)", icon: Users, badge: `${residentsCount}` },
    { id: "notes", label: "Bitácora (Anteckningar)", icon: FileText, badge: `${notesCount}` },
  ];

  return (
    <aside className="lg:col-span-3 xl:col-span-3 space-y-6">
      {/* Cabecera del Reino */}
      <div className="relative rounded-3xl border-4 border-[#3A2E2B] bg-[#E8DFCF] p-5 shadow-[0_6px_0_#3A2E2B] transition-transform hover:-translate-y-0.5">
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
            <Sparkles className="h-3.5 w-3.5" /> Nivel {playerLevel} • {streakDays} Días Racha
          </div>
        </div>
      </div>

      {/* Menú de Navegación estilo Inventario */}
      <nav className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-3 shadow-[0_6px_0_#3A2E2B]">
        <div className="px-3 py-2 border-b-2 border-[#3A2E2B]/10 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#795548]">
            Bolsa de Aventura
          </span>
          <span className="text-xs">🎒</span>
        </div>

        <div className="mt-2 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id as NavItem)}
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
                        ? "border-[#FFFDF8] bg-[#3B5443] text-white"
                        : "border-[#3A2E2B] bg-[#E8DFCF] text-[#3A2E2B]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span>{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isActive
                        ? "bg-[#E9C46A] text-[#3A2E2B]"
                        : "bg-[#E8DFCF] text-[#795548]"
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

      {/* Acceso Rápido al Command Center Clásico */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] text-center">
        <span className="text-xs font-bold text-[#795548] block mb-2">
          ¿Prefieres la vista analítica?
        </span>
        <Link
          href="/dashboard"
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-[#3A2E2B] bg-[#3A2E2B] py-2.5 text-xs font-black text-[#F7F4EB] shadow-[0_3px_0_#5C4033] hover:bg-[#4E3834] transition cursor-pointer"
        >
          <Zap className="h-3.5 w-3.5 text-amber-300" />
          Ir a Command Center ➜
        </Link>
      </div>
    </aside>
  );
}
