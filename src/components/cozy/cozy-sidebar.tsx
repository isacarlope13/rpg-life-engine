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
      {/* 1. CABECERA DEL REINO — ESTÉTICA VERDE BOSQUE & MADERA */}
      <div className="relative rounded-3xl border-4 border-[#3A2E2B] bg-[#2A4333] p-5 shadow-[0_6px_0_#1E2E23] text-[#FFFDF8] transition-transform hover:-translate-y-0.5">
        <span className="absolute top-2.5 left-3 text-xs opacity-50 select-none">🔩</span>
        <span className="absolute top-2.5 right-3 text-xs opacity-50 select-none">🔩</span>
        <span className="absolute bottom-2.5 left-3 text-xs opacity-50 select-none">🔩</span>
        <span className="absolute bottom-2.5 right-3 text-xs opacity-50 select-none">🔩</span>

        <div className="text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C] shadow-[0_3px_0_#3A2E2B] mb-2 text-2xl select-none">
            🏰
          </div>
          <span className="block text-[11px] font-black tracking-widest uppercase text-[#B8CCA0]">
            Bienvenido al Reino
          </span>
          <h1 className="text-xl font-black text-[#F4EEDC] tracking-tight">
            Valle de Oakhaven
          </h1>
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-[#314C3C] px-3.5 py-1 border-2 border-[#77936A]/60 text-xs font-black text-[#E7D69C] shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-[#E7D69C]" /> Nivel {playerLevel} • {streakDays} Días Racha
          </div>
        </div>
      </div>

      {/* 2. MENÚ DE NAVEGACIÓN — SIDEBAR VERDE BOSQUE PROFUNDO */}
      <nav className="rounded-3xl border-4 border-[#3A2E2B] bg-[#243B2E] p-3.5 shadow-[0_6px_0_#1A2B20] text-[#F4EEDC]">
        <div className="px-3 py-2 border-b-2 border-[#77936A]/20 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-[#B8CCA0]">
            Bolsa de Aventura
          </span>
          <span className="text-xs select-none">🎒</span>
        </div>

        <div className="mt-2.5 space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id as NavItem)}
                className={`w-full group flex items-center justify-between rounded-2xl border-3 px-3.5 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "border-[#E7D69C] bg-[#3B5A45] text-[#FFFDF8] shadow-[0_4px_0_#1A2B20] -translate-y-0.5"
                    : "border-transparent bg-transparent text-[#D8E6DA] hover:border-[#77936A]/40 hover:bg-[#2D4737] hover:-translate-y-0.5"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-xl border-2 transition-transform group-hover:scale-110 ${
                      isActive
                        ? "border-[#E7D69C] bg-[#E7D69C] text-[#3A2E2B]"
                        : "border-[#77936A]/50 bg-[#1F3327] text-[#B8CCA0]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className={isActive ? "font-black text-[#F4EEDC]" : ""}>
                    {item.label}
                  </span>
                </div>

                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isActive
                        ? "bg-[#E7D69C] text-[#3A2E2B]"
                        : "bg-[#1E3025] text-[#B8CCA0] border border-[#77936A]/30"
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

      {/* 3. ACCESO RÁPIDO AL COMMAND CENTER CLÁSICO */}
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
