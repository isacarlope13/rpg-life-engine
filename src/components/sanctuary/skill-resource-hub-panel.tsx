"use client";

import React, { useState, useEffect, useId } from "react";
import {
  FileText,
  Link as LinkIcon,
  Image as ImageIcon,
  BookOpen,
  Plus,
  Trash2,
  ExternalLink,
  ShieldCheck,
  UploadCloud,
  FileCheck2,
  AlertCircle,
  Eye,
  Scissors,
  FileQuestion,
} from "lucide-react";
import type { SkillDomain } from "@/types/rpg";
import {
  SkillResource,
  SkillResourceType,
  getStoredSkillResources,
  saveSkillResource,
  deleteSkillResource,
  validateSkillResourceAttachment,
} from "@/lib/sanctuary/skill-resources-hub";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface SkillResourceHubPanelProps {
  domain: SkillDomain;
  userId?: string;
  className?: string;
  onSelectResource?: (resource: SkillResource) => void;
}

export function SkillResourceHubPanel({
  domain,
  userId = "usr_cozy_hero",
  className = "",
  onSelectResource,
}: SkillResourceHubPanelProps) {
  const [resources, setResources] = useState<SkillResource[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | SkillResourceType>("all");
  const [isAdding, setIsAdding] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  const fileInputId = useId();

  // Formulario de nuevo recurso
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState<SkillResourceType>(
    domain === "knitting" ? "pattern" : domain === "reading" ? "book" : "document"
  );
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAttachment, setNewAttachment] = useState<{
    dataUrl: string;
    name: string;
    size: number;
    mime: string;
  } | null>(null);

  // Cargar recursos
  useEffect(() => {
    const list = getStoredSkillResources(domain, userId);
    setResources(list);
  }, [domain, userId]);

  const filteredResources = resources.filter((r) =>
    activeFilter === "all" ? true : r.type === activeFilter
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateSkillResourceAttachment(file);
    if (!validation.valid) {
      triggerHaptic("warning");
      setNotification({
        type: "error",
        message: validation.error || "Archivo no válido.",
      });
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setNewAttachment({
        dataUrl,
        name: validation.sanitizedName || file.name,
        size: file.size,
        mime: file.type,
      });
      if (!newTitle) {
        setNewTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      triggerHaptic("light");
    };
    reader.readAsDataURL(file);
  };

  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setNotification({
        type: "warning",
        message: "Por favor asigna un título al recurso.",
      });
      return;
    }

    try {
      const created = saveSkillResource(
        {
          domain,
          userId,
          title: newTitle.trim(),
          type: newType,
          description: newDescription.trim() || undefined,
          url: newUrl.trim() || undefined,
          attachmentDataUrl: newAttachment?.dataUrl,
          fileName: newAttachment?.name,
          fileSizeBytes: newAttachment?.size,
          mimeType: newAttachment?.mime,
          tags: [domain, newType],
        },
        userId
      );

      setResources((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setIsAdding(false);
      setNewTitle("");
      setNewUrl("");
      setNewDescription("");
      setNewAttachment(null);
      triggerHaptic("success");
      setNotification({
        type: "success",
        message: `✨ Recurso "${created.title}" vinculado a ${domain}.`,
      });
    } catch {
      setNotification({
        type: "error",
        message: "Error al guardar el recurso.",
      });
    }
  };

  const handleDelete = (id: string, title: string) => {
    if (confirm(`¿Deseas desenlazar el recurso "${title}"?`)) {
      deleteSkillResource(id, userId);
      setResources((prev) => prev.filter((r) => r.id !== id));
      triggerHaptic("light");
      setNotification({
        type: "success",
        message: `Recurso "${title}" eliminado correctamente.`,
      });
    }
  };

  const getIconForType = (type: SkillResourceType) => {
    switch (type) {
      case "pattern":
        return <Scissors className="h-4 w-4 text-[#C88973]" />;
      case "book":
        return <BookOpen className="h-4 w-4 text-[#D8B48A]" />;
      case "pdf":
      case "document":
        return <FileText className="h-4 w-4 text-[#77936A]" />;
      case "image":
        return <ImageIcon className="h-4 w-4 text-[#A9C7C7]" />;
      case "link":
      case "video":
        return <LinkIcon className="h-4 w-4 text-[#E7D69C]" />;
      default:
        return <FileQuestion className="h-4 w-4 text-[#7A6B62]" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* NOTIFICACIÓN */}
      {notification && (
        <CozyNotification
          variant={notification.type}
          message={notification.message}
          onDismiss={() => setNotification(null)}
        />
      )}

      {/* CABECERA & CONTROLES */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-[#3A2E2B] flex items-center gap-1.5">
            <UploadCloud className="h-4 w-4 text-[#77936A]" />
            Bóveda de Recursos & Referencias
          </h3>
          <p className="text-xs text-[#7A6B62]">
            Patrones, PDFs, enlaces y archivos asociados para consulta rápida durante tus sesiones.
          </p>
        </div>

        <CozyButton
          variant="wood"
          size="sm"
          onClick={() => setIsAdding(!isAdding)}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>{isAdding ? "Cancelar" : "Vincular Recurso"}</span>
        </CozyButton>
      </div>

      {/* FORMULARIO DE NUEVO RECURSO */}
      {isAdding && (
        <form
          onSubmit={handleCreateResource}
          className="rounded-2xl border-2 border-[#D8B48A] bg-[#FFFDF8] p-4 shadow-md space-y-3"
        >
          <div className="flex items-center justify-between border-b border-[#D8B48A]/40 pb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#3A2E2B]">
              Vincular Nuevo Recurso de {domain}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-[#77936A] font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Max 5 MB • Aislado Localmente
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#3A2E2B] block mb-1">
                Título del Recurso *
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ej. Patrón Bufanda Nube / PDF Cálculo / Video Algoritmos"
                className="w-full rounded-xl border border-[#D8B48A] bg-[#FFFBF2] px-3 py-1.5 text-xs text-[#3A2E2B] focus:outline-none focus:ring-2 focus:ring-[#77936A]"
                required
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[#3A2E2B] block mb-1">
                Tipo de Recurso
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as SkillResourceType)}
                className="w-full rounded-xl border border-[#D8B48A] bg-[#FFFBF2] px-3 py-1.5 text-xs text-[#3A2E2B] focus:outline-none focus:ring-2 focus:ring-[#77936A]"
              >
                <option value="pattern">Patrón de Tejido / Guía</option>
                <option value="pdf">Documento PDF</option>
                <option value="book">Libro de Referencia</option>
                <option value="image">Fotografía / Diagrama</option>
                <option value="link">Enlace Web</option>
                <option value="video">Video Tutorial</option>
                <option value="document">Apunte / Documento</option>
                <option value="template">Plantilla</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-[#3A2E2B] block mb-1">
                Enlace URL (opcional)
              </label>
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-[#D8B48A] bg-[#FFFBF2] px-3 py-1.5 text-xs text-[#3A2E2B] focus:outline-none focus:ring-2 focus:ring-[#77936A]"
              />
            </div>

            <div>
              <label
                htmlFor={fileInputId}
                className="text-[11px] font-bold text-[#3A2E2B] block mb-1"
              >
                Archivo Adjunto (Imágenes, PDF, máx 5MB)
              </label>
              <input
                id={fileInputId}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.txt,.md"
                onChange={handleFileChange}
                className="w-full text-xs text-[#7A6B62] file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#77936A] file:text-white hover:file:bg-[#314C3C] cursor-pointer"
              />
              {newAttachment && (
                <p className="text-[10px] text-[#77936A] mt-1 flex items-center gap-1 font-bold">
                  <FileCheck2 className="h-3 w-3" /> {newAttachment.name} (
                  {(newAttachment.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-[#3A2E2B] block mb-1">
              Notas u Observaciones
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Ej. Tensión recomendada 4.5mm, capítulo clave 2..."
              className="w-full rounded-xl border border-[#D8B48A] bg-[#FFFBF2] px-3 py-1.5 text-xs text-[#3A2E2B] focus:outline-none focus:ring-2 focus:ring-[#77936A]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <CozyButton
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
            >
              Cancelar
            </CozyButton>
            <CozyButton type="submit" variant="forest" size="sm">
              Guardar en Bóveda
            </CozyButton>
          </div>
        </form>
      )}

      {/* FILTROS DE CATEGORÍA */}
      <div className="flex flex-wrap gap-1.5 border-b border-[#D8B48A]/30 pb-2">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
            activeFilter === "all"
              ? "bg-[#314C3C] text-white"
              : "bg-[#F4EEDC] text-[#7A6B62] hover:bg-[#E7D69C]/40"
          }`}
        >
          Todos ({resources.length})
        </button>
        {["pattern", "pdf", "image", "link", "book", "document"].map((ftype) => {
          const count = resources.filter((r) => r.type === ftype).length;
          if (count === 0 && activeFilter !== ftype) return null;
          return (
            <button
              key={ftype}
              type="button"
              onClick={() => setActiveFilter(ftype as SkillResourceType)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                activeFilter === ftype
                  ? "bg-[#314C3C] text-white"
                  : "bg-[#F4EEDC] text-[#7A6B62] hover:bg-[#E7D69C]/40"
              }`}
            >
              {ftype.toUpperCase()} ({count})
            </button>
          );
        })}
      </div>

      {/* LISTA DE RECURSOS EN GRILA BENTO */}
      {filteredResources.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8B48A] p-6 text-center text-xs text-[#7A6B62]">
          <UploadCloud className="h-8 w-8 text-[#D8B48A] mx-auto mb-2 opacity-60" />
          <p className="font-bold text-[#3A2E2B]">No hay recursos vinculados para {domain}.</p>
          <p className="text-[11px] mt-0.5">
            Agrega un patrón, enlace o PDF para tenerlo a mano durante tus sesiones de trabajo.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredResources.map((res) => (
            <div
              key={res.id}
              className="group rounded-2xl border-2 border-[#D8B48A] bg-[#FFFDF8] p-3 shadow-sm hover:border-[#77936A] hover:shadow-md transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {getIconForType(res.type)}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A6B62]">
                      {res.type}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(res.id, res.title)}
                    className="text-[#7A6B62] hover:text-[#C88973] opacity-60 group-hover:opacity-100 transition cursor-pointer p-0.5"
                    title="Eliminar recurso"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <h4 className="text-xs font-bold text-[#3A2E2B] mt-1 line-clamp-1">{res.title}</h4>
                {res.description && (
                  <p className="text-[11px] text-[#7A6B62] mt-0.5 line-clamp-2">
                    {res.description}
                  </p>
                )}
              </div>

              {/* ACCIONES Y ENLACES */}
              <div className="pt-2 mt-2 border-t border-[#D8B48A]/30 flex items-center justify-between gap-2">
                <span className="text-[9px] text-[#7A6B62]">
                  {res.fileName
                    ? `${res.fileName} (${((res.fileSizeBytes || 0) / 1024).toFixed(0)} KB)`
                    : res.url
                    ? "Enlace externo"
                    : "Nota local"}
                </span>

                <div className="flex items-center gap-1">
                  {onSelectResource && (
                    <button
                      type="button"
                      onClick={() => onSelectResource(res)}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#77936A]/20 px-2 py-0.5 text-[10px] font-bold text-[#314C3C] hover:bg-[#77936A]/40 cursor-pointer"
                    >
                      <Eye className="h-3 w-3" /> Usar
                    </button>
                  )}

                  {res.url && (
                    <a
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 rounded-lg bg-[#E7D69C]/30 px-2 py-0.5 text-[10px] font-bold text-[#3A2E2B] hover:bg-[#E7D69C] cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" /> Abrir
                    </a>
                  )}

                  {res.attachmentDataUrl && (
                    <a
                      href={res.attachmentDataUrl}
                      download={res.fileName || "recurso"}
                      className="inline-flex items-center gap-0.5 rounded-lg bg-[#A9C7C7]/30 px-2 py-0.5 text-[10px] font-bold text-[#314C3C] hover:bg-[#A9C7C7] cursor-pointer"
                    >
                      Descargar
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
