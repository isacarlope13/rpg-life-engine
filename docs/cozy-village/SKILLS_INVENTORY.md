# INVENTARIO COMPLETO DE HABILIDADES Y EDIFICIOS DEL SANTUARIO
## RPG Life-Engine — Cozy Living Village
**Última actualización:** 10 de Noviembre de 2026

---

### 1. Filosofía del Santuario y Edificios Especializados
El Santuario de habilidades no consiste en páginas decorativas ni colecciones estáticas. Cada edificio representa una habilidad de la vida real y proporciona al usuario:
1. **Herramientas de Sesión:** Cronómetro universal, temporizador de pausas, contador de vueltas, atril o barra de espacio WCA.
2. **Contexto & Bitácora:** Registro de notas, reflexiones, páginas leídas, proyectos en curso o esquejes vegetales.
3. **Mobiliario & Trofeos Progresivos:** Piezas de decoración interior que se desbloquean determinísticamente según el esfuerzo real acumulado (sin economías paralelas ni gastos de recursos).
4. **Residente Asistente:** Un NPC característico que acompaña la actividad con consejos no punitivos y micro-misiones de bienestar.

---

### 2. Catálogo de los 6 Edificios Nucleares del Santuario

#### 1. El Atelier de Hilados (`knitting`)
* **Edificio / Componente:** `src/components/sanctuary/atelier-building.tsx`
* **Ruta:** `/skills/knitting`
* **Residente:** Clara la Oveja Hilandera
* **Mecánicas:**
  - Contador de vueltas táctil con botones (+1, +5, -1) para tejido a dos agujas, crochet, telar o amigurumi.
  - Gestión de proyectos activos con barra de progreso fraccionario hacia la meta de filas.
  - Recompensa al completar proyecto: +6.000 GP y +2.500 XP calculados por el motor canónico.
* **Mobiliario & Trofeos:** Cojín de Vellón Suave, Rueca Artesanal de Roble, Canasta de Mimbre con Lanas Teñidas, Tapiz del Gran Artesano.

#### 2. La Librería & Archivo (`reading`)
* **Edificio / Componente:** `src/components/sanctuary/libreria-building.tsx`
* **Ruta:** `/skills/reading`
* **Residente:** Eldrin el Búho Archivero
* **Mecánicas:**
  - Estantería interactiva de libros con portadas, ISBN y estado de lectura (En Progreso / Completado).
  - Calculadora de páginas leídas por sesión con actualización automática de porcentaje de libro.
  - Captura rápida de frases célebres y notas de lectura (+250 GP por hallazgo reflexivo).
* **Mobiliario & Trofeos:** Atril de Lectura Monástico, Estantería de Roble de Doble Altura, Sillón de Orejas de Cuero Envejecido, Sello Dorado del Archivero.

#### 3. La Biblioteca del Erudito (`study`)
* **Edificio / Componente:** `src/components/sanctuary/biblioteca-building.tsx`
* **Ruta:** `/skills/study`
* **Residente:** Lyra la Gata Erudita
* **Mecánicas:**
  - Temporizador Deep Study (50/10) y Pomodoro clásico (25/5).
  - Módulo de Repetición Espaciada basado en el algoritmo **SM-2**: cálculo de factor de facilidad (EF) e intervalos óptimos.
  - Clasificación de apuntes y flashcards por materias y conceptos.
* **Mobiliario & Trofeos:** Lámpara Verde de Banquero, Globo Terráqueo de Caoba y Bronce, Tintero de Cristal y Pluma de Ganso, Códice de la Sabiduría.

#### 4. Club de Speedcubing & Puzzles (`rubik`)
* **Edificio / Componente:** `src/components/sanctuary/club-puzzles-building.tsx`
* **Ruta:** `/skills/rubik`
* **Residente:** Milo la Nutria Analítica
* **Mecánicas:**
  - Cronómetro con retención de barra espaciadora (modo inspección de 15 segundos conforme a regulación WCA).
  - Generador de Scrambles WCA oficiales para cubos 3x3, 2x2, 4x4, Pyraminx y Megaminx.
  - Cálculo estricto de medias trimmed: Ao5 (Average of 5) y Ao12 (Average of 12) descartando el mejor y peor tiempo.
  - Arsenal de cubos físicos y ficha técnica con lubricación, magnetismo y récord personal (PB).
* **Mobiliario & Trofeos:** Alfombrilla de Competición Acolchada, Estante Expositor de Policarbonato, Kit de Mantenimiento y Lubricación, Copa Dorada de Torneo.

#### 5. El Observatorio Cósmico (`general` / Deep Work)
* **Edificio / Componente:** `src/components/sanctuary/observatorio-building.tsx`
* **Ruta:** `/skills/general`
* **Residente:** Aura la Zorra Estelar
* **Mecánicas:**
  - Temporizador de flujo cognitivo profundo libre de notificaciones.
  - Contador de distracciones/interrupciones mitigadas.
  - Calificación de claridad mental post-sesión (1 al 10).
  - Sincronización y exportación de Session Intelligence hacia Notion.
* **Mobiliario & Trofeos:** Almohadón Zen de Meditación, Esfera Armilar de Latón, Prisma Cósmico de Claridad.

