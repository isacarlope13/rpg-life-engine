import { NextResponse } from "next/server";
import { resolveAuthenticatedUser } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { getGuidedRowInstruction, validateLinkedFiletPatternSnapshot } from "@/lib/sanctuary/filet-guided-engine";
import { isAuthorizedSupabaseUserId } from "@/lib/single-user-guard";
import { supabaseAdmin } from "@/lib/supabase";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(request: Request) {
  const session = await resolveAuthenticatedUser(request);
  if (session?.mode !== "supabase" || !session.userClient || !isAuthorizedSupabaseUserId(session.userId)) {
    return reply({ error: "Sesión de Supabase requerida" }, 401);
  }
  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId || !uuid.test(projectId)) return reply({ error: "Proyecto inválido" }, 400);
  const { data, error } = await session.userClient.from("filet_guided_progress")
    .select("pattern_version_id,confirmed_rows,revision")
    .eq("user_id", session.userId).eq("project_id", projectId).maybeSingle();
  if (error) return reply({ error: "Progreso remoto no disponible" }, 503);
  return reply(data);
}

export async function POST(request: Request) {
  const session = await resolveAuthenticatedUser(request);
  if (session?.mode !== "supabase" || !session.userClient || !isAuthorizedSupabaseUserId(session.userId)) {
    return reply({ error: "Sesión de Supabase requerida" }, 401);
  }
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = new URL(configuredOrigin || (process.env.NODE_ENV === "production" ? getAppBaseUrl() : request.url)).origin;
  if (request.headers.get("origin") !== origin || request.headers.get("x-oakhaven-filet-write") !== "1") {
    return reply({ error: "Origen inválido" }, 403);
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return reply({ error: "Se requiere JSON" }, 415);
  }
  const unavailable = () => reply({ error: "Progreso remoto no disponible" }, 503);
  if (!supabaseAdmin || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) return unavailable();

  const reader = request.body?.getReader();
  if (!reader) return reply({ error: "Solicitud inválida" }, 400);
  let input: Record<string, unknown>;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let bytes = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        await reader.cancel().catch(() => {});
        return reply({ error: "Solicitud demasiado grande" }, 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    const parsed: unknown = JSON.parse(text + decoder.decode());
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid input");
    input = parsed as Record<string, unknown>;
  } catch {
    return reply({ error: "Solicitud inválida" }, 400);
  } finally {
    reader.releaseLock();
  }

  const { projectId, versionId, operationId, action, row, revision, segments } = input;
  const undo = action === "undo";
  if (Object.keys(input).length !== (undo ? 6 : 7) ||
      typeof projectId !== "string" || !uuid.test(projectId) ||
      typeof operationId !== "string" || !uuid.test(operationId) ||
      typeof versionId !== "string" || !versionId || versionId.length > 120 ||
      (!undo && action !== "confirm") ||
      typeof row !== "number" || !Number.isInteger(row) || row < 1 || row > 200 ||
      typeof revision !== "number" || !Number.isInteger(revision) || revision < 0 || revision > 2147483647 ||
      (undo && Object.hasOwn(input, "segments"))) {
    return reply({ error: "Operación guiada inválida" }, 400);
  }
  const { data: project, error } = await session.userClient.from("knitting_projects")
    .select("linked_pattern_snapshot,linked_pattern_version_id,total_rows_target")
    .eq("id", projectId).eq("user_id", session.userId).maybeSingle();
  if (error) return unavailable();
  if (!project) return reply({ error: "Proyecto no encontrado" }, 404);
  const validated = validateLinkedFiletPatternSnapshot(project.linked_pattern_snapshot);
  if (!validated.valid || validated.snapshot.version_id !== versionId || project.linked_pattern_version_id !== versionId) {
    return reply({ error: "Versión de patrón incompatible" }, 409);
  }
  const plan = getGuidedRowInstruction(validated.snapshot, row);
  if (!plan || row > project.total_rows_target) return reply({ error: "Vuelta inválida" }, 400);
  const expected = plan.runs.length;
  if (!undo && (!Array.isArray(segments) || segments.length !== expected ||
      new Set(segments).size !== expected ||
      segments.some(index => !Number.isInteger(index) || index < 0 || index >= expected))) {
    return reply({ error: "Segmentos incompletos o inválidos" }, 400);
  }

  const args = {
    p_owner_id: session.userId,
    p_project_id: projectId,
    p_pattern_version_id: versionId,
    p_row_number: row,
    p_operation_key: operationId,
    p_expected_revision: revision,
  };
  const { data, error: rpcError } = undo
    ? await supabaseAdmin.rpc("undo_filet_row_atomic_v1", args)
    : await supabaseAdmin.rpc("confirm_filet_row_atomic_v1", {
        ...args,
        p_completed_segments_count: expected,
        p_expected_segments_count: expected,
      });
  if (rpcError?.code === "22023") return reply({ error: "La operación no coincide con el recibo" }, 409);
  if (rpcError || !data) return unavailable();
  return reply(data, data.success === true ? 200 : 409);
}
