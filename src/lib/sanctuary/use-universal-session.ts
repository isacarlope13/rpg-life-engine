"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SkillDomain } from "@/types/rpg";
import type { UniversalSessionState } from "./types";

const STORAGE_KEY = "rpg_universal_session_v3";

export function formatStopwatchTime(totalSecs: number): string {
  const hrs = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function useUniversalSession(targetDomain?: SkillDomain, targetBuildingId?: string) {
  const [session, setSession] = useState<UniversalSessionState | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored) as UniversalSessionState;
          if (parsed && parsed.status !== "idle" && parsed.status !== "completed") {
            // Si coincide con el dominio o no se especificó filtro, lo carga
            if (!targetDomain || parsed.domain === targetDomain) {
              return parsed;
            }
          }
        }
      } catch {
        // Ignorar error de parsing
      }
    }
    return null;
  });

  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronización continua de segundos y persistencia
  useEffect(() => {
    if (session && session.status === "running") {
      timerRef.current = setInterval(() => {
        setSession((prev) => {
          if (!prev || prev.status !== "running") return prev;
          const nextState: UniversalSessionState = {
            ...prev,
            elapsedSeconds: prev.elapsedSeconds + 1,
          };
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
          } catch {
            // Ignorar
          }
          return nextState;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [session?.status]);

  const startSession = useCallback(
    (params?: {
      domain?: SkillDomain;
      buildingId?: string;
      resourceId?: string;
      resourceTitle?: string;
      objective?: string;
      initialNotes?: string;
      notes?: string;
    }) => {
      const activeDomain = params?.domain || targetDomain || "general";
      const activeBuildingId = params?.buildingId || targetBuildingId || "observatorio";

      const newSession: UniversalSessionState = {
        sessionId: `ses-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        domain: activeDomain,
        buildingId: activeBuildingId,
        status: "running",
        startedAt: new Date().toISOString(),
        elapsedSeconds: 0,
        isPaused: false,
        associatedResourceId: params?.resourceId,
        associatedResourceTitle: params?.resourceTitle,
        sessionObjective: params?.objective,
        notes: params?.notes || params?.initialNotes || "",
      };

      setSession(newSession);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
      } catch {
        // Ignorar
      }
    },
    [targetDomain, targetBuildingId]
  );

  const pauseSession = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.status !== "running") return prev;
      const paused: UniversalSessionState = {
        ...prev,
        status: "paused",
        isPaused: true,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(paused));
      } catch {
        // Ignorar
      }
      return paused;
    });
  }, []);

  const resumeSession = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.status !== "paused") return prev;
      const running: UniversalSessionState = {
        ...prev,
        status: "running",
        isPaused: false,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(running));
      } catch {
        // Ignorar
      }
      return running;
    });
  }, []);

  const resetSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSession(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignorar
    }
  }, []);

  const updateNotes = useCallback((notes: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, notes };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignorar
      }
      return updated;
    });
  }, []);

  const finishSession = useCallback(
    async (specializedPayload: Record<string, unknown> = {}) => {
      if (!session) return null;
      setSubmitting(true);
      const elapsedMinutes = Math.max(1, Math.round(session.elapsedSeconds / 60));

      const payload = {
        domain: session.domain,
        duration_minutes: elapsedMinutes,
        notes: session.notes,
        title: session.associatedResourceTitle || session.sessionObjective,
        idempotency_key: `univ-ses-${session.sessionId}-${Date.now()}`,
        ...specializedPayload,
      };

      try {
        const res = await fetch("/api/shortcuts/skill-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        resetSession();
        return data;
      } catch (err) {
        console.error("Error al finalizar sesión universal:", err);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [session, resetSession]
  );

  return {
    session,
    isRunning: session?.status === "running",
    isPaused: session?.status === "paused",
    isActive: session !== null && session.status !== "idle",
    elapsedSeconds: session?.elapsedSeconds || 0,
    formattedTime: formatStopwatchTime(session?.elapsedSeconds || 0),
    elapsedMinutes: Math.max(1, Math.round((session?.elapsedSeconds || 0) / 60)),
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    updateNotes,
    finishSession,
    submitting,
  };
}
