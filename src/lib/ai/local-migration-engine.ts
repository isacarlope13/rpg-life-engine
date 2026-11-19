/**
 * ============================================================================
 * MOTOR DE MIGRACIÓN INCREMENTAL DESDE LOCALSTORAGE Y DETECCIÓN DE CONFLICTOS
 * ============================================================================
 * REGLAS DE PROTECCIÓN DE DATOS:
 * 1. Nunca borra automáticamente localStorage tras sincronizar.
 * 2. Nunca reemplaza datos remotos con arreglos vacíos.
 * 3. Nunca importa registros pertenecientes a otra cuenta.
 * 4. Genera copia de seguridad exportable antes de migrar.
 * 5. Detecta duplicados y conflictos entre dispositivos sin sobrescribir en silencio.
 */

import type { CinemaEntry } from "../sanctuary/cinema-store.ts";
import type { AtelierProjectPattern } from "../sanctuary/atelier-patterns-store.ts";
import type { SyncLifecycleState } from "./building-resources-engine.ts";

export interface MigrationConflict<T> {
  key: string;
  localItem: T;
  remoteItem: T;
  reason: string;
}

export interface MigrationPlan<T> {
  ownerId: string;
  backupJson: string;
  toImport: T[];
  alreadySynced: T[];
  conflicts: MigrationConflict<T>[];
  syncState: SyncLifecycleState;
}

export function buildCinemaMigrationPlan(params: {
  authenticatedUserId: string;
  localOwnerId: string;
  localEntries: CinemaEntry[];
  remoteEntries: CinemaEntry[];
}): MigrationPlan<CinemaEntry> {
  if (!params.authenticatedUserId || params.localOwnerId !== params.authenticatedUserId) {
    throw new Error("Bloqueado: los datos locales pertenecen a otra cuenta y no pueden importarse.");
  }

  const backupJson = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      ownerId: params.authenticatedUserId,
      kind: "oakhaven_cinema_local_backup_v1",
      count: params.localEntries.length,
      entries: params.localEntries,
    },
    null,
    2
  );

  const remoteByFingerprint = new Map<string, CinemaEntry>();
  for (const r of params.remoteEntries) {
    const fp = `${r.kind}:${r.title.trim().toLowerCase()}`;
    remoteByFingerprint.set(fp, r);
    remoteByFingerprint.set(r.id, r);
  }

  const toImport: CinemaEntry[] = [];
  const alreadySynced: CinemaEntry[] = [];
  const conflicts: MigrationConflict<CinemaEntry>[] = [];

  for (const local of params.localEntries) {
    const fp = `${local.kind}:${local.title.trim().toLowerCase()}`;
    const remote = remoteByFingerprint.get(local.id) || remoteByFingerprint.get(fp);
    if (!remote) {
      toImport.push(local);
      continue;
    }

    const sameStatus = remote.status === local.status;
    const sameEpisode = (remote.episode || 0) === (local.episode || 0);
    const sameNotes = (remote.notes || "").trim() === (local.notes || "").trim();

    if (sameStatus && sameEpisode && sameNotes) {
      alreadySynced.push(local);
    } else {
      conflicts.push({
        key: fp,
        localItem: local,
        remoteItem: remote,
        reason: "Cambios divergentes entre el navegador local y la nube (requiere decisión del usuario).",
      });
    }
  }

  const syncState: SyncLifecycleState =
    conflicts.length > 0
      ? "CONFLICTO"
      : toImport.length > 0
      ? "PENDIENTE_SINCRONIZACION"
      : params.remoteEntries.length > 0
      ? "SINCRONIZADO"
      : "GUARDADO_LOCALMENTE";

  return {
    ownerId: params.authenticatedUserId,
    backupJson,
    toImport,
    alreadySynced,
    conflicts,
    syncState,
  };
}

export function buildCrochetPatternsBackupJson(
  authenticatedUserId: string,
  patterns: Record<string, AtelierProjectPattern>
): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      ownerId: authenticatedUserId,
      kind: "oakhaven_crochet_patterns_local_backup_v1",
      count: Object.keys(patterns).length,
      patterns,
    },
    null,
    2
  );
}
