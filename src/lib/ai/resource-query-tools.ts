/**
 * ============================================================================
 * HERRAMIENTAS DE CONSULTA DE RECURSOS PARA ROWAN Y ESPECIALISTAS (HITO 2.6)
 * ============================================================================
 * - Identidad resuelta siempre en el servidor (`authenticatedUserId`).
 * - Aislamiento estricto por propietario y por edificio del especialista.
 * - Documentos financieros sensibles (`is_sensitive_financial`) bloqueados del
 *   contexto de texto automático de la IA (solo metadatos básicos para Rowan).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getSkillByBuildingId, MAYOR_ROWAN_SKILL } from "./building-skills-registry.ts";
import {
  extractAndSanitizeDocumentText,
  type PrivateBuildingResource,
} from "./building-resources-engine.ts";

export interface ResourceQueryContext {
  authenticatedUserId: string;
  db: SupabaseClient | null;
  isSupabaseConfigured: boolean;
  /** Repositorio en memoria para pruebas o fallback cuando no hay Supabase */
  memoryResources?: PrivateBuildingResource[];
}

export interface ResourceQueryResult<T = unknown> {
  ok: boolean;
  blocked?: boolean;
  source: "supabase" | "memory" | "none";
  asOf: string;
  data: T | null;
  error?: string;
}

function canSkillAccessBuilding(callerSkillId: string, targetBuildingId: string): boolean {
  if (callerSkillId === MAYOR_ROWAN_SKILL.skillId) return true;
  const targetSkill = getSkillByBuildingId(targetBuildingId);
  return Boolean(targetSkill && targetSkill.skillId === callerSkillId);
}

