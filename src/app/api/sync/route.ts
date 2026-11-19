import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import {
  isDemoSyncRecord,
  MAX_SYNC_PAYLOAD_BYTES,
  type SyncEntityDomain,
  type SyncRecordEnvelope,
} from "@/lib/sync/universal-sync-engine";
import {
  listLocalSyncedRecords,
  upsertLocalSyncedRecord,
} from "@/lib/sync/local-sync-memory";

const ALLOWED_DOMAINS = new Set<SyncEntityDomain>([
  "gym_sets",
  "work_projects",
  "work_tasks",
  "rubik_cubes",
]);

function isValidDomain(val: string): val is SyncEntityDomain {
  return ALLOWED_DOMAINS.has(val as SyncEntityDomain);
}

/**
 * GET /api/sync?domain=gym_sets|work_projects|work_tasks|rubik_cubes
 * Recupera registros sincronizados del usuario autenticado (con degradación segura
 * si las tablas aditivas de Fase 8 aún no han sido ejecutadas en Supabase).
 */
export async function GET(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  if (process.env.OAKHAVEN_SYNC_ENABLED === "false") {
    return NextResponse.json({
      success: true,
      synced: false,
      syncDisabled: true,
      status: "PENDIENTE_DE_SINCRONIZAR",
      records: [],
      notice: "Sincronización en nube pausada por kill-switch (OAKHAVEN_SYNC_ENABLED=false); tus datos locales permanecen intactos.",
    });
  }

  const url = new URL(req.url);
  const domain = (url.searchParams.get("domain") || "").trim();
  if (!isValidDomain(domain)) {
    return NextResponse.json(
      { success: false, error: "Dominio de sincronización inválido." },
      { status: 400 }
    );
  }

  if (mode !== "supabase" || !db) {
    return NextResponse.json({
      success: true,
      synced: false,
      status: "PENDIENTE_DE_SINCRONIZAR",
      domain,
      records: listLocalSyncedRecords(userId, domain),
    });
  }

  const tableName =
    domain === "gym_sets"
      ? "gym_workout_sets"
      : domain === "work_projects"
      ? "work_projects"
      : domain === "work_tasks"
      ? "work_project_tasks"
      : "rubik_cubes";

  const { data, error } = await db
    .from(tableName)
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({
      success: true,
      synced: false,
      migrationPending: true,
      status: "PENDIENTE_DE_SINCRONIZAR",
      domain,
      records: [],
      notice: `La tabla "${tableName}" aún requiere aprobación y ejecución de la migración SQL de Fase 8 en Supabase.`,
    });
  }

  return NextResponse.json({
    success: true,
    synced: true,
    status: "SINCRONIZADO",
    domain,
    records: data || [],
  });
}

/**
 * POST /api/sync
 * Sincronización incremental idempotente con lista blanca de campos (previene mass assignment),
 * exclusión de demos y límite estricto de tamaño por solicitud (256 KB).
 */
