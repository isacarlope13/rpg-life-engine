"use client";

import { useCallback, useEffect, useState } from "react";
import { isOfflineOwner } from "@/lib/offline-owner";
import { safeLocalStorage } from "@/lib/storage-safe";
import { isValidFiletWorkspace, readFiletStudioWorkspace, readFiletStudioWorkspaceSafe, saveFiletStudioWorkspaceSafe } from "./filet-crochet-store";
import type { FiletStudioWorkspace } from "./filet-crochet-engine";

type Remote = { revision: number; workspace: FiletStudioWorkspace | null };
type Pending = { operationId: string; baseRevision: number; workspace: FiletStudioWorkspace };
type Outbox = { revision: number; acknowledgedDigest?: string; pending?: Pending };
type Status = "local" | "syncing" | "confirmed" | "offline" | "conflict" | "error";

async function digest(workspace: FiletStudioWorkspace) {
  const bytes = new TextEncoder().encode(JSON.stringify(workspace));
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(result), byte => byte.toString(16).padStart(2, "0")).join("");
}

function readOutbox(key: string): Outbox {
  const raw = window.localStorage.getItem(key);
  if (!raw) return { revision: 0 };
  const state = JSON.parse(raw) as Outbox;
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 ||
      (state.pending && (typeof state.pending.operationId !== "string" ||
        state.pending.baseRevision !== state.revision || !isValidFiletWorkspace(state.pending.workspace)))) {
    throw new Error("Cola de sincronización inválida");
  }
  return state;
}

async function readRemote(signal: AbortSignal): Promise<Remote> {
  const response = await fetch("/api/filet/workspace", { cache: "no-store", signal });
  if (!response.ok) throw new Error("Sincronización remota no disponible");
  const remote = await response.json() as Remote;
  if (!Number.isSafeInteger(remote.revision) || remote.revision < 0 ||
      (remote.workspace !== null && !isValidFiletWorkspace(remote.workspace))) {
    throw new Error("Respuesta de sincronización inválida");
  }
  return remote;
}

export function useFiletWorkspaceSync(
  owner: string | undefined,
  workspace: FiletStudioWorkspace,
  applyRemote: (workspace: FiletStudioWorkspace) => void,
) {
  const key = isOfflineOwner(owner) ? `oakhaven_filet_sync_v1_${encodeURIComponent(owner)}` : null;
  const [status, setStatus] = useState<Status>("local");
  const [conflict, setConflict] = useState<{ key: string; remote: Remote } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!key || conflict?.key === key) return;
    const scopedKey = key;
    const controller = new AbortController();
    const { signal } = controller;
    let timer: number | undefined;
    let failures = 0;

    async function sync() {
      if (signal.aborted) return;
      try {
        const state = readOutbox(scopedKey);
        // Read through the existing owner-scoped store, never from another render.
        const local = readFiletStudioWorkspace(safeLocalStorage, owner);
        const localDigest = local ? await digest(local) : null;
        if (signal.aborted) return;
        const onlineNow = navigator.onLine;
        if (!state.pending && localDigest !== null && state.acknowledgedDigest === localDigest) {
          if (!onlineNow) {
            setStatus("offline");
            return;
          }
          const remote = await readRemote(signal);
          if (signal.aborted) return;
          if (remote.revision !== state.revision) {
            setConflict({ key: scopedKey, remote });
            setStatus("conflict");
          } else {
            failures = 0;
            setStatus("confirmed");
            timer = window.setTimeout(sync, 30_000);
          }
          return;
        }
        if (!state.pending && (state.revision === 0 || !local)) {
          if (onlineNow) {
            const remote = await readRemote(signal);
            if (signal.aborted) return;
            if (remote.revision > 0) {
              setConflict({ key: scopedKey, remote });
              setStatus("conflict");
              return;
            }
          }
          if (!local) {
            setStatus(onlineNow ? "local" : "offline");
            return;
          }
        }
        let pending = state.pending;
        if (!pending) {
          if (!local) return;
          pending = { operationId: crypto.randomUUID(), baseRevision: state.revision, workspace: local };
        }
        const serialized = JSON.stringify({ ...state, pending });
        if (new TextEncoder().encode(serialized).byteLength > 5 * 1024 * 1024) {
          throw new Error("La cola de sincronización supera el límite");
        }
        window.localStorage.setItem(scopedKey, serialized);
        if (!onlineNow) {
          setStatus("offline");
          return;
        }
        setStatus("syncing");
        const response = await fetch("/api/filet/workspace", {
          method: "POST", signal,
          headers: { "content-type": "application/json", "x-oakhaven-filet-write": "1" },
          body: JSON.stringify(pending),
        });
        if (signal.aborted) return;
        if (response.status === 409) {
          const remote = await readRemote(signal);
          if (!signal.aborted) {
            setConflict({ key: scopedKey, remote });
            setStatus("conflict");
          }
          return;
        }
        if (!response.ok) {
          if (response.status < 500) {
            setStatus("error");
            return;
          }
          throw new Error("Sin confirmación del servidor");
        }
        const receipt = await response.json();
        if (signal.aborted) return;
        if (!["applied", "replayed"].includes(receipt.status) || receipt.revision !== pending.baseRevision + 1) {
          throw new Error("Recibo de sincronización inválido");
        }
        const acknowledgedDigest = await digest(pending.workspace);
        if (signal.aborted) return;
        // A parallel tab may already have advanced the queue.
        if (readOutbox(scopedKey).pending?.operationId !== pending.operationId) return;
        window.localStorage.setItem(scopedKey, JSON.stringify({
          revision: receipt.revision, acknowledgedDigest,
        } satisfies Outbox));
        failures = 0;
        setStatus("confirmed");
        if (localDigest !== null && localDigest !== acknowledgedDigest) timer = window.setTimeout(sync, 0);
      } catch {
        if (signal.aborted) return;
        setStatus(navigator.onLine ? "error" : "offline");
        if (++failures <= 4) timer = window.setTimeout(sync, 1000 * 2 ** (failures - 1));
      }
    }

    const online = () => setRetry(value => value + 1);
    window.addEventListener("online", online);
    timer = window.setTimeout(sync, 600);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
      window.removeEventListener("online", online);
    };
  }, [key, owner, workspace, retry, conflict]);

  const resolveConflict = useCallback(async (choice: "local" | "remote") => {
    if (!key || conflict?.key !== key) return;
    try {
      const latest = readFiletStudioWorkspaceSafe(owner);
      const { remote } = conflict;
      if (choice === "remote" && remote.workspace) {
        window.localStorage.setItem(`${key}_recovery_${crypto.randomUUID()}`, JSON.stringify(latest));
        const saved = saveFiletStudioWorkspaceSafe(owner, remote.workspace);
        if (!saved.ok) throw new Error(saved.error);
        window.localStorage.setItem(key, JSON.stringify({
          revision: remote.revision, acknowledgedDigest: await digest(saved.workspace),
        } satisfies Outbox));
        applyRemote(saved.workspace);
      } else {
        const pending = { operationId: crypto.randomUUID(), baseRevision: remote.revision, workspace: latest };
        window.localStorage.setItem(key, JSON.stringify({ revision: remote.revision, pending } satisfies Outbox));
      }
      setConflict(null);
      setRetry(value => value + 1);
    } catch {
      setStatus("error");
    }
  }, [key, owner, conflict, applyRemote]);

  return {
    status: key ? status : "local",
    remote: conflict?.key === key ? conflict.remote : null,
    resolveConflict,
    retry: () => setRetry(value => value + 1),
  };
}
