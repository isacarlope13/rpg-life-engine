# OAKHAVEN — FASE 9: PUEBLO VIVO 5.0 (ARQUITECTURA WORLD EXPERIENCE)

**Fecha:** 2026-11-19  
**Rama:** `feat/oakhaven-phase9-living-village-5` (base `main` @ `5813eea`, Release 3.1)  
**Dependencias externas añadidas:** `0` (sin Phaser ni motores pesados; 100% React + CSS GPU + SVG).

---

## 1. Filosofía Arquitectónica (Explicación Pedagógica)
Pueblo Vivo 5.0 evoluciona la capa visual de OakHaven sin duplicar ni alterar ninguno de los sistemas canónicos ya estabilizados (finanzas COP, GP/XP, sesiones atómicas, RLS, `/api/sync`, cola offline, aprobaciones Nivel 2/3 ni privacidad de Silas y Rowan).

En lugar de introducir un motor de canvas externo (que rompería la accesibilidad por teclado, aumentaría el bundle móvil y duplicaría el estado de React), se centralizó la lógica pura de experiencia 2D en [`src/lib/sanctuary/living-village-engine.ts`](../../src/lib/sanctuary/living-village-engine.ts) y se conectó mediante refactors localizados a los componentes existentes:

1. **Motor puro de mundo (`src/lib/sanctuary/living-village-engine.ts`):**
   - `clampExplorerPosition` / `stepExplorerPosition` / `findNearestBuilding`: controlan el avatar explorador opcional dentro de límites seguros del mundo (`1400×900`) y detectan edificios cercanos.
   - `deriveBuildingVisualSignals`: traduce únicamente registros confirmados (sesiones activas, sesiones completadas, proyectos/libros/solves, propuestas pendientes) a señales visuales; en días de descanso muestra estado sereno (`En calma`) sin penalizaciones.
   - `getResidentAmbientState`: estados ambientales deterministas para habitantes (0 llamadas a Gemini; respeta el modo silencioso por especialista).
   - `getInteriorRoomTheme`: planos temáticos (paredes, piso SVG, halo de luz y mobiliario interactivo) para los 8 edificios definitivos.
2. **Mapa 2D (`src/components/sanctuary/interactive-village-scene.tsx` + `src/lib/sanctuary/use-village-camera.ts`):**
   - Pinch-to-zoom real de 2 dedos (`onTouchStart`/`onTouchMove`/`onTouchEnd`) + `touch-none` para evitar conflictos con el scroll vertical.
   - Iluminación y partículas ambientales por clima (`sunny`, `rain`, `autumn`, `night`) usando exclusivamente `@keyframes` CSS acelerados por GPU (`transform: translate3d` y `opacity`).
   - Presencia en vivo del **Presidente Rowan (🦉)** en la Plaza Central con globo de diálogo basado en registros reales y acceso directo a su Centro de Mando.
   - **Avatar explorador opcional (`🧭`)** con modo Caminar (`WASD`/Flechas, doble clic en terreno, D-pad táctil y `Enter` al acercarse a un edificio), preservando siempre el acceso directo con un clic/toque.
3. **Interiores como Habitaciones (`src/components/sanctuary/living-interior-room.tsx`):**
   - Reutiliza `LivingInteriorRoom` para los 8 edificios añadiendo fondo temático por edificio, mobiliario interactivo clicable sincronizado con las estaciones y barra de pestañas táctiles (`min-h-[44px]`) para móvil, conservando todos los formularios, cronómetros, `BuildingSpecialistPanel` y `BuildingLibraryPanel`.
