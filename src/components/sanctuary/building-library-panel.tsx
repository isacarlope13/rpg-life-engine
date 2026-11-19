"use client";

import React, { useState, useEffect } from "react";
import {
  FolderOpen,
  Plus,
  Archive,
  X,
  ShieldCheck,
  AlertCircle,
  Download,
  Cloud,
  HardDrive,
} from "lucide-react";
import {
  getBuildingLibraryConfig,
  validatePrivateResourceFile,
  type PrivateBuildingResource,
  type SyncLifecycleState,
} from "@/lib/ai/building-resources-engine";
import {
  buildCinemaMigrationPlan,
  buildCrochetPatternsBackupJson,
} from "@/lib/ai/local-migration-engine";
import { useSessionIdentity } from "@/lib/sanctuary/session-identity";
import { readCinemaEntriesSafe } from "@/lib/sanctuary/cinema-store";
import { readAtelierPatternsSafe } from "@/lib/sanctuary/atelier-patterns-store";
import { CozyButton } from "@/components/cozy/ui";

interface BuildingLibraryPanelProps {
  buildingId: string;
}

const SYNC_BADGE_META: Record<SyncLifecycleState, { label: string; cls: string }> = {
  GUARDADO_LOCALMENTE: { label: "Guardado localmente", cls: "bg-amber-100 text-amber-900 border-amber-400" },
  PENDIENTE_SINCRONIZACION: { label: "Pendiente de sincronización", cls: "bg-orange-100 text-orange-900 border-orange-400" },
  SINCRONIZADO: { label: "Sincronizado en nube", cls: "bg-emerald-100 text-emerald-900 border-emerald-500" },
  ERROR: { label: "Error de sincronización", cls: "bg-red-100 text-red-900 border-red-400" },
  CONFLICTO: { label: "Conflicto detectado", cls: "bg-purple-100 text-purple-900 border-purple-400" },
};

function localLibraryKey(owner: string, buildingId: string): string {
  return `oakhaven_private_library_v2_${encodeURIComponent(owner)}_${buildingId}`;
}

