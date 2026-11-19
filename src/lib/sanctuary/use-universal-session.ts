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
  calculateNetDurationSeconds,
  formatDuration,
  buildSkillSessionPayload,
} from "./universal-session-engine";

import { useSessionIdentity } from "./session-identity";
import { isOfflineOwner } from "../offline-owner.ts";
import { safeLocalStorage } from "../storage-safe.ts";
import { captureSessionCommand, executeSessionCommand, hasCapturedSessionCommand } from "./session-command.ts";
import { loadOwnedSession, saveOwnedSession, loadOwnedHistory, appendOwnedHistory } from "./session-storage.ts";

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
        };

  const contextUserId = useSessionIdentity();
  // Explicit options support isolated hosts; they cannot override an authenticated provider.
  const candidate = options.userId ?? contextUserId;
  const activeUserId = isOfflineOwner(candidate) && (!contextUserId || contextUserId === candidate) ? candidate : undefined;
  const targetDomain = options.targetDomain;
  const targetBuildingId = options.targetBuildingId;

  const lifetimeRef = useRef({ owner: activeUserId, mounted: true });
  if (lifetimeRef.current.owner !== activeUserId) lifetimeRef.current = { owner: activeUserId, mounted: true };
  const lifetime = lifetimeRef.current;
  const isCurrent = useCallback(() => lifetimeRef.current === lifetime && lifetime.mounted, [lifetime]);
  useEffect(() => {
    lifetime.mounted = true;
    return () => { lifetime.mounted = false; };
  }, [lifetime]);

  const [storedSession, setStoredSession] = useState<UniversalSessionRecord | null>(null);
  const ownedSession = activeUserId && storedSession?.userId === activeUserId ? storedSession : null;
  const session = ownedSession && (!targetDomain || ownedSession.domain === targetDomain) ? ownedSession : null;
  const currentSession = useRef(session);
  currentSession.current = session;
  const setSession = useCallback((update: UniversalSessionRecord | null | ((previous: UniversalSessionRecord | null) => UniversalSessionRecord | null)) => {
    if (!isCurrent()) return;
    setStoredSession(previous => {
      if (!isCurrent()) return previous;
      const owned = previous && previous.userId === activeUserId && (!targetDomain || previous.domain === targetDomain) ? previous : null;
      const next = typeof update === "function" ? update(owned) : update;
      return next && next.userId !== activeUserId ? previous : next;
    });
  }, [activeUserId, targetDomain, isCurrent]);
  const [submitting, setSubmitting] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [storedHistory, setHistory] = useState<UniversalSessionRecord[]>([]);
  const history = storedHistory.filter(item => activeUserId && item.userId === activeUserId && (!targetDomain || item.domain === targetDomain));
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const activeLockConflict = ownedSession && targetDomain && ownedSession.domain !== targetDomain
    ? { domain: ownedSession.domain, buildingId: ownedSession.buildingId, sessionId: ownedSession.sessionId } : null;

  useEffect(() => {
    setStoredSession(loadOwnedSession(safeLocalStorage, activeUserId));
    setHistory(loadOwnedHistory(safeLocalStorage, activeUserId));
    setSubmitting(false);
    setSubmissionError(null);
  }, [activeUserId]);

  const persistSession = useCallback((value: UniversalSessionRecord | null) => {
    if (!isCurrent()) return;
    saveOwnedSession(safeLocalStorage, activeUserId, value);
  }, [activeUserId, isCurrent]);

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
  }, [session?.status, persistSession, setSession]);

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
      if (!activeUserId || !isCurrent()) return null;
      if (session && hasCapturedSessionCommand(safeLocalStorage, activeUserId, session.idempotencyKey)) { setSubmissionError("Termina o descarta el registro pendiente antes de iniciar otro."); return null; }
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
      return newSession;
    },
    [session, activeUserId, targetDomain, targetBuildingId, persistSession, isCurrent, setSession]
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
      if (!activeUserId || !isCurrent()) return;
      if (session && hasCapturedSessionCommand(safeLocalStorage, activeUserId, session.idempotencyKey)) { setSubmissionError("Termina o descarta el registro pendiente antes de iniciar otro."); return; }
      const next = session?.status === "preparing"
        ? startUniversalSession(session, Date.now())
        : createUniversalSession({
            userId: activeUserId,
            domain: params?.domain || targetDomain || "general",
            buildingId: params?.buildingId || targetBuildingId || `bld_${params?.domain || targetDomain || "general"}`,
            resourceId: params?.resourceId,
            resourceTitle: params?.resourceTitle,
            objective: params?.objective,
            initialNotes: params?.notes || params?.initialNotes,
            specializedData: params?.specializedData,
            autoStart: true,
          });
      setSession(next);
      persistSession(next);
    },
    [session, activeUserId, targetDomain, targetBuildingId, persistSession, isCurrent, setSession]
  );

  // Fase 3: Pausar Sesión
  const pauseSession = useCallback(() => {
    setSession((prev) => {
      if (!prev || prev.status !== "running") return prev;
      const paused = pauseUniversalSession(prev, Date.now());
      persistSession(paused);
      return paused;
    });
  }, [persistSession, setSession]);

  // Fase 4: Reanudar Sesión
  const resumeSession = useCallback(() => {
    if (session && hasCapturedSessionCommand(safeLocalStorage, activeUserId, session.idempotencyKey)) { setSubmissionError("La sesión espera confirmación; reintenta guardarla sin añadir tiempo."); return; }
    setSession((prev) => {
      if (!prev || prev.status !== "paused") return prev;
      const resumed = resumeUniversalSession(prev, Date.now());
      persistSession(resumed);
      return resumed;
    });
  }, [session, activeUserId, persistSession, setSession]);

  // Fase 5: Cancelar o Reiniciar Sesión
  const resetSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setSession(null);
    persistSession(null);
  }, [persistSession, setSession]);

  const cancelSession = useCallback(
    (reason: string = "Usuario descartó la sesión") => {
      if (!session || !isCurrent()) return;
      cancelUniversalSession(session, reason, Date.now());
      resetSession();
    },
    [session, isCurrent, resetSession]
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
    [persistSession, setSession]
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
    [persistSession, setSession]
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
    [persistSession, setSession]
  );

  // Fase 6: Finalizar y Guardar con Idempotencia
  const finishSession = useCallback(
    async (specializedPayload: Record<string, unknown> = {}) => {
      if (!session || !activeUserId || session.userId !== activeUserId || !isCurrent()) return null;
      setSubmitting(true);
      setSubmissionError(null);

      try {
        const now = Date.now();
        const completed = finishUniversalSession(session, undefined, now);
        const command = captureSessionCommand(safeLocalStorage, {
          ownerId: activeUserId, operationId: session.idempotencyKey,
          payload: buildSkillSessionPayload(completed, specializedPayload), context: { completed },
        });
        // Stop accumulating productive time once the user requests completion.
        if (session.status === "running") {
          const pending = pauseUniversalSession(session, now);
          setSession(pending);
          persistSession(pending);
        }
        const result = await executeSessionCommand(safeLocalStorage, command);
        if (!isCurrent() || currentSession.current?.sessionId !== session.sessionId) return null;
        if (result.outcome !== "confirmed") throw new Error(result.message);
        const captured = (command.context as { completed: UniversalSessionRecord }).completed;
        if (!appendOwnedHistory(safeLocalStorage, activeUserId, captured)) {
          throw new Error("Sesión confirmada; el historial local sigue pendiente. Reintenta sin registrar otra actividad.");
        }
        setHistory(loadOwnedHistory(safeLocalStorage, activeUserId));
        resetSession();
        return result.data;
      } catch (err: unknown) {
        if (!isCurrent()) return null;
        console.error("Error al finalizar sesión universal:", err);
        const errMsg = err instanceof Error ? err.message : "Error de red al guardar sesión";
        setSubmissionError(errMsg);
        return null;
      } finally {
        if (isCurrent()) setSubmitting(false);
      }
    },
    [session, activeUserId, isCurrent, resetSession, setSession, persistSession]
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
