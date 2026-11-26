"use client";

import React, { useState } from "react";
import { Download, FileUp, PenTool, ShieldCheck, Watch } from "lucide-react";
import type { KnittingProject, Quest, ReadingBook } from "@/types/rpg";
import { CozyButton, CozyModal, CozyNotification } from "@/components/cozy/ui";
import { OakHavenInkPad } from "@/components/cozy/oakhaven-ink-pad";
import { DEVICE_CHANNEL_CAPABILITIES } from "@/lib/devices/wrist-shortcut-contract";
import {
  buildOakHavenPortabilityBundle,
  previewPortabilityImport,
  type PortabilityImportPreview,
} from "@/lib/portability/oakhaven-export-bundle";

interface DeviceHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletGp: number;
  vaultRemainingGp: number;
  vaultCapGp: number;
  currentXp: number;
  playerLevel: number;
  streakDays: number;
  knittingProjects: KnittingProject[];
  readingBooks: ReadingBook[];
  quests: Quest[];
  notesList: string[];
}

export function DeviceHubModal({
  isOpen,
  onClose,
  walletGp,
  vaultRemainingGp,
  vaultCapGp,
  currentXp,
  playerLevel,
  streakDays,
  knittingProjects,
  readingBooks,
  quests,
  notesList,
}: DeviceHubModalProps) {
  const [tab, setTab] = useState<"ink" | "wrist" | "portability">("ink");
  const [linkedProjectId, setLinkedProjectId] = useState<string>(knittingProjects[0]?.id || "");
  const [includeKnitting, setIncludeKnitting] = useState(true);
  const [includeBooks, setIncludeBooks] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [importPreview, setImportPreview] = useState<PortabilityImportPreview | null>(null);
  const [confirmSimulation, setConfirmSimulation] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleExportPortability = () => {
    const bundle = buildOakHavenPortabilityBundle({
      walletGp,
      vaultRemainingGp,
      vaultCapGp,
      currentXp,
      playerLevel,
      streakDays,
      knittingProjects: includeKnitting
        ? (knittingProjects as unknown as Array<Record<string, unknown>>)
        : [],
      readingBooks: includeBooks
        ? (readingBooks as unknown as Array<Record<string, unknown>>)
        : [],
      notes: includeNotes ? notesList : [],
    });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oakhaven-portability-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Archivo portable JSON exportado (sin secretos, tokens ni dinero real COP).");
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const preview = previewPortabilityImport(parsed, {
        knittingProjects: knittingProjects.map((k) => ({ id: k.id, name: k.name })),
        readingBooks: readingBooks.map((b) => ({ id: b.id, title: b.title })),
        notes: notesList,
      });
      setImportPreview(preview);
      setConfirmSimulation(false);
    } catch {
      setImportPreview({
        valid: false,
        errors: ["El archivo seleccionado no es un JSON válido."],
        newKnittingCount: 0,
        duplicateKnittingCount: 0,
        newBooksCount: 0,
        duplicateBooksCount: 0,
        newNotesCount: 0,
        duplicateNotesCount: 0,
      });
    }
  };

  return (
    <CozyModal
      isOpen={isOpen}
      onClose={onClose}
      title="Dispositivos, OakHaven Ink y Portabilidad"
      subtitle="Cuadernos S Pen · Atajos de iOS / Apple Watch · Exportación e Importación Segura"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {notice && (
          <CozyNotification
            variant="success"
            title="OakHaven Dispositivos"
            message={notice}
            onDismiss={() => setNotice(null)}
          />
        )}

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "ink", label: "OakHaven Ink (S Pen)", icon: <PenTool className="h-3.5 w-3.5" /> },
              { id: "wrist", label: "Wrist & Atajos iOS", icon: <Watch className="h-3.5 w-3.5" /> },
              { id: "portability", label: "Portabilidad JSON", icon: <Download className="h-3.5 w-3.5" /> },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-xl border-2 px-3 py-1.5 text-xs font-black cursor-pointer ${
                tab === item.id
                  ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                  : "border-[#3A2E2B]/35 bg-[#F4EEDC] text-[#3A2E2B]"
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>

        {tab === "ink" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F4EEDC]/70 p-2.5 text-xs">
              <label className="flex items-center gap-2 font-bold text-[#3A2E2B]">
                <span>Asociar cuaderno a proyecto:</span>
                <select
                  value={linkedProjectId}
                  onChange={(e) => setLinkedProjectId(e.target.value)}
                  className="rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1 text-xs font-bold"
                >
                  <option value="">Sin proyecto específico</option>
                  {knittingProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      🧶 {p.name}
                    </option>
                  ))}
                  {quests.slice(0, 5).map((q) => (
                    <option key={q.code} value={q.code}>
                      🎯 {q.title}
                    </option>
                  ))}
                </select>
              </label>
              <span className="text-[10px] font-bold text-[#795548]">
                Nota: presión física y rechazo de palma S Pen dependen del navegador/dispositivo físico (requiere prueba en Galaxy Tab real).
              </span>
            </div>

            <OakHavenInkPad
              linkedProjectId={linkedProjectId || undefined}
              onSaveNotebook={(nb) =>
                setNotice(
                  `Cuaderno "${nb.title}" guardado offline (${nb.pages.length} página(s)).`
                )
              }
            />
          </div>
        )}

        {tab === "wrist" && (
          <div className="space-y-3 text-xs text-[#3A2E2B]">
            <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3.5 space-y-2">
              <h4 className="font-black uppercase flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#314C3C]" />
                Distinción de Canales (Cero tokens productivos generados)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.values(DEVICE_CHANNEL_CAPABILITIES).map((ch) => (
                  <div key={ch.channel} className="rounded-xl border border-[#3A2E2B]/30 bg-[#FFFDF8] p-2.5 space-y-1">
                    <span className="font-black block">{ch.label}</span>
                    <span className="text-[11px] text-[#5C381E] block">{ch.notes}</span>
                    <span className="text-[10px] font-bold text-[#314C3C] block">
                      {ch.requiresNativeApp ? "Requiere app watchOS nativa futura" : "Utilizable hoy vía Atajos de iOS"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-[11px] text-[#795548] font-bold">
              Acciones soportadas por contrato idempotente: registrar hábito, iniciar/finalizar sesión, consultar tareas, registrar gasto con confirmación, capturar idea, consultar GP/XP, prioridades del día y energía disponible. Consulta <code>docs/IOS_SHORTCUTS_GUIDE.md</code> para el paso a paso.
            </p>
          </div>
        )}

        {tab === "portability" && (
          <div className="space-y-3 text-xs">
            <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3.5 space-y-2.5">
              <h4 className="font-black uppercase text-[#3A2E2B]">
                1. Exportar paquete portable (JSON)
              </h4>
              <div className="flex flex-wrap gap-3 font-bold text-[#3A2E2B]">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={includeKnitting} onChange={(e) => setIncludeKnitting(e.target.checked)} />
                  Proyectos de tejido ({knittingProjects.length})
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={includeBooks} onChange={(e) => setIncludeBooks(e.target.checked)} />
                  Libros ({readingBooks.length})
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={includeNotes} onChange={(e) => setIncludeNotes(e.target.checked)} />
                  Notas ({notesList.length})
                </label>
              </div>
              <CozyButton size="sm" variant="forest" onClick={handleExportPortability} icon={<Download className="h-3.5 w-3.5" />}>
                Descargar respaldo portable JSON
              </CozyButton>
            </div>

            <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-3.5 space-y-2.5">
              <h4 className="font-black uppercase text-[#3A2E2B]">
                2. Simular y validar importación (Vista previa segura)
              </h4>
              <label className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-3 py-1.5 font-black text-[#3A2E2B] cursor-pointer">
                <FileUp className="h-3.5 w-3.5" />
                Seleccionar JSON de OakHaven
                <input type="file" accept="application/json,.json" onChange={handleImportFile} className="hidden" />
              </label>

              {importPreview && (
                <div className="rounded-xl border border-[#3A2E2B]/30 bg-[#F7F4EB] p-3 space-y-1.5 text-[11px]">
                  {!importPreview.valid ? (
                    <p className="font-black text-red-700">Errores: {importPreview.errors.join(" · ")}</p>
                  ) : (
                    <>
                      <p className="font-black text-[#314C3C]">
                        Esquema v1 válido · 0 secretos · 0 mezcla COP
                      </p>
                      <p>
                        Tejido: <strong>{importPreview.newKnittingCount} nuevo(s)</strong>, {importPreview.duplicateKnittingCount} duplicado(s) omitido(s).
                      </p>
                      <p>
                        Libros: <strong>{importPreview.newBooksCount} nuevo(s)</strong>, {importPreview.duplicateBooksCount} duplicado(s). · Notas: <strong>{importPreview.newNotesCount} nueva(s)</strong>, {importPreview.duplicateNotesCount} duplicada(s).
                      </p>
                      <label className="inline-flex items-center gap-1.5 font-bold cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          checked={confirmSimulation}
                          onChange={(e) => setConfirmSimulation(e.target.checked)}
                        />
                        Confirmo la simulación de importación (sin sobrescribir producción)
                      </label>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </CozyModal>
  );
}
