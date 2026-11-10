# AUDITORÍA DE COMPATIBILIDAD, SEGURIDAD Y RIESGOS (P0–P3)
## RPG Life-Engine — Cozy Living Village
**Última actualización:** 10 de Noviembre de 2026

---

### 1. Invariantes Arquitectónicas y Matemáticas (Reglas Absolutas)

Para preservar la integridad del RPG Life-Engine, el sistema Cozy Living Village opera bajo las siguientes invariantes innegociables:

1. **Invariante de Bóveda y Billetera (Sin Dinero Ficticio):**
   - El GP ganado en las actividades del pueblo (sesiones de lectura, tejido, botánica o micro-misiones) se debita exclusivamente de la bóveda presupuestaria del usuario si hay fondos disponibles.
   - Si la bóveda está agotada, el sistema emite el XP correspondiente pero no crea GP de la nada ni falsea la salud financiera real del usuario.
2. **Invariante de Curva de Nivel y XP Canónica:**
   - La curva de nivel sigue la función canónica cuadrática exponencial del motor (`calculateLevelFromXP`). Ningún edificio o residente puede alterar los umbrales de subida de nivel.
3. **Invariante de Idempotencia y Deduplicación:**
   - Todas las llamadas de registro (`/api/shortcuts/skill-session`, `/api/shortcuts/habit-log`) exigen una `idempotency_key`.
   - Se bloquea la duplicación accidental de páginas de libros o resoluciones de cubos en la misma marca temporal.
4. **Cero Migraciones Destructivas de Base de Datos:**
   - No se alteran columnas, tipos ni restricciones en PostgreSQL/Supabase. Los datos visuales del pueblo (tiers, mobiliario desbloqueado, postales del álbum) se calculan determinísticamente en memoria a partir de los datos existentes (`sessions_count`, `level`, `booksRead`, `knittingRows`, `rubikPb`).

---

### 2. Inventario de Componentes y Módulos Reutilizables

| Componente / Módulo | Ubicación | Función y Reutilización |
|---|---|---|
| `CozyVillageMap` | `src/components/sanctuary/cozy-village-map.tsx` | Plano del pueblo, selector de climas, audio procedural y vista de edificios. |
| `AtelierBuilding` | `src/components/sanctuary/atelier-building.tsx` | Taller de tejido con contador de vueltas y control de proyectos. |
| `LibreriaBuilding` | `src/components/sanctuary/libreria-building.tsx` | Estantería con portadas, cálculo de páginas y captura de frases célebres. |
| `BibliotecaBuilding` | `src/components/sanctuary/biblioteca-building.tsx` | Estudio profundo, materias y repetición espaciada SM-2. |
| `ClubPuzzlesBuilding` | `src/components/sanctuary/club-puzzles-building.tsx` | Cronómetro WCA, barra espaciadora, scrambles y medias Ao5/Ao12. |
| `ObservatorioBuilding` | `src/components/sanctuary/observatorio-building.tsx` | Deep work, temporizador de flujo y exportación a Notion. |
| `BotanicalGardenBuilding` | `src/components/sanctuary/botanical-garden-building.tsx` | Cantero de hábitos vivos regables y cuaderno de campo botánico. |
| `HikingOutpostBuilding` | `src/components/sanctuary/hiking-outpost-building.tsx` | Bitácora de rutas de montaña, checklist de mochila y cronómetro de marcha. |
| `InteriorDecorationsPanel`| `src/components/sanctuary/interior-decorations-panel.tsx`| Vitrina de trofeos y mobiliario desbloqueado por esfuerzo real. |
| `MayorsLedgerModal` | `src/components/sanctuary/mayors-ledger-modal.tsx` | Pergamino de prosperidad comunitaria, estación del año y decretos. |
| `VillageScrapbookModal` | `src/components/sanctuary/village-scrapbook-modal.tsx` | Álbum de recuerdos y postales ilustradas tipo polaroid. |
| `cozySoundscape` | `src/lib/sanctuary/cozy-soundscape.ts` | Motor procedural Web Audio API sin dependencias de archivos externos. |
| `useUniversalSession` | `src/lib/sanctuary/use-universal-session.ts` | Hook central para manejo unificado de sesiones, cronómetro y guardado. |
| `offline-sync` | `src/lib/offline-sync.ts` | Cola local y sincronización automática ante evento `online`. |

