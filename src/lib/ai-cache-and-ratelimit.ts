/**
 * ============================================================================
 * ESCUDO DE COSTOS A GRAN ESCALA: CACHÉ GLOBAL IA + RATE LIMITING POR USUARIO
 * ============================================================================
 * 1. Cache-First para Libros y Cubos (`catalog_ai_cache` en Supabase + Memoria):
 *    Cuando el primer usuario consulta un libro o cubo con Gemini, la ficha
 *    completa se almacena en `public.catalog_ai_cache`. Los siguientes 10.000
 *    usuarios que consulten el mismo ítem obtienen la respuesta en <10ms y con
 *    costo $0.00 de tokens de IA.
 * 2. Rate Limiter por Usuario/IP (`checkAiQuotaAllowance`):
 *    Protege tu cuenta de Gemini contra bucles accidentales o abuso de bots
 *    limitando el máximo de llamadas en vivo a Gemini por minuto y por día por
 *    usuario, conmutando de forma transparente al motor determinista local.
 */

import { isSupabaseConfigured, supabaseAdmin } from "./supabase.ts";

const memoryCatalogCache = new Map<string, unknown>();

interface UserRateBucket {
  minuteWindowStart: number;
  minuteCount: number;
  dayWindowStart: number;
  dayCount: number;
}

const userRateBuckets = new Map<string, UserRateBucket>();

const MAX_GEMINI_CALLS_PER_MINUTE_PER_USER = 12;
const MAX_GEMINI_CALLS_PER_DAY_PER_USER = 150;

export function normalizeCatalogCacheKey(
  domain: "cube" | "book",
  rawQuery: string
): string {
  const clean = (rawQuery || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return `${domain}:${clean}`;
}

export function checkAiQuotaAllowance(userIdentifier = "global"): {
  allowed: boolean;
  remainingToday: number;
} {
  const now = Date.now();
  const key = userIdentifier || "global";
  let bucket = userRateBuckets.get(key);

  if (!bucket) {
    bucket = {
      minuteWindowStart: now,
      minuteCount: 0,
      dayWindowStart: now,
      dayCount: 0,
    };
    userRateBuckets.set(key, bucket);
  }

  if (now - bucket.minuteWindowStart > 60_000) {
    bucket.minuteWindowStart = now;
    bucket.minuteCount = 0;
  }
  if (now - bucket.dayWindowStart > 86_400_000) {
    bucket.dayWindowStart = now;
    bucket.dayCount = 0;
  }

  if (
    bucket.minuteCount >= MAX_GEMINI_CALLS_PER_MINUTE_PER_USER ||
    bucket.dayCount >= MAX_GEMINI_CALLS_PER_DAY_PER_USER
  ) {
    return {
      allowed: false,
      remainingToday: Math.max(
        0,
        MAX_GEMINI_CALLS_PER_DAY_PER_USER - bucket.dayCount
      ),
    };
  }

  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  return {
    allowed: true,
    remainingToday: Math.max(
      0,
      MAX_GEMINI_CALLS_PER_DAY_PER_USER - bucket.dayCount
    ),
  };
}

export async function getCachedCatalogSpecs<T>(
  domain: "cube" | "book",
  rawQuery: string
): Promise<T | null> {
  const cacheKey = normalizeCatalogCacheKey(domain, rawQuery);
  if (cacheKey.length <= domain.length + 2) return null;

  // 1. Memoria RAM del servidor (0ms)
  const memHit = memoryCatalogCache.get(cacheKey);
  if (memHit) {
    return memHit as T;
  }

  // 2. Tabla compartida en Supabase public.catalog_ai_cache (~5ms, $0 IA)
  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      const { data } = await supabaseAdmin
        .from("catalog_ai_cache")
        .select("specs_json")
        .eq("cache_key", cacheKey)
        .maybeSingle();

      if (data && data.specs_json && typeof data.specs_json === "object") {
        memoryCatalogCache.set(cacheKey, data.specs_json);
        return data.specs_json as T;
      }
    } catch {
      // Si la tabla aún no fue migrada, continúa normalmente
    }
  }

  return null;
}

export async function setCachedCatalogSpecs<T>(
  domain: "cube" | "book",
  rawQuery: string,
  specs: T
): Promise<void> {
  const cacheKey = normalizeCatalogCacheKey(domain, rawQuery);
  if (cacheKey.length <= domain.length + 2) return;

  memoryCatalogCache.set(cacheKey, specs);

  if (isSupabaseConfigured && supabaseAdmin) {
    try {
      await supabaseAdmin.from("catalog_ai_cache").upsert(
        {
          cache_key: cacheKey,
          domain,
          raw_query: rawQuery.trim().slice(0, 180),
          specs_json: specs,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "cache_key" }
      );
    } catch {
      // Si la tabla aún no fue migrada, queda en caché de memoria
    }
  }
}

export function getCostShieldStats() {
  return {
    cached_catalog_items_in_memory: memoryCatalogCache.size,
    active_rate_limit_buckets: userRateBuckets.size,
    max_gemini_calls_per_minute_per_user: MAX_GEMINI_CALLS_PER_MINUTE_PER_USER,
    max_gemini_calls_per_day_per_user: MAX_GEMINI_CALLS_PER_DAY_PER_USER,
  };
}
