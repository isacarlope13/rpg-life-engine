"use client";

import React, { useState, useEffect } from "react";
import { Send, MessageCircle, X, Check, ShieldCheck, AlertCircle, Sparkles } from "lucide-react";
import { getSkillByBuildingId } from "@/lib/ai/building-skills-registry";
import type { SpecialistProposal } from "@/lib/ai/specialist-engine";
import type { MayorCitation } from "@/lib/ai/mayor-rowan-engine";
import { useSessionIdentity } from "@/lib/sanctuary/session-identity";
import {
  createCinemaEntry,
  readCinemaEntriesSafe,
  saveCinemaEntriesSafe,
  type CinemaMediaKind,
} from "@/lib/sanctuary/cinema-store";
import { readAtelierPatternsSafe } from "@/lib/sanctuary/atelier-patterns-store";
import { CozyButton } from "@/components/cozy/ui";

interface BuildingSpecialistPanelProps {
  buildingId: string;
  avatar?: string;
}

interface SpecialistMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: MayorCitation[];
  proposal?: SpecialistProposal;
  proposalStatus?: "pending" | "applied" | "dismissed";
}

const SUGGESTIONS_BY_BUILDING: Record<string, string[]> = {
  banco_oakhaven: ["¿Cuánto gasté esta semana?", "¿Cuál fue mi último gasto registrado?"],
  biblioteca: [
    "¿Qué debería repasar hoy?",
    "Explícame el tema de este documento",
    "Hazme un examen de 3 preguntas",
    "Crea flashcards de este documento",
  ],
  oficina: ["¿Qué proyectos de trabajo tengo pendientes?", "¿Cuál fue mi última sesión de trabajo?"],
  gimnasio: ["¿Cuándo entrené por última vez?", "¿Cómo va mi constancia en el gym?"],
  club_puzzles: ["¿Cuál fue mi último récord de cubos?", "¿Cuál fue mi último solve?"],
  libreria: ["¿Cuál fue mi último libro registrado?", "¿Qué libro terminé más recientemente?"],
  cine: ["¿Qué serie estoy viendo?", "Agrega la película \"Mi Vecino Totoro\""],
  atelier: [
    "¿En qué vuelta quedé?",
    "Explícame pb, aum y dism",
    "¿Cuánto hilo podría necesitar?",
    "Prepara mi sesión de crochet",
  ],
};

const DISABLED_SKILLS_KEY = "oakhaven_disabled_ai_skills_v1";

