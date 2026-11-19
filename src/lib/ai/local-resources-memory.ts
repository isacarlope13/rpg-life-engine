/**
 * Almacenamiento en memoria aislado por `userId` para el modo local (`local_engine` / demo).
 * Nunca se utiliza cuando Supabase está activo (`mode === "supabase"`).
 * Permite validar flujos E2E completos (POST -> GET tras recarga -> DELETE lógico -> PATCH restore)
 * sin tocar la base de datos de producción ni datos personales reales.
 */

import type { PrivateBuildingResource } from "./building-resources-engine.ts";

const globalKey = "__oakhaven_local_resources_by_user__";

function getStoreMap(): Map<string, PrivateBuildingResource[]> {
  const g = globalThis as unknown as Record<string, Map<string, PrivateBuildingResource[]> | undefined>;
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, PrivateBuildingResource[]>();
  }
  return g[globalKey]!;
}

export function listLocalUserResources(
  userId: string,
  opts?: { buildingId?: string; archivedOnly?: boolean }
): PrivateBuildingResource[] {
  const list = getStoreMap().get(userId) || [];
  return list.filter((r) => {
    if (opts?.buildingId && r.building_id !== opts.buildingId) return false;
    if (opts?.archivedOnly) return Boolean(r.deleted_at);
    return !r.deleted_at;
  });
}

export function addLocalUserResource(
  userId: string,
  resource: PrivateBuildingResource
): { duplicate?: PrivateBuildingResource } {
  const map = getStoreMap();
  const list = map.get(userId) || [];
  const hash = (resource.metadata as { content_hash?: string } | undefined)?.content_hash;
  if (hash) {
    const dup = list.find(
      (r) =>
        !r.deleted_at &&
        r.building_id === resource.building_id &&
        (r.metadata as { content_hash?: string } | undefined)?.content_hash === hash
    );
    if (dup) return { duplicate: dup };
  }
  map.set(userId, [resource, ...list]);
  return {};
}

export function archiveLocalUserResource(userId: string, id: string): boolean {
  const list = getStoreMap().get(userId) || [];
  const target = list.find((r) => r.id === id);
  if (!target) return false;
  target.deleted_at = new Date().toISOString();
  target.updated_at = target.deleted_at;
  return true;
}

export function restoreLocalUserResource(userId: string, id: string): boolean {
  const list = getStoreMap().get(userId) || [];
  const target = list.find((r) => r.id === id);
  if (!target) return false;
  target.deleted_at = null;
  target.updated_at = new Date().toISOString();
  return true;
}