---

### 3. Matriz de Clasificación de Riesgos (P0 a P3)

#### P0 — Crítico (Seguridad, Datos e Integridad Financiera)
* **Riesgo:** Exposición involuntaria de claves de servicio Supabase o tokens de API en código cliente.
  - *Estado:* **Mitigado.** No existen variables secretas expuestas en el repositorio. El cliente utiliza únicamente variables públicas `NEXT_PUBLIC_` y el backend resuelve tokens mediante `.env.local` y cookies HTTP-only.
* **Riesgo:** Migración destructiva o caída de base de datos en producción por alteración de esquema SQL.
  - *Estado:* **Mitigado.** No se han ejecutado scripts `ALTER TABLE` ni `DROP COLUMN`. El modelo Cozy Village es 100% derivado y compatible.

#### P1 — Alto (Disponibilidad y Consistencia de Estado)
* **Riesgo:** Pérdida de sesiones o registros de hábitos si el usuario registra actividad en un túnel o sin conexión a internet.
  - *Estado:* **Mitigado.** La cola persistente `offline-sync.ts` retiene las peticiones fallidas en `localStorage` y las reenvía automáticamente al dispararse el evento `window.ononline`.
* **Riesgo:** Desincronización entre la versión declarada por el frontend y los endpoints API.
  - *Estado:* **Mitigado.** Centralizado en `src/lib/version.ts` (`v3.5.0-autonomous-core`) y verificado mediante la prueba unitaria `Sprint Estabilización 1`.

#### P2 — Medio (Rendimiento y Experiencia de Usuario)
* **Riesgo:** Fuga de memoria o bloqueo de audio (`AudioContext suspended`) debido a las políticas de autoplay de los navegadores.
  - *Estado:* **Mitigado.** `cozySoundscape` se inicializa silenciado por defecto (*Muted by default*), reactiva el contexto sólo ante interacción directa del usuario y limpia los nodos activos en el desmontaje con `stopAll()`.
* **Riesgo:** Sobrecarga de GPU o consumo excesivo de batería por animaciones CSS de partículas continuas en dispositivos móviles modestos.
  - *Estado:* **Mitigado.** Se incluyó el botón explícito de **"Modo Quieto"**, que apaga las partículas y congelamientos inmediatamente.

#### P3 — Bajo (Detalles Cosméticos y Estilo)
* **Riesgo:** Inconsistencia de fuentes o contraste entre el modo Cozy y pantallas de alto brillo exterior.
  - *Estado:* **Bajo control.** La paleta cumple con las proporciones de contraste WCAG AA (#3A2E2B sobre #F7F4EB).

---

### 4. Recomendaciones Técnicas
1. **Conservar la Arquitectura Desacoplada:** Mantener los edificios del Santuario en `src/components/sanctuary/` para evitar que `cozy-rpg-dashboard.tsx` o `rpg-dashboard.tsx` crezcan de manera monolítica.
2. **Memorizar Preferencia de Clima:** Persistir la preferencia de atmósfera (Día, Lluvia, Otoño, Noche) en `localStorage` para que la experiencia sea personalizada entre sesiones.
3. **Revisión Periódica de Idempotencia:** Continuar exigiendo claves criptográficas únicas en cualquier nuevo endpoint o atajo que se cree en el futuro.

---

### 5. Propuesta de Siguiente Incremento (Fase 2 de Expansión)
Una vez completada y aprobada esta auditoría de base, se recomienda abordar:
1. **Persistencia de Preferencias Cosméticas:** Guardado local de clima favorito, nivel de volumen del paisaje sonoro y edificio predilecto de inicio.
2. **Pabellón de Cocina & Recetario Consciente:** Extender el edificio de `cooking` (`src/lib/sanctuary/buildings-registry.ts`) para incluir el temporizador de fermentación y recetas conscientes.
3. **Integración con Widgets de Escritorio / Móvil:** Exponer las métricas del Valle de Oakhaven (plantas regadas hoy y postales reveladas) en el endpoint `/api/shortcuts/widget-summary`.