#### 6. La Oficina Estratégica (`work`)
* **Edificio / Definición:** `src/lib/sanctuary/buildings-registry.ts`
* **Ruta:** `/skills/work`
* **Residente:** Aura la Zorra Estelar
* **Mecánicas:**
  - Tablero Kanban con etapas ágiles (Scrum, Kanban, Lean).
  - Priorización de tareas laborales y multiplicador por impacto estratégico.
  - Planificador de proyectos asistido por IA Gemini.

---

### 3. Pabellones Especializados y Complementarios

#### 7. Invernadero Botánico & Cantero de Hábitos (`gardening`)
* **Edificio / Componente:** `src/components/sanctuary/botanical-garden-building.tsx`
* **Ruta:** `/skills/gardening`
* **Residente:** Barnaby el Tejón Botánico
* **Mecánicas:**
  - **Cantero de Hábitos Vivos:** Cada hábito o pausa del día es una planta (Lavanda, Helecho, Girasol, Menta, Trébol) con botón de *Regar Planta*.
  - **Cuaderno de Campo:** Registro de esquejes, sustrato y observaciones botánicas.
  - **Temporizador Consciente:** Sesiones de cuidado y contacto con la naturaleza con `useUniversalSession`.
* **Mobiliario & Trofeos:** Regadera de Cobre Forjado, Terrario de Musgo y Cuarzo, Bonsái Centenario de Roble, Orquídea Solar de Oakhaven.

#### 8. Puesto de Senderismo & Montaña (`hiking`)
* **Edificio / Componente:** `src/components/sanctuary/hiking-outpost-building.tsx`
* **Ruta:** `/skills/hiking`
* **Residente:** Tara la Zorra Montañesa
* **Mecánicas:**
  - **Bitácora de Senderos:** Registro de caminatas, distancia en kilómetros y desnivel acumulado.
  - **Preparación de Mochila:** Checklist de seguridad (agua, abrigo, ración de marcha, botiquín).
  - **Temporizador de Marcha:** Cronómetro de pasos activos y oxigenación mental.
* **Mobiliario & Trofeos:** Botas de Cuero Curtido, Brújula de Latón Envejecido, Bastón de Fresno Tallado, Estandarte del Mirador del Viento.

#### 9-14. Pabellones en Expansión del Santuario
* **Taller de Ilustración & Bocetos** (`drawing`): Temporizador de bocetos rápidos y sketchbook libre de autocrítica.
* **Taller de Arcilla & Alfarería** (`ceramics`): Modelado táctil, tiempos de secado y horneado.
* **Cocina & Laboratorio Experimental** (`cooking`): Recetario de nutrición consciente y tiempos de fermentación.
* **Santuario de Journaling & Zen** (`journaling`): Bitácora de gratitud, preguntas guiadas y victorias libres de culpa.
* **Salón Arcade Consciente** (`gaming`): Sesiones de juego con alarma anti-tilt a los 40 minutos.
* **Dojo & Acondicionamiento Físico** (`sports`): Seguimiento de esfuerzo percibido y vigor físico.

---

### 4. Censo Comunitario de Residentes
| Nombre | Especie | Rol / Especialidad | Edificio Asignado | Micro-Misión de Bienestar |
|---|---|---|---|---|
| **Rowan** | Ciervo Sabio | Alcalde de Oakhaven | Ayuntamiento / Plaza | Pausa de respiración diafragmática (3 min) |
| **Sabia Elda** | Lechuza Blanca | Consejera Comunitaria | Librería / Archivo | Pausa de infusión tibia y reflexión |
| **Maestro Tesh** | Tejón Carpintero | Maestro de Obras | Taller de Maderas | Estiramiento lumbar y alineación postural |
| **Clara** | Oveja | Maestra Hilandera | Atelier de Hilados | Completar 5 filas de tejido sin prisa |
| **Eldrin** | Búho | Bibliotecario & Historiador | Librería & Archivo | Leer 10 páginas de un tomo pendiente |
| **Lyra** | Gata | Erudita de la Memoria | Biblioteca del Erudito | Repasar 5 tarjetas de repetición espaciada |
| **Milo** | Nutria | Entrenador de Puzzles WCA | Club de Speedcubing | Resolver 1 cubo con ritmo suave y mirada serena |
| **Aura** | Zorra Estelar | Astrónoma & Guía de Enfoque | Observatorio Cósmico | Bloque de 25 minutos de Deep Work |
| **Barnaby** | Tejón | Botánico del Invernadero | Invernadero Botánico | Regar 1 planta del cantero de hábitos |
| **Tara** | Zorra | Guía de Montaña | Puesto de Senderismo | Caminata suave de 15 minutos al aire libre |

---

### 5. Mecanismo de Sesiones: Motor Universal (`useUniversalSession`)
Para evitar la proliferación de lógicas redundantes de cronómetro y guardado, todos los edificios consumen el hook central `useUniversalSession(domain, buildingId)` en `src/lib/sanctuary/use-universal-session.ts`:
* Provee: `isRunning`, `isPaused`, `formattedTime`, `startSession()`, `pauseSession()`, `resumeSession()`, `resetSession()` y `finishSession()`.
* Guarda automáticamente las sesiones en `/api/shortcuts/skill-session` de forma idempotente.
* Si el navegador no tiene conexión, delega en `queueOfflineAction` para sincronización posterior sin pérdida de progreso.
