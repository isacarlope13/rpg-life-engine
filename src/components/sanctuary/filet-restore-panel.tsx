"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Eye,
  HardDrive,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import type { KnittingProject } from "@/types/rpg";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import type { FiletStudioWorkspace } from "@/lib/sanctuary/filet-crochet-engine";
import {
  buildFiletStudioPrivateResourcePayload,
  countFiletWorkspace,
  detectFiletRestoreConflict,
  restoreFiletWorkspaceFromBackupSafe,
  validateFiletBackupPreview,
  type FiletBackupPreviewResult,
  type FiletRestoreConflictReport,
} from "@/lib/sanctuary/filet-crochet-store";

interface PrivateAtelierBackupItem {
  id: string;
  title: string;
  description?: string;
  original_filename?: string;
  resource_type?: string;
  updated_at?: string;
  created_at?: string;
}

interface FiletRestorePanelProps {
  sessionOwner?: string;
  workspace: FiletStudioWorkspace;
  activeProject?: KnittingProject;
  onWorkspaceRestored: (restored: FiletStudioWorkspace) => void;
}

export function FiletRestorePanel({
  sessionOwner,
  workspace,
  activeProject,
  onWorkspaceRestored,
}: FiletRestorePanelProps) {
  const [backups, setBackups] = useState<PrivateAtelierBackupItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [loadingPreviewId, setLoadingPreviewId] = useState<string | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<{
    item: PrivateAtelierBackupItem;
    rawJson: string;
    preview: FiletBackupPreviewResult;
    conflict: FiletRestoreConflictReport | null;
  } | null>(null);
  const [confirmOverwriteChecked, setConfirmOverwriteChecked] = useState(false);
  const [notice, setNotice] = useState<{
    type: "success" | "warning" | "error";
    message: string;
  } | null>(null);

  const localCounts = countFiletWorkspace(workspace);

  const fetchPrivateBackups = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await fetch("/api/resources?buildingId=atelier", { cache: "no-store" });
      if (!res.ok) {
        setNotice({
          type: "warning",
          message: `No se pudieron listar los respaldos privados del Atelier (HTTP ${res.status}). La edición offline local continúa activa.`,
        });
        return;
      }
      const json = (await res.json()) as { resources?: PrivateAtelierBackupItem[] };
      const filetOnly = (json.resources || []).filter(
        (r) => r.resource_type === "filet_crochet_studio"
      );
      setBackups(filetOnly);
    } catch {
      setNotice({
        type: "warning",
        message: "Sin conexión para consultar respaldos privados. Tus cambios offline siguen protegidos localmente.",
      });
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    fetchPrivateBackups();
  }, [fetchPrivateBackups]);

  const handleManualBackup = async () => {
    if (creatingBackup) return;
    setCreatingBackup(true);
    try {
      const payload = buildFiletStudioPrivateResourcePayload(workspace, {
        projectId: activeProject?.id || null,
      });
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        duplicate?: boolean;
        sync_state?: string;
        error?: string;
      };
      if (res.status === 409 && json.duplicate) {
        setNotice({
          type: "warning",
          message: "Ya existe un respaldo manual idéntico en tu Carpeta Privada del Atelier.",
        });
      } else if (!res.ok || !json.success) {
        setNotice({
          type: "error",
          message: json.error || `Error al crear respaldo manual (HTTP ${res.status}).`,
        });
      } else {
        setNotice({
          type: "success",
          message:
            json.sync_state === "SINCRONIZADO"
              ? "Respaldo manual guardado en Supabase Storage privado (Atelier)."
              : "Respaldo manual guardado en el almacén privado local del Atelier.",
        });
        await fetchPrivateBackups();
      }
    } catch {
      setNotice({
        type: "error",
        message: "No se pudo completar el respaldo manual por error de red.",
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  const handlePreviewBackup = async (item: PrivateAtelierBackupItem) => {
    setLoadingPreviewId(item.id);
    setConfirmOverwriteChecked(false);
    try {
      const res = await fetch(
        `/api/resources?buildingId=atelier&id=${encodeURIComponent(item.id)}&includeContent=1`,
        { cache: "no-store" }
      );
      const json = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        content?: string;
        error?: string;
      };
      if (!res.ok || !json.success || typeof json.content !== "string") {
        setNotice({
          type: "error",
          message: json.error || "No se pudo leer el contenido privado del respaldo.",
        });
        return;
      }

      const preview = validateFiletBackupPreview(json.content);
      const conflict =
        preview.valid && preview.workspace
          ? detectFiletRestoreConflict(workspace, preview.workspace)
          : null;

      setSelectedBackup({
        item,
        rawJson: json.content,
        preview,
        conflict,
      });
    } catch {
      setNotice({
        type: "error",
        message: "Error al cargar la vista previa del respaldo privado.",
      });
    } finally {
      setLoadingPreviewId(null);
    }
  };

  const handleConfirmRestore = () => {
    if (!selectedBackup) return;
    const needsConfirm = Boolean(selectedBackup.conflict?.hasConflict);
    const result = restoreFiletWorkspaceFromBackupSafe(sessionOwner, selectedBackup.rawJson, {
      confirmOverwrite: needsConfirm ? confirmOverwriteChecked : true,
    });
    if (!result.ok || !result.workspace) {
      setNotice({
        type: "warning",
        message: result.error || "No se restauró el respaldo.",
      });
      return;
    }

    onWorkspaceRestored(result.workspace);
    setSelectedBackup(null);
    setConfirmOverwriteChecked(false);
    setNotice({
      type: "success",
      message: `Respaldo "${selectedBackup.item.title}" restaurado con éxito en tu espacio privado.`,
    });
  };

  return (
    <div className="space-y-4">
      {notice && (
        <CozyNotification
          variant={notice.type}
          title="Persistencia Privada"
          message={notice.message}
          onDismiss={() => setNotice(null)}
        />
      )}

      {/* Diferenciación explícita: Edición offline local vs Respaldo manual en nube */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
              <HardDrive className="h-4 w-4 text-[#C88973]" />
              Edición Offline Local (En este dispositivo)
            </h4>
            <span className="rounded-full bg-[#314C3C]/15 px-2 py-0.5 text-[10px] font-black text-[#314C3C]">
              Activa
            </span>
          </div>
          <p className="text-[11px] text-[#5C381E]">
            Tus ediciones se guardan localmente de forma aislada para tu usuario autenticado. Funciona sin internet y <strong>no se sobrescribe automáticamente</strong> desde la nube.
          </p>
          <p className="font-mono text-[11px] font-bold text-[#3A2E2B]">
            Local actual: {localCounts.collections} col. · {localCounts.glyphs} glifos ·{" "}
            {localCounts.patterns} patrones ({localCounts.patternVersions} versiones) ·{" "}
            {localCounts.drafts} borradores.
          </p>
        </div>

        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_6px_0_#3A2E2B] space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#314C3C]" />
              Respaldo Manual en Atelier Privado
            </h4>
            <span className="rounded-full bg-[#E7D69C] px-2 py-0.5 text-[10px] font-black text-[#3A2E2B]">
              Bajo tu control (NO sync auto)
            </span>
          </div>
          <p className="text-[11px] text-[#5C381E]">
            Usa la Carpeta Privada de <code>/api/resources</code> (<code>atelier</code>, RLS por propietario). Solo sube o restaura cuando tú lo solicitas y confirmas explícitamente.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <CozyButton
              type="button"
              variant="forest"
              size="sm"
              disabled={creatingBackup}
              onClick={handleManualBackup}
              className="flex items-center gap-1.5"
            >
              <CloudUpload className="h-3.5 w-3.5" />
              {creatingBackup ? "Guardando..." : "Crear Respaldo Manual Ahora"}
            </CozyButton>
            <CozyButton
              type="button"
              variant="wood"
              size="sm"
              disabled={loadingList}
              onClick={fetchPrivateBackups}
              className="flex items-center gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? "animate-spin" : ""}`} />
              Actualizar Lista
            </CozyButton>
          </div>
        </div>
      </div>

      {/* Lista de respaldos privados existentes en el Atelier */}
      <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
          Respaldos Privados de Filet Studio en el Atelier ({backups.length})
        </h4>

        {backups.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/50 p-4 text-xs text-[#795548]">
            Aún no tienes respaldos manuales de Filet Crochet Studio guardados en la Carpeta Privada del Atelier.
          </p>
        ) : (
          <div className="divide-y divide-[#3A2E2B]/15">
            {backups.map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-black text-[#3A2E2B] truncate">{item.title}</p>
                  <p className="text-[11px] text-[#795548]">
                    {item.original_filename || "filet-studio.json"} ·{" "}
                    {item.updated_at || item.created_at
                      ? new Date(item.updated_at || item.created_at || "").toLocaleString("es-CO")
                      : "Fecha no disponible"}
                  </p>
                </div>
                <CozyButton
                  type="button"
                  variant="wood"
                  size="sm"
                  disabled={loadingPreviewId === item.id}
                  onClick={() => handlePreviewBackup(item)}
                  className="flex items-center gap-1.5"
                >
                  <Eye className="h-3.5 w-3.5" />
                  {loadingPreviewId === item.id ? "Validando..." : "Vista Previa y Restaurar"}
                </CozyButton>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Panel de Vista Previa + Validación de Versión + Detector de Conflictos */}
      {selectedBackup && (
        <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFBF2] p-4 sm:p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
              Vista Previa antes de Restaurar — {selectedBackup.item.title}
            </h4>
            <button
              type="button"
              onClick={() => setSelectedBackup(null)}
              className="text-xs font-black text-[#795548] hover:underline cursor-pointer"
            >
              Cerrar vista previa
            </button>
          </div>

          {!selectedBackup.preview.valid || !selectedBackup.preview.summary ? (
            <div role="alert" className="rounded-2xl border-2 border-rose-700 bg-rose-50 p-3 text-xs font-bold text-rose-900">
              Respaldo rechazado por validación de integridad: {selectedBackup.preview.errors.join(" ")}
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-xl border border-[#3A2E2B]/30 bg-[#FFFDF8] p-2.5">
                  <span className="text-[10px] font-bold text-[#795548] block">Versión esquema</span>
                  <span className="font-mono font-black text-[#314C3C]">
                    v{selectedBackup.preview.schemaVersion} (válida)
                  </span>
                </div>
                <div className="rounded-xl border border-[#3A2E2B]/30 bg-[#FFFDF8] p-2.5">
                  <span className="text-[10px] font-bold text-[#795548] block">Colecciones / Glifos</span>
                  <span className="font-mono font-black text-[#3A2E2B]">
                    {selectedBackup.preview.summary.counts.collections} /{" "}
                    {selectedBackup.preview.summary.counts.glyphs}
                  </span>
                </div>
                <div className="rounded-xl border border-[#3A2E2B]/30 bg-[#FFFDF8] p-2.5">
                  <span className="text-[10px] font-bold text-[#795548] block">Patrones / Versiones</span>
                  <span className="font-mono font-black text-[#3A2E2B]">
                    {selectedBackup.preview.summary.counts.patterns} /{" "}
                    {selectedBackup.preview.summary.counts.patternVersions}
                  </span>
                </div>
                <div className="rounded-xl border border-[#3A2E2B]/30 bg-[#FFFDF8] p-2.5">
                  <span className="text-[10px] font-bold text-[#795548] block">Borradores</span>
                  <span className="font-mono font-black text-[#3A2E2B]">
                    {selectedBackup.preview.summary.counts.drafts}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#5C381E]">
                <strong>Colecciones incluidas:</strong>{" "}
                {selectedBackup.preview.summary.collectionNames.join(", ") || "Ninguna"}
                {selectedBackup.preview.summary.patternTitles.length > 0
                  ? ` · Patrones: ${selectedBackup.preview.summary.patternTitles.join(", ")}`
                  : ""}
              </p>

              {selectedBackup.conflict?.hasConflict ? (
                <div
                  role="alert"
                  className="rounded-2xl border-2 border-amber-700 bg-amber-50 p-3 space-y-2 text-amber-950"
                >
                  <p className="font-black flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                    {selectedBackup.conflict.reason}
                  </p>
                  <label className="flex items-start gap-2 text-[11px] font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={confirmOverwriteChecked}
                      onChange={(e) => setConfirmOverwriteChecked(e.target.checked)}
                      className="mt-0.5 h-4 w-4"
                    />
                    <span>
                      Entiendo que existen diferencias con mi copia local offline y confirmo reemplazarla por este respaldo validado.
                    </span>
                  </label>
                </div>
              ) : (
                <p className="rounded-2xl border border-[#314C3C]/40 bg-[#314C3C]/10 p-2.5 text-[11px] font-bold text-[#314C3C] flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  {selectedBackup.conflict?.reason || "Sin conflictos detectados con tu espacio local."}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <CozyButton
                  type="button"
                  variant="wood"
                  size="sm"
                  onClick={() => setSelectedBackup(null)}
                >
                  Cancelar
                </CozyButton>
                <CozyButton
                  type="button"
                  variant="forest"
                  size="sm"
                  disabled={
                    Boolean(selectedBackup.conflict?.hasConflict) && !confirmOverwriteChecked
                  }
                  onClick={handleConfirmRestore}
                  className="flex items-center gap-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Confirmar y Restaurar
                </CozyButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
