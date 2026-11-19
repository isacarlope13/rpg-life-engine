"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SkillDomain } from "../../types/rpg.ts";
import { isOfflineOwner } from "../offline-owner.ts";
import { safeLocalStorage } from "../storage-safe.ts";
import { advanceLiveTimer, isLiveTimerDomain, loadLiveTimer, saveLiveTimer, type OwnedLiveTimer } from "./live-timer.ts";
import { captureSessionCommand, executeSessionCommand, hasCapturedSessionCommand, type SessionCommandResult } from "./session-command.ts";

/** Legacy stopwatch UI only; never creates a session, calculates rewards or sends HTTP. */
export function useOwnedLiveTimer(userId?: string) {
  const owner = isOfflineOwner(userId) ? userId : undefined;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const hydratedOwner = useRef<string | undefined>(undefined);
  const snapshot = useRef<OwnedLiveTimer | null>(null);
  const [stored, setStored] = useState<OwnedLiveTimer | null>(null);
  const [submission, setSubmission] = useState<{ owner?: string; busy: boolean; error: string | null }>({ busy: false, error: null });
  // Mask old state during the first render after a change, before effects run.
  const visible = owner && stored?.ownerId === owner ? stored : null;

  useEffect(() => {
    hydratedOwner.current = owner;
    const recovered = loadLiveTimer(safeLocalStorage, owner);
    snapshot.current = recovered;
    setStored(recovered);
    setSubmission({ owner, busy: false, error: null });
    return () => { hydratedOwner.current = undefined; };
  }, [owner]);

  const commit = useCallback((next: OwnedLiveTimer): boolean => {
    if (!owner || currentOwner.current !== owner || hydratedOwner.current !== owner || next.ownerId !== owner) return false;
    snapshot.current = next;
    setStored(next);
    saveLiveTimer(safeLocalStorage, owner, next);
    return true;
  }, [owner]);

  const startLiveTimer = useCallback((domain: SkillDomain) => {
    if (!owner || !isLiveTimerDomain(domain)) return false;
    const previous = snapshot.current;
    if (previous?.ownerId === owner && previous.domain && hasCapturedSessionCommand(safeLocalStorage, owner, previous.operationId)) {
      setSubmission({ owner, busy: false, error: "Hay un registro pendiente. Reintenta guardarlo o descarta el cronómetro antes de iniciar otro." });
      return false;
    }
    const now = Date.now();
    const next = previous?.ownerId === owner && previous.domain === domain && previous.paused
      ? { ...previous, paused: false, lastTimestamp: now }
      : { ownerId: owner, operationId: `live-${crypto.randomUUID()}`, domain, seconds: 0, paused: false, lastTimestamp: now };
    return commit(next);
  }, [owner, commit]);

  const pauseLiveTimer = useCallback(() => {
    const previous = snapshot.current;
    return !!owner && previous?.ownerId === owner && !!previous.domain && commit({ ...advanceLiveTimer(previous, Date.now()), paused: true });
  }, [owner, commit]);
  const resumeLiveTimer = useCallback(() => {
    const previous = snapshot.current;
    if (hasCapturedSessionCommand(safeLocalStorage, owner, previous?.operationId)) return false;
    return !!owner && previous?.ownerId === owner && !!previous.domain && commit({ ...previous, paused: false, lastTimestamp: Date.now() });
  }, [owner, commit]);
  const resetLiveTimer = useCallback(() => {
    if (!owner) return false;
    return commit({ ownerId: owner, domain: null, seconds: 0, paused: false, lastTimestamp: Date.now() });
  }, [owner, commit]);

  const finishLiveTimer = useCallback(async (payload: Record<string, unknown>): Promise<SessionCommandResult> => {
    const current = snapshot.current;
    const isCurrent = () => !!owner && currentOwner.current === owner && hydratedOwner.current === owner;
    if (!owner || !isCurrent() || current?.ownerId !== owner || !current.domain) return { outcome: "rejected", message: "No hay cronómetro de esta cuenta" };
    setSubmission({ owner, busy: true, error: null });
    try {
      const paused = { ...advanceLiveTimer(current, Date.now()), paused: true,
        operationId: current.operationId || `live-${crypto.randomUUID()}` };
      const duration = paused.seconds > 0 ? Math.max(1, Math.round(paused.seconds / 60)) : 0;
      const command = captureSessionCommand(safeLocalStorage, {
        ownerId: owner, operationId: paused.operationId,
        payload: { ...payload, domain: paused.domain, duration_minutes: duration }, context: { timer: paused },
      });
      commit(paused);
      const result = await executeSessionCommand(safeLocalStorage, command);
      if (!isCurrent()) return { outcome: "pending", message: "La cuenta cambió; la operación original se conserva" };
      if (result.outcome === "confirmed") {
        if (snapshot.current?.operationId === command.operationId) {
          commit({ ownerId: owner, domain: null, seconds: 0, paused: false, lastTimestamp: Date.now() });
        }
        setSubmission({ owner, busy: false, error: null });
      } else setSubmission({ owner, busy: false, error: result.message });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo confirmar la sesión";
      if (isCurrent()) setSubmission({ owner, busy: false, error: message });
      return { outcome: "pending", message };
    }
  }, [owner, commit]);

  useEffect(() => {
    if (!owner || !visible?.domain || visible.paused) return;
    const interval = setInterval(() => {
      const previous = snapshot.current;
      if (previous?.ownerId === owner && previous.domain && !previous.paused) commit(advanceLiveTimer(previous, Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [owner, visible?.domain, visible?.paused, commit]);

  return {
    liveTimerDomain: visible?.domain ?? null,
    liveTimerSeconds: visible?.seconds ?? 0,
    liveTimerPaused: visible?.paused ?? false,
    startLiveTimer, pauseLiveTimer, resumeLiveTimer, resetLiveTimer,
    finishLiveTimer,
    liveTimerSubmitting: submission.owner === owner && submission.busy,
    liveTimerError: submission.owner === owner ? submission.error : null,
  };
}
