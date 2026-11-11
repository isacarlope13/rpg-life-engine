"use client";

import React, { useState, useId } from "react";
import {
  Sparkles,
  Mic,
  MicOff,
  Camera,
  Check,
  ChevronRight,
  FileCheck,
  Lightbulb,
  X,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import type { SkillDomain } from "@/types/rpg";
import {
  SkillResourceContext,
  getSuggestedSkillValues,
  parseSmartCaptureSnippet,
  validateSkillResourceAttachment,
  ExtractedSmartSnippet,
} from "@/lib/sanctuary/skill-resources-hub";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface SmartCaptureWidgetProps {
  domain: SkillDomain;
  context: SkillResourceContext;
  notes?: string;
  onNotesChange?: (notes: string) => void;
  onApplySuggestedValues?: (values: {
    quantity: number;
    unitLabel?: string;
    notes?: string;
    title?: string;
  }) => void;
  onPhotoUploaded?: (dataUrl: string, fileName: string) => void;
  className?: string;
}

export function SmartCaptureWidget({
  domain,
  context,
  notes = "",
  onNotesChange,
  onApplySuggestedValues,
  onPhotoUploaded,
  className = "",
}: SmartCaptureWidgetProps) {
  const fileInputId = useId();
  const suggestions = getSuggestedSkillValues(context);

  const [isDictating, setIsDictating] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<{ url: string; name: string } | null>(null);
  const [pendingSnippet, setPendingSnippet] = useState<ExtractedSmartSnippet | null>(null);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Dictado por voz nativo accesible
  const handleToggleVoiceDictation = () => {
    const SpeechCtor =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechCtor) {
      setNotification({
        type: "warning",
        message: "Tu navegador no tiene activado el reconocimiento de voz nativo.",
      });
      return;
    }

    if (isDictating) {
      setIsDictating(false);
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechCtor as any)();
      recognition.lang = "es-CO";
      recognition.interimResults = false;
      setIsDictating(true);
      triggerHaptic("medium");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (evt: any) => {
        const transcript = evt.results[0][0].transcript;
        if (transcript) {
          triggerHaptic("light");
          const nextText = notes ? `${notes} ${transcript}` : transcript;
          if (onNotesChange) {
            onNotesChange(nextText);
          }

          // Analizar si contiene patrones para sugerir valores (HITL)
          const extracted = parseSmartCaptureSnippet(transcript, domain);
          if (extracted.candidateNumber !== undefined) {
            setPendingSnippet(extracted);
          }
        }
        setIsDictating(false);
      };

      recognition.onerror = () => setIsDictating(false);
      recognition.onend = () => setIsDictating(false);
      recognition.start();
    } catch {
      setIsDictating(false);
    }
  };

  // Manejo de foto de evidencia con validación de seguridad
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateSkillResourceAttachment(file);
    if (!validation.valid) {
      triggerHaptic("warning");
      setNotification({
        type: "error",
        message: validation.error || "Archivo no admitido.",
      });
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPhotoPreview({ url: dataUrl, name: validation.sanitizedName || file.name });
      triggerHaptic("success");
      if (onPhotoUploaded) {
        onPhotoUploaded(dataUrl, validation.sanitizedName || file.name);
      }
      setNotification({
        type: "success",
        message: `📷 Evidencia "${validation.sanitizedName}" adjuntada con éxito.`,
      });
    };
    reader.readAsDataURL(file);
  };

  // Confirmar y aplicar snippet extraído (HITL)
  const handleConfirmSnippet = () => {
    if (!pendingSnippet) return;
    triggerHaptic("medium");

    if (onApplySuggestedValues && pendingSnippet.candidateNumber !== undefined) {
      onApplySuggestedValues({
        quantity: pendingSnippet.candidateNumber,
        unitLabel: pendingSnippet.candidateUnit,
        notes: pendingSnippet.candidateNotes,
      });
    }

    setPendingSnippet(null);
    setNotification({
      type: "success",
      message: `✨ Valores confirmados y aplicados a la sesión.`,
    });
  };

  const handleSnippetClick = (snippet: string) => {
    triggerHaptic("light");
    const next = notes ? `${notes} • ${snippet}` : snippet;
    if (onNotesChange) {
      onNotesChange(next);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* NOTIFICACIÓN */}
      {notification && (
        <CozyNotification
          variant={notification.type}
          message={notification.message}
          onDismiss={() => setNotification(null)}
        />
      )}

      {/* MODAL / BANNER DE CONFIRMACIÓN HITL */}
      {pendingSnippet && (
        <div className="rounded-2xl border-2 border-[#E7D69C] bg-[#FFFBF2] p-3 shadow-md animate-fadeIn">
          <div className="flex items-center justify-between gap-2 border-b border-[#E7D69C]/60 pb-2">
            <span className="flex items-center gap-1.5 text-xs font-black text-[#3A2E2B]">
              <Sparkles className="h-4 w-4 text-[#D8B48A]" />
              ¿Confirmar datos detectados por Smart Capture?
            </span>
            <button
              type="button"
              onClick={() => setPendingSnippet(null)}
              className="text-[#7A6B62] hover:text-[#3A2E2B] p-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="py-2 text-xs text-[#3A2E2B] space-y-1">
            <p>
              <strong>Cantidad detectada:</strong> {pendingSnippet.candidateNumber}{" "}
              {pendingSnippet.candidateUnit || "unidades"}
            </p>
            {pendingSnippet.candidateNotes && (
              <p className="italic text-[#7A6B62]">
                &quot;{pendingSnippet.candidateNotes}&quot;
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setPendingSnippet(null)}
              className="rounded-xl border border-[#D8B48A] bg-white px-2.5 py-1 text-xs font-bold text-[#7A6B62] hover:bg-[#F4EEDC]"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={handleConfirmSnippet}
              className="rounded-xl bg-[#314C3C] px-3 py-1 text-xs font-bold text-white hover:bg-[#77936A] flex items-center gap-1"
            >
              <Check className="h-3.5 w-3.5" /> Confirmar y Aplicar
            </button>
          </div>
        </div>
      )}

      {/* TARJETA DE VALORES SUGERIDOS DETERMINISTAS */}
      <div className="rounded-2xl border-2 border-[#D8B48A] bg-[#FFFDF8] p-3.5 shadow-sm space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#E7D69C]/40 text-sm">
              💡
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6B62]">
                Sugerencia de Continuación
              </span>
              <h4 className="text-xs font-black text-[#3A2E2B]">
                {suggestions.primaryTitle}
              </h4>
            </div>
          </div>

          {onApplySuggestedValues && (
            <CozyButton
              variant="forest"
              size="sm"
              onClick={() => {
                triggerHaptic("medium");
                onApplySuggestedValues({
                  quantity: suggestions.suggestedQuantity,
                  unitLabel: suggestions.unitLabel,
                  title: suggestions.primaryTitle,
                });
              }}
              className="flex items-center gap-1 text-[11px]"
            >
              <span>{suggestions.suggestedActionLabel}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </CozyButton>
          )}
        </div>

        <p className="text-[11px] text-[#7A6B62]">{suggestions.contextSummary}</p>

        {/* BARRA DE AVANCE SI EXISTE */}
        {typeof suggestions.progressPercentage === "number" && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-[#7A6B62]">
              <span>Avance acumulado</span>
              <span className="text-[#314C3C]">{suggestions.progressPercentage}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#F4EEDC] border border-[#D8B48A]/40">
              <div
                className="h-full bg-gradient-to-r from-[#77936A] to-[#314C3C] transition-all duration-500"
                style={{ width: `${suggestions.progressPercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* PILLS DE NOTAS RÁPIDAS (SNIPPETS) */}
        <div className="pt-1 border-t border-[#D8B48A]/30">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6B62] block mb-1.5">
            Snippets de Captura Rápida:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.quickSnippets.map((snippet, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSnippetClick(snippet)}
                className="rounded-xl border border-[#D8B48A] bg-[#FFFBF2] px-2.5 py-1 text-[10px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/40 hover:border-[#77936A] transition cursor-pointer"
              >
                + {snippet}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BARRA DE CAPTURA RÁPIDA: VOZ & FOTO DE EVIDENCIA */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#D8B48A] bg-[#FFFDF8] p-2.5 shadow-sm">
        <div className="flex items-center gap-2">
          {/* BOTÓN DE VOZ */}
          <button
            type="button"
            onClick={handleToggleVoiceDictation}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
              isDictating
                ? "bg-[#C88973] text-white animate-pulse"
                : "border border-[#D8B48A] bg-[#FFFBF2] text-[#3A2E2B] hover:bg-[#E7D69C]/30"
            }`}
          >
            {isDictating ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5 text-[#314C3C]" />}
            <span>{isDictating ? "Escuchando..." : "Dictar Nota"}</span>
          </button>

          {/* BOTÓN DE FOTO */}
          <label
            htmlFor={fileInputId}
            className="flex items-center gap-1.5 rounded-xl border border-[#D8B48A] bg-[#FFFBF2] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] hover:bg-[#E7D69C]/30 transition cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5 text-[#77936A]" />
            <span>{photoPreview ? "Cambiar Foto" : "Subir Foto"}</span>
            <input
              id={fileInputId}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </label>
        </div>

        {/* PREVIEW MINIATURA SI EXISTE */}
        {photoPreview && (
          <div className="flex items-center gap-2 rounded-xl border border-[#77936A] bg-[#FFFBF2] px-2 py-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoPreview.url}
              alt={photoPreview.name}
              className="h-6 w-6 rounded-lg object-cover border border-[#D8B48A]"
            />
            <span className="text-[10px] font-bold text-[#314C3C] line-clamp-1 max-w-[120px]">
              {photoPreview.name}
            </span>
            <button
              type="button"
              onClick={() => setPhotoPreview(null)}
              className="text-[#7A6B62] hover:text-[#C88973]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
