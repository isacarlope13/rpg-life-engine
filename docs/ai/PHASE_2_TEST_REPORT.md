# PHASE 2 TEST REPORT — EVIDENCIA REAL DE VERIFICACIÓN

**Fecha:** 2026-11-19

## 1. Resultados ejecutados

| Verificación | Estado | Resultado real |
|---|---|---|
| `npx tsc --noEmit` | **PASÓ** | Exit code `0` (0 errores de TypeScript). |
| `npm test` (suite completa) | **PASÓ** | **302 / 302 pruebas aprobadas**, 0 fallos, 0 omitidas (8 suites). |
| `tests/oakhaven-ai-phase2-libraries.test.ts` | **PASÓ** | 4 bloques completos (matriz estricta de 8 edificios, magic bytes / MIME / path traversal / tamaño / sin sesión, migración sin pérdida con respaldo y conflictos cross-device, aislamiento Rowan vs especialistas, bloqueo financiero sensible, defensa prompt injection e invariante GP/XP/COP). |
| `tests/oakhaven-ai-phase2.test.ts` | **PASÓ** | 4 bloques (8 especialistas, propuestas Nivel 2 con confirmación obligatoria, bloqueo Nivel 3, integración `LivingInteriorRoom`). |
| `npm run build` | **NO EJECUTADO** en esta iteración | Pendiente de ejecución antes de despliegue final (y evita `EPERM` transitorio local de Windows en `.next/standalone`). |
| Subida física real a bucket Supabase Storage | **BLOQUEADO POR MIGRACIÓN PENDIENTE** | Requiere ejecutar `supabase/drafts/20261119_phase2_private_storage_and_resources.sql` en Supabase Dashboard. |

## 2. Invariantes verificadas
- **GP, XP y COP intactos:** ninguna validación, subida, extracción o consulta de recursos modifica saldos económicos ni recompensas RPG.
- **Cero contaminación entre edificios:** ningún tipo de Crochet (`crochet_pattern`, `stitch_diagram`) aparece en Banco, Estudio, Trabajo, Gym, Cubos, Lectura o Cine.
- **Protección financiera:** `bank_statement`, `receipt`, `budget` y `financial_document` quedan marcados con `is_sensitive_financial: true` y bloqueados para lectura automática de texto por la IA.