export function BuildingLibraryPanel({ buildingId }: BuildingLibraryPanelProps) {
  const config = getBuildingLibraryConfig(buildingId);
  const sessionOwner = useSessionIdentity();
  const [isOpen, setIsOpen] = useState(false);
  const [resources, setResources] = useState<PrivateBuildingResource[]>([]);
  const [filterType, setFilterType] = useState<string>("all");
  const [title, setTitle] = useState("");
  const [resourceType, setResourceType] = useState<string>(config?.resourceTypes[0]?.id || "");
  const [noteContent, setNoteContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedResources, setArchivedResources] = useState<PrivateBuildingResource[]>([]);

  useEffect(() => {
    if (!config || !sessionOwner || !isOpen) return;
    let localItems: PrivateBuildingResource[] = [];
    try {
      const raw = window.localStorage.getItem(localLibraryKey(sessionOwner, buildingId));
      if (raw) localItems = JSON.parse(raw) as PrivateBuildingResource[];
    } catch {
      localItems = [];
    }
    setResources(localItems);

    fetch(`/api/resources?buildingId=${encodeURIComponent(buildingId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.synced || !Array.isArray(data.resources) || data.resources.length === 0) return;
        const remoteMapped: PrivateBuildingResource[] = data.resources.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          owner_id: String(r.user_id || sessionOwner),
          building_id: String(r.building_id),
          resource_type: String(r.resource_type || r.resource_category),
          title: String(r.title),
          original_filename: String(r.original_filename || ""),
          mime_type: String(r.mime_type || "text/plain"),
          size_bytes: Number(r.size_bytes || 0),
          metadata: (r.metadata as Record<string, unknown>) || {},
          tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
          created_at: String(r.created_at),
          updated_at: String(r.updated_at),
          processing_status: "ready",
          extraction_status: "not_applicable",
          is_sensitive_financial: Boolean(r.is_sensitive_financial),
          sync_state: "SINCRONIZADO",
        }));
        const remoteIds = new Set(remoteMapped.map((m) => m.id));
        const merged = [...remoteMapped, ...localItems.filter((l) => !remoteIds.has(l.id))];
        setResources(merged);
      })
      .catch(() => {});
  }, [buildingId, config, sessionOwner, isOpen]);

  if (!config) return null;

  const saveLocalList = (next: PrivateBuildingResource[]) => {
    setResources(next);
    if (!sessionOwner) return;
    try {
      window.localStorage.setItem(localLibraryKey(sessionOwner, buildingId), JSON.stringify(next));
    } catch {
      // ignorar cuota
    }
  };

  const handleAddResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionOwner) {
      setErrorMsg("Inicia sesión para guardar recursos privados.");
      return;
    }
    setErrorMsg(null);
    setStatusMsg(null);
    setSubmitting(true);

    try {
      const filename = selectedFile ? selectedFile.name : `${title.trim() || "nota"}.md`;
      const mimeType = selectedFile ? selectedFile.type || "application/octet-stream" : "text/markdown";
      const sizeBytes = selectedFile ? selectedFile.size : new TextEncoder().encode(noteContent || title).length;
      let fileBytes: Uint8Array | undefined;

      if (selectedFile) {
        const sliceBuf = await selectedFile.slice(0, 2048).arrayBuffer();
        fileBytes = new Uint8Array(sliceBuf);
      } else {
        fileBytes = new TextEncoder().encode(noteContent || title);
      }

      const check = validatePrivateResourceFile({
        buildingId,
        resourceType,
        filename,
        reportedMimeType: mimeType,
        sizeBytes,
        ownerId: sessionOwner,
        authenticatedUserId: sessionOwner,
        fileBytes,
      });

      if (!check.valid) {
        setErrorMsg(check.error || "Archivo rechazado por el contrato de este edificio.");
        return;
      }

      let res: Response;
      if (selectedFile) {
        const formData = new FormData();
        formData.append("buildingId", buildingId);
        formData.append("resourceType", resourceType);
        formData.append("title", title.trim() || check.safeFilename || "Recurso");
        formData.append("file", selectedFile);
        res = await fetch("/api/resources", {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch("/api/resources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            buildingId,
            resourceType,
            title: title.trim() || check.safeFilename,
            filename: check.safeFilename,
            mimeType,
            sizeBytes,
            rawTextContent: noteContent,
          }),
        });
      }
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || "El servidor rechazó el recurso.");
        return;
      }

      const now = new Date().toISOString();
      const newEntry: PrivateBuildingResource = {
        id: data.resource?.id || `loc-${Date.now()}`,
        owner_id: sessionOwner,
        building_id: buildingId,
        resource_type: resourceType,
        title: title.trim() || check.safeFilename || "Recurso",
        original_filename: check.safeFilename || filename,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        metadata: {},
        tags: [],
        created_at: now,
        updated_at: now,
        processing_status: "ready",
        extraction_status: check.isFinancialSensitive ? "blocked_sensitive" : "completed",
        is_sensitive_financial: Boolean(check.isFinancialSensitive),
        sync_state: data.synced ? "SINCRONIZADO" : "GUARDADO_LOCALMENTE",
      };

      saveLocalList([newEntry, ...resources]);
      setTitle("");
      setNoteContent("");
      setSelectedFile(null);
      setStatusMsg(
        data.synced
          ? "Recurso validado y sincronizado en Supabase."
          : "Recurso validado y guardado localmente (pendiente de migración en Supabase)."
      );
    } catch {
      setErrorMsg("Error de red al guardar el recurso.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenSignedResource = async (resourceId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/resources?id=${encodeURIComponent(resourceId)}&signedUrl=1`);
      const data = await res.json();
      if (!res.ok || !data.signedUrl) {
        setErrorMsg(data.error || "No se pudo obtener enlace temporal para este recurso.");
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch {
      setErrorMsg("Error de red al solicitar URL firmada temporal.");
    }
  };

  const handleArchiveConfirmed = async (id: string) => {
    const target = resources.find((r) => r.id === id);
    saveLocalList(resources.filter((r) => r.id !== id));
    if (target) {
      setArchivedResources((prev) => [target, ...prev.filter((p) => p.id !== id)]);
    }
    setConfirmArchiveId(null);
    await fetch(`/api/resources?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    setStatusMsg("Recurso archivado de forma reversible. Puedes restaurarlo desde 'Archivados'.");
  };

  const handleToggleArchived = async () => {
    const next = !showArchived;
    setShowArchived(next);
    if (!next) return;
    try {
      const res = await fetch(`/api/resources?buildingId=${encodeURIComponent(buildingId)}&archivedOnly=1`);
      const data = await res.json();
      if (data?.synced && Array.isArray(data.resources)) {
        const mapped: PrivateBuildingResource[] = data.resources.map((r: Record<string, unknown>) => ({
          id: String(r.id),
          owner_id: String(r.user_id || sessionOwner || ""),
          building_id: String(r.building_id),
          resource_type: String(r.resource_type || r.resource_category),
          title: String(r.title),
          original_filename: String(r.original_filename || ""),
          mime_type: String(r.mime_type || "text/plain"),
          size_bytes: Number(r.size_bytes || 0),
          metadata: (r.metadata as Record<string, unknown>) || {},
          tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
          created_at: String(r.created_at),
          updated_at: String(r.updated_at),
          processing_status: "ready",
          extraction_status: "not_applicable",
          is_sensitive_financial: Boolean(r.is_sensitive_financial),
          sync_state: "SINCRONIZADO",
        }));
        setArchivedResources(mapped);
      }
    } catch {
      // mantener lista local de archivados de esta sesión
    }
  };

  const handleRestoreArchived = async (item: PrivateBuildingResource) => {
    setErrorMsg(null);
    try {
      const res = await fetch("/api/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, action: "restore" }),
      });
      if (!res.ok) {
        setErrorMsg("No se pudo restaurar el recurso.");
        return;
      }
      setArchivedResources((prev) => prev.filter((r) => r.id !== item.id));
      saveLocalList([item, ...resources.filter((r) => r.id !== item.id)]);
      setStatusMsg(`Recurso "${item.title}" restaurado sin duplicados.`);
    } catch {
      setErrorMsg("Error de red al restaurar el recurso.");
    }
  };

  const handleExportLocalBackup = () => {
    if (!sessionOwner) return;
    let json = "";
    let filename = `oakhaven-${buildingId}-backup.json`;
    if (buildingId === "cine") {
      const plan = buildCinemaMigrationPlan({
        authenticatedUserId: sessionOwner,
        localOwnerId: sessionOwner,
        localEntries: readCinemaEntriesSafe(sessionOwner),
        remoteEntries: [],
      });
      json = plan.backupJson;
    } else if (buildingId === "atelier") {
      json = buildCrochetPatternsBackupJson(sessionOwner, readAtelierPatternsSafe(sessionOwner));
    } else {
      json = JSON.stringify({ exportedAt: new Date().toISOString(), buildingId, resources }, null, 2);
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMsg("Copia de seguridad local descargada sin borrar tus datos.");
  };

  const filtered = filterType === "all" ? resources : resources.filter((r) => r.resource_type === filterType);

  return (
    <div className="mt-2">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-200/40 bg-amber-950/35 px-3 py-1.5 text-[11px] font-black text-amber-100 hover:bg-amber-900/50 cursor-pointer"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>{config.libraryIcon} Abrir {config.libraryTitle}</span>
        </button>
      ) : (
        <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-4 text-[#3A2E2B] shadow-[0_4px_0_#3A2E2B] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3A2E2B]/15 pb-2.5">
            <div>
              <h5 className="text-xs font-black text-[#3A2E2B]">
                {config.libraryIcon} {config.libraryTitle}
              </h5>
              <p className="text-[10px] text-[#795548]">{config.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportLocalBackup}
                className="inline-flex items-center gap-1 rounded-lg border border-[#3A2E2B]/30 bg-[#F4EEDC] px-2 py-1 text-[10px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C] cursor-pointer"
              >
                <Download className="h-3 w-3" />
                Respaldo JSON
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar biblioteca"
                className="rounded-lg border border-[#3A2E2B]/30 bg-[#F4EEDC] p-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Filtros específicos del edificio */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilterType("all")}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                filterType === "all"
                  ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                  : "border-[#3A2E2B]/30 bg-[#F4EEDC] text-[#3A2E2B]"
              }`}
            >
              Todos ({resources.length})
            </button>
            {config.resourceTypes.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterType(t.id)}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold cursor-pointer ${
                  filterType === t.id
                    ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                    : "border-[#3A2E2B]/30 bg-[#F4EEDC] text-[#3A2E2B]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Formulario contextual estricto */}
          <form onSubmit={handleAddResource} className="rounded-xl border border-[#3A2E2B]/25 bg-[#F4EEDC]/70 p-3 space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Título del recurso *"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl border border-[#3A2E2B]/40 bg-[#FFFDF8] px-3 py-1.5 text-xs font-bold outline-none"
              />
              <select
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                className="rounded-xl border border-[#3A2E2B]/40 bg-[#FFFDF8] px-3 py-1.5 text-xs font-bold outline-none"
              >
                {config.resourceTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} (.{t.allowedExtensions.join(", .")})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-[11px] text-[#5C381E]"
              />
              <CozyButton type="submit" variant="forest" size="sm" disabled={submitting}>
                <Plus className="h-3.5 w-3.5 inline mr-1" />
                {submitting ? "Validando..." : "Guardar en Biblioteca"}
              </CozyButton>
            </div>

            {!selectedFile && (
              <textarea
                rows={2}
                placeholder="O escribe una nota de texto plano/Markdown directamente..."
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                className="w-full rounded-xl border border-[#3A2E2B]/30 bg-[#FFFDF8] p-2 text-xs outline-none"
              />
            )}
          </form>

          {errorMsg && (
            <p role="alert" className="text-[11px] font-bold text-red-900 bg-red-50 border border-red-400 rounded-xl p-2 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}
          {statusMsg && (
            <p className="text-[11px] font-bold text-[#314C3C] bg-[#C4DC9C]/40 border border-[#314C3C]/40 rounded-xl p-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>{statusMsg}</span>
            </p>
          )}

          {/* Lista de recursos */}
          {filtered.length === 0 ? (
            <p className="text-[11px] text-[#795548] text-center py-3">
              Aún no hay recursos guardados en {config.libraryTitle}.
            </p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {filtered.map((item) => {
                const syncBadge = SYNC_BADGE_META[item.sync_state];
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#3A2E2B]/25 bg-[#FFFDF8] p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <span className="font-black text-[#3A2E2B] block">{item.title}</span>
                      <span className="text-[10px] text-[#795548]">
                        {item.resource_type} • {item.original_filename}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.sync_state === "SINCRONIZADO" && (
                        <button
                          type="button"
                          onClick={() => handleOpenSignedResource(item.id)}
                          className="rounded-lg border border-[#314C3C]/40 bg-[#C4DC9C]/40 px-2 py-0.5 text-[10px] font-black text-[#314C3C] hover:bg-[#C4DC9C] cursor-pointer"
                        >
                          Abrir
                        </button>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-black ${syncBadge.cls}`}>
                        {item.sync_state === "SINCRONIZADO" ? <Cloud className="h-2.5 w-2.5" /> : <HardDrive className="h-2.5 w-2.5" />}
                        {syncBadge.label}
                      </span>
                      {confirmArchiveId === item.id ? (
                        <button
                          type="button"
                          onClick={() => handleArchiveConfirmed(item.id)}
                          className="rounded-lg bg-red-700 px-2 py-0.5 text-[10px] font-black text-white cursor-pointer"
                        >
                          Confirmar archivo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmArchiveId(item.id)}
                          aria-label={`Archivar ${item.title}`}
                          className="text-[#795548] hover:text-red-700 cursor-pointer"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sección de archivados y restauración reversible */}
          <div className="pt-1 border-t border-[#3A2E2B]/15">
            <button
              type="button"
              onClick={handleToggleArchived}
              className="text-[10px] font-black text-[#795548] hover:text-[#3A2E2B] underline cursor-pointer"
            >
              {showArchived ? "Ocultar recursos archivados" : "Ver recursos archivados (restauración reversible)"}
            </button>
            {showArchived && (
              <div className="mt-2 space-y-1.5">
                {archivedResources.length === 0 ? (
                  <p className="text-[10px] text-[#795548]">No hay recursos archivados en este edificio.</p>
                ) : (
                  archivedResources.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-dashed border-[#3A2E2B]/30 bg-[#F4ECE1]/60 p-2 flex items-center justify-between gap-2 text-xs"
                    >
                      <div>
                        <span className="font-bold text-[#3A2E2B] block">{item.title}</span>
                        <span className="text-[10px] text-[#795548]">{item.original_filename}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRestoreArchived(item)}
                        className="rounded-lg border border-[#314C3C]/40 bg-[#C4DC9C]/50 px-2 py-0.5 text-[10px] font-black text-[#314C3C] hover:bg-[#C4DC9C] cursor-pointer"
                      >
                        Restaurar
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
