import { NextResponse } from "next/server";
import { AI_SKILLS_REGISTRY } from "@/lib/ai-skills-prompts";
import { isSupabaseConfigured } from "@/lib/supabase";

export async function GET() {
  const hasGeminiKey = Boolean(
    process.env.GEMINI_API_KEY &&
      process.env.GEMINI_API_KEY !== "tu-gemini-api-key"
  );

  return NextResponse.json({
    status: "ok",
    version: "3.2.0-trial-ready",
    timestamp: new Date().toISOString(),
    persistence: {
      supabase_connected: isSupabaseConfigured,
      local_disk_backup_enabled: true,
      pwa_manifest: "/manifest.json",
    },
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
