"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, ExternalLink, Edit3, CheckCircle2, Radio, Sparkles } from "lucide-react";
import type { SpotifyPlaybackState } from "@/app/api/spotify/now-playing/route";

interface SpotifyAudioHubProps {
  onOpenSessionNotes: (title: string, artist: string, category: string) => void;
  onLogAudioSession: (title: string, minutes: number) => Promise<void>;
}

export function SpotifyAudioHub({
  onOpenSessionNotes,
  onLogAudioSession,
}: SpotifyAudioHubProps) {
  const [playback, setPlayback] = useState<SpotifyPlaybackState | null>(null);
  const [isPlayingLocally, setIsPlayingLocally] = useState(true);
  const [logging, setLogging] = useState(false);
  const [audioToast, setAudioToast] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchSpotify() {
      try {
        const res = await fetch("/api/spotify/now-playing");
        if (res.ok) {
          const data: SpotifyPlaybackState = await res.json();
          if (isMounted) {
            setPlayback(data);
            setIsPlayingLocally(data.isPlaying);
          }
        }
      } catch (e) {
        console.error("Error loading Spotify data:", e);
      }
    }
    fetchSpotify();
    return () => {
      isMounted = false;
    };
  }, []);

  const formatMs = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const current = playback || {
    isPlaying: true,
    itemType: "episode" as const,
    title: "Huberman Lab: Protocolos de Enfoque, Rutinas Matutinas & Dopamina",
    artist: "Dr. Andrew Huberman",
    album: "Huberman Lab Podcast",
    albumImageUrl:
      "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=300&auto=format&fit=crop&q=80",
    progressMs: 1845000,
    durationMs: 5120000,
    spotifyUrl: "https://open.spotify.com",
    category: "podcast" as const,
    isConfigured: false,
  };

  const progressPct = Math.min(
    100,
    Math.round((current.progressMs / (current.durationMs || 1)) * 100)
  );

  const handleLogListen = async () => {
    setLogging(true);
    try {
      const listenedMins = Math.max(15, Math.round(current.progressMs / 60000));
      await onLogAudioSession(current.title, listenedMins);
      setAudioToast("✨ ¡Sesión de escucha registrada en tu Santuario! +80 XP y +400 GP.");
      setTimeout(() => setAudioToast(null), 4000);
    } finally {
      setLogging(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-[#161E2E]/80 backdrop-blur-md p-4 shadow-xl text-xs transition-all hover:border-emerald-500/20 mb-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* LEFT: Cover art & track metadata */}
        <div className="flex items-center gap-3.5">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-slate-900 shadow-md">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.albumImageUrl}
              alt={current.title}
              className="h-full w-full object-cover"
            />
            {isPlayingLocally && (
              <span className="absolute bottom-1 right-1 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
            )}
          </div>

          <div className="space-y-1 truncate max-w-sm">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 rounded bg-[#1DB954]/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-[#1DB954] ring-1 ring-[#1DB954]/30">
                <Radio className="h-2.5 w-2.5" />
                {current.category === "podcast"
                  ? "PODCAST EDUCATIVO"
                  : current.category === "audiobook"
                  ? "AUDIOLIBRO"
                  : "MÚSICA ENFOQUE"}
              </span>
              {current.isConfigured ? (
                <span className="text-[9px] text-slate-400 font-mono">En vivo</span>
              ) : (
                <span className="text-[9px] text-slate-500 font-mono">Modo Santuario</span>
              )}
            </div>

            <h4 className="font-bold text-[#F1F5F9] truncate text-sm hover:text-emerald-300 transition" title={current.title}>
              {current.title}
            </h4>
            <p className="text-[11px] text-[#94A3B8] truncate">{current.artist}</p>
          </div>
        </div>

        {/* RIGHT: Progress & Actions */}
        <div className="flex flex-col sm:items-end gap-2.5 shrink-0">
          <div className="flex items-center gap-2 w-full sm:w-64">
            <span className="font-mono text-[10px] text-slate-400">
              {formatMs(current.progressMs)}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full bg-gradient-to-r from-[#1DB954] to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-slate-500">
              {formatMs(current.durationMs)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlayingLocally(!isPlayingLocally)}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-slate-300 hover:text-white transition cursor-pointer"
              title={isPlayingLocally ? "Pausar" : "Reproducir"}
            >
              {isPlayingLocally ? (
                <Pause className="h-3 w-3 text-emerald-400" />
              ) : (
                <Play className="h-3 w-3 text-emerald-400" />
              )}
              <span>{isPlayingLocally ? "Pausa" : "Play"}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenSessionNotes(current.title, current.artist, current.category)}
              className="flex items-center gap-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/15 hover:bg-indigo-500/25 px-3 py-1 font-bold text-indigo-300 transition cursor-pointer shadow-sm"
              title="Abrir Bloc de Notas por Sesión para capturar apuntes de este audio"
            >
              <Edit3 className="h-3 w-3" />
              <span>Anotar Insights</span>
            </button>

            <button
              type="button"
              onClick={handleLogListen}
              disabled={logging}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 transition cursor-pointer shadow-md disabled:opacity-50"
              title="Registrar sesión voluntaria (0% culpa, +80 XP)"
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{logging ? "Guardando..." : "+80 XP Cero Culpa"}</span>
            </button>

            <a
              href={current.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 text-slate-400 hover:text-[#1DB954] transition"
              title="Abrir en Spotify"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </div>

      {audioToast && (
        <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-2 text-[11px] font-bold text-emerald-300 flex items-center justify-between animate-in fade-in">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            {audioToast}
          </span>
          <button type="button" onClick={() => setAudioToast(null)} className="text-emerald-400">✕</button>
        </div>
      )}
    </div>
  );
}
