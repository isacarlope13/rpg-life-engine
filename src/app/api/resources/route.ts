import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import {
  buildPrivateStoragePath,
  validatePrivateResourceFile,
} from "@/lib/ai/building-resources-engine";
import { extractCompatibleDocument } from "@/lib/ai/document-extractor";

const PRIVATE_BUCKET = "oakhaven-private-resources";
const SIGNED_URL_TTL_SECONDS = 300; // 5 minutos

export async function GET(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  const url = new URL(req.url);
  const buildingId = (url.searchParams.get("buildingId") || "").trim();
  const resourceId = (url.searchParams.get("id") || "").trim();
  const wantsSignedUrl = url.searchParams.get("signedUrl") === "1";
  const archivedOnly = url.searchParams.get("archivedOnly") === "1";

  if (mode !== "supabase" || !db) {
    return NextResponse.json({ success: true, synced: false, resources: [] });
  }

  // Generar URL firmada temporal para un recurso específico del propietario
  if (wantsSignedUrl && resourceId) {
    const { data: row, error } = await db
      .from("building_resources")
      .select("id, user_id, storage_path, original_filename, mime_type, deleted_at")
      .eq("id", resourceId)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !row || !row.storage_path) {
      return NextResponse.json(
        { success: false, error: "Recurso no encontrado o sin archivo privado asociado." },
        { status: 404 }
      );
    }

    // Defensa extra: la ruta siempre debe comenzar con el userId autenticado
    if (!String(row.storage_path).startsWith(`${userId}/`)) {
      return NextResponse.json(
        { success: false, error: "Ruta de almacenamiento fuera del espacio del propietario." },
        { status: 403 }
      );
    }

    const { data: signed, error: signErr } = await db.storage
      .from(PRIVATE_BUCKET)
      .createSignedUrl(String(row.storage_path), SIGNED_URL_TTL_SECONDS);

    if (signErr || !signed?.signedUrl) {
      return NextResponse.json(
        { success: false, error: "No se pudo generar la URL firmada temporal." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: signed.signedUrl,
      expiresInSeconds: SIGNED_URL_TTL_SECONDS,
      filename: row.original_filename,
      mimeType: row.mime_type,
    });
  }

  let query = db
    .from("building_resources")
    .select(
      "id, user_id, building_id, resource_category, resource_type, project_id, title, description, original_filename, storage_path, mime_type, size_bytes, tags, processing_status, extraction_status, is_sensitive_financial, deleted_at, created_at, updated_at"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (archivedOnly) {
    query = query.not("deleted_at", "is", null);
  } else {
    query = query.is("deleted_at", null);
  }

  if (buildingId) {
    query = query.eq("building_id", buildingId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({
      success: true,
      synced: false,
      resources: [],
      notice: "No se pudieron consultar los recursos en Supabase.",
    });
  }

  return NextResponse.json({ success: true, synced: true, resources: data || [] });
}

export async function POST(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  let buildingId = "";
  let resourceType = "";
  let title = "";
  let description = "";
  let filename = "";
  let mimeType = "";
  let sizeBytes = 0;
  let projectId: string | null = null;
  let tags: string[] = [];
  let externalUrl: string | null = null;
  let rawTextContent: string | undefined;
  let binaryBytes: Uint8Array | undefined;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    buildingId = String(form.get("buildingId") || "").trim();
    resourceType = String(form.get("resourceType") || "").trim();
    title = String(form.get("title") || "").trim();
    description = String(form.get("description") || "").trim();
    projectId = form.get("projectId") ? String(form.get("projectId")).trim() : null;
    const rawTags = form.get("tags");
    if (typeof rawTags === "string" && rawTags.trim()) {
      tags = rawTags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    }

    const fileEntry = form.get("file");
    if (fileEntry && typeof fileEntry !== "string") {
      filename = fileEntry.name || "recurso";
      mimeType = fileEntry.type || "application/octet-stream";
      sizeBytes = fileEntry.size;
      const arrBuf = await fileEntry.arrayBuffer();
      binaryBytes = new Uint8Array(arrBuf);
      if (["text/plain", "text/markdown", "text/csv", "application/json"].includes(mimeType.toLowerCase())) {
        rawTextContent = new TextDecoder("utf-8", { fatal: false }).decode(binaryBytes);
      }
    } else {
      const note = String(form.get("rawTextContent") || "").trim();
      filename = `${title || "nota"}.md`;
      mimeType = "text/markdown";
      binaryBytes = new TextEncoder().encode(note || title);
      sizeBytes = binaryBytes.byteLength;
      rawTextContent = note;
    }
  } else {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ success: false, error: "JSON inválido." }, { status: 400 });
    }
    buildingId = String(body.buildingId || "").trim();
    resourceType = String(body.resourceType || "").trim();
    title = String(body.title || "").trim();
    description = String(body.description || "").trim();
    filename = String(body.filename || `${title || "recurso"}.md`);
    mimeType = String(body.mimeType || "text/markdown");
    sizeBytes = Number(body.sizeBytes || 0);
    projectId = body.projectId ? String(body.projectId).trim() : null;
    externalUrl = body.externalUrl ? String(body.externalUrl).trim() : null;
    if (Array.isArray(body.tags)) {
      tags = body.tags.map((t) => String(t).trim()).filter(Boolean).slice(0, 10);
    }
    if (typeof body.fileBase64Sample === "string" && body.fileBase64Sample.length > 0) {
      const cleanB64 = body.fileBase64Sample.replace(/^data:[^;]+;base64,/, "");
      binaryBytes = new Uint8Array(Buffer.from(cleanB64, "base64"));
      if (!sizeBytes) sizeBytes = binaryBytes.byteLength;
    } else if (typeof body.rawTextContent === "string" && body.rawTextContent.length > 0) {
      rawTextContent = body.rawTextContent;
      binaryBytes = new TextEncoder().encode(rawTextContent);
      if (!sizeBytes) sizeBytes = binaryBytes.byteLength;
    }
  }

  // Validación estricta en servidor (edificio, categoría, extensión, MIME, magic bytes, path traversal y tamaño)
  const validation = validatePrivateResourceFile({
    buildingId,
    resourceType,
    filename,
    reportedMimeType: mimeType,
    sizeBytes,
    ownerId: userId,
    authenticatedUserId: userId,
    fileBytes: binaryBytes,
  });

  if (!validation.valid) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }

  const contentHash = binaryBytes
    ? crypto.createHash("sha256").update(binaryBytes).digest("hex")
    : null;
  const cleanTitle = (title || validation.safeFilename || "Recurso").slice(0, 200);
  const docExtract = extractCompatibleDocument({
    mimeType,
    bytes: binaryBytes,
    rawText: rawTextContent,
    contentHash,
    isFinancialSensitive: Boolean(validation.isFinancialSensitive),
  });
  const extracted = {
    extractionStatus:
      docExtract.status === "extracted"
        ? "completed"
        : docExtract.status === "blocked_sensitive"
        ? "blocked_sensitive"
        : docExtract.status === "scanned_no_text"
        ? "failed"
        : "not_applicable",
    sanitizedText: docExtract.fullSanitizedText || null,
    extractionError: docExtract.notice || null,
  };
  const resourceId = crypto.randomUUID();
  const storagePath = buildPrivateStoragePath(
    userId,
    buildingId,
    resourceId,
    validation.safeFilename || "recurso"
  );

  if (mode !== "supabase" || !db) {
    return NextResponse.json({
      success: true,
      synced: false,
      sync_state: "GUARDADO_LOCALMENTE",
      resource: {
        id: resourceId,
        owner_id: userId,
        building_id: buildingId,
        resource_type: resourceType,
        title: cleanTitle,
        original_filename: validation.safeFilename,
        storage_path: storagePath,
        mime_type: mimeType,
        size_bytes: sizeBytes,
        content_hash: contentHash,
        is_sensitive_financial: Boolean(validation.isFinancialSensitive),
        extraction_status: extracted.extractionStatus,
      },
    });
  }

  // Protección contra duplicados exactos por content_hash en el mismo edificio
  if (contentHash) {
    const { data: dup } = await db
      .from("building_resources")
      .select("id, title, storage_path")
      .eq("user_id", userId)
      .eq("building_id", buildingId)
      .eq("content_hash", contentHash)
      .is("deleted_at", null)
      .maybeSingle();

    if (dup) {
      return NextResponse.json(
        {
          success: false,
          duplicate: true,
          existingResourceId: dup.id,
          error: `Este archivo ya existe en tu biblioteca como "${dup.title}".`,
        },
        { status: 409 }
      );
    }
  }

  // Subida real al bucket privado de Supabase Storage (sin sobrescribir existentes: upsert: false)
  let uploadedToStorage = false;
  if (binaryBytes && binaryBytes.byteLength > 0) {
    const { error: uploadErr } = await db.storage
      .from(PRIVATE_BUCKET)
      .upload(storagePath, binaryBytes, {
        contentType: mimeType,
        upsert: false,
      });

    if (uploadErr) {
      return NextResponse.json(
        {
          success: false,
          sync_state: "ERROR",
          error: `Error al subir al almacenamiento privado: ${uploadErr.message}`,
        },
        { status: 502 }
      );
    }
    uploadedToStorage = true;
  }

  const { data, error: dbErr } = await db
    .from("building_resources")
    .insert({
      id: resourceId,
      user_id: userId,
      building_id: buildingId,
      resource_category: resourceType,
      resource_type: resourceType,
      project_id: projectId,
      title: cleanTitle,
      description: description.slice(0, 500),
      original_filename: validation.safeFilename || "",
      storage_path: uploadedToStorage ? storagePath : null,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      external_url: externalUrl,
      tags,
      processing_status: "ready",
      extraction_status: extracted.extractionStatus,
      extraction_error: extracted.extractionError,
      extracted_text: extracted.sanitizedText,
      content_hash: contentHash,
      is_sensitive_financial: Boolean(validation.isFinancialSensitive),
    })
    .select("*")
    .single();

  if (dbErr) {
    // Rollback limpio en Storage si falló el registro en BD (sin archivos huérfanos)
    if (uploadedToStorage) {
      await db.storage.from(PRIVATE_BUCKET).remove([storagePath]).catch(() => {});
    }
    return NextResponse.json(
      {
        success: false,
        sync_state: "ERROR",
        error: "No se pudieron registrar los metadatos en Supabase.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      synced: true,
      uploadedToStorage,
      sync_state: "SINCRONIZADO",
      resource: data,
    },
    { status: 201 }
  );
}

export async function PATCH(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  let body: { id?: string; action?: "restore" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido." }, { status: 400 });
  }

  if (!body.id || body.action !== "restore") {
    return NextResponse.json({ success: false, error: "id y action='restore' requeridos." }, { status: 400 });
  }

  if (mode !== "supabase" || !db) {
    return NextResponse.json({ success: true, synced: false });
  }

  const { error } = await db
    .from("building_resources")
    .update({ deleted_at: null, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true, synced: !error, restored: !error });
}

export async function DELETE(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "id requerido." }, { status: 400 });
  }

  if (mode !== "supabase" || !db) {
    return NextResponse.json({ success: true, synced: false, archived: true });
  }

  // Archivado lógico seguro (NUNCA borra físicamente registros ni archivos en Storage)
  const { error } = await db
    .from("building_resources")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true, synced: !error, archived: true });
}
