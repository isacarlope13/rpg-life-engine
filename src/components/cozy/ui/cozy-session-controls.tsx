"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, Check, Sparkles } from "lucide-react";
import { CozyButton } from "./cozy-button";
import { triggerHaptic } from "@/lib/offline-sync";

export interface CozySessionControlsProps {
  initialMinutes?: number;
  domainName?: string;
  onSessionComplete?: (durationMinutes: number, notes: string) => void;
  className?: string;
}

export function CozySessionControls({
  initialMinutes = 15,
  domainName = "Sesión Consciente",
  onSessionComplete,
  className = "",
}: CozySessionControlsProps) {
  const [selectedMinutes, setSelectedMinutes] = useState(initialMinutes);
  const [secondsRemaining, setSecondsRemaining] = useState(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setSecondsRemaining(selectedMinutes * 60);
    setIsRunning(false);
  }, [selectedMinutes]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRunning && secondsRemaining > 0) {
      timer = setInterval(() => {
        setSecondsRemaining((prev) => prev - 1);
      }, 1000);
    } else if (secondsRemaining === 0 && isRunning) {
      setIsRunning(false);
      triggerHaptic("success");
    }
    return () => clearInterval(timer);
  }, [isRunning, secondsRemaining]);

  const toggleRunning = () => {
    setIsRunning(!isRunning);
    triggerHaptic("light");
  };

  const handleReset = () => {
    setIsRunning(false);
    setSecondsRemaining(selectedMinutes * 60);
    triggerHaptic("warning");
  };

  const handleComplete = () => {
    const elapsedMinutes = Math.max(
      1,
      Math.round((selectedMinutes * 60 - secondsRemaining) / 60)
    );
    triggerHaptic("success");
    if (onSessionComplete) {
      onSessionComplete(elapsedMinutes, notes);
    }
    handleReset();
    setNotes("");
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
        <span className="text-xs font-black uppercase tracking-wider text-[#795548]">
          ⏳ Temporizador de {domainName}
        </span>
        <span className="rounded-full bg-[#E9C46A] border-2 border-[#3A2E2B] px-2.5 py-0.5 text-[10px] font-black text-[#3A2E2B]">
          {selectedMinutes} Minutos
        </span>
      </div>

      {/* Reloj Monospace Retro */}
      <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#241C1A] p-4 text-center shadow-inner">
        <span className="font-mono text-4xl sm:text-5xl font-black tracking-widest text-[#E7D69C] drop-shadow-sm">
          {formatTime(secondsRemaining)}
        </span>
      </div>

      {/* Selector de Presets */}
      <div className="grid grid-cols-4 gap-2">
        {[5, 15, 25, 45].map((mins) => (
          <button
            key={mins}
            type="button"
            onClick={() => setSelectedMinutes(mins)}
            className={`rounded-xl border-2 py-1.5 text-xs font-black transition-all cursor-pointer ${
              selectedMinutes === mins
                ? "border-[#3A2E2B] bg-[#4E6E58] text-[#FFFDF8] shadow-[0_2px_0_#3A2E2B] -translate-y-0.5"
                : "border-[#3A2E2B]/30 bg-[#F7F4EB] text-[#3A2E2B] hover:bg-[#E8DFCF]"
            }`}
          >
            {mins}m
          </button>
        ))}
      </div>

      {/* Botones de Control */}
      <div className="flex gap-2">
        <CozyButton
          variant={isRunning ? "clay" : "forest"}
          className="flex-1"
          icon={isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          onClick={toggleRunning}
        >
          {isRunning ? "Pausar" : "Iniciar Foco"}
        </CozyButton>

        <CozyButton
          variant="wood"
          icon={<RotateCcw className="h-4 w-4" />}
          onClick={handleReset}
          aria-label="Reiniciar"
        />

        <CozyButton
          variant="sunlight"
          icon={<Check className="h-4 w-4" />}
          onClick={handleComplete}
        >
          Forjar
        </CozyButton>
      </div>

      {/* Input de Notas Opcionales */}
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notas o avances de la sesión..."
        className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3.5 py-2 text-xs text-[#3A2E2B] focus:outline-none focus:border-[#4E6E58]"
      />
    </div>
  );
}