async function fetchOwnedResources(
  ctx: ResourceQueryContext,
  filter?: { buildingId?: string; projectId?: string; resourceId?: string; limit?: number }
): Promise<{ source: "supabase" | "memory" | "none"; items: PrivateBuildingResource[]; error?: string }> {
  const limit = Math.min(25, Math.max(1, filter?.limit || 15));

  if (ctx.isSupabaseConfigured && ctx.db) {
    let query = ctx.db
      .from("building_resources")
      .select("*")
      .eq("user_id", ctx.authenticatedUserId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(limit);

    if (filter?.buildingId) query = query.eq("building_id", filter.buildingId);
    if (filter?.projectId) query = query.eq("project_id", filter.projectId);
    if (filter?.resourceId) query = query.eq("id", filter.resourceId);

    const { data, error } = await query;
    if (error) {
      return { source: "supabase", items: [], error: "No se pudieron consultar los recursos en Supabase." };
    }
    const mapped: PrivateBuildingResource[] = ((data as Array<Record<string, unknown>>) || []).map((r) => ({
      id: String(r.id),
      owner_id: String(r.user_id),
      building_id: String(r.building_id),
      resource_type: String(r.resource_type || r.resource_category || "note"),
      activity_id: r.activity_id ? String(r.activity_id) : null,
      project_id: r.project_id ? String(r.project_id) : null,
      title: String(r.title || ""),
      description: String(r.description || ""),
      original_filename: String(r.original_filename || ""),
      storage_path: r.storage_path ? String(r.storage_path) : null,
      mime_type: String(r.mime_type || ""),
      size_bytes: Number(r.size_bytes || 0),
      metadata: (r.metadata as Record<string, unknown>) || {},
      tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
      created_at: String(r.created_at),
      updated_at: String(r.updated_at),
      deleted_at: r.deleted_at ? String(r.deleted_at) : null,
      processing_status: (r.processing_status as PrivateBuildingResource["processing_status"]) || "ready",
      extraction_status: (r.extraction_status as PrivateBuildingResource["extraction_status"]) || "not_applicable",
      extraction_error: r.extraction_error ? String(r.extraction_error) : null,
      extracted_text: r.extracted_text ? String(r.extracted_text) : null,
      content_hash: r.content_hash ? String(r.content_hash) : null,
      is_sensitive_financial: Boolean(r.is_sensitive_financial || r.building_id === "banco_oakhaven"),
      sync_state: "SINCRONIZADO",
    }));
    return { source: "supabase", items: mapped };
  }

  const mem = (ctx.memoryResources || []).filter(
    (r) => r.owner_id === ctx.authenticatedUserId && !r.deleted_at
  );
  const filtered = mem
    .filter((r) => (!filter?.buildingId || r.building_id === filter.buildingId))
    .filter((r) => (!filter?.projectId || r.project_id === filter.projectId))
    .filter((r) => (!filter?.resourceId || r.id === filter.resourceId))
    .sort((a, b) => (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0))
    .slice(0, limit);

  return { source: "memory", items: filtered };
}

function stripSensitivePayload(r: PrivateBuildingResource) {
  return {
    id: r.id,
    building_id: r.building_id,
    resource_type: r.resource_type,
    project_id: r.project_id,
    title: r.title,
    description: r.description,
    original_filename: r.original_filename,
    mime_type: r.mime_type,
    size_bytes: r.size_bytes,
    tags: r.tags,
    created_at: r.created_at,
    updated_at: r.updated_at,
    extraction_status: r.extraction_status,
    is_sensitive_financial: r.is_sensitive_financial,
    sync_state: r.sync_state,
  };
}

export async function listBuildingResources(
  ctx: ResourceQueryContext,
  buildingId: string,
  callerSkillId: string = MAYOR_ROWAN_SKILL.skillId
): Promise<ResourceQueryResult> {
  const asOf = new Date().toISOString();
  if (!canSkillAccessBuilding(callerSkillId, buildingId)) {
    return {
      ok: false,
      blocked: true,
      source: "none",
      asOf,
      data: null,
      error: `El especialista "${callerSkillId}" no tiene permiso para consultar recursos de "${buildingId}".`,
    };
  }
  const { source, items, error } = await fetchOwnedResources(ctx, { buildingId, limit: 20 });
  if (error) return { ok: false, source, asOf, data: null, error };
  return { ok: true, source, asOf, data: items.map(stripSensitivePayload) };
}

export async function getResourceMetadata(
  ctx: ResourceQueryContext,
  resourceId: string,
  callerSkillId: string = MAYOR_ROWAN_SKILL.skillId
): Promise<ResourceQueryResult> {
  const asOf = new Date().toISOString();
  const { source, items, error } = await fetchOwnedResources(ctx, { resourceId, limit: 1 });
  if (error) return { ok: false, source, asOf, data: null, error };
  const item = items[0];
  if (!item) return { ok: false, source, asOf, data: null, error: "Recurso no encontrado o sin permisos." };
  if (!canSkillAccessBuilding(callerSkillId, item.building_id)) {
    return {
      ok: false,
      blocked: true,
      source,
      asOf,
      data: null,
      error: `Aislamiento activo: "${callerSkillId}" no puede consultar metadatos de "${item.building_id}".`,
    };
  }
  return { ok: true, source, asOf, data: stripSensitivePayload(item) };
}

export async function getProjectResources(
  ctx: ResourceQueryContext,
  projectId: string,
  callerSkillId: string = MAYOR_ROWAN_SKILL.skillId
): Promise<ResourceQueryResult> {
  const asOf = new Date().toISOString();
  const { source, items, error } = await fetchOwnedResources(ctx, { projectId, limit: 20 });
  if (error) return { ok: false, source, asOf, data: null, error };
  const allowed = items.filter((r) => canSkillAccessBuilding(callerSkillId, r.building_id));
  return { ok: true, source, asOf, data: allowed.map(stripSensitivePayload) };
}

export async function getRecentResources(
  ctx: ResourceQueryContext,
  buildingId: string,
  callerSkillId: string = MAYOR_ROWAN_SKILL.skillId
): Promise<ResourceQueryResult> {
  return listBuildingResources(ctx, buildingId, callerSkillId);
}

export async function getResourceExtractedText(
  ctx: ResourceQueryContext,
  resourceId: string,
  callerSkillId: string
): Promise<ResourceQueryResult<{ resourceId: string; text: string; promptInjectionDetected: boolean }>> {
  const asOf = new Date().toISOString();
  const { source, items, error } = await fetchOwnedResources(ctx, { resourceId, limit: 1 });
  if (error) return { ok: false, source, asOf, data: null, error };
  const item = items[0];
  if (!item) return { ok: false, source, asOf, data: null, error: "Recurso no encontrado." };

  if (!canSkillAccessBuilding(callerSkillId, item.building_id)) {
    return {
      ok: false,
      blocked: true,
      source,
      asOf,
      data: null,
      error: `Aislamiento entre especialistas: "${callerSkillId}" no puede leer documentos de "${item.building_id}".`,
    };
  }

  // Protección estricta: documentos financieros sensibles nunca entran automáticamente al contexto de texto de IA
  if (item.is_sensitive_financial || item.building_id === "banco_oakhaven") {
    return {
      ok: false,
      blocked: true,
      source,
      asOf,
      data: null,
      error: "Documento financiero sensible: excluido de la lectura automática de texto por IA.",
    };
  }

  const sanitized = extractAndSanitizeDocumentText({
    rawText: item.extracted_text || "",
    isFinancialSensitive: false,
  });

  return {
    ok: true,
    source,
    asOf,
    data: {
      resourceId: item.id,
      text: sanitized.sanitizedText || "",
      promptInjectionDetected: sanitized.promptInjectionDetected,
    },
  };
}

export async function searchOwnResources(
  ctx: ResourceQueryContext,
  query: string,
  buildingId?: string,
  callerSkillId: string = MAYOR_ROWAN_SKILL.skillId
): Promise<ResourceQueryResult> {
  const asOf = new Date().toISOString();
  if (buildingId && !canSkillAccessBuilding(callerSkillId, buildingId)) {
    return {
      ok: false,
      blocked: true,
      source: "none",
      asOf,
      data: null,
      error: `Especialista "${callerSkillId}" sin acceso a "${buildingId}".`,
    };
  }
  const { source, items, error } = await fetchOwnedResources(ctx, { buildingId, limit: 25 });
  if (error) return { ok: false, source, asOf, data: null, error };
  const q = (query || "").trim().toLowerCase();
  const matches = items
    .filter((r) => canSkillAccessBuilding(callerSkillId, r.building_id))
    .filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        (!r.is_sensitive_financial && (r.extracted_text || "").toLowerCase().includes(q))
    );
  return { ok: true, source, asOf, data: matches.map(stripSensitivePayload) };
}
