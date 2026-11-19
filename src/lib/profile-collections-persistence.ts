import type { SupabaseClient } from "@supabase/supabase-js";

/** A successful update with zero matching rows is not durable storage. */
export async function persistProfileCollections(
  client: SupabaseClient, userId: string, payload: unknown,
): Promise<{ saved: boolean; error?: string }> {
  try {
    const { data, error } = await client.from("profiles")
      .update({ collections_state: payload, updated_at: new Date().toISOString() })
      .eq("id", userId).select("id").maybeSingle();
    if (error || !data || data.id !== userId) return { saved: false, error: "No se confirmó el estado del perfil" };
    return { saved: true };
  } catch { return { saved: false, error: "No se confirmó el estado del perfil" }; }
}
