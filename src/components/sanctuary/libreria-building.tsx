"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Clock,
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Star,
  Quote,
  Mic,
  Search,
  BookMarked,
  Award,
  Layers,
  History,
  Trash2,
} from "lucide-react";
import type { ReadingBook, SkillSessionRecord } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyProgress, CozyNotification, CozyCard } from "@/components/cozy/ui";
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { triggerHaptic } from "@/lib/offline-sync";
import { SmartCaptureWidget } from "@/components/sanctuary/smart-capture-widget";
import { SkillResourceHubPanel } from "@/components/sanctuary/skill-resource-hub-panel";
import { projectLibreriaProgression } from "@/lib/sanctuary/visual-village-progression";
import { VillageProgressionPanel } from "@/components/sanctuary/village-progression-panel";
import { ResidentAssistantWidget } from "@/components/sanctuary/resident-assistant-widget";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";

interface LibreriaBuildingProps {
  books: ReadingBook[];
  sessions?: SkillSessionRecord[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  currency?: string;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

export function LibreriaBuilding({
  books = [],
  sessions = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  currency = "COP",
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: LibreriaBuildingProps) {
  // Pestañas del interior
  const [activeTab, setActiveTab] = useState<"lectura" | "catalogo" | "citas" | "historial" | "eldrin" | "evolucion">("lectura");

  // Estado de libro seleccionado y filtros
  const [selectedBookId, setSelectedBookId] = useState<string>(() => books[0]?.id || "");
  const [galleryFilter, setGalleryFilter] = useState<"all" | "reading" | "completed" | "wishlist">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Captura de lectura de la sesión
  const [pagesReadInput, setPagesReadInput] = useState<number>(10);
  const [quoteTextInput, setQuoteTextInput] = useState<string>("");
  const [quotePageInput, setQuotePageInput] = useState<string>("");
  const [sessionQuotes, setSessionQuotes] = useState<Array<{ text: string; page?: number }>>([]);
  const [dictatingQuote, setDictatingQuote] = useState(false);
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Formulario de nuevo libro
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newTotalPages, setNewTotalPages] = useState(250);
  const [newCategory, setNewCategory] = useState("No Ficción / Desarrollo");
  const [newPrice, setNewPrice] = useState(45000);
  const [isSearchingMetadata, setIsSearchingMetadata] = useState(false);

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
    isActive,
    formattedTime,
    elapsedMinutes,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    finishSession,
    submitting,
  } = useUniversalSession("reading", "libreria");

  const activeBook = books.find((b) => b.id === selectedBookId) || books[0];

  const filteredBooks = books.filter((b) => {
    const matchesFilter = galleryFilter === "all" ? true : b.status === galleryFilter;
    const matchesSearch =
      b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalPagesReadEver = books.reduce((acc, b) => acc + (b.pages_read || 0), 0);
  const readingBooksCount = books.filter((b) => b.status === "reading" || !b.status).length;
  const completedBooksCount = books.filter((b) => b.status === "completed").length;
  const readingSessions = sessions.filter((s) => s.domain === "reading");

  // Proyección Visual Determinista de la Librería (Fase 9)
  const progression = projectLibreriaProgression({
    level: skillLevel,
    sessionsCount: readingSessions.length,
    readingBooks: books,
  });

  const handleStartReading = () => {
    triggerHaptic("light");
    startSession({
      domain: "reading",
      buildingId: "libreria",
      resourceId: activeBook?.id,
      resourceTitle: activeBook?.title || "Lectura Serena",
      objective: `Leer ${pagesReadInput} páginas de ${activeBook?.title || "libro"}`,
    });
    setNotification({
      type: "success",
      message: "📖 ¡Sesión de lectura comenzada! Concéntrate en cada página.",
    });
  };

  const handleAddQuote = () => {
    if (!quoteTextInput.trim()) return;
    triggerHaptic("light");
    const p = quotePageInput ? Number(quotePageInput) : undefined;
    setSessionQuotes((prev) => [...prev, { text: quoteTextInput.trim(), page: p }]);
    setQuoteTextInput("");
    setQuotePageInput("");
  };

  const handleRemoveQuote = (idx: number) => {
    setSessionQuotes((prev) => prev.filter((_, i) => i !== idx));
  };

  const startVoiceDictation = () => {
    const SpeechCtor =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechCtor) {
      alert("Tu navegador no soporta reconocimiento de voz nativo.");
      return;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const recognition = new (SpeechCtor as any)();
      recognition.lang = "es-CO";
      recognition.interimResults = false;
      setDictatingQuote(true);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (evt: any) => {
        const transcript = evt.results[0][0].transcript;
        if (transcript) {
          setQuoteTextInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setDictatingQuote(false);
      };

      recognition.onerror = () => setDictatingQuote(false);
      recognition.onend = () => setDictatingQuote(false);
      recognition.start();
    } catch {
      setDictatingQuote(false);
    }
  };

  const handleFinishAndSave = async () => {
    triggerHaptic("medium");
    try {
      const parsedSinglePage = quotePageInput ? Number(quotePageInput) : undefined;
      const result = await finishSession({
        book_id: activeBook?.id,
        pages_read: pagesReadInput > 0 ? pagesReadInput : 5,
        quote_text: quoteTextInput.trim() || undefined,
        quote_page: parsedSinglePage && parsedSinglePage > 0 ? parsedSinglePage : undefined,
        quotes_list: sessionQuotes.length > 0 ? sessionQuotes : undefined,
      });

      if (result) {
        setNotification({
          type: "success",
          message: `✨ ¡Lectura registrada con éxito! Has avanzado ${pagesReadInput} páginas en "${activeBook?.title}".`,
        });
        setQuoteTextInput("");
        setQuotePageInput("");
        setSessionQuotes([]);
        await onRefreshState();
      }
    } catch (err) {
      console.error("Error al finalizar sesión de lectura:", err);
      setNotification({
        type: "error",
        message: "Ocurrió un error al guardar la sesión de lectura.",
      });
    }
  };

  const handleCreateNewBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      await onSubmitDirectSkillSession({
        action: "add_reading_book",
        book_title: newTitle.trim(),
        book_author: newAuthor.trim() || "Autor Desconocido",
        book_total_pages: Number(newTotalPages) || 200,
        book_category: newCategory,
        book_price: Number(newPrice) || 0,
      });

      setNotification({
        type: "success",
        message: `📚 ¡Libro "${newTitle}" catalogado con éxito!`,
      });
      setIsAddingBook(false);
      setNewTitle("");
      setNewAuthor("");
      await onRefreshState();
    } catch {
      setNotification({
        type: "error",
        message: "No se pudo catalogar el libro.",
      });
    }
  };

  const handleSearchMetadata = async () => {
    if (!newTitle.trim()) {
      setNotification({
        type: "warning",
        message: "Escribe el título o ISBN del libro para buscar sus metadatos.",
      });
      return;
    }
    setIsSearchingMetadata(true);
    triggerHaptic("medium");
    try {
      const res = await fetch("/api/shortcuts/skill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "extract_book_specs",
          raw_query: newTitle.trim(),
        }),
      });
      const data = await res.json();
      if (data && data.extracted_specs) {
        const specs = data.extracted_specs;
        if (specs.title) setNewTitle(specs.title);
        if (specs.author) setNewAuthor(specs.author);
        if (specs.total_pages) setNewTotalPages(specs.total_pages);
        if (specs.category) setNewCategory(specs.category);
        triggerHaptic("success");
        setNotification({
          type: "success",
          message: `✨ Metadatos encontrados: "${specs.title}" por ${specs.author} (${specs.total_pages} págs).`,
        });
      } else {
        setNotification({
          type: "warning",
          message: "No se encontraron metadatos exactos. Puedes completarlos manualmente.",
        });
      }
    } catch {
      setNotification({
        type: "error",
        message: "Error al consultar metadatos del libro.",
      });
    } finally {
      setIsSearchingMetadata(false);
    }
  };

  const stations: InteriorStationDefinition[] = [
    {
      id: "lectura",
      name: "Sillón de Lectura & Cronómetro",
      shortName: "Lectura Activa",
      icon: "📖",
      badge: isActive ? (isPaused ? "⏸️" : "⏱️") : undefined,
      badgeVariant: isRunning ? "success" : "info",
      hotkey: "1",
      description: "Sillón orejero: cronómetro de lectura serena, contador de páginas y notas.",
    },
    {
      id: "catalogo",
      name: "Estantes & Catálogo de Libros",
      shortName: "Catálogo",
      icon: "📚",
      badge: books.length,
      hotkey: "2",
      description: "Estantes de roble: libros activos, lectura pendiente y registro de tomos.",
    },
    {
      id: "citas",
      name: "Fichero de Citas & Extractos",
      shortName: "Notas & Citas",
      icon: "📜",
      badge: sessionQuotes.length > 0 ? sessionQuotes.length : undefined,
      hotkey: "3",
      description: "Fichero de madera: captura de citas memorables, dictado y reflexiones.",
    },
    {
      id: "historial",
      name: "Archivo Histórico & Resúmenes",
      shortName: "Historial",
      icon: "🏛️",
      badge: readingSessions.length > 0 ? readingSessions.length : undefined,
      hotkey: "4",
      description: "Bitácora histórica: tomos concluidos, páginas leídas y evolución visual.",
    },
    {
      id: "eldrin",
      name: "Despacho de Eldrin el Sabio",
      shortName: "Consejo Eldrin",
      icon: "🦉",
      hotkey: "5",
      description: "Diálogos de sabiduría literaria, sugerencias de lectura y misiones vecinales.",
    },
  ];

  return (
    <LivingInteriorRoom
      buildingId="libreria"
      buildingName="La Librería & Archivo Antiguo"
      domain="reading"
      districtName="Distrito del Saber"
      icon="📚"
      tagline="Estantes de roble con historias vivas, citas memorables y progreso página a página."
      resident={COZY_VILLAGE_RESIDENTS.find((r) => r.id === "eldrin")}
      stations={stations}
      activeStationId={activeTab}
      onSelectStation={(id) => setActiveTab(id as typeof activeTab)}
      onClose={onClose}
      activeSessionBanner={{
        isActive,
        isPaused,
        formattedTime,
        label: activeBook ? `Leyendo "${activeBook.title}"` : "Lectura serena en curso",
        onViewSession: () => setActiveTab("lectura"),
      }}
      metrics={[
        { label: "Nivel de Edificio", value: progression.tierName },
        { label: "Libros Activos", value: readingBooksCount },
        { label: "Páginas Leídas", value: totalPagesReadEver.toLocaleString("es-CO") },
        { label: "Libros Terminados", value: completedBooksCount },
      ]}
      roomTheme={{
        wallColor: "#22382E",
        floorPattern: "wood",
        ambientWarmth: "candlelight",
      }}
    >
      {/* NOTIFICACIÓN COZY */}
      {notification && (
        <div className="mb-4">
          <CozyNotification
            variant={notification.type}
            title={notification.type === "success" ? "¡Éxito!" : "Aviso"}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* =======================================================================
          TAB 1: LECTURA ACTIVA (LIBRO EN CURSO, TIMER, CAPTURA DE PÁGINAS & CITAS)
         ======================================================================= */}
      {activeTab === "lectura" && (
        <div className="space-y-4">
          {/* ASISTENTE CONTEXTUAL: ELDRIN EL ARCHIVERO MAYOR (FASE 10) */}
          <ResidentAssistantWidget
            context={{
              residentId: "eldrin",
              buildingId: "libreria",
              domain: "reading",
              readingBooks: books,
              recentSessions: readingSessions,
            }}
            onPrepareSession={(prepared) => {
              if (prepared.resourceId) {
                setSelectedBookId(prepared.resourceId);
              }
              if (prepared.recommendedMinutes) {
                setPagesReadInput(15);
              }
              if (prepared.initialNotes) {
                setQuoteTextInput((prev) => (prev ? `${prev} • ${prepared.initialNotes}` : prepared.initialNotes || ""));
              }
            }}
          />

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Columna Izquierda: Libro Activo & Cronómetro */}
          <div className="md:col-span-7 space-y-5">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#795548] tracking-wider block">
                    Libro en Atril de Lectura
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-[#3A2E2B]">
                    {activeBook?.title || "Ningún libro seleccionado"}
                  </h3>
                  <span className="text-xs text-[#795548] font-bold">
                    Por {activeBook?.author || "Autor Desconocido"}
                  </span>
                </div>

                <select
                  value={selectedBookId}
                  onChange={(e) => setSelectedBookId(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                >
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Progreso del libro activo */}
              {activeBook && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-bold text-[#795548]">
                    <span>
                      Página {activeBook.pages_read || 0} de {activeBook.total_pages || 200}
                    </span>
                    <span>
                      {Math.round(((activeBook.pages_read || 0) / (activeBook.total_pages || 200)) * 100)}% leído
                    </span>
                  </div>
                  <CozyProgress
                    value={activeBook.pages_read || 0}
                    max={activeBook.total_pages || 200}
                    variant="forest"
                  />
                </div>
              )}

              {/* Cronómetro de Lectura Universal */}
              <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#F4EEDC] p-4 text-center space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#795548] block">
                  {isRunning ? "⏱️ Lectura en Curso" : isPaused ? "⏸️ Lectura en Pausa" : "📖 Sesión Lista"}
                </span>

                <div className="font-mono text-4xl sm:text-5xl font-black text-[#3A2E2B] tracking-tight">
                  {formattedTime}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  {!isActive ? (
                    <CozyButton
                      variant="forest"
                      size="md"
                      onClick={handleStartReading}
                      className="flex items-center gap-2"
                    >
                      <Play className="h-4 w-4" />
                      Iniciar Lectura
                    </CozyButton>
                  ) : (
                    <>
                      {isRunning ? (
                        <CozyButton
                          variant="clay"
                          size="md"
                          onClick={() => {
                            triggerHaptic("light");
                            pauseSession();
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Pause className="h-4 w-4" />
                          Pausar
                        </CozyButton>
                      ) : (
                        <CozyButton
                          variant="forest"
                          size="md"
                          onClick={() => {
                            triggerHaptic("light");
                            resumeSession();
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <Play className="h-4 w-4" />
                          Reanudar
                        </CozyButton>
                      )}

                      <CozyButton
                        variant="sunlight"
                        size="md"
                        disabled={submitting}
                        onClick={handleFinishAndSave}
                        className="flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        {submitting ? "Guardando..." : "Completar & Registrar"}
                      </CozyButton>

                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("warning");
                          resetSession();
                        }}
                        className="text-xs font-bold text-red-700 underline hover:text-red-900 cursor-pointer ml-2"
                      >
                        Descartar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Registro de Páginas Avanzadas */}
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-3 space-y-2">
                <label className="text-xs font-bold text-[#795548] block">
                  Páginas avanzadas en este bloque:
                </label>
                <div className="flex items-center gap-2">
                  {[5, 10, 15, 20, 30].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPagesReadInput(p)}
                      className={`flex-1 rounded-xl border-2 py-1.5 text-xs font-bold transition cursor-pointer ${
                        pagesReadInput === p
                          ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                          : "border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C]"
                      }`}
                    >
                      +{p}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Captura de Citas del Libro */}
          <div className="md:col-span-5 space-y-5">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
              <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/15 pb-2">
                <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
                  <Quote className="h-4 w-4 text-[#77936A]" />
                  Anotar Cita del Libro
                </h4>
                <button
                  type="button"
                  onClick={startVoiceDictation}
                  className={`flex items-center gap-1 rounded-lg border border-[#3A2E2B] px-2 py-0.5 text-[10px] font-bold transition cursor-pointer ${
                    dictatingQuote
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-[#F4EEDC] text-[#795548] hover:bg-[#E7D69C]"
                  }`}
                  title="Dictar cita por voz"
                >
                  <Mic className="h-3 w-3" />
                  <span>{dictatingQuote ? "Escuchando..." : "Dictar"}</span>
                </button>
              </div>

              <textarea
                value={quoteTextInput}
                onChange={(e) => setQuoteTextInput(e.target.value)}
                placeholder="Escribe o dicta la cita o reflexión que te llamó la atención..."
                rows={3}
                className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs font-medium text-[#3A2E2B] placeholder:text-[#795548]/60 outline-none"
              />

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={quotePageInput}
                  onChange={(e) => setQuotePageInput(e.target.value)}
                  placeholder="Pág. (opcional)"
                  className="w-28 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                />

                <CozyButton
                  variant="forest"
                  size="sm"
                  disabled={!quoteTextInput.trim()}
                  onClick={handleAddQuote}
                  className="flex-1 flex items-center justify-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Guardar Cita</span>
                </CozyButton>
              </div>

              {/* Lista de citas capturadas en esta sesión */}
              {sessionQuotes.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-[#3A2E2B]/15">
                  <span className="text-[10px] font-bold text-[#795548] uppercase block">
                    Citas de la sesión ({sessionQuotes.length})
                  </span>
                  {sessionQuotes.map((q, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-[#3A2E2B]/30 bg-[#F4EEDC] p-2 text-xs text-[#3A2E2B] flex items-start justify-between gap-2"
                    >
                      <p className="italic">"{q.text}" {q.page ? `(pág. ${q.page})` : ""}</p>
                      <button
                        type="button"
                        onClick={() => handleRemoveQuote(idx)}
                        className="text-red-600 hover:text-red-800 text-[10px] font-bold cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Smart Capture & Valores Sugeridos */}
            <SmartCaptureWidget
              domain="reading"
              context={{
                domain: "reading",
                activeBook: activeBook
                  ? {
                      id: activeBook.id,
                      title: activeBook.title,
                      author: activeBook.author,
                      pages_read: activeBook.pages_read,
                      total_pages: activeBook.total_pages,
                    }
                  : undefined,
              }}
              notes={quoteTextInput}
              onNotesChange={setQuoteTextInput}
              onApplySuggestedValues={(vals) => {
                setPagesReadInput(vals.quantity);
                if (vals.notes) {
                  setQuoteTextInput(vals.notes);
                }
              }}
            />
          </div>
        </div>
        </div>
      )}

      {/* =======================================================================
          TAB 2: CATÁLOGO DE LIBROS & PENDIENTES
         ======================================================================= */}
      {activeTab === "catalogo" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Buscador & Filtros */}
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <div className="relative min-w-[200px] flex-1">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#795548]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por título o autor..."
                  className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] pl-8 pr-3 py-1.5 text-xs font-bold text-[#3A2E2B] placeholder:text-[#795548]/60 outline-none"
                />
              </div>

              <div className="flex gap-1">
                {(["all", "reading", "completed", "wishlist"] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setGalleryFilter(filter)}
                    className={`rounded-xl border-2 border-[#3A2E2B] px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                      galleryFilter === filter
                        ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                        : "bg-[#FFFDF8] text-[#795548] hover:bg-[#F4EEDC]"
                    }`}
                  >
                    {filter === "all" ? "Todos" : filter === "reading" ? "Leyendo" : filter === "completed" ? "Completados" : "Pendientes"}
                  </button>
                ))}
              </div>
            </div>

            <CozyButton
              variant="sunlight"
              size="sm"
              onClick={() => setIsAddingBook(!isAddingBook)}
              className="flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{isAddingBook ? "Cerrar" : "Catalogar Nuevo Libro"}</span>
            </CozyButton>
          </div>

          {/* Formulario para agregar libro */}
          {isAddingBook && (
            <form onSubmit={handleCreateNewBook} className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_4px_0_#3A2E2B] space-y-3">
              <div className="flex items-center justify-between border-b border-[#D8B48A]/40 pb-2">
                <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                  Registrar Nuevo Libro en la Colección
                </h4>
                <button
                  type="button"
                  disabled={isSearchingMetadata}
                  onClick={handleSearchMetadata}
                  className="inline-flex items-center gap-1 rounded-xl bg-[#E7D69C] px-2.5 py-1 text-[11px] font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#F2E3B3] disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{isSearchingMetadata ? "Buscando..." : "Buscar Metadatos ✨"}</span>
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Título o ISBN del libro *"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <input
                  type="text"
                  placeholder="Autor *"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <input
                  type="number"
                  placeholder="Total de páginas *"
                  value={newTotalPages}
                  onChange={(e) => setNewTotalPages(Number(e.target.value))}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                />
                <input
                  type="text"
                  placeholder="Categoría"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-bold text-[#3A2E2B] outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <CozyButton variant="wood" size="sm" type="button" onClick={() => setIsAddingBook(false)}>
                  Cancelar
                </CozyButton>
                <CozyButton variant="forest" size="sm" type="submit">
                  Catalogar Libro ➜
                </CozyButton>
              </div>
            </form>
          )}

          {/* Galería de Tarjetas de Libros */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBooks.map((book) => {
              const isSelected = book.id === selectedBookId;
              const percent = Math.round(((book.pages_read || 0) / (book.total_pages || 200)) * 100);

              return (
                <div
                  key={book.id}
                  onClick={() => setSelectedBookId(book.id)}
                  className={`rounded-3xl border-3 p-4 shadow-[0_4px_0_#3A2E2B] transition-all cursor-pointer space-y-3 ${
                    isSelected
                      ? "border-[#3A2E2B] bg-[#F4EEDC] ring-2 ring-[#77936A]"
                      : "border-[#3A2E2B] bg-[#FFFDF8] hover:bg-[#F4EEDC]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-lg shadow-[0_2px_0_#3A2E2B]">
                      📖
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${
                        book.status === "completed"
                          ? "bg-[#314C3C] text-[#FFFDF8]"
                          : "bg-[#77936A]/20 text-[#314C3C] border border-[#77936A]"
                      }`}
                    >
                      {book.status === "completed" ? "Leído ✓" : "En curso"}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-[#3A2E2B] line-clamp-1">
                      {book.title}
                    </h4>
                    <span className="text-[10px] text-[#795548] font-bold">
                      {book.author}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-[#795548]">
                      <span>{book.pages_read || 0} / {book.total_pages || 200} págs</span>
                      <span>{percent}%</span>
                    </div>
                    <CozyProgress value={book.pages_read || 0} max={book.total_pages || 200} variant="sage" />
                  </div>

                  {isSelected && (
                    <div className="pt-1 flex items-center justify-between text-[10px] font-black text-[#314C3C]">
                      <span>Libro activo en atril</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab("lectura");
                          handleStartReading();
                        }}
                        className="underline hover:text-amber-800"
                      >
                        Comenzar a leer ➜
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* BÓVEDA DE RECURSOS & PDFs ASOCIADOS A LA LECTURA */}
          <div className="pt-4 border-t-2 border-[#D8B48A]/40">
            <SkillResourceHubPanel domain="reading" />
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 3: NOTAS & CITAS DESTACADAS
         ======================================================================= */}
      {activeTab === "citas" && (
        <div className="space-y-4">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
              Reflexiones y Citas Extraídas de los Libros
            </h4>
            <p className="text-xs text-[#795548]">
              Cada idea anotada enriquece tu visión del mundo y consolida el aprendizaje de la lectura consciente.
            </p>

            {/* Listado de citas de libros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-4 space-y-2">
                <span className="text-2xl">“</span>
                <p className="text-xs italic text-[#3A2E2B]">
                  No nos elevamos al nivel de nuestras metas; caemos al nivel de nuestros sistemas.
                </p>
                <div className="flex justify-between text-[10px] font-bold text-[#795548] border-t border-[#3A2E2B]/20 pt-1">
                  <span>Hábitos Atómicos</span>
                  <span>Pág. 27</span>
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-4 space-y-2">
                <span className="text-2xl">“</span>
                <p className="text-xs italic text-[#3A2E2B]">
                  El trabajo profundo no es una virtud moral ni una habilidad anticuada: es una destreza crucial en una economía competitiva.
                </p>
                <div className="flex justify-between text-[10px] font-bold text-[#795548] border-t border-[#3A2E2B]/20 pt-1">
                  <span>Deep Work</span>
                  <span>Pág. 14</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================================
          TAB 4: HISTORIAL DE SESIONES DE LECTURA
         ======================================================================= */}
      {activeTab === "historial" && (
        <div className="space-y-4">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
              Historial de Sesiones Registradas en La Librería
            </h4>

            {readingSessions.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#795548]">
                Aún no has registrado sesiones de lectura. ¡Inicia un bloque en el atril!
              </div>
            ) : (
              <div className="divide-y divide-[#3A2E2B]/15">
                {readingSessions.map((ses) => (
                  <div key={ses.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-black text-[#3A2E2B] block">
                        {ses.title}
                      </span>
                      <span className="text-[10px] text-[#795548]">
                        {ses.details} • {new Date(ses.timestamp).toLocaleDateString("es-CO")}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-[#314C3C]">
                        +{ses.gp_earned} GP
                      </span>
                      <span className="text-[10px] text-[#795548] block">
                        {ses.duration_minutes} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =======================================================================
          ESTACIÓN 5: DESPACHO DE ELDRIN EL SABIO
         ======================================================================= */}
      {activeTab === "eldrin" && (
        <div className="space-y-4">
          <ResidentAssistantWidget
            context={{
              residentId: "eldrin",
              buildingId: "libreria",
              domain: "reading",
              readingBooks: books,
              recentSessions: readingSessions,
            }}
            onPrepareSession={(prepared) => {
              if (prepared.resourceId) {
                setSelectedBookId(prepared.resourceId);
              }
              if (prepared.metadata?.targetPages) {
                setPagesReadInput(Number(prepared.metadata.targetPages));
              }
              setActiveTab("lectura");
            }}
          />
        </div>
      )}

      {/* =======================================================================
          TAB 5: EVOLUCIÓN VISUAL & COLECCIONES DE LIBROS (FASE 9)
         ======================================================================= */}
      {activeTab === "evolucion" && (
        <VillageProgressionPanel
          progression={progression}
          buildingName="La Librería & Archivo Antiguo"
        />
      )}
    </LivingInteriorRoom>
  );
}