function readDisabledSkills(): string[] {
  try {
    const raw = window.localStorage.getItem(DISABLED_SKILLS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

export function BuildingSpecialistPanel({
  buildingId,
  avatar = "✨",
}: BuildingSpecialistPanelProps) {
  const skill = getSkillByBuildingId(buildingId);
  const sessionOwner = useSessionIdentity();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<SpecialistMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [disabledSkills, setDisabledSkills] = useState<string[]>([]);
  const [buildingDocs, setBuildingDocs] = useState<Array<{ id: string; title: string; resource_type?: string }>>([]);
  const [selectedResourceId, setSelectedResourceId] = useState<string>("");

  useEffect(() => {
    setDisabledSkills(readDisabledSkills());
  }, []);

  useEffect(() => {
    if (!isOpen || (buildingId !== "atelier" && buildingId !== "biblioteca")) return;
    fetch(`/api/resources?buildingId=${encodeURIComponent(buildingId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.synced && Array.isArray(data.resources)) {
          setBuildingDocs(
            data.resources.map((r: Record<string, unknown>) => ({
              id: String(r.id),
              title: String(r.title || r.original_filename || "Documento"),
              resource_type: r.resource_type ? String(r.resource_type) : undefined,
            }))
          );
        }
      })
      .catch(() => {});
  }, [isOpen, buildingId]);

  if (!skill || skill.buildingId === "ayuntamiento") return null;

  const isMuted = disabledSkills.includes(skill.skillId);

  const toggleSpecialistEnabled = () => {
    const next = isMuted
      ? disabledSkills.filter((id) => id !== skill.skillId)
      : [...disabledSkills, skill.skillId];
    setDisabledSkills(next);
    try {
      window.localStorage.setItem(DISABLED_SKILLS_KEY, JSON.stringify(next));
    } catch {
      // ignorar
    }
  };

  const handleSend = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || loading) return;
    setErrorMsg(null);
    setLoading(true);
    const userMsg: SpecialistMessage = {
      id: `su-${Date.now()}`,
      role: "user",
      content: text,
    };
    const nextHistory = [...messages, userMsg].slice(-8);
    setMessages(nextHistory);
    if (!raw) setInput("");

    try {
      const res = await fetch("/api/ai/specialist/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingId,
          message: text,
          history: nextHistory.slice(0, -1).map((m) => ({ role: m.role, content: m.content })),
          disabled_skill_ids: disabledSkills,
          selected_resource_id: selectedResourceId || undefined,
          local_snapshot: {
            cinemaEntries: readCinemaEntriesSafe(sessionOwner),
            localPatternProjectsCount: Object.keys(readAtelierPatternsSafe(sessionOwner)).length,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error || `No se pudo consultar a ${skill.name}.`);
        return;
      }

      const assistantMsg: SpecialistMessage = {
        id: `sa-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        citations: data.citations || [],
        proposal: data.proposal,
        proposalStatus: data.proposal ? "pending" : undefined,
      };
      setMessages((prev) => [...prev, assistantMsg].slice(-8));
    } catch {
      setErrorMsg("Error de red al consultar al especialista.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmProposal = async (msgId: string, proposal: SpecialistProposal) => {
    setApplyingId(proposal.id);
    setErrorMsg(null);
    try {
      if (proposal.actionType === "add_cinema_entry") {
        const created = createCinemaEntry({
          title: String(proposal.payload.title || "Nueva obra"),
          kind: (proposal.payload.kind as CinemaMediaKind) || "movie",
          status: "watchlist",
        });
        const existing = readCinemaEntriesSafe(sessionOwner);
        saveCinemaEntriesSafe(sessionOwner, [created, ...existing]);
        await fetch("/api/cinema", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(created),
        }).catch(() => {});
      } else if (proposal.actionType === "add_knitting_project") {
        const res = await fetch("/api/shortcuts/skill-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(proposal.payload),
        });
        if (!res.ok) throw new Error("No se pudo crear el proyecto en el servidor.");
      } else if (
        proposal.actionType === "plan_study_block" &&
        proposal.payload.action === "add_spaced_card_batch" &&
        Array.isArray(proposal.payload.cards)
      ) {
        for (const card of proposal.payload.cards as Array<{ prompt: string; reflection: string; source: string }>) {
          await fetch("/api/shortcuts/skill-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "add_spaced_card",
              prompt: card.prompt,
              reflection: card.reflection,
              source: card.source,
            }),
          });
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, proposalStatus: "applied" } : m))
      );
    } catch {
      setErrorMsg("No se pudo aplicar la propuesta confirmada.");
    } finally {
      setApplyingId(null);
    }
  };

  const handleDismissProposal = (msgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, proposalStatus: "dismissed" } : m))
    );
  };

  const suggestions = SUGGESTIONS_BY_BUILDING[buildingId] || [];

  return (
    <div className="mt-3">
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-xl border-2 border-amber-200/40 bg-amber-950/50 px-3 py-1.5 text-[11px] font-black text-amber-100 hover:bg-amber-900/60 cursor-pointer"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          <span>Consultar a {skill.name} ({skill.role})</span>
        </button>
      ) : (
        <div className="rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-4 text-[#3A2E2B] shadow-[0_4px_0_#3A2E2B] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#3A2E2B]/15 pb-2.5">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-lg">
                {avatar}
              </span>
              <div>
                <h5 className="text-xs font-black text-[#3A2E2B]">{skill.name}</h5>
                <p className="text-[10px] text-[#795548] font-bold">
                  {skill.role} • Confirmación humana en acciones Nivel 2
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 text-[10px] font-bold text-[#5C381E] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!isMuted}
                  onChange={toggleSpecialistEnabled}
                />
                <span>Activo</span>
              </label>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Cerrar chat del especialista"
                className="rounded-lg border border-[#3A2E2B]/30 bg-[#F4EEDC] p-1 text-[#3A2E2B] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {(buildingId === "atelier" || buildingId === "biblioteca") && buildingDocs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#3A2E2B]/25 bg-[#F4EEDC] px-2.5 py-1.5 text-[10px]">
              <span className="font-black text-[#3A2E2B]">
                {buildingId === "atelier" ? "📜 Patrón a consultar:" : "📚 Documento a estudiar:"}
              </span>
              <select
                value={selectedResourceId}
                onChange={(e) => setSelectedResourceId(e.target.value)}
                className="flex-1 rounded-lg border border-[#3A2E2B]/30 bg-[#FFFDF8] px-2 py-1 text-[10px] font-bold text-[#3A2E2B] outline-none"
              >
                <option value="">Ninguno seleccionado (consulta general)</option>
                {buildingDocs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend(s)}
                  className="rounded-full border border-[#3A2E2B]/30 bg-[#F4EEDC] px-2.5 py-1 text-[10px] font-bold text-[#5C381E] hover:bg-[#E7D69C]/60 cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
            {messages.length === 0 ? (
              <p className="text-[11px] text-[#795548] flex items-center gap-1.5 py-2">
                <ShieldCheck className="h-3.5 w-3.5 text-[#314C3C] shrink-0" />
                <span>
                  {skill.name} solo consulta tus datos de este edificio. Nunca ejecuta pagos ni altera GP/XP.
                </span>
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl p-2.5 text-xs space-y-2 ${
                    m.role === "user"
                      ? "bg-[#314C3C] text-[#FFFDF8] ml-6"
                      : "bg-[#F4EEDC] text-[#3A2E2B] border border-[#3A2E2B]/20 mr-4"
                  }`}
                >
                  <p className="whitespace-pre-line font-medium">{m.content}</p>

                  {m.citations && m.citations.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.citations.map((c, idx) => (
                        <span
                          key={`${m.id}-c-${idx}`}
                          className="rounded-md bg-[#FFFDF8] border border-[#3A2E2B]/20 px-1.5 py-0.5 text-[9px] font-bold text-[#5C4033]"
                        >
                          Origen: {c.source}
                        </span>
                      ))}
                    </div>
                  )}

                  {m.proposal && m.proposalStatus === "pending" && (
                    <div className="rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] p-2.5 space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-black text-[#3A2E2B]">
                        <Sparkles className="h-3.5 w-3.5 text-[#C88973]" />
                        <span>Propuesta Nivel 2: {m.proposal.title}</span>
                      </div>
                      <p className="text-[10px] text-[#795548]">{m.proposal.summary}</p>
                      <div className="flex items-center gap-2">
                        <CozyButton
                          variant="forest"
                          size="sm"
                          disabled={applyingId === m.proposal.id}
                          onClick={() => handleConfirmProposal(m.id, m.proposal!)}
                        >
                          <Check className="h-3 w-3 inline mr-1" />
                          {applyingId === m.proposal.id ? "Aplicando..." : "Confirmar"}
                        </CozyButton>
                        <button
                          type="button"
                          onClick={() => handleDismissProposal(m.id)}
                          className="text-[10px] font-bold text-[#795548] underline cursor-pointer"
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                  )}

                  {m.proposalStatus === "applied" && (
                    <p className="text-[10px] font-black text-[#314C3C]">
                      ✓ Propuesta confirmada y aplicada.
                    </p>
                  )}
                  {m.proposalStatus === "dismissed" && (
                    <p className="text-[10px] font-bold text-[#795548]">Propuesta descartada.</p>
                  )}
                </div>
              ))
            )}
          </div>

          {errorMsg && (
            <p role="alert" className="text-[11px] font-bold text-amber-900 bg-amber-50 border border-amber-700 rounded-xl p-2 flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{errorMsg}</span>
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              maxLength={600}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Pregúntale a ${skill.name}...`}
              className="flex-1 rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B] outline-none"
            />
            <CozyButton type="submit" variant="forest" size="sm" disabled={loading || !input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </CozyButton>
          </form>
        </div>
      )}
    </div>
  );
}
