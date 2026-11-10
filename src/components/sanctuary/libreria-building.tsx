"use client";

import React, { useState } from "react";
import Link from "next/link";
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
} from "lucide-react";
import type { ReadingBook } from "@/types/rpg";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import { CozyButton, CozyProgress, CozyNotification } from "@/components/cozy/ui";

interface LibreriaBuildingProps {
  books: ReadingBook[];
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  currency?: string;
  isCozyActive?: boolean;
  onRefreshState: () => Promise<void>;
  onSubmitDirectSkillSession: (payload: Record<string, unknown>) => Promise<unknown>;
}

export function LibreriaBuilding({
  books = [],
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  currency = "COP",
  isCozyActive = true,
  onRefreshState,
  onSubmitDirectSkillSession,
}: LibreriaBuildingProps) {
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
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Formulario de nuevo libro
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAuthor, setNewAuthor] = useState("");
  const [newTotalPages, setNewTotalPages] = useState(250);
  const [newCategory, setNewCategory] = useState("No Ficción / Desarrollo");
  const [newPrice, setNewPrice] = useState(45000);

  // Motor Universal de Sesiones
  const {
    session,
    isRunning,
    isPaused,
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
  const totalInvestedCop = books.reduce((acc, b) => acc + (Number(b.price_paid) || 0), 0);

  const handleStartReading = () => {
    startSession({
      domain: "reading",
      buildingId: "libreria",
      resourceId: activeBook?.id,
      resourceTitle: activeBook?.title || "Lectura Serena",
      objective: `Leer ${pagesReadInput} páginas de ${activeBook?.title || "libro"}`,
    });
    setActionSuccessMsg("📖 ¡Sesión de lectura comenzada en La Librería!");
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleAddQuote = () => {
    if (!quoteTextInput.trim()) return;
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
        setActionSuccessMsg(
          `✨ ¡Lectura registrada con éxito! Has avanzado ${pagesReadInput} páginas en "${activeBook?.title}".`
        );
        setQuoteTextInput("");
        setQuotePageInput("");
        setSessionQuotes([]);
        await onRefreshState();
        setTimeout(() => setActionSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Error al finalizar sesión de lectura:", err);
      setActionSuccessMsg("⚠️ Ocurrió un error al guardar la sesión.");
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

      setActionSuccessMsg(`📚 ¡Libro "${newTitle}" catalogado con éxito!`);
      setIsAddingBook(false);
      setNewTitle("");
      setNewAuthor("");
      await onRefreshState();
      setTimeout(() => setActionSuccessMsg(null), 3500);
    } catch {
      setActionSuccessMsg("⚠️ No se pudo catalogar el libro.");
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. NAVEGACIÓN DE RETORNO AL PUEBLO */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#4A3C31]/40 pb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-[#4A3C31]/50 bg-[#25201C] px-3.5 py-2 text-xs font-bold text-[#EAE4D9] hover:border-[#88A98E]/60 hover:bg-[#2C2420] transition"
        >
          <ArrowLeft className="h-4 w-4 text-[#88A98E]" />
          <span>Volver al Pueblo del Santuario</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="rounded-lg bg-[#88A98E]/15 border border-[#88A98E]/30 px-2.5 py-1 text-xs font-bold text-[#D8E6DA]">
            NVL {skillLevel} Lectura
          </span>
          <span className="rounded-lg bg-[#E9C46A]/15 border border-[#E9C46A]/30 px-2.5 py-1 text-xs font-bold text-[#E9C46A]">
            🪙 {totalGpEarned.toLocaleString("es-CO")} GP Liberados
          </span>
          <span className="rounded-lg bg-[#2E2822] border border-[#4A3C31]/50 px-2.5 py-1 text-xs font-mono font-bold text-[#D8E6DA]">
            📖 {totalPagesReadEver.toLocaleString("es-CO")} págs totales
          </span>
        </div>
      </div>

      {/* 2. CABECERA ATMOSFÉRICA: LA LIBRERÍA */}
      <div className="rounded-2xl border border-[#3B4D3F]/60 bg-gradient-to-r from-[#1E231F] via-[#252C26] to-[#1E231F] p-6 shadow-md text-[#EAE4D9]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#2C382F] text-3xl ring-2 ring-[#88A98E]/40 shadow-inner">
              📖
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-[#F4EFE6] tracking-tight">
                  La Librería & Archivo
                </h1>
                <span className="rounded-md bg-[#88A98E]/20 px-2 py-0.5 text-[11px] font-bold text-[#D8E6DA]">
                  Colección & Lectura
                </span>
              </div>
              <p className="mt-1 text-xs text-[#C9BEAE] max-w-2xl leading-relaxed">
                Estanterías de roble que huelen a papel añejo y encuadernaciones de cuero. Cada página leída nutre tu perspectiva y forja sabiduría inmutable.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#3B4D3F]/50 bg-[#161B17]/70 p-3 text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-[#A69B8D] tracking-wider block">
              Inversión en Biblioteca
            </span>
            <span className="font-mono text-lg font-black text-[#E9C46A]">
              ${totalInvestedCop.toLocaleString("es-CO")} {currency}
            </span>
            <span className="block text-[10px] text-[#88A98E] font-medium">
              {books.length} volúmenes catalogados
            </span>
          </div>
        </div>
      </div>

      {/* BANNER DE NOTIFICACIÓN ESTANDARIZADO */}
      {actionSuccessMsg && (
        <CozyNotification
          variant={actionSuccessMsg.includes("⚠️") ? "warning" : "success"}
          message={actionSuccessMsg}
          onDismiss={() => setActionSuccessMsg(null)}
        />
      )}

      {/* 3. LAYOUT CENTRAL: ESTANTERÍA DE LIBROS & ÁREA DE LECTURA */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* PANEL IZQUIERDO: ESTANTERÍA DE LIBROS (7 COLUMNAS) */}
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookMarked className="h-4 w-4 text-[#88A98E]" />
              <h2 className="text-sm font-bold text-[#EAE4D9]">
                Estantería de Libros ({filteredBooks.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setIsAddingBook((v) => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#4A3C31]/60 bg-[#25201C] px-2.5 py-1 text-xs font-semibold text-[#D8E6DA] hover:border-[#88A98E]/60 transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 text-[#88A98E]" />
              <span>Catalogar Libro</span>
            </button>
          </div>

          {/* FILTROS Y BÚSQUEDA */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#201D1A] p-2.5 rounded-xl border border-[#4A3C31]/40">
            <div className="flex flex-wrap gap-1">
              {[
                { id: "all", label: "📚 Todos" },
                { id: "reading", label: "📖 Leyendo" },
                { id: "completed", label: "🏆 Concluidos" },
                { id: "wishlist", label: "✨ Por Leer" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setGalleryFilter(f.id as typeof galleryFilter)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    galleryFilter === f.id
                      ? "bg-[#88A98E] text-[#1E1B18] shadow"
                      : "text-[#A69B8D] hover:bg-[#2C2622] hover:text-[#EAE4D9]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="h-3.5 w-3.5 text-[#A69B8D] absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar libro o autor..."
                className="rounded-lg border border-[#4A3C31]/50 bg-[#151210] pl-8 pr-2.5 py-1 text-xs text-[#EAE4D9] placeholder-[#7D7366] focus:border-[#88A98E] focus:outline-none w-44"
              />
            </div>
          </div>

          {/* FORMULARIO DE CATALOGAR LIBRO */}
          {isAddingBook && (
            <form
              onSubmit={handleCreateNewBook}
              className="rounded-xl border border-[#88A98E]/40 bg-[#221F1C] p-4 space-y-3 animate-in fade-in duration-200"
            >
              <h3 className="text-xs font-bold text-[#D8E6DA] flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-[#E9C46A]" />
                Catalogar Nuevo Volumen en la Librería
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">Título:</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. Hábitos Atómicos"
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">Autor:</label>
                  <input
                    type="text"
                    required
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Ej. James Clear"
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">Total Páginas:</label>
                  <input
                    type="number"
                    min="10"
                    required
                    value={newTotalPages}
                    onChange={(e) => setNewTotalPages(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">Categoría:</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#A69B8D] block mb-1">Precio Pagado ({currency}):</label>
                  <input
                    type="number"
                    min="0"
                    value={newPrice}
                    onChange={(e) => setNewPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-[#4A3C31] bg-[#161412] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingBook(false)}
                  className="rounded-lg border border-[#4A3C31] px-3 py-1.5 text-xs text-[#A69B8D] hover:text-[#EAE4D9]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#88A98E] px-4 py-1.5 text-xs font-bold text-[#1E1B18] hover:bg-[#97B89D] shadow"
                >
                  Catalogar Tomo
                </button>
              </div>
            </form>
          )}

          {/* GRID DE LIBROS EN LA ESTANTERÍA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredBooks.map((book) => {
              const pct = Math.min(100, Math.round((book.pages_read / Math.max(1, book.total_pages)) * 100));
              const isSelected = activeBook?.id === book.id;

              return (
                <div
                  key={book.id}
                  onClick={() => setSelectedBookId(book.id)}
                  className={`rounded-xl border p-3.5 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "border-[#88A98E]/70 bg-[#242A25] shadow-md ring-1 ring-[#88A98E]/30"
                      : "border-[#4A3C31]/40 bg-[#1D1917]/70 hover:border-[#4A3C31] hover:bg-[#221D1A]"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1.5">
                      <span className="rounded bg-[#88A98E]/20 px-2 py-0.5 text-[9px] font-bold text-[#D8E6DA]">
                        {book.category}
                      </span>
                      {book.status === "completed" ? (
                        <span className="text-[10px] text-[#E9C46A] font-bold">🏆 Concluido</span>
                      ) : (
                        <span className="text-[10px] font-mono text-[#A69B8D]">{pct}% leído</span>
                      )}
                    </div>
                    <h3 className="text-xs font-bold text-[#F4EFE6] line-clamp-1">{book.title}</h3>
                    <p className="text-[11px] text-[#A69B8D] line-clamp-1">{book.author}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-[#4A3C31]/30">
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#A69B8D] mb-1">
                      <span>{book.pages_read} / {book.total_pages} págs</span>
                      {book.rating && (
                        <span className="text-[#E9C46A] flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-current" /> {book.rating}
                        </span>
                      )}
                    </div>
                    <div className="mt-1">
                      <CozyProgress
                        value={pct}
                        variant="sage"
                        size="sm"
                        showPercentage={false}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PANEL DERECHO: BANCO DE LECTURA & MOTOR UNIVERSAL (5 COLUMNAS) */}
        <div className="space-y-4 rounded-2xl border border-[#4A3C31]/50 bg-[#221F1C]/85 p-5 shadow-md lg:col-span-5 text-[#EAE4D9]">
          <div className="flex items-center justify-between border-b border-[#4A3C31]/40 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#88A98E]" />
              <h2 className="text-sm font-bold text-[#EAE4D9]">
                Mesa de Lectura Serena
              </h2>
            </div>
            <span className="text-[11px] text-[#A69B8D]">
              Motor Universal
            </span>
          </div>

          {/* CRONÓMETRO DE LECTURA EN VIVO */}
          <div className="rounded-xl border border-[#4A3C31]/50 bg-[#1A1715] p-4 text-center">
            <span className="text-[10px] uppercase font-bold text-[#A69B8D] tracking-wider block">
              {isRunning
                ? "● Lectura Serena en Curso"
                : isPaused
                ? "⏸ Lectura en Pausa"
                : "Listo para Iniciar"}
            </span>
            <div className="mt-1 font-mono text-3xl font-black text-[#F4EFE6] tracking-tight">
              {formattedTime}
            </div>
            <p className="mt-1 text-[11px] text-[#A69B8D] truncate">
              {activeBook ? `Libro: ${activeBook.title}` : "Selecciona un libro en la estantería"}
            </p>

            {/* CONTROLES */}
            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              {!isRunning && !isPaused ? (
                <CozyButton
                  variant="sage"
                  size="sm"
                  icon={<Play className="h-4 w-4 fill-current" />}
                  onClick={handleStartReading}
                >
                  Iniciar Lectura
                </CozyButton>
              ) : (
                <>
                  {isPaused ? (
                    <CozyButton
                      variant="sage"
                      size="sm"
                      icon={<Play className="h-3.5 w-3.5 fill-current" />}
                      onClick={resumeSession}
                    >
                      Reanudar
                    </CozyButton>
                  ) : (
                    <CozyButton
                      variant="sunlight"
                      size="sm"
                      icon={<Pause className="h-3.5 w-3.5" />}
                      onClick={pauseSession}
                    >
                      Pausar
                    </CozyButton>
                  )}

                  <CozyButton
                    variant="forest"
                    size="sm"
                    disabled={submitting}
                    icon={<Square className="h-3.5 w-3.5 fill-current" />}
                    onClick={handleFinishAndSave}
                  >
                    Concluir ({elapsedMinutes}m)
                  </CozyButton>

                  <CozyButton
                    variant="wood"
                    size="sm"
                    icon={<RotateCcw className="h-3 w-3" />}
                    onClick={resetSession}
                    aria-label="Reiniciar cronómetro"
                  />
                </>
              )}
            </div>
          </div>

          {/* PÁGINAS LEÍDAS HOY */}
          <div className="rounded-xl border border-[#4A3C31]/40 bg-[#1C1816] p-3.5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-[#D8E6DA]">
                Páginas leídas en esta sesión:
              </label>
              <span className="font-mono text-xs text-[#E9C46A] font-bold">
                +{pagesReadInput} págs
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="500"
                value={pagesReadInput}
                onChange={(e) => setPagesReadInput(Number(e.target.value))}
                className="w-24 rounded-lg border border-[#4A3C31] bg-[#151210] px-2.5 py-1.5 text-xs text-[#EAE4D9] focus:border-[#88A98E] focus:outline-none"
              />
              <div className="flex flex-wrap gap-1">
                {[5, 10, 15, 25].map((pages) => (
                  <button
                    key={pages}
                    type="button"
                    onClick={() => setPagesReadInput(pages)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold transition cursor-pointer ${
                      pagesReadInput === pages
                        ? "bg-[#88A98E] text-[#1E1B18]"
                        : "bg-[#25201C] text-[#A69B8D] hover:bg-[#2C2420]"
                    }`}
                  >
                    {pages}p
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* CAPTURA RÁPIDA DE CITAS SIN FRICCIÓN (+250 GP) */}
          <div className="rounded-xl border border-[#E9C46A]/30 bg-[#252119] p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#E9C46A] flex items-center gap-1.5">
                <Quote className="h-3.5 w-3.5" />
                Citas Célebres (+250 GP de Bóveda)
              </span>
              <span className="text-[10px] text-[#A69B8D]">Enter = añadir</span>
            </div>

            <div className="flex gap-1.5">
              <input
                type="text"
                value={quoteTextInput}
                onChange={(e) => setQuoteTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddQuote();
                  }
                }}
                placeholder="Escribe o dicta una frase inspiradora..."
                className="flex-1 rounded-lg border border-[#4A3C31] bg-[#161412] px-2.5 py-1.5 text-xs text-[#EAE4D9] placeholder-[#7D7366] focus:border-[#88A98E] focus:outline-none"
              />
              <input
                type="number"
                min="1"
                placeholder="Pág."
                value={quotePageInput}
                onChange={(e) => setQuotePageInput(e.target.value)}
                className="w-14 rounded-lg border border-[#4A3C31] bg-[#161412] px-2 py-1.5 text-xs text-[#EAE4D9] placeholder-[#7D7366] focus:border-[#88A98E] focus:outline-none text-center"
              />
              <button
                type="button"
                onClick={startVoiceDictation}
                title="Dictar cita con voz"
                className={`rounded-lg border px-2.5 py-1.5 text-xs transition cursor-pointer ${
                  dictatingQuote
                    ? "border-rose-500 bg-rose-500/20 text-rose-300 animate-pulse"
                    : "border-[#4A3C31] bg-[#1E1B18] text-[#E9C46A] hover:border-[#E9C46A]"
                }`}
              >
                <Mic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleAddQuote}
                disabled={!quoteTextInput.trim()}
                className="rounded-lg bg-[#E9C46A] px-3 py-1.5 text-xs font-bold text-[#1E1B18] hover:bg-[#F2D68C] disabled:opacity-40 cursor-pointer"
              >
                +
              </button>
            </div>

            {/* CHIPS DE CITAS AÑADIDAS */}
            {sessionQuotes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {sessionQuotes.map((q, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#181512] border border-[#4A3C31]/50 px-2 py-1 text-[10px] text-[#EAE4D9]"
                  >
                    <span className="italic truncate max-w-[200px]">&quot;{q.text}&quot;</span>
                    {q.page && <strong className="text-[#E9C46A]">p.{q.page}</strong>}
                    <button
                      type="button"
                      onClick={() => handleRemoveQuote(idx)}
                      className="text-[#A69B8D] hover:text-white ml-0.5"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* BOTÓN DE REGISTRO DIRECTO SIN TEMPORIZADOR */}
          <div className="pt-2 border-t border-[#4A3C31]/30">
            <button
              type="button"
              disabled={submitting}
              onClick={handleFinishAndSave}
              className="w-full rounded-xl bg-[#2D2621] border border-[#88A98E]/40 py-2.5 text-xs font-bold text-[#D8E6DA] hover:bg-[#382F2A] hover:border-[#88A98E] transition disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
            >
              <Award className="h-4 w-4 text-[#E9C46A]" />
              <span>Registrar Avance (+{pagesReadInput} Páginas)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
