# OAKHAVEN — RELEASE 3.2: PLAN DE DESPLIEGUE (PUEBLO VIVO 5.0)

**Fecha:** 2026-11-19  
**Rama candidata:** `feat/oakhaven-phase9-living-village-5` (base `main` @ `5813eea`, Release 3.1)  
**Impacto en base de datos:** **NINGUNO** (0 migraciones SQL nuevas; no modifica tablas, RLS, finanzas ni `/api/sync`).

---

## 1. Pre-requisitos antes de publicar
1. Confirmar que el árbol de trabajo en `feat/oakhaven-phase9-living-village-5` está limpio y que `npx tsc --noEmit`, `npm test` (`335/335`) y `npm run build` (`35/35` rutas) están en verde.
2. Confirmar que las correcciones P1/P2 detectadas en QA visual (overflow móvil en header, solapamiento de D-pad en 320px/375px, listener `wheel` no-pasivo, z-index de Rowan y guardia de foco teclado) fueron re-verificadas en navegador real.
3. Verificar estado del esquema SQL de Release 3.1 en Supabase: Pueblo Vivo 5.0 es 100% seguro de desplegar independientemente del SQL de Fase 8, pero la sincronización multidispositivo en la nube requiere haber aplicado `supabase/drafts/20261119_phase8_data_continuity_sync.sql` en Supabase.

## 2. Secuencia de Despliegue (solo tras autorización humana explícita)
```powershell
git checkout main
git pull --ff-only origin main
git merge --no-ff feat/oakhaven-phase9-living-village-5 -m "release: OakHaven 3.2 (Pueblo Vivo 5.0 — World Experience)"
git push origin main
```

## 3. Verificación Post-Despliegue en Producción (Railway)
1. Confirmar build verde y `/api/health` en Railway.
2. Abrir `/cozy` en desktop y móvil real (iOS Safari / Android Chrome):
   - Verificar carga sin errores de consola ni hidratación.
   - Comprobar 0 scroll horizontal accidental en móvil.
   - Verificar barra `Ir directo:`, interiores temáticos, Rowan en Plaza Central y modo `Caminar` sin solapamientos.
   - Confirmar que los saldos reales (GP/XP/COP) y sesiones activas permanecen intactos.

## 4. Rollback Inmediato (sin pérdida de datos)
- Al no existir cambios de esquema ni de motor financiero/sesiones, el rollback es inmediato y 100% seguro:
  ```powershell
  git revert -m 1 <merge_commit_sha>
  git push origin main
  ```
- Alternativamente, promover el despliegue previo (`5813eea`) desde Railway.