export async function POST(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  if (process.env.OAKHAVEN_SYNC_ENABLED === "false") {
    return NextResponse.json({
      success: true,
      synced: false,
      syncDisabled: true,
      status: "PENDIENTE_DE_SINCRONIZAR",
      records: [],
      notice: "Sincronización en nube pausada por kill-switch (OAKHAVEN_SYNC_ENABLED=false); tus datos locales permanecen intactos.",
    });
  }

  const rawText = await req.text();
  if (Buffer.byteLength(rawText, "utf8") > MAX_SYNC_PAYLOAD_BYTES) {
    return NextResponse.json(
      { success: false, error: "La solicitud excede el límite máximo de 256 KB." },
      { status: 413 }
    );
  }

  let body: { domain?: string; records?: SyncRecordEnvelope[] };
  try {
    body = JSON.parse(rawText);
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido." }, { status: 400 });
  }

  const domain = String(body.domain || "").trim();
  if (!isValidDomain(domain)) {
    return NextResponse.json(
      { success: false, error: "Dominio de sincronización no permitido." },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.records) || body.records.length === 0 || body.records.length > 50) {
    return NextResponse.json(
      { success: false, error: "Envía entre 1 y 50 registros válidos para sincronizar." },
      { status: 400 }
    );
  }

  // Filtrar estrictamente registros demo y forzar ownerId = userId autenticado del servidor
  const cleanRecords = body.records.filter(
    (r) => r && typeof r.clientId === "string" && r.clientId.trim().length > 0 && !isDemoSyncRecord(r)
  );

  if (cleanRecords.length === 0) {
    return NextResponse.json({
      success: true,
      synced: false,
      status: "SINCRONIZADO",
      appliedCount: 0,
      conflicts: [],
      notice: "Todos los registros enviados eran plantillas demostrativas y fueron excluidos.",
    });
  }

  if (mode !== "supabase" || !db) {
    const applied: SyncRecordEnvelope[] = [];
    const conflicts: Array<{ clientId: string; remoteRecord: SyncRecordEnvelope }> = [];
    for (const rec of cleanRecords) {
      const res = upsertLocalSyncedRecord(userId, domain, {
        ...rec,
        ownerId: userId,
        domain,
        version: Math.max(1, Math.floor(Number(rec.version) || 1)),
        updatedAt: rec.updatedAt || new Date().toISOString(),
      });
      if (res.ok) applied.push(res.record);
      else conflicts.push({ clientId: rec.clientId, remoteRecord: res.conflict });
    }
    return NextResponse.json({
      success: true,
      synced: false,
      status: conflicts.length > 0 ? "CONFLICTO_REQUIERE_REVISION" : "PENDIENTE_DE_SINCRONIZAR",
      appliedCount: applied.length,
      conflicts,
    });
  }

  // Modo Supabase: Compare-And-Swap (CAS) atómico por (user_id, client_id, version) — cero pérdidas silenciosas
  if (domain === "gym_sets") {
    let appliedCount = 0;
    const conflicts: Array<{ clientId: string; expectedVersion: number; reason: string }> = [];

    for (const r of cleanRecords) {
      const cid = r.clientId.slice(0, 120);
      const expectedVersion = (r as SyncRecordEnvelope & { expectedVersion?: number }).expectedVersion;
      const baseFields = {
        session_id: r.payload.sessionId ? String(r.payload.sessionId).slice(0, 120) : null,
        exercise_name: String(r.payload.exerciseName || "Ejercicio").slice(0, 160),
        set_number: Math.max(1, Math.min(100, Math.floor(Number(r.payload.setNumber) || 1))),
        reps: Math.max(0, Math.min(1000, Math.floor(Number(r.payload.reps) || 0))),
        weight_kg: Math.max(0, Math.min(1500, Number(r.payload.weightKg) || 0)),
        rpe: Math.max(1, Math.min(10, Number(r.payload.rpe) || 7)),
        completed: Boolean(r.payload.completed),
        deleted_at: r.deletedAt || null,
      };

      if (typeof expectedVersion === "number" && expectedVersion >= 1) {
        const { data: updated, error: updErr } = await db
          .from("gym_workout_sets")
          .update({ ...baseFields, version: expectedVersion + 1 })
          .eq("user_id", userId)
          .eq("client_id", cid)
          .eq("version", expectedVersion)
          .select("client_id, version");

        if (updErr) {
          return NextResponse.json({
            success: true,
            synced: false,
            migrationPending: true,
            status: "PENDIENTE_DE_SINCRONIZAR",
            notice: "Migración SQL de gym_workout_sets pendiente de aprobación/ejecución en Supabase.",
          });
        }
        if (!updated || updated.length === 0) {
          conflicts.push({
            clientId: cid,
            expectedVersion,
            reason: "Conflicto CAS: otro dispositivo ya actualizó esta versión.",
          });
          continue;
        }
        appliedCount += 1;
      } else {
        const { error: insErr } = await db.from("gym_workout_sets").insert({
          user_id: userId,
          client_id: cid,
          ...baseFields,
          version: 1,
        });
        if (insErr) {
          if (insErr.code === "23505") {
            conflicts.push({
              clientId: cid,
              expectedVersion: 0,
              reason: "Conflicto de inserción concurrente (client_id ya existe en nube).",
            });
            continue;
          }
          return NextResponse.json({
            success: true,
            synced: false,
            migrationPending: true,
            status: "PENDIENTE_DE_SINCRONIZAR",
            notice: "Migración SQL de gym_workout_sets pendiente de aprobación/ejecución en Supabase.",
          });
        }
        appliedCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      synced: conflicts.length === 0,
      status: conflicts.length > 0 ? "CONFLICTO_REQUIERE_REVISION" : "SINCRONIZADO",
      appliedCount,
      conflicts,
    });
  }

  if (domain === "work_projects") {
    let appliedCount = 0;
    const conflicts: Array<{ clientId: string; expectedVersion: number; reason: string }> = [];

    for (const r of cleanRecords) {
      const cid = r.clientId.slice(0, 120);
      const expectedVersion = (r as SyncRecordEnvelope & { expectedVersion?: number }).expectedVersion;
      const baseFields = {
        name: String(r.payload.name || "Proyecto").slice(0, 180),
        description: String(r.payload.description || "").slice(0, 800),
        methodology: ["none", "scrum", "kanban", "lean"].includes(String(r.payload.methodology))
          ? String(r.payload.methodology)
          : "kanban",
        current_stage: String(r.payload.currentStage || "En progreso").slice(0, 80),
        status: ["active", "completed", "on_hold", "archived"].includes(String(r.payload.status))
          ? String(r.payload.status)
          : "active",
        work_scope: r.payload.workScope === "personal" ? "personal" : "professional",
        deleted_at: r.deletedAt || null,
      };

      if (typeof expectedVersion === "number" && expectedVersion >= 1) {
        const { data: updated, error: updErr } = await db
          .from("work_projects")
          .update({ ...baseFields, version: expectedVersion + 1 })
          .eq("user_id", userId)
          .eq("client_id", cid)
          .eq("version", expectedVersion)
          .select("client_id, version");

        if (updErr) {
          return NextResponse.json({
            success: true,
            synced: false,
            migrationPending: true,
            status: "PENDIENTE_DE_SINCRONIZAR",
            notice: "Migración SQL de work_projects pendiente de aprobación/ejecución en Supabase.",
          });
        }
        if (!updated || updated.length === 0) {
          conflicts.push({
            clientId: cid,
            expectedVersion,
            reason: "Conflicto CAS: otro dispositivo ya modificó este proyecto.",
          });
          continue;
        }
        appliedCount += 1;
      } else {
        const { error: insErr } = await db.from("work_projects").insert({
          user_id: userId,
          client_id: cid,
          ...baseFields,
          version: 1,
        });
        if (insErr) {
          if (insErr.code === "23505") {
            conflicts.push({
              clientId: cid,
              expectedVersion: 0,
              reason: "Conflicto de inserción concurrente (client_id ya existe en nube).",
            });
            continue;
          }
          return NextResponse.json({
            success: true,
            synced: false,
            migrationPending: true,
            status: "PENDIENTE_DE_SINCRONIZAR",
            notice: "Migración SQL de work_projects pendiente de aprobación/ejecución en Supabase.",
          });
        }
        appliedCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      synced: conflicts.length === 0,
      status: conflicts.length > 0 ? "CONFLICTO_REQUIERE_REVISION" : "SINCRONIZADO",
      appliedCount,
      conflicts,
    });
  }

  if (domain === "rubik_cubes") {
    let appliedCount = 0;
    const conflicts: Array<{ clientId: string; expectedVersion: number; reason: string }> = [];
    for (const r of cleanRecords) {
      const cubeId = r.clientId.slice(0, 50);
      const expectedVersion = Math.max(
        1,
        Math.floor(Number((r as SyncRecordEnvelope & { expectedVersion?: number }).expectedVersion ?? r.version) || 1)
      );
      const { data: updated, error: updErr } = await db
        .from("rubik_cubes")
        .update({
          tension_notes: String(r.payload.tensionNotes || "").slice(0, 400),
          lube_notes: String(r.payload.lubeNotes || "").slice(0, 400),
          maintenance_needs: String(r.payload.maintenanceNeeds || "").slice(0, 400),
          custom_notes: String(r.payload.customNotes || "").slice(0, 800),
          algorithms_to_master: String(r.payload.algorithmsToMaster || "").slice(0, 600),
          sync_version: expectedVersion + 1,
        })
        .eq("user_id", userId)
        .eq("cube_id", cubeId)
        .eq("sync_version", expectedVersion)
        .select("cube_id, sync_version");

      if (updErr) {
        return NextResponse.json({
          success: true,
          synced: false,
          migrationPending: true,
          status: "PENDIENTE_DE_SINCRONIZAR",
          notice: "Columnas aditivas de rubik_cubes pendientes de migración SQL en Supabase.",
        });
      }
      if (!updated || updated.length === 0) {
        conflicts.push({
          clientId: cubeId,
          expectedVersion,
          reason: "Conflicto CAS en rubik_cubes: otro dispositivo ya actualizó estas notas.",
        });
        continue;
      }
      appliedCount += 1;
    }

    return NextResponse.json({
      success: true,
      synced: conflicts.length === 0,
      status: conflicts.length > 0 ? "CONFLICTO_REQUIERE_REVISION" : "SINCRONIZADO",
      appliedCount,
      conflicts,
    });
  }

  // work_tasks
  return NextResponse.json({
    success: true,
    synced: false,
    migrationPending: true,
    status: "PENDIENTE_DE_SINCRONIZAR",
    notice: `Sincronización remota de "${domain}" lista para activarse tras aplicar la migración SQL de Fase 8.`,
  });
}
