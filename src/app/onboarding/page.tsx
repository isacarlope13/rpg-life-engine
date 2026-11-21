"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Plus,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wallet,
  CalendarClock,
  Compass,
  AlertTriangle,
} from "lucide-react";
import {
  EIGHT_LIFE_AREAS,
  buildCharacterSheet,
  clearAllOnboardingDrafts,
  clearOnboardingDraft,
  computeRealFinanceSummary,
  createEmptyOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  type PersonalOnboardingDraft,
} from "@/lib/onboarding/personal-onboarding-engine";
import {
  buildAdaptiveDayPlan,
  recommendFreeSlotActivities,
} from "@/lib/planner/adaptive-calendar-engine";
import { buildRowanDecisionRecommendation } from "@/lib/ai/rowan-decision-engine";
import type { CurrencyCode, DebtStrategy } from "@/types/rpg";

const STEPS = [
  { id: 1 as const, label: "1. Identidad" },
  { id: 2 as const, label: "2. Rutina" },
  { id: 3 as const, label: "3. 8 Áreas" },
  { id: 4 as const, label: "4. Finanzas" },
  { id: 5 as const, label: "5. Objetivos" },
  { id: 6 as const, label: "6. Revisión" },
  { id: 7 as const, label: "7. Pueblo" },
];

