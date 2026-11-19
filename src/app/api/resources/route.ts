import { NextResponse } from "next/server";
import { requireShortcutUser } from "@/lib/request-auth";
import {
  validateBuildingResourceUpload,
  type ResourceCategory,
} from "@/lib/ai/building-skills-registry";

export async function GET(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  const url = new URL(req.url);
  const buildingId = (url.searchParams.get("buildingId") || "").trim();

  if (mode !== "supabase" || !db) {
    return NextResponse.json({ success: true, synced: false, resources: [] });
  }

  let query = db
    .from("building_resources")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (buildingId) {
    query = query.eq("building_id", buildingId);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({
      success: true,
      synced: false,
      resources: [],
      notice: "Tabla building_resources pendiente de ejecutar en Supabase.",
    });
  }

  return NextResponse.json({ success: true, synced: true, resources: data || [] });
}

export async function POST(req: Request) {
  const authCtx = await requireShortcutUser(req);
  if (!authCtx.ok) return authCtx.response;
  const { userId, db, mode } = authCtx;

  let body: {
    buildingId?: string;
    resourceCategory?: ResourceCategory;
    title?: string;
    mimeType?: string;
    sizeBytes?: number;
    externalUrl?: string;
    metadata?: Record<string, unknown>;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido." }, { status: 400 });
  }

  const validation = validateBuildingResourceUpload({
    buildingId: body.buildingId || "",
    resourceCategory: (body.resourceCategory || "") as ResourceCategory,
    mimeType: body.mimeType || "",
    sizeBytes: Number(body.sizeBytes || 0),
    ownerId: userId,
    authenticatedUserId: userId,
  });

  if (!validation.valid) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }

  const cleanTitle = (body.title || "").trim().slice(0, 200);
  if (!cleanTitle) {
    return NextResponse.json({ success: false, error: "El título del recurso es obligatorio." }, { status: 400 });
  }

  if (mode !== "supabase" || !db) {
    return NextResponse.json({ success: true, synced: false });
  }

  const { data, error } = await db
    .from("building_resources")
    .insert({
      user_id: userId,
      building_id: body.buildingId,
      resource_category: body.resourceCategory,
      title: cleanTitle,
      mime_type: body.mimeType,
      size_bytes: Number(body.sizeBytes),
      external_url: body.externalUrl || null,
      metadata: body.metadata || {},
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ success: true, synced: false });
  }

  return NextResponse.json({ success: true, synced: true, resource: data }, { status: 201 });
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
    return NextResponse.json({ success: true, synced: false });
  }

  const { error } = await db
    .from("building_resources")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  return NextResponse.json({ success: true, synced: !error });
}
