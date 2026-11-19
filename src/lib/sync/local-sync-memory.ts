/**
 * Almacén en memoria aislado por `userId` para pruebas locales (`local_engine` / demo)
 * del endpoint `/api/sync`. Nunca se utiliza cuando Supabase está activo.
 */

import type { SyncEntityDomain, SyncRecordEnvelope } from "./universal-sync-engine.ts";

const GLOBAL_KEY = "__oakhaven_local_sync_memory_v1__";

function getMap(): Map<string, SyncRecordEnvelope[]> {
  const g = globalThis as unknown as Record<string, Map<string, SyncRecordEnvelope[]> | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map<string, SyncRecordEnvelope[]>();
  return g[GLOBAL_KEY]!;
}

function bucketKey(userId: string, domain: SyncEntityDomain): string {
  return `${userId}::${domain}`;
}

export function listLocalSyncedRecords(userId: string, domain: SyncEntityDomain): SyncRecordEnvelope[] {
  return [...(getMap().get(bucketKey(userId, domain)) || [])];
}

export function upsertLocalSyncedRecord(
  userId: string,
  domain: SyncEntityDomain,
  incoming: SyncRecordEnvelope & { expectedVersion?: number }
): { ok: true; record: SyncRecordEnvelope } | { ok: false; conflict: SyncRecordEnvelope } {
  const map = getMap();
  const key = bucketKey(userId, domain);
  const list = map.get(key) || [];
  const idx = list.findIndex((r) => r.clientId === incoming.clientId);

  if (idx === -1) {
    const saved: SyncRecordEnvelope = {
      ...incoming,
      ownerId: userId,
      domain,
      version: Math.max(1, Math.floor(Number(incoming.version) || 1)),
      dataOrigin: "real_synced",
    };
    map.set(key, [saved, ...list]);
    return { ok: true, record: saved };
  }

  const existing = list[idx];
  // Control atómico Compare-And-Swap (CAS): si expectedVersion no coincide con la versión actual -> conflicto
  if (
    typeof incoming.expectedVersion === "number" &&
    existing.version !== incoming.expectedVersion
  ) {
    return { ok: false, conflict: existing };
  }
  if (incoming.version < existing.version) {
    return { ok: false, conflict: existing };
  }

  const nextVersion =
    typeof incoming.expectedVersion === "number"
      ? existing.version + 1
      : Math.max(existing.version, incoming.version);

  const updated: SyncRecordEnvelope = {
    ...incoming,
    ownerId: userId,
    domain,
    version: nextVersion,
    dataOrigin: "real_synced",
  };
  const next = [...list];
  next[idx] = updated;
  map.set(key, next);
  return { ok: true, record: updated };
}
