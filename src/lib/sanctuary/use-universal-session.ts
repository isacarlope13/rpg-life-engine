"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SkillDomain } from "@/types/rpg";
import {
  UniversalSessionRecord,
  SessionSpecializedMap,
  createUniversalSession,
  startUniversalSession,
  pauseUniversalSession,
  resumeUniversalSession,
  finishUniversalSession,
  cancelUniversalSession,
  hydrateUniversalSession,
  calculateNetDurationSeconds,
  formatDuration,
  buildSkillSessionPayload,
} from "./universal-session-engine";

const STORAGE_KEY_V4 = "rpg_universal_session_v4";
const STORAGE_KEY_V3_FALLBACK = "rpg_universal_session_v3";
const HISTORY_STORAGE_KEY = "rpg_universal_sessions_history_v4";

export function formatStopwatchTime(totalSecs: number): string {
  return formatDuration(totalSecs);
}

export interface UseUniversalSessionOptions {
  userId?: string;
  targetDomain?: SkillDomain;
  targetBuildingId?: string;
}

export function useUniversalSession(
  targetDomainOrOptions?: SkillDomain | UseUniversalSessionOptions,
  targetBuildingIdParam?: string
) {
  // Normalizar parámetros de entrada (soporta firma original y basada en opciones)
  const options: UseUniversalSessionOptions =
    typeof targetDomainOrOptions === "object" && targetDomainOrOptions !== null
      ? targetDomainOrOptions
      : {
          targetDomain: targetDomainOrOptions,
          targetBuildingId: targetBuildingIdParam,
          userId: "usr_cozy_hero",
        };

  const activeUserId = options.userId || "usr_cozy_hero";
  const targetDomain = options.targetDomain;
  const targetBuildingId = options.targetBuildingId;

  // Estado principal de sesión hidratada
  const [session, setSession] = useState<UniversalSessionRecord | null>(() => {
    if (typeof window !== "undefined") {
      try {
        // Intentar leer v4
        const storedV4 = localStorage.getItem(STORAGE_KEY_V4);
        if (storedV4) {
          const hydrated = hydrateUniversalSession(storedV4, activeUserId, Date.now());
          if (hydrated && (!targetDomain || hydrated.domain === targetDomain)) {
            return hydrated;
          }
        }

        // Fallback a v3 para continuidad sin pérdida
        const storedV3 = localStorage.getItem(STORAGE_KEY_V3_FALLBACK);
        if (storedV3) {
          const parsed = JSON.parse(storedV3);
          if (parsed && parsed.status !== "idle" && parsed.status !== "completed") {
            if (!targetDomain || parsed.domain === targetDomain) {
              const adapted = hydrateUniversalSession(
                {
                  ...parsed,
                  userId: activeUserId,
                  idempotencyKey: `ses_univ_${activeUserId}_${parsed.sessionId}`,
                  pauses: [],
                  specializedData: {},
                  historyLog: [],
                },
                activeUserId,
                Date.now()
              );
              return adapted;
            }
          }
        }
      } catch {
        // Ignorar errores de lectura
      }
    }
    return null;
  });

  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [history, setHistory] = useState<UniversalSessionRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const storedHist = localStorage.getItem(HISTORY_STORAGE_KEY);
        if (storedHist) {
          const parsedList = JSON.parse(storedHist) as UniversalSessionRecord[];
          if (Array.isArray(parsedList)) {
            return targetDomain
              ? parsedList.filter((s) => s.domain === targetDomain)
              : parsedList;
          }
        }
      } catch {
        // Ignorar
      }
    }
    return [];
  });

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Advertencia de conflicto si hay otra sesión activa de otro dominio
  const [activeLockConflict, setActiveLockConflict] = useState<{
    domain: SkillDomain;
    buildingId: string;
    sessionId: string;
  } | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(STORAGE_KEY_V4);
        if (stored) {
          const hydrated = hydrateUniversalSession(stored, activeUserId, Date.now());
          if (hydrated && targetDomain && hydrated.domain !== targetDomain) {
            return {
              domain: hydrated.domain,
              buildingId: hydrated.buildingId,
              sessionId: hydrated.sessionId,
            };
          }
        }
      } catch {
        // Ignorar
      }
    }
    return null;
  });

  // Persistencia auxiliar segura
  const persistSession = useCallback((sess: UniversalSessionRecord | null) => {
    if (typeof window === "undefined") return;
    try {
      if (sess && sess.status !== "completed" && sess.status !== "cancelled") {
        localStorage.setItem(STORAGE_KEY_V4, JSON.stringify(sess));
        // Mantener compatibilidad con componentes que leían v3
        localStorage.setItem(STORAGE_KEY_V3_FALLBACK, JSON.stringify(sess));
      } else {
        localStorage.removeItem(STORAGE_KEY_V4);
        localStorage.removeItem(STORAGE_KEY_V3_FALLBACK);
      }
    } catch {
      // Ignorar errores de storage
    }
  }, []);

  // Actualización continua de duración neta (basada en marcas de tiempo exactas)
  useEffect(() => {
    if (session && session.status === "running") {
      timerRef.current = setInterval(() => {
        setSession((prev) => {
          if (!prev || prev.status !== "running") return prev;
          const currentNetSeconds = calculateNetDurationSeconds(prev, Date.now());
          if (currentNetSeconds === prev.elapsedSeconds) {
            return prev;
          }
          const updated: UniversalSessionRecord = {
            ...prev,
            elapsedSeconds: currentNetSeconds,
          };
          persistSession(updated);
          return updated;
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
  }, [session?.status, persistSession]);

  // Fase 1: Preparar Sesión (sin arrancar el cronómetro todavía)
  const prepareSession = useCallback(
    (params?: {
      domain?: SkillDomain;
      buildingId?: string;
      resourceId?: string;
      resourceTitle?: string;
      objective?: string;
      initialNotes?: string;
      specializedData?: SessionSpecializedMap;
    }) => {
      const activeDomain = params?.domain || targetDomain || "general";
      const activeBuilding = params?.buildingId || targetBuildingId || `bld_${activeDomain}`;

      const newSession = createUniversalSession({
        userId: activeUserId,
        domain: activeDomain,
        buildingId: activeBuilding,
        resourceId: params?.resourceId,
        resourceTitle: params?.resourceTitle,
        objective: params?.objective,
        initialNotes: params?.initialNotes,
        specializedData: params?.specializedData,
        autoStart: false,
      });

      setSession(newSession);
      persistSession(newSession);
      setActiveLockConflict(null);
      return newSession;
    },
    [activeUserId, targetDomain, targetBuildingId, persistSession]
  );

  // Fase 2: Iniciar Sesión (arranca cronómetro)
  const startSession = useCallback(
    (params?: {
      domain?: SkillDomain;
      buildingId?: string;
      resourceId?: string;
      resourceTitle?: string;
      objective?: string;
      initialNotes?: string;
      notes?: string;
      specializedData?: SessionSpecializedMap;
    }) => {
      setSession((prev) => {
        if (prev && prev.status === "preparing") {
          const started = startUniversalSession(prev, Date.now());
          persistSession(started);
          return started;
        }

        const activeDomain = params?.domain || targetDomain || "general";
        const activeBuilding = params?.buildingId || targetBuildingId || `bld_${activeDomain}`;

        const newSession = createUniversalSession({
          userId: activeUserId,
          domain: activeDomain,
          buildingId: activeBuilding,
          resourceId: params?.resourceId,
          resourceTitle: params?.resourceTitle,
          objective: params?.objective,
          initialNotes: params?.notes || params?.initialNotes,
          specializedData: params?.specializedData,
          autoStart: true,
        });

        persistSession(newSession);
        setActiveLockConflict(null);
        return newSession;
      });
    },
    [activeUserId, targetDomain, targetBuildingId, persistSession]
  );

  // Fase 3: Pausar Sesión
  const pauseSession = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.status !== "running") return prev;
      const paused = pauseUniversalSession(prev, Date.now());
      persistSession(paused);
      return paused;
    });
  }, [persistSession]);

  // Fase 4: Reanudar Sesión
  const resumeSession = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.status !== "paused") return prev;
      const resumed = resumeUniversalSession(prev, Date.now());
      persistSession(resumed);
      return resumed;
    });
  }, [persistSession]);

  // Fase 5: Cancelar o Reiniciar Sesión
  const resetSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSession(null);
    persistSession(null);
  }, [persistSession]);

  const cancelSession = useCallback(
    (reason: string = "Usuario descartó la sesión") => {
      setSession((prev) => {
        if (!prev) return null;
        cancelUniversalSession(prev, reason, Date.now());
        resetSession();
        return null;
      });
    },
    [resetSession]
  );

  // Actualizar notas
  const updateNotes = useCallback(
    (notes: string) => {
      setSession((prev) => {
        if (!prev) return prev;
        const updated: UniversalSessionRecord = { ...prev, notes };
        persistSession(updated);
        return updated;
      });
    },
    [persistSession]
  );

  // Actualizar datos especializados por habilidad
  const updateSpecializedData = useCallback(
    (specData: SessionSpecializedMap) => {
      setSession((prev) => {
        if (!prev) return prev;
        const updated: UniversalSessionRecord = {
          ...prev,
          specializedData: {
            ...prev.specializedData,
            ...specData,
          },
        };
        persistSession(updated);
        return updated;
      });
    },
    [persistSession]
  );

  // Añadir URL o evidencia fotográfica
  const addEvidenceUrl = useCallback(
    (url: string) => {
      setSession((prev) => {
        if (!prev || !url.trim()) return prev;
        const updated: UniversalSessionRecord = {
          ...prev,
          evidenceUrls: [...(prev.evidenceUrls || []), url.trim()],
        };
        persistSession(updated);
        return updated;
      });
    },
    [persistSession]
  );

  // Fase 6: Finalizar y Guardar con Idempotencia
  const finishSession = useCallback(
    async (specializedPayload: Record<string, unknown> = {}) => {
      if (!session) return null;
      setSubmitting(true);
      setSubmissionError(null);

      const completed = finishUniversalSession(session, undefined, Date.now());
      const payload = buildSkillSessionPayload(completed, specializedPayload);

      try {
        const res = await fetch("/api/shortcuts/skill-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        // Guardar en búfer histórico local
        try {
          if (typeof window !== "undefined") {
            const rawHist = localStorage.getItem(HISTORY_STORAGE_KEY);
            const currentHist: UniversalSessionRecord[] = rawHist ? JSON.parse(rawHist) : [];
            const nextHist = [completed, ...currentHist].slice(0, 50);
            localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(nextHist));
            setHistory(targetDomain ? nextHist.filter((s) => s.domain === targetDomain) : nextHist);
          }
        } catch {
          // Ignorar fallo de historial local
        }

        resetSession();
        return data;
      } catch (err: unknown) {
        console.error("Error al finalizar sesión universal:", err);
        const errMsg = err instanceof Error ? err.message : "Error de red al guardar sesión";
        setSubmissionError(errMsg);
        throw err;
      } finally {
        setSubmitting(false);
      }
    },
    [session, targetDomain, resetSession]
  );

  const netSecs = session ? calculateNetDurationSeconds(session, Date.now()) : 0;

  return {
    session,
    isRunning: session?.status === "running",
    isPaused: session?.status === "paused",
    isPreparing: session?.status === "preparing",
    isActive: session !== null && session.status !== "completed" && session.status !== "cancelled",
    elapsedSeconds: netSecs,
    formattedTime: formatDuration(netSecs),
    elapsedMinutes: Math.max(1, Math.round(netSecs / 60)),
    prepareSession,
    startSession,
    pauseSession,
    resumeSession,
    resetSession,
    cancelSession,
    updateNotes,
    updateSpecializedData,
    addEvidenceUrl,
    finishSession,
    submitting,
    submissionError,
    history,
    activeLockConflict,
  };
}
