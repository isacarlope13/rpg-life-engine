import { NextResponse } from "next/server";
import { AI_SKILLS_REGISTRY } from "@/lib/ai-skills-prompts";
import { getCostShieldStats } from "@/lib/ai-cache-and-ratelimit";
import { resolveAuthenticatedUser } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { SYSTEM_VERSION } from "@/lib/version";

export async function GET(req: Request) {
  const session = await resolveAuthenticatedUser(req);
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== "tu-gemini-api-key"
  );

  // Si un visitante no autenticado abre /api/health, solo ve el estado general sin detalles internos
  if (!session) {
    return NextResponse.json({
      status: "ok",
      version: SYSTEM_VERSION.version,
      apiVersion: SYSTEM_VERSION.apiVersion,
      releaseTag: SYSTEM_VERSION.releaseTag,
      security: "rls_and_auth_enforced",
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    status: "ok",
    version: SYSTEM_VERSION.version,
    apiVersion: SYSTEM_VERSION.apiVersion,
    releaseTag: SYSTEM_VERSION.releaseTag,
    buildDate: SYSTEM_VERSION.buildDate,
    timestamp: new Date().toISOString(),
    persistence: {
      supabase_connected: isSupabaseConfigured,
      local_disk_backup_enabled: true,
      pwa_manifest: "/manifest.json",
    },
    cost_and_scale_shield: getCostShieldStats(),
    ai_engine: {
      gemini_api_configured: hasGeminiKey,
      fallback_deterministic_ready: true,
      registered_skills_count: Object.keys(AI_SKILLS_REGISTRY).length,
      skills: Object.values(AI_SKILLS_REGISTRY).map((s) => ({
        id: s.id,
        name: s.name,
        endpoint: s.endpoint,
        temperature: s.temperature,
      })),
    },
  });
}
