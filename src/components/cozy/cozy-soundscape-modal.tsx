"use client";

import React, { useState, useEffect } from "react";
import { Volume2, VolumeX, Sparkles, Music } from "lucide-react";
import {
  cozySoundscape,
  SOUNDSCAPE_PRESETS,
  type SoundscapePreset,
} from "@/lib/cozy/cozy-soundscape";
import { CozyModal, CozyButton, CozyCard } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface CozySoundscapeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CozySoundscapeModal({ isOpen, onClose }: CozySoundscapeModalProps) {
  const [activePreset, setActivePreset] = useState<SoundscapePreset>("off");
  const [volume, setVolume] = useState<number>(35);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedVol = localStorage.getItem("cozy_soundscape_vol");
        if (savedVol) {
          const parsed = Math.round(parseFloat(savedVol) * 100);
          setVolume(isNaN(parsed) ? 35 : parsed);
        }
        const savedPreset = (localStorage.getItem("cozy_soundscape_preset") ||
          "off") as SoundscapePreset;
        setActivePreset(savedPreset);
      } catch {}
    }
  }, []);

  const handleSelectPreset = (preset: SoundscapePreset) => {
    setActivePreset(preset);
    cozySoundscape.play(preset);
    triggerHaptic("light");
  };

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    cozySoundscape.setVolume(newVal / 100);
  };

  const handleMute = () => {
    setActivePreset("off");
    cozySoundscape.stop();
    triggerHaptic("warning");
  };

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Ambientación Sonora de Oakhaven"
      subtitle="Paisajes sonoros procedurales para concentración y descanso"
      icon="🎵"
      headerVariant="wood"
      maxWidth="md"
    >
      <div className="space-y-4 text-[#3A2E2B]">
        {/* CONTROL DE VOLUMEN */}
        <CozyCard variant="cream" shadow="sm" className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-black text-[#795548]">
            <span className="flex items-center gap-1.5">
              {activePreset === "off" || volume === 0 ? (
                <VolumeX className="h-4 w-4 text-[#C88973]" />
              ) : (
                <Volume2 className="h-4 w-4 text-[#314C3C]" />
              )}
              Volumen Ambiental
            </span>
            <span className="font-mono text-sm font-black text-[#3A2E2B]">
              {volume}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            className="w-full accent-[#4E6E58] cursor-pointer"
            aria-label="Volumen ambiental"
          />
        </CozyCard>

        {/* LISTA DE PRESETS */}
        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-[#795548] block">
            Selecciona un Paisaje Relajante:
          </span>
          <div className="grid grid-cols-1 gap-2">
            {SOUNDSCAPE_PRESETS.map((p) => {
              const isSelected = activePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPreset(p.id)}
                  className={`flex items-start gap-3 rounded-2xl border-3 p-3 text-left transition-all cursor-pointer ${
                    isSelected
                      ? "border-[#3A2E2B] bg-[#FFFDF8] shadow-[0_4px_0_#3A2E2B] scale-[1.01]"
                      : "border-[#3A2E2B]/30 bg-[#F4EEDC]/60 hover:bg-[#FFFDF8] hover:border-[#3A2E2B]/60"
                  }`}
                >
                  <span className="text-2xl select-none">{p.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-[#3A2E2B]">
                        {p.label}
                      </span>
                      {isSelected && (
                        <span className="rounded-full border border-[#77936A] bg-[#77936A]/20 px-2 py-0.5 text-[9px] font-black text-[#314C3C]">
                          ● En reproducción
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#795548] leading-tight">
                      {p.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIE CON ACCIONES */}
        <div className="pt-2 flex items-center justify-between gap-2 border-t-2 border-[#3A2E2B]/15">
          <CozyButton
            variant="clay"
            size="sm"
            onClick={handleMute}
            disabled={activePreset === "off"}
          >
            Silenciar
          </CozyButton>

          <CozyButton
            variant="sunlight"
            size="sm"
            onClick={onClose}
          >
            Listo
          </CozyButton>
        </div>
      </div>
    </CozyModal>
  );
}
