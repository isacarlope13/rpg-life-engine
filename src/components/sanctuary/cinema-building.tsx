"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Film,
  Tv,
  Music,
  Star,
  Plus,
  Shuffle,
  Trash2,
  Sparkles,
  CheckCircle2,
  Heart,
} from "lucide-react";
import { useSessionIdentity } from "@/lib/sanctuary/session-identity";
import {
  readCinemaEntriesSafe,
  saveCinemaEntriesSafe,
  createCinemaEntry,
  incrementSeriesEpisode,
  updateCinemaEntryStatus,
  type CinemaEntry,
  type CinemaMediaKind,
  type CinemaEntryStatus,
} from "@/lib/sanctuary/cinema-store";
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface CinemaBuildingProps {
  playerLevel?: number;
  onRefreshState?: () => Promise<void>;
  onSubmitDirectSkillSession?: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

const KIND_META: Record<CinemaMediaKind, { label: string; icon: string; badgeClass: string }> = {
  movie: {
    label: "Película",
    icon: "🎬",
    badgeClass: "bg-[#C88973]/20 border-[#C88973] text-[#8A3722]",
  },
  series: {
    label: "Serie",
    icon: "📺",
    badgeClass: "bg-[#314C3C]/15 border-[#314C3C] text-[#314C3C]",
  },
  musical: {
    label: "Musical",
    icon: "🎭",
    badgeClass: "bg-[#E7D69C]/50 border-[#8C6239] text-[#5C381E]",
  },
};

const STATUS_LABELS: Record<CinemaEntryStatus, string> = {
  watching: "🍿 Viendo ahora",
  watchlist: "🎟️ Por ver",
  watched: "✅ Vista",
  favorite: "⭐ Favorita",
};

export function CinemaBuilding({ onClose }: CinemaBuildingProps) {
  const sessionOwner = useSessionIdentity();
  const [activeTab, setActiveTab] = useState<
    "pantalla" | "cartelera" | "musicales" | "diario" | "registrar"
  >("pantalla");

  const [entries, setEntries] = useState<CinemaEntry[]>([]);
  const [pickedTonight, setPickedTonight] = useState<CinemaEntry | null>(null);
  const [kindFilter, setKindFilter] = useState<"all" | CinemaMediaKind>("all");
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Formulario de nueva obra
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CinemaMediaKind>("movie");
  const [status, setStatus] = useState<CinemaEntryStatus>("watchlist");
  const [rating, setRating] = useState<number>(0);
  const [season, setSeason] = useState<number>(1);
  const [episode, setEpisode] = useState<number>(1);
  const [favoriteSongOrScene, setFavoriteSongOrScene] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setEntries(readCinemaEntriesSafe(sessionOwner));
  }, [sessionOwner]);

  const persistEntries = (next: CinemaEntry[], successMsg?: string) => {
    setEntries(next);
    const res = saveCinemaEntriesSafe(sessionOwner, next);
    if (!res.ok) {
      setNotification({ type: "error", message: res.error || "No se pudo guardar." });
    } else if (successMsg) {
      setNotification({ type: "success", message: successMsg });
    }
  };

  const watchingList = useMemo(() => entries.filter((e) => e.status === "watching"), [entries]);
  const watchlist = useMemo(
    () =>
      entries.filter(
        (e) => e.status === "watchlist" && (kindFilter === "all" || e.kind === kindFilter)
      ),
    [entries, kindFilter]
  );
  const musicalsAndFavorites = useMemo(
    () => entries.filter((e) => e.kind === "musical" || e.status === "favorite"),
    [entries]
  );
  const watchedList = useMemo(
    () => entries.filter((e) => e.status === "watched" || e.status === "favorite"),
    [entries]
  );

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    triggerHaptic("light");
    const created = createCinemaEntry({
      title,
      kind,
      status,
      rating: rating > 0 ? rating : undefined,
      season: kind === "series" ? season : undefined,
      episode: kind === "series" ? episode : undefined,
      favoriteSongOrScene,
      notes,
    });
    persistEntries(
      [created, ...entries],
      `${KIND_META[kind].icon} "${created.title}" agregada a tu Cine Boutique.`
    );
    setTitle("");
    setFavoriteSongOrScene("");
    setNotes("");
    setRating(0);
    setActiveTab(status === "watching" ? "pantalla" : status === "watchlist" ? "cartelera" : "diario");
  };

  const handleNextEpisode = (entryId: string) => {
    triggerHaptic("light");
    const next = incrementSeriesEpisode(entries, entryId);
    const updated = next.find((e) => e.id === entryId);
    persistEntries(
      next,
      updated ? `📺 "${updated.title}" → T${updated.season} E${updated.episode}` : undefined
    );
  };

  const handleChangeStatus = (entryId: string, nextStatus: CinemaEntryStatus) => {
    triggerHaptic("light");
    const next = updateCinemaEntryStatus(entries, entryId, nextStatus);
    persistEntries(next, `🎟️ Estado actualizado a ${STATUS_LABELS[nextStatus]}.`);
  };

  const handleRemoveEntry = (entryId: string) => {
    triggerHaptic("warning");
    persistEntries(
      entries.filter((e) => e.id !== entryId),
      "Obra retirada de tu cartelera."
    );
  };

  const handlePickRandomWatchlist = () => {
    if (watchlist.length === 0) return;
    triggerHaptic("medium");
    const chosen = watchlist[Math.floor(Math.random() * watchlist.length)];
    setPickedTonight(chosen);
  };

  const stations: InteriorStationDefinition[] = [
    {
      id: "pantalla",
      name: "Pantalla & Viendo Ahora",
      shortName: "Viendo",
      icon: "🎬",
      badge: watchingList.length || undefined,
      badgeVariant: "success",
      hotkey: "1",
      description: "Lo que estás viendo ahora, avance rápido +1 episodio y descanso sin cronómetro.",
    },
    {
      id: "cartelera",
      name: "Cartelera Pendiente",
      shortName: "Watchlist",
      icon: "🎟️",
      badge: entries.filter((e) => e.status === "watchlist").length || undefined,
      hotkey: "2",
      description: "Tu lista de películas, series y musicales por ver + ruleta ¿Qué ver hoy?",
    },
    {
      id: "musicales",
      name: "Vitrina de Musicales & Favoritos",
      shortName: "Musicales",
      icon: "🎭",
      badge: musicalsAndFavorites.length || undefined,
      hotkey: "3",
      description: "Canciones y escenas inolvidables de tus musicales y obras favoritas.",
    },
    {
      id: "diario",
      name: "Butaca de Reseñas",
      shortName: "Diario",
      icon: "🍿",
      badge: watchedList.length || undefined,
      hotkey: "4",
      description: "Tu archivo de boletos vintage con impresiones y calificaciones.",
    },
    {
      id: "registrar",
      name: "Taquilla (Agregar Obra)",
      shortName: "Agregar",
      icon: "➕",
      hotkey: "5",
      description: "Anota una película, serie o musical en segundos sin APIs externas.",
    },
  ];

  return (
    <LivingInteriorRoom
      buildingId="cine"
      buildingName="Cine Boutique & Teatro de OakHaven"
      domain="reading"
      districtName="Artes & Cultura"
      icon="🎬"
      tagline="Cortinas cálidas, boletos vintage y disfrute cultural sin cronómetros ni presión."
      stations={stations}
      activeStationId={activeTab}
      onSelectStation={(id) => setActiveTab(id as typeof activeTab)}
      onClose={onClose}
      metrics={[
        { label: "Viendo Ahora", value: watchingList.length, icon: "🍿" },
        { label: "Por Ver", value: entries.filter((e) => e.status === "watchlist").length, icon: "🎟️" },
        { label: "Vistas", value: watchedList.length, icon: "✅" },
        { label: "Musicales", value: entries.filter((e) => e.kind === "musical").length, icon: "🎭" },
      ]}
      roomTheme={{
        wallColor: "#4A1F28",
        floorPattern: "carpet",
        ambientWarmth: "candlelight",
      }}
    >
      {notification && (
        <div className="mb-4">
          <CozyNotification
            variant={notification.type}
            title={notification.type === "success" ? "¡Listo!" : "Aviso"}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* ESTACIÓN 1: VIENDO AHORA */}
      {activeTab === "pantalla" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-black uppercase text-[#3A2E2B]">
                En Pantalla Ahora
              </h4>
              <p className="text-[11px] text-[#795548]">
                Disfruta sin cronómetros ni prisa. Actualiza tus episodios con un toque.
              </p>
            </div>
            <CozyButton variant="forest" size="sm" onClick={() => setActiveTab("registrar")}>
              <Plus className="h-3.5 w-3.5 inline mr-1" />
              Nueva Obra
            </CozyButton>
          </div>

          {watchingList.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/60 p-8 text-center space-y-3">
              <p className="text-xs font-bold text-[#5C381E]">
                No tienes ninguna película, serie o musical marcado en &quot;Viendo ahora&quot;.
              </p>
              <CozyButton variant="wood" size="sm" onClick={() => setActiveTab("registrar")}>
                🎟️ Agregar tu primera obra
              </CozyButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {watchingList.map((item) => (
                <div
                  key={item.id}
                  className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_4px_0_#3A2E2B] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-black mb-1 ${KIND_META[item.kind].badgeClass}`}
                      >
                        {KIND_META[item.kind].icon} {KIND_META[item.kind].label}
                      </span>
                      <h5 className="text-sm font-black text-[#3A2E2B]">{item.title}</h5>
                    </div>
                    {item.kind === "series" && (
                      <span className="rounded-xl border border-[#3A2E2B] bg-[#E7D69C] px-2.5 py-1 text-xs font-black text-[#3A2E2B]">
                        T{item.season || 1} • E{item.episode || 0}
                      </span>
                    )}
                  </div>

                  {item.favoriteSongOrScene && (
                    <p className="text-[11px] text-[#5C381E] bg-[#F4EEDC] rounded-xl px-3 py-1.5">
                      🎵 <strong>Escena / Canción:</strong> {item.favoriteSongOrScene}
                    </p>
                  )}

                  {item.notes && <p className="text-xs text-[#795548]">{item.notes}</p>}

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#3A2E2B]/15">
                    {item.kind === "series" && (
                      <CozyButton
                        variant="forest"
                        size="sm"
                        onClick={() => handleNextEpisode(item.id)}
                      >
                        +1 Episodio
                      </CozyButton>
                    )}
                    <CozyButton
                      variant="sunlight"
                      size="sm"
                      onClick={() => handleChangeStatus(item.id, "watched")}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />
                      Terminada
                    </CozyButton>
                    <CozyButton
                      variant="wood"
                      size="sm"
                      onClick={() => handleChangeStatus(item.id, "favorite")}
                    >
                      <Heart className="h-3.5 w-3.5 inline mr-1" />
                      Favorita
                    </CozyButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ESTACIÓN 2: CARTELERA PENDIENTE (WATCHLIST + RULETA) */}
      {activeTab === "cartelera" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: "Todos" },
                  { id: "movie", label: "🎬 Películas" },
                  { id: "series", label: "📺 Series" },
                  { id: "musical", label: "🎭 Musicales" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setKindFilter(f.id)}
                  className={`rounded-full border-2 px-3 py-1 text-[11px] font-bold cursor-pointer ${
                    kindFilter === f.id
                      ? "border-[#3A2E2B] bg-[#314C3C] text-[#FFFDF8]"
                      : "border-[#3A2E2B]/30 bg-[#FFFDF8] text-[#3A2E2B]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <CozyButton
              variant="sunlight"
              size="sm"
              disabled={watchlist.length === 0}
              onClick={handlePickRandomWatchlist}
            >
              <Shuffle className="h-3.5 w-3.5 inline mr-1" />
              ¿Qué ver hoy?
            </CozyButton>
          </div>

          {pickedTonight && (
            <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#E7D69C]/45 p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-black uppercase text-[#5C381E] block">
                  ✨ Función sugerida para hoy
                </span>
                <p className="text-sm font-black text-[#3A2E2B]">
                  {KIND_META[pickedTonight.kind].icon} {pickedTonight.title}
                </p>
              </div>
              <CozyButton
                variant="forest"
                size="sm"
                onClick={() => {
                  handleChangeStatus(pickedTonight.id, "watching");
                  setPickedTonight(null);
                  setActiveTab("pantalla");
                }}
              >
                Empezar a ver ➜
              </CozyButton>
            </div>
          )}

          {watchlist.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/60 p-8 text-center text-xs text-[#795548]">
              Tu cartelera pendiente está vacía. Agrega películas, series o musicales en Taquilla.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {watchlist.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-4 space-y-2.5 shadow-[0_3px_0_#3A2E2B]"
                >
                  <span
                    className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-black ${KIND_META[item.kind].badgeClass}`}
                  >
                    {KIND_META[item.kind].icon} {KIND_META[item.kind].label}
                  </span>
                  <h5 className="text-xs font-black text-[#3A2E2B]">{item.title}</h5>
                  {item.notes && <p className="text-[11px] text-[#795548] line-clamp-2">{item.notes}</p>}
                  <div className="flex items-center justify-between pt-2 border-t border-[#3A2E2B]/15">
                    <button
                      type="button"
                      onClick={() => handleChangeStatus(item.id, "watching")}
                      className="text-[11px] font-black text-[#314C3C] hover:underline cursor-pointer"
                    >
                      ▶ Ver ahora
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(item.id)}
                      aria-label={`Eliminar ${item.title}`}
                      className="text-red-700 hover:text-red-900 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ESTACIÓN 3: MUSICALES & FAVORITOS */}
      {activeTab === "musicales" && (
        <div className="space-y-4">
          <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
            <Music className="h-4 w-4 text-[#C88973]" />
            Vitrina de Musicales & Favoritos
          </h4>
          {musicalsAndFavorites.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/60 p-8 text-center text-xs text-[#795548]">
              Guarda tus musicales o marca cualquier obra como ⭐ Favorita para exhibirla aquí.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {musicalsAndFavorites.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFBF2] p-4 space-y-2 shadow-[0_3px_0_#3A2E2B]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#3A2E2B]">
                      {KIND_META[item.kind].icon} {item.title}
                    </span>
                    {item.rating && (
                      <span className="text-xs font-black text-[#8C6239]">
                        {"★".repeat(item.rating)}
                      </span>
                    )}
                  </div>
                  {item.favoriteSongOrScene && (
                    <p className="text-xs text-[#5C381E] bg-[#F4EEDC] rounded-xl p-2">
                      🎵 {item.favoriteSongOrScene}
                    </p>
                  )}
                  {item.notes && <p className="text-[11px] text-[#795548]">{item.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ESTACIÓN 4: DIARIO / BOLETOS VISTOS */}
      {activeTab === "diario" && (
        <div className="space-y-3">
          <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-[#C88973]" />
            Boletos Vintage — Archivo de Obras Vistas
          </h4>
          {watchedList.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-[#3A2E2B]/30 bg-[#F4EEDC]/60 p-8 text-center text-xs text-[#795548]">
              Aún no has marcado películas, series o musicales como vistos.
            </div>
          ) : (
            <div className="divide-y divide-[#3A2E2B]/15 rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-4">
              {watchedList.map((item) => (
                <div key={item.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-[#3A2E2B] block">
                      {KIND_META[item.kind].icon} {item.title}{" "}
                      {item.status === "favorite" ? "⭐" : ""}
                    </span>
                    {item.notes && <span className="text-[11px] text-[#795548]">{item.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-[11px]">
                    {item.rating && (
                      <span className="font-black text-[#8C6239]">{"★".repeat(item.rating)}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveEntry(item.id)}
                      className="text-red-700 hover:text-red-900 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ESTACIÓN 5: TAQUILLA (REGISTRAR OBRA) */}
      {activeTab === "registrar" && (
        <form
          onSubmit={handleAddEntry}
          className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFFBF2] p-5 space-y-4"
        >
          <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
            <Film className="h-4 w-4 text-[#C88973]" />
            Registrar Película, Serie o Musical
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              placeholder="Título de la obra *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
            />

            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as CinemaMediaKind)}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
            >
              <option value="movie">🎬 Película</option>
              <option value="series">📺 Serie</option>
              <option value="musical">🎭 Musical</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CinemaEntryStatus)}
              className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
            >
              <option value="watchlist">🎟️ Por ver (Watchlist)</option>
              <option value="watching">🍿 Viendo ahora</option>
              <option value="watched">✅ Ya vista</option>
              <option value="favorite">⭐ Favorita</option>
            </select>

            <div className="flex items-center gap-1.5 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5">
              <span className="text-[11px] font-bold text-[#795548] mr-1">Nota:</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(rating === star ? 0 : star)}
                  className="cursor-pointer"
                >
                  <Star
                    className={`h-4 w-4 ${
                      star <= rating ? "fill-[#E9C46A] text-[#8C6239]" : "text-[#D8B48A]"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {kind === "series" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="text-[11px] font-bold text-[#3A2E2B] space-y-1">
                <span>Temporada</span>
                <input
                  type="number"
                  min={1}
                  value={season}
                  onChange={(e) => setSeason(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5 text-xs font-bold"
                />
              </label>
              <label className="text-[11px] font-bold text-[#3A2E2B] space-y-1">
                <span>Episodio</span>
                <input
                  type="number"
                  min={0}
                  value={episode}
                  onChange={(e) => setEpisode(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-1.5 text-xs font-bold"
                />
              </label>
            </div>
          )}

          <input
            type="text"
            placeholder={
              kind === "musical"
                ? "Canción o número musical favorito (opcional)"
                : "Escena o frase favorita (opcional)"
            }
            value={favoriteSongOrScene}
            onChange={(e) => setFavoriteSongOrScene(e.target.value)}
            className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
          />

          <textarea
            rows={3}
            placeholder="Impresiones personales o por qué quieres verla..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-3 text-xs text-[#3A2E2B] outline-none"
          />

          <div className="flex justify-end">
            <CozyButton type="submit" variant="forest" size="md">
              🎟️ Guardar en mi Cine
            </CozyButton>
          </div>
        </form>
      )}
    </LivingInteriorRoom>
  );
}
