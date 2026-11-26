"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Command, Search } from "lucide-react";
import { CozyModal } from "@/components/cozy/ui";

export interface CommandPaletteAction {
  id: string;
  label: string;
  category: string;
  keywords: string;
  onSelect: () => void;
}

interface CozyCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  actions: CommandPaletteAction[];
}

export function CozyCommandPalette({
  isOpen,
  onClose,
  actions,
}: CozyCommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.keywords.toLowerCase().includes(q)
    );
  }, [actions, query]);

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Buscador Global y Acciones Rápidas (Ctrl+K)"
      subtitle="Navega entre edificios, especialistas, AI Command Center y automatizaciones"
      maxWidth="lg"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2">
          <Search className="h-4 w-4 text-[#795548] shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar edificio, Clara, Rowan, Filet, automatizaciones..."
            className="w-full bg-transparent text-xs font-bold text-[#3A2E2B] outline-none"
          />
          <span className="hidden sm:inline-flex items-center gap-0.5 rounded-lg border border-[#3A2E2B]/30 bg-[#FFFDF8] px-1.5 py-0.5 text-[10px] font-black text-[#795548]">
            <Command className="h-2.5 w-2.5" />K
          </span>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#3A2E2B]/30 p-4 text-center text-xs font-bold text-[#795548]">
              Sin coincidencias para &ldquo;{query}&rdquo;.
            </p>
          ) : (
            filtered.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => {
                  action.onSelect();
                  onClose();
                }}
                className="w-full rounded-xl border-2 border-[#3A2E2B]/25 bg-[#FFFDF8] px-3 py-2 text-left flex items-center justify-between gap-2 hover:border-[#3A2E2B] hover:bg-[#E7D69C]/40 transition-colors cursor-pointer"
              >
                <span className="text-xs font-black text-[#3A2E2B]">{action.label}</span>
                <span className="rounded-full bg-[#F4EEDC] px-2 py-0.5 text-[10px] font-bold text-[#795548]">
                  {action.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </CozyModal>
  );
}
