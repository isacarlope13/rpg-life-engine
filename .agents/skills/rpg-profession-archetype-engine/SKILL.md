---
name: rpg-profession-archetype-engine
description: Skill especializada para generar arquetipos de personaje RPG según la profesión u ocupación del usuario con caché persistente en base de datos (profession_class_catalog).
---

# Skill 6: Motor de Arquetipos & Clases por Profesión (`rpg-profession-archetype-engine`)

## 1. Propósito y Endpoint
Se activa en el Paso 1 del Onboarding cuando el usuario escribe su profesión o si es estudiante:
- `POST /api/onboarding/ai` (`action: "profession_classes"`)
- Función asociada: `resolveProfessionClasses` y `sanitizeProfessionClasses` en `src/lib/onboarding-ai.ts` / `src/lib/ai-skills-prompts.ts`.

## 2. Flujo Condicional Anti-Latencia (Cache-First)
1. Normaliza la clave (`normalizeProfessionKey`).
2. Consulta primero el catálogo predeterminado (`PRESET_PROFESSION_CATALOG`) y la tabla `public.profession_class_catalog` en Supabase.
3. **Solo si no existe coincidencia**, invoca a Gemini con `AI_SKILLS_REGISTRY.PROFESSION_ARCHETYPE_ENGINE`, sanitiza las 3 clases generadas y las guarda en `profession_class_catalog` para no volver a consumir cuota de API con esa profesión.
