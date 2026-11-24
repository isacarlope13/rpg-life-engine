import { NextResponse } from "next/server";
import { buildAuthSetCookieHeaders, resolveAuthenticatedUser } from "@/lib/auth";
import { getAppBaseUrl } from "@/lib/app-url";
import { isAuthorizedSupabaseUserId } from "@/lib/single-user-guard";
import { supabaseAdmin } from "@/lib/supabase";
import { isValidFiletWorkspace } from "@/lib/sanctuary/filet-crochet-store";

const bodyLimit = 5 * 1024 * 1024;
const operationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function workspaceSession(request: Request) {
  const session = await resolveAuthenticatedUser(request);
  if (session?.mode !== "supabase" || !session.userClient || !isAuthorizedSupabaseUserId(session.userId)) {
    return null;
  }
  return { id: session.userId, db: session.userClient, tokens: session.refreshedTokens };
}

function reply(session: Awaited<ReturnType<typeof workspaceSession>>, body: unknown, status = 200) {
  const response = NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
  if (session?.tokens) {
    for (const header of buildAuthSetCookieHeaders(session.tokens)) response.headers.append("Set-Cookie", header);
  }
  return response;
}

export async function GET(request: Request) {
  const session = await workspaceSession(request);
  if (!session) return reply(null, { error: "Sesión de Supabase requerida" }, 401);
  const { data, error } = await session.db.from("filet_workspace_sync")
    .select("revision,workspace").eq("user_id", session.id).maybeSingle();
  if (error) return reply(session, { error: "Sincronización no disponible" }, 503);
  return reply(session, data ?? { revision: 0, workspace: null });
}

export async function POST(request: Request) {
  const session = await workspaceSession(request);
  if (!session) return reply(null, { error: "Sesión de Supabase requerida" }, 401);
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const origin = new URL(configuredOrigin || (process.env.NODE_ENV === "production" ? getAppBaseUrl() : request.url)).origin;
  if (request.headers.get("origin") !== origin || request.headers.get("x-oakhaven-filet-write") !== "1") {
    return reply(session, { error: "Origen inválido" }, 403);
  }
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "")) {
    return reply(session, { error: "Se requiere JSON" }, 415);
  }
  if (!supabaseAdmin || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return reply(session, { error: "Sincronización no disponible" }, 503);
  }
  const reader = request.body?.getReader();
  if (!reader) return reply(session, { error: "Solicitud inválida" }, 400);

  let value: unknown;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    const chunks: string[] = [];
    let size = 0;
    for (;;) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      size += chunk.byteLength;
      if (size > bodyLimit) {
        await reader.cancel().catch(() => {});
        return reply(session, { error: "Solicitud demasiado grande" }, 413);
      }
      chunks.push(decoder.decode(chunk, { stream: true }));
    }
    chunks.push(decoder.decode());
    value = JSON.parse(chunks.join(""));
  } catch {
    return reply(session, { error: "Solicitud inválida" }, 400);
  } finally {
    reader.releaseLock();
  }

  if (!value || typeof value !== "object") return reply(session, { error: "Solicitud inválida" }, 400);
  const { operationId, baseRevision, workspace } = value as Record<string, unknown>;
  if (Object.keys(value).length !== 3 ||
      typeof operationId !== "string" || !operationIdPattern.test(operationId) ||
      typeof baseRevision !== "number" || !Number.isSafeInteger(baseRevision) || baseRevision < 0 ||
      !isValidFiletWorkspace(workspace) ||
      Object.keys(workspace).some((key) => !["schemaVersion", "updatedAt", "collections", "patterns", "drafts"].includes(key))) {
    return reply(session, { error: "Operación de sincronización inválida" }, 400);
  }
  const { data, error } = await supabaseAdmin.rpc("save_filet_workspace_v1", {
    p_user_id: session.id,
    p_operation_id: operationId,
    p_base_revision: baseRevision,
    p_workspace: workspace,
  });
  if (error) {
    return error.code === "22023"
      ? reply(session, { error: "Operación de sincronización inválida" }, 400)
      : reply(session, { error: "Sincronización no disponible" }, 503);
  }
  return reply(session, data, data?.status === "conflict" ? 409 : 200);
}