const SUGGESTED_CLASSES = [
  "Arquitecta de Sistemas y Equilibrio",
  "Estratega Cozy de Proyectos & Datos",
  "Exploradora de Conocimiento y Oficios",
];

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function PersonalOnboardingPage() {
  const [draft, setDraft] = useState<PersonalOnboardingDraft>(() => createEmptyOnboardingDraft());
  const [ownerUserId, setOwnerUserId] = useState<string>("");
  const [onboardingMode, setOnboardingMode] = useState<"initial" | "edit">("initial");
  const [draftSavedNotice, setDraftSavedNotice] = useState<string | null>(null);
  const [nameCheck, setNameCheck] = useState<{
    checking: boolean;
    available: boolean | null;
    reason: string;
  }>({ checking: false, available: null, reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<{
    ok: boolean;
    onboardingMode: "initial" | "edit";
    preservedProgress: boolean;
    partialErrors: Array<{ section: string; message: string }>;
  } | null>(null);

  // Cargar identidad verificada y borrador aislado por userId (limpia claves heredadas)
  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => {
        if (r.status === 401) {
          clearAllOnboardingDrafts();
          window.location.href = "/login";
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then((data) => {
        if (!data) return;
        const uid = typeof data.user_id === "string" ? data.user_id : "";
        if (uid) {
          setOwnerUserId(uid);
          const saved = loadOnboardingDraft(uid);
          if (saved) setDraft(saved);
        }
        if (data.onboardingMode === "edit") {
          setOnboardingMode("edit");
        }
      })
      .catch(() => {});
  }, []);

  const updateDraft = (patch: Partial<PersonalOnboardingDraft>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      if (ownerUserId) {
        saveOnboardingDraft(ownerUserId, next);
      }
      return next;
    });
  };

  const handleCheckName = async () => {
    const trimmed = draft.displayName.trim();
    if (trimmed.length < 2) {
      setNameCheck({ checking: false, available: false, reason: "Mínimo 2 caracteres." });
      return;
    }
    setNameCheck({ checking: true, available: null, reason: "Verificando..." });
    try {
      const r = await fetch(`/api/onboarding?check_name=${encodeURIComponent(trimmed)}`);
      const json = (await r.json().catch(() => ({}))) as {
        available?: boolean;
        reason?: string;
      };
      setNameCheck({
        checking: false,
        available: Boolean(json.available),
        reason: json.reason || (json.available ? "Nombre disponible" : "No disponible"),
      });
    } catch {
      setNameCheck({
        checking: false,
        available: null,
        reason: "No se pudo verificar ahora; se validará al guardar.",
      });
    }
  };

  const financeSummary = useMemo(() => computeRealFinanceSummary(draft), [draft]);
  const characterSheet = useMemo(
    () => buildCharacterSheet(draft, onboardingMode === "edit" ? undefined : 1),
    [draft, onboardingMode]
  );
  const dayPlan = useMemo(
    () =>
      buildAdaptiveDayPlan({
        wakeTime: draft.wakeTime,
        sleepTime: draft.sleepTime,
        workStart: draft.workStart,
        workEnd: draft.workEnd,
        timezone: draft.timezone,
      }),
    [draft.wakeTime, draft.sleepTime, draft.workStart, draft.workEnd, draft.timezone]
  );
  const sampleFreeSlot = useMemo(
    () =>
      recommendFreeSlotActivities({
        availableMinutes: 20,
        enabledAreaIds: draft.enabledAreaIds,
      }),
    [draft.enabledAreaIds]
  );
  const rowanPreview = useMemo(
    () =>
      buildRowanDecisionRecommendation({
        question: "Tengo 20 minutos libres",
        availableMinutes: 20,
        enabledAreaIds: draft.enabledAreaIds,
      }),
    [draft.enabledAreaIds]
  );

  const handleSaveDraftExplicit = () => {
    if (ownerUserId) {
      saveOnboardingDraft(ownerUserId, draft);
    }
    setDraftSavedNotice(
      "Borrador guardado para tu usuario (cifras financieras solo en sesión temporal; se borran al cerrar pestaña o sesión)."
    );
    setTimeout(() => setDraftSavedNotice(null), 5000);
  };

  const handlePersistOnboarding = async () => {
    setError(null);
    if (draft.displayName.trim().length < 2) {
      setError("Indica tu nombre de aventurero (mínimo 2 caracteres) en el paso 1.");
      return;
    }
    if (!draft.dataPrivacyAccepted) {
      setError("Debes aceptar expresamente la Política de Tratamiento de Datos Personales.");
      return;
    }
    if (financeSummary.totalRecurringIncomeCop > 0 && !draft.financialDataConfirmed) {
      setError("Confirma explícitamente que las cifras financieras introducidas son tuyas antes de guardar.");
      return;
    }

    const enabledAreas = EIGHT_LIFE_AREAS.filter((a) => draft.enabledAreaIds.includes(a.id));
    const skillsPayload = enabledAreas
      .filter((a) => a.skillDomain !== null)
      .map((a) => ({
        domain: a.skillDomain!,
        label: a.label,
        weekly_target_minutes: Math.max(15, draft.areaWeeklyMinutes[a.id] ?? a.suggestedWeeklyMinutes),
        preferred_session_time: "noche" as const,
      }));

    if (skillsPayload.length === 0) {
      setError("Activa al menos una habilidad para tu pueblo.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: draft.displayName.trim(),
          profession: draft.profession.trim() || "Por definir",
          character_class: draft.characterClass.trim() || SUGGESTED_CLASSES[0],
          currency: draft.currency,
          timezone: draft.timezone || "America/Bogota",
          monthly_income: financeSummary.totalRecurringIncomeCop,
          pay_frequency: draft.incomeSources.length > 1 ? "biweekly" : "monthly",
          pay_day: draft.incomeSources[0]?.payDay || 1,
          fixed_costs: draft.fixedCosts.map((fc) => ({
            name: fc.name.trim() || "Costo fijo",
            amount: Math.max(0, Math.round(fc.amountCop)),
            category: fc.category || "hogar",
          })),
          variable_ops_budget: financeSummary.totalVariableBudgetCop,
          vault_cap: financeSummary.allowedGpRewardsCap,
          savings_goal_monthly: Math.max(0, Math.round(draft.monthlySavingsGoalCop)),
          debt_strategy: draft.debtStrategy,
          bosses: draft.debts.map((d) => ({
            name: d.name.trim(),
            total_balance: Math.max(0, Math.round(d.totalBalanceCop)),
            interest_rate_ea: Math.max(0, Number(d.interestRateEa) || 0),
            min_monthly_payment: Math.max(0, Math.round(d.minMonthlyPaymentCop)),
          })),
          skills: skillsPayload,
          cinema_enabled: draft.enabledAreaIds.includes("cinema"),
          routine: {
            wake_time: draft.wakeTime,
            sleep_time: draft.sleepTime,
            work_start: draft.workStart,
            work_end: draft.workEnd,
            timezone: draft.timezone,
          },
          main_goal: draft.mainGoal.trim() || undefined,
          goal_deadline: draft.goalDeadline.trim() || undefined,
          wishlist: draft.wishlist.map((w) => ({
            name: w.name.trim(),
            cost_gp: Math.max(1, Math.round(w.costGp)),
            priority: w.priority,
          })),
          data_privacy_accepted: draft.dataPrivacyAccepted,
          privacy_accepted_at: new Date().toISOString(),
          privacy_version: "3.4",
          confirm_destructive_replace: false,
        }),
      });

      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        onboardingMode?: "initial" | "edit";
        preservedProgress?: boolean;
        partialErrors?: Array<{ section: string; message: string }>;
      };

      if (!res.ok && res.status !== 207) {
        setError(json.error || `Error ${res.status} al guardar tu configuración.`);
        return;
      }

      clearAllOnboardingDrafts();
      if (ownerUserId) clearOnboardingDraft(ownerUserId);
      setSubmitResult({
        ok: Boolean(json.ok),
        onboardingMode: json.onboardingMode || onboardingMode,
        preservedProgress: Boolean(json.preservedProgress),
        partialErrors: json.partialErrors || [],
      });
      updateDraft({ step: 7 });
    } catch {
      setError("No se pudo conectar con el servidor. Tu borrador local permanece guardado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EEDC] text-[#3A2E2B] p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Cabecera Cozy */}
        <header className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-[0_2px_0_#3A2E2B]">
              🏡
            </span>
            <div>
              <h1 className="text-lg sm:text-xl font-black tracking-tight">
                Configuración Personal de OakHaven
              </h1>
              <p className="text-xs font-bold text-[#795548]">
                {onboardingMode === "edit"
                  ? "Modo edición segura: tu GP, XP, nivel, rachas y sesiones previas se preservan intactos."
                  : "Configura tu perfil real paso a paso. Cero datos ficticios precargados."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveDraftExplicit}
            className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-3 py-2 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#F2E3B3] cursor-pointer"
          >
            <Save className="h-3.5 w-3.5" />
            Guardar borrador
          </button>
        </header>

        {draftSavedNotice && (
          <p role="status" className="rounded-2xl border-2 border-[#314C3C] bg-[#EAF3ED] px-4 py-2.5 text-xs font-bold text-[#1A2B20]">
            ✓ {draftSavedNotice}
          </p>
        )}

        {/* Navegación por las 7 etapas */}
        <nav aria-label="Etapas del onboarding" className="flex flex-wrap gap-1.5">
          {STEPS.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={s.id === 7 && !submitResult}
              onClick={() => updateDraft({ step: s.id })}
              className={`rounded-2xl border-2 border-[#3A2E2B] px-3 py-1.5 text-xs font-black transition cursor-pointer disabled:opacity-40 ${
                draft.step === s.id
                  ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                  : "bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#E7D69C]/40"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {error && (
          <div role="alert" className="rounded-2xl border-2 border-rose-700 bg-rose-50 p-3.5 text-xs font-bold text-rose-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Contenido principal por etapa */}
        <main className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 sm:p-6 shadow-[0_8px_0_#3A2E2B] space-y-5">
          {/* PASO 1: IDENTIDAD */}
          {draft.step === 1 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-[#314C3C]" />
                <h2 className="text-base font-black">1. Tu Identidad en OakHaven</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="ob-name" className="block text-xs font-black mb-1">
                    Nombre de aventurero (único)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="ob-name"
                      type="text"
                      placeholder="Ejemplo ilustrativo: tu alias único"
                      value={draft.displayName}
                      onChange={(e) => updateDraft({ displayName: e.target.value })}
                      className="flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold outline-none focus:bg-[#FFFDF8]"
                    />
                    <button
                      type="button"
                      onClick={handleCheckName}
                      className="rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-3 py-2 text-xs font-black cursor-pointer"
                    >
                      Verificar
                    </button>
                  </div>
                  {nameCheck.reason && (
                    <p className={`mt-1 text-[11px] font-bold ${nameCheck.available ? "text-[#314C3C]" : "text-amber-800"}`}>
                      {nameCheck.reason}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="ob-class" className="block text-xs font-black mb-1">
                    Clase RPG
                  </label>
                  <input
                    id="ob-class"
                    type="text"
                    value={draft.characterClass}
                    onChange={(e) => updateDraft({ characterClass: e.target.value })}
                    className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold outline-none focus:bg-[#FFFDF8]"
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {SUGGESTED_CLASSES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateDraft({ characterClass: c })}
                        className="rounded-full border border-[#3A2E2B]/30 bg-[#F4EEDC] px-2 py-0.5 text-[10px] font-bold hover:bg-[#E7D69C] cursor-pointer"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="ob-prof" className="block text-xs font-black mb-1">
                    Profesión / Enfoque
                  </label>
                  <input
                    id="ob-prof"
                    type="text"
                    placeholder="Ej. Ingeniería Administrativa, analítica y desarrollo"
                    value={draft.profession}
                    onChange={(e) => updateDraft({ profession: e.target.value })}
                    className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold outline-none focus:bg-[#FFFDF8]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor="ob-currency" className="block text-xs font-black mb-1">
                      Moneda
                    </label>
                    <select
                      id="ob-currency"
                      value={draft.currency}
                      onChange={(e) => updateDraft({ currency: e.target.value as CurrencyCode })}
                      className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold"
                    >
                      <option value="COP">COP</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="MXN">MXN</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="ob-tz" className="block text-xs font-black mb-1">
                      Zona horaria
                    </label>
                    <input
                      id="ob-tz"
                      type="text"
                      value={draft.timezone}
                      onChange={(e) => updateDraft({ timezone: e.target.value })}
                      className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Vista previa de Ficha de Personaje */}
              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#EAF3ED] p-3.5 text-xs space-y-1">
                <div className="font-black text-[#314C3C]">
                  🪪 Vista previa de ficha · Nivel {characterSheet.level} ({onboardingMode === "edit" ? "progreso conservado" : "cuenta nueva"})
                </div>
                <p className="font-bold">
                  {characterSheet.identity.adventurerName} — {characterSheet.identity.characterClass}
                </p>
                <p className="text-[#5C4033] text-[11px]">
                  {characterSheet.identity.style} · {characterSheet.identity.currency} · {characterSheet.identity.timezone}
                </p>
              </div>
            </section>
          )}

          {/* PASO 2: RUTINA Y DISPONIBILIDAD */}
          {draft.step === 2 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-[#314C3C]" />
                <h2 className="text-base font-black">2. Rutina y Calendario Adaptativo</h2>
              </div>
              <p className="text-xs text-[#795548]">
                {dayPlan.availabilityNotice}
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "wakeTime", label: "Despertar", val: draft.wakeTime },
                  { id: "workStart", label: "Inicio trabajo", val: draft.workStart },
                  { id: "workEnd", label: "Fin trabajo", val: draft.workEnd },
                  { id: "sleepTime", label: "Dormir", val: draft.sleepTime },
                ].map((f) => (
                  <div key={f.id}>
                    <label htmlFor={`ob-${f.id}`} className="block text-xs font-black mb-1">
                      {f.label}
                    </label>
                    <input
                      id={`ob-${f.id}`}
                      type="time"
                      value={f.val}
                      onChange={(e) => updateDraft({ [f.id]: e.target.value })}
                      className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <h3 className="text-xs font-black uppercase text-[#795548]">
                  Bloques estimados (protegiendo descansos y comidas)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {dayPlan.blocks.map((b) => (
                    <div
                      key={b.id}
                      className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F7F4EB] p-2.5 text-xs flex items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-mono font-black text-[#314C3C]">
                          {b.start}–{b.end}
                        </span>{" "}
                        <span className="font-bold">{b.label}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#FFFDF8] border border-[#3A2E2B]/20 px-2 py-0.5 text-[10px] font-black">
                        {b.status === "confirmed" ? "Confirmado" : "Estimado"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {sampleFreeSlot.length > 0 && (
                <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#FFF8E1] p-3 text-xs space-y-1">
                  <div className="font-black text-[#5C381E]">
                    🦉 Ejemplo si tienes 20 min libres (requiere tu confirmación; nunca se auto-inicia):
                  </div>
                  <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                    {sampleFreeSlot.map((s) => (
                      <li key={s.areaId}>
                        <strong>{s.title}</strong> ({s.specialist}) — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* PASO 3: LAS 8 ÁREAS */}
          {draft.step === 3 && (
            <section className="space-y-4">
              <h2 className="text-base font-black">3. Tus 8 Áreas y Especialistas</h2>
              <p className="text-xs text-[#795548]">
                Activa las áreas que deseas cultivar y ajusta metas semanales editables sin horarios rígidos. Cine se integra con su módulo dedicado y Journaling con su dominio propio.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {EIGHT_LIFE_AREAS.map((area) => {
                  const enabled = draft.enabledAreaIds.includes(area.id);
                  const mins = draft.areaWeeklyMinutes[area.id] ?? area.suggestedWeeklyMinutes;
                  return (
                    <div
                      key={area.id}
                      className={`rounded-2xl border-2 p-3 space-y-2 transition ${
                        enabled
                          ? "border-[#314C3C] bg-[#EAF3ED]"
                          : "border-[#3A2E2B]/25 bg-[#F7F4EB] opacity-70"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 font-black text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={() => {
                              const next = enabled
                                ? draft.enabledAreaIds.filter((x) => x !== area.id)
                                : [...draft.enabledAreaIds, area.id];
                              updateDraft({ enabledAreaIds: next });
                            }}
                            className="h-4 w-4 accent-[#314C3C]"
                          />
                          <span>{area.icon} {area.label}</span>
                        </label>
                        <span className="rounded-full bg-[#FFFDF8] border border-[#3A2E2B]/20 px-2 py-0.5 text-[10px] font-bold">
                          {area.specialist}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#5C4033]">{area.description}</p>
                      {enabled && (
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span>Meta semanal sugerida:</span>
                          <input
                            type="number"
                            min={15}
                            max={1500}
                            step={15}
                            value={mins}
                            onChange={(e) =>
                              updateDraft({
                                areaWeeklyMinutes: {
                                  ...draft.areaWeeklyMinutes,
                                  [area.id]: Math.max(15, Number(e.target.value) || 15),
                                },
                              })
                            }
                            aria-label={`Minutos semanales para ${area.label}`}
                            className="w-20 rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1 text-right font-mono"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* PASO 4: FINANZAS PERSONALES REALES (0 DATOS PRECARGADOS) */}
          {draft.step === 4 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-[#314C3C]" />
                <h2 className="text-base font-black">4. Economía y Finanzas Privadas (COP vs GP)</h2>
              </div>
              <p className="text-xs text-[#795548]">
                Este espacio inicia completamente vacío. Introduce únicamente tus cifras reales (o déjalo vacío y complétalo luego). Saldos iniciales y reembolsos nunca se suman como ingreso recurrente.
              </p>

              {/* Ingresos múltiples/variables */}
              <div className="space-y-2 rounded-2xl border-2 border-[#3A2E2B]/25 bg-[#F7F4EB] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">Ingresos mensuales (múltiples fechas o variables)</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        incomeSources: [
                          ...draft.incomeSources,
                          {
                            id: makeId("inc"),
                            label: "",
                            amountCop: 0,
                            payDay: 15,
                            isVariable: false,
                            kind: "recurring_income",
                          },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-2.5 py-1 text-[11px] font-black cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Añadir ingreso
                  </button>
                </div>
                {draft.incomeSources.length === 0 && (
                  <p className="text-[11px] italic text-[#795548]">
                    Sin ingresos registrados aún (ejemplo ilustrativo: &quot;Quincena 1 — día 15&quot;).
                  </p>
                )}
                {draft.incomeSources.map((src) => (
                  <div key={src.id} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Ej. Nómina quincena 1"
                      value={src.label}
                      onChange={(e) =>
                        updateDraft({
                          incomeSources: draft.incomeSources.map((x) =>
                            x.id === src.id ? { ...x, label: e.target.value } : x
                          ),
                        })
                      }
                      className="rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Monto COP"
                      value={src.amountCop || ""}
                      onChange={(e) =>
                        updateDraft({
                          incomeSources: draft.incomeSources.map((x) =>
                            x.id === src.id ? { ...x, amountCop: Math.max(0, Number(e.target.value) || 0) } : x
                          ),
                        })
                      }
                      className="rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1.5 text-xs font-mono font-bold"
                    />
                    <select
                      value={src.kind}
                      onChange={(e) =>
                        updateDraft({
                          incomeSources: draft.incomeSources.map((x) =>
                            x.id === src.id
                              ? { ...x, kind: e.target.value as typeof src.kind }
                              : x
                          ),
                        })
                      }
                      className="rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2 py-1.5 text-xs font-bold"
                    >
                      <option value="recurring_income">Ingreso recurrente</option>
                      <option value="initial_balance">Saldo inicial (excluido)</option>
                      <option value="refund">Reembolso (excluido)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft({
                          incomeSources: draft.incomeSources.filter((x) => x.id !== src.id),
                        })
                      }
                      aria-label="Eliminar ingreso"
                      className="inline-flex items-center justify-center rounded-xl border border-rose-700 bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-800 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Costos fijos */}
              <div className="space-y-2 rounded-2xl border-2 border-[#3A2E2B]/25 bg-[#F7F4EB] p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">Gastos fijos mensuales</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateDraft({
                        fixedCosts: [
                          ...draft.fixedCosts,
                          { id: makeId("fc"), name: "", amountCop: 0, category: "hogar" },
                        ],
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-2.5 py-1 text-[11px] font-black cursor-pointer"
                  >
                    <Plus className="h-3 w-3" /> Añadir gasto fijo
                  </button>
                </div>
                {draft.fixedCosts.map((fc) => (
                  <div key={fc.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Ej. Servicios o arriendo"
                      value={fc.name}
                      onChange={(e) =>
                        updateDraft({
                          fixedCosts: draft.fixedCosts.map((x) =>
                            x.id === fc.id ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                      className="rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1.5 text-xs font-bold"
                    />
                    <input
                      type="number"
                      min={0}
                      placeholder="Monto COP"
                      value={fc.amountCop || ""}
                      onChange={(e) =>
                        updateDraft({
                          fixedCosts: draft.fixedCosts.map((x) =>
                            x.id === fc.id ? { ...x, amountCop: Math.max(0, Number(e.target.value) || 0) } : x
                          ),
                        })
                      }
                      className="rounded-xl border border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1.5 text-xs font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        updateDraft({ fixedCosts: draft.fixedCosts.filter((x) => x.id !== fc.id) })
                      }
                      className="rounded-xl border border-rose-700 bg-rose-50 px-2 py-1.5 text-xs font-bold text-rose-800 cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>

              {/* Presupuesto variable, ahorro y tope de recompensas GP */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label htmlFor="ob-var" className="block text-xs font-black mb-1">
                    Variables (COP)
                  </label>
                  <input
                    id="ob-var"
                    type="number"
                    min={0}
                    value={draft.variableBudgetCop || ""}
                    onChange={(e) => updateDraft({ variableBudgetCop: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label htmlFor="ob-sav" className="block text-xs font-black mb-1">
                    Meta ahorro (COP)
                  </label>
                  <input
                    id="ob-sav"
                    type="number"
                    min={0}
                    value={draft.monthlySavingsGoalCop || ""}
                    onChange={(e) => updateDraft({ monthlySavingsGoalCop: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label htmlFor="ob-vault" className="block text-xs font-black mb-1">
                    Tope recompensas GP
                  </label>
                  <input
                    id="ob-vault"
                    type="number"
                    min={0}
                    value={draft.vaultCapGp || ""}
                    onChange={(e) => updateDraft({ vaultCapGp: Math.max(0, Number(e.target.value) || 0) })}
                    className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-2.5 py-1.5 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label htmlFor="ob-strat" className="block text-xs font-black mb-1">
                    Estrategia deudas
                  </label>
                  <select
                    id="ob-strat"
                    value={draft.debtStrategy}
                    onChange={(e) => updateDraft({ debtStrategy: e.target.value as DebtStrategy })}
                    className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-2.5 py-1.5 text-xs font-bold"
                  >
                    <option value="snowball">Bola de nieve</option>
                    <option value="avalanche">Avalancha</option>
                  </select>
                </div>
              </div>

              {/* Resumen COP vs GP */}
              <div className="rounded-2xl border-2 border-[#314C3C] bg-[#EAF3ED] p-3.5 text-xs space-y-1.5">
                <div className="font-black text-[#314C3C]">
                  📊 Panorama Real (Dinero COP separado de Puntos GP)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-bold">
                  <div>Ingreso recurrente: ${financeSummary.totalRecurringIncomeCop.toLocaleString("es-CO")} COP</div>
                  <div>Comprometido: ${financeSummary.committedCop.toLocaleString("es-CO")} COP</div>
                  <div>Disponible real: ${financeSummary.availableRealMoneyCop.toLocaleString("es-CO")} COP</div>
                  <div>Tope GP permitido: {financeSummary.allowedGpRewardsCap.toLocaleString("es-CO")} GP</div>
                </div>
                {financeSummary.preventiveAlerts.map((a, i) => (
                  <p key={i} className="text-[11px] font-bold text-amber-900">
                    ⚠️ {a}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* PASO 5: OBJETIVOS Y MISIONES */}
          {draft.step === 5 && (
            <section className="space-y-4">
              <h2 className="text-base font-black">5. Objetivos, Wishlist y Asistente Rowan</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="ob-goal" className="block text-xs font-black mb-1">
                    Objetivo principal actual
                  </label>
                  <input
                    id="ob-goal"
                    type="text"
                    placeholder="Ej. Mantener equilibrio semanal y avanzar en proyectos clave"
                    value={draft.mainGoal}
                    onChange={(e) => updateDraft({ mainGoal: e.target.value })}
                    className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label htmlFor="ob-deadline" className="block text-xs font-black mb-1">
                    Horizonte / fecha objetivo
                  </label>
                  <input
                    id="ob-deadline"
                    type="date"
                    value={draft.goalDeadline}
                    onChange={(e) => updateDraft({ goalDeadline: e.target.value })}
                    className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-2 text-xs font-bold"
                  />
                </div>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#FFF8E1] p-3.5 text-xs space-y-1">
                <div className="font-black text-[#314C3C]">
                  🦉 Vista previa de Rowan como Asistente de Decisiones (0 llamadas a Gemini)
                </div>
                <p><strong>Acción propuesta:</strong> {rowanPreview.proposedAction}</p>
                <p><strong>Motivo:</strong> {rowanPreview.reason}</p>
                <p><strong>Tiempo estimado:</strong> {rowanPreview.estimatedMinutes} min · <strong>Alternativa:</strong> {rowanPreview.alternative}</p>
              </div>
            </section>
          )}

          {/* PASO 6: REVISIÓN FINAL Y PRIVACIDAD */}
          {draft.step === 6 && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#314C3C]" />
                <h2 className="text-base font-black">6. Revisión Final y Confirmación Explícita</h2>
              </div>

              <div className="rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F7F4EB] p-4 text-xs space-y-1.5">
                <p><strong>Aventurero:</strong> {characterSheet.identity.adventurerName} ({characterSheet.identity.characterClass})</p>
                <p><strong>Áreas activas ({characterSheet.areas.length}):</strong> {characterSheet.areas.map((a) => a.label).join(", ")}</p>
                <p><strong>Rutina ({draft.timezone}):</strong> {draft.wakeTime}–{draft.sleepTime} · Trabajo {draft.workStart}–{draft.workEnd}</p>
                <p><strong>Ingreso recurrente declarado:</strong> ${financeSummary.totalRecurringIncomeCop.toLocaleString("es-CO")} COP</p>
              </div>

              <label className="flex items-start gap-2.5 rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#FFFDF8] p-3 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={draft.dataPrivacyAccepted}
                  onChange={(e) => updateDraft({ dataPrivacyAccepted: e.target.checked })}
                  className="mt-0.5 h-4 w-4 accent-[#314C3C]"
                />
                <span>
                  Acepto expresamente la{" "}
                  <Link href="/privacidad" target="_blank" className="underline font-black text-[#314C3C]">
                    Política de Tratamiento de Datos Personales
                  </Link>{" "}
                  y entiendo que mis datos financieros privados permanecen aislados y nunca son mutados automáticamente por la IA.
                </span>
              </label>

              {financeSummary.totalRecurringIncomeCop > 0 && (
                <label className="flex items-start gap-2.5 rounded-2xl border-2 border-[#314C3C]/40 bg-[#EAF3ED] p-3 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.financialDataConfirmed}
                    onChange={(e) => updateDraft({ financialDataConfirmed: e.target.checked })}
                    className="mt-0.5 h-4 w-4 accent-[#314C3C]"
                  />
                  <span className="font-bold">
                    Confirmo que las cifras financieras introducidas son mías y autorizo guardarlas en mi cuenta privada.
                  </span>
                </label>
              )}

              <button
                type="button"
                disabled={submitting || !draft.dataPrivacyAccepted}
                onClick={handlePersistOnboarding}
                className="w-full rounded-2xl border-3 border-[#3A2E2B] bg-[#314C3C] py-3 text-xs font-black text-[#FFFDF8] shadow-[0_4px_0_#1A2B20] hover:bg-[#273E30] disabled:opacity-40 cursor-pointer"
              >
                {submitting ? "Guardando de forma segura..." : "Confirmar y Guardar Configuración"}
              </button>
            </section>
          )}

          {/* PASO 7: ENTRADA AL PUEBLO */}
          {draft.step === 7 && (
            <section className="space-y-4 text-center py-4">
              <CheckCircle2 className="mx-auto h-12 w-12 text-[#314C3C]" />
              <h2 className="text-lg font-black">¡Tu Santuario en OakHaven está listo!</h2>
              <p className="text-xs text-[#5C4033] max-w-md mx-auto">
                {submitResult?.preservedProgress
                  ? "Configuración actualizada en modo edición: todo tu progreso anterior (GP, XP, nivel y rachas) fue preservado."
                  : "Tu perfil personal y tus áreas quedaron guardados de forma segura."}
              </p>
              {submitResult && submitResult.partialErrors.length > 0 && (
                <div className="rounded-2xl border-2 border-amber-700 bg-amber-50 p-3 text-left text-xs text-amber-950">
                  <strong>Avisos parciales:</strong>
                  <ul className="list-disc pl-5 mt-1">
                    {submitResult.partialErrors.map((pe, idx) => (
                      <li key={idx}>{pe.section}: {pe.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Link
                href="/cozy"
                className="inline-flex items-center gap-2 rounded-2xl border-3 border-[#3A2E2B] bg-[#FDDA24] px-6 py-3 text-xs font-black text-[#3A2E2B] shadow-[0_4px_0_#3A2E2B] hover:bg-[#FDE24F]"
              >
                <Compass className="h-4 w-4" />
                Entrar al Pueblo Vivo ➜
              </Link>
            </section>
          )}

          {/* Controles de navegación Inferior */}
          {draft.step < 7 && (
            <div className="flex items-center justify-between pt-4 border-t-2 border-[#3A2E2B]/15">
              <button
                type="button"
                disabled={draft.step === 1}
                onClick={() => updateDraft({ step: Math.max(1, draft.step - 1) as PersonalOnboardingDraft["step"] })}
                className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-4 py-2 text-xs font-black disabled:opacity-40 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Anterior
              </button>

              {draft.step < 6 && (
                <button
                  type="button"
                  onClick={() => updateDraft({ step: Math.min(6, draft.step + 1) as PersonalOnboardingDraft["step"] })}
                  className="inline-flex items-center gap-1.5 rounded-2xl border-2 border-[#3A2E2B] bg-[#314C3C] px-4 py-2 text-xs font-black text-[#FFFDF8] cursor-pointer"
                >
                  Siguiente <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
