# GUÍA DE LANZAMIENTO, MANUAL DE USUARIO Y PLAN DE REVERSIÓN
## RPG Life-Engine · Versión 3.5.0 "Cozy Living Village"

Este documento consolida la documentación técnica de entrega, la guía de usuario final, el registro de cambios detallado, el checklist pre-despliegue y el protocolo formal de reversión para la experiencia integral del **Valle de Oakhaven**.

---

## 1. Guía de Uso para el Usuario (Manual de Oakhaven)

### 1.1. Navegación Principal
* **Dashboard Bento (`/cozy`):** Vista panorámica de tu progreso diario. Presenta en formato tarjetas bento:
  * Encabezado con hora viva, fecha, clima interactivo (Soleado, Llovizna, Nublado) y botón de captura rápida.
  * Resumen de recursos: GP en billetera, GP en bóveda, Nivel, XP actual, Racha de días y multiplicador.
  * Resumen de habilidades vivas y acceso directo a la última actividad.
* **Pueblo Interactivo de Oakhaven:** Presiona el botón *"Explorar Pueblo"* o el icono de aldea en el sidebar.
  * El mapa SVG 2D desplegará los 9 distritos y edificios del Santuario.
  * Cada edificio cuenta con un indicador visual determinista que señala si tienes tareas pendientes (ej. libros activos en lectura, prendas en bastidor, tarjetas SM-2 listas para repaso).
  * Al hacer clic en un edificio, se abrirá su **Interior Especializado**.
  * Para regresar al pueblo o al dashboard en cualquier momento, presiona el botón accesible **"Volver al Pueblo ✕"** o la tecla **`Escape`**.

### 1.2. Interiores Especializados & Centro de Acción
Cada edificio es un centro funcional donde puedes operar directamente:
* **El Atelier de Hilados (Tejido):**
  * Contador táctil de vueltas y rondas (+1, +5, -1).
  * Control de proyectos activos (técnica, tipo de fibra, porcentaje).
  * Galería de prendas terminadas (Exposición de Creaciones).
* **La Librería & Archivo (Lectura):**
  * Catálogo de tomos activos y calculadora de páginas leídas hoy.
  * Captura rápida de frases célebres y notas de lectura.
  * Estantería de honor con libros concluidos.
* **La Biblioteca del Erudito (Estudio & SM-2):**
  * Duelo de repaso activo con algoritmo de repetición espaciada SM-2.
  * Repaso de materias, apuntes y forja de tarjetas de memoria.
* **Club de Puzzles WCA (Speedcubing):**
  * Cronómetro WCA reglamentario, generador de scrambles oficiales, historial de solves, cálculo de Single PB y medias Ao5/Ao12.
* **El Observatorio Cósmico (Deep Work & Foco):**
  * Temporizador de concentración profunda, registro de interrupciones conscientes y bitácora de metas.
* **Torre de Gestión & Oficina (Trabajo Ágil):**
  * Tablero Kanban, sprints ágiles, entregables y registro de jornadas de trabajo.

### 1.3. Motor Universal de Sesiones
1. **Preparar:** Define tu objetivo de foco, recurso o proyecto.
2. **Iniciar:** El temporizador comienza a correr en base a marcas de tiempo confiables (`Date.now()`).
3. **Pausar / Reanudar:** Si surge una interrupción real, pulsa "Pausar". El tiempo en pausa queda excluido del tiempo neto de habilidad.
4. **Resiliencia ante recarga:** Si cierras la pestaña o el navegador accidentalmente, al reabrir la app tu sesión continuará corriendo en segundo plano sin pérdida de segundos.
5. **Finalizar:** Consolida las notas y evidencias. Se emite un payload canónico hacia `/api/shortcuts/skill-session` con clave de idempotencia única que garantiza que nunca se dupliquen tus recompensas ni tu progreso.

### 1.4. Asistentes Contextuales (NPCs) & Gobernanza HITL
* Los residentes de los edificios (Clara, Eldrin, Lyra, Milo, Marcus) actúan como compañeros de apoyo:
  * **Nivel 1 (Automático):** Te saludan con sabiduría contextual y dejan preparado el temporizador con tu objetivo recomendado en un solo clic.
  * **Nivel 2 (HITL):** Te sugieren remates de proyectos o nuevas tareas. Estas propuestas **requieren siempre que pulses "Aceptar y Aplicar"** para ejecutarse. Si no deseas la sugerencia, pulsa "Descartar".
  * **Nivel 3 (Protegido):** Los residentes tienen **terminantemente prohibido** modificar tu oro (GP), tu experiencia (XP) o tus cuentas bancarias.
  * **Control del usuario:** Puedes silenciar a cualquier residente desde el engranaje de configuración o desactivar la asistencia globalmente.

---

## 2. Registro de Cambios (Changelog v3.5.0)

### Añadido
* **Dashboard Bento Cozy:** Rediseño completo con paleta de 8 tonos cálidos de Oakhaven (Forest, Cream, Bark, Meadow, Wood, Clay, Lake, Sunlight).
* **Pueblo Interactivo SVG:** Renderizado vectorial accesible de 9 distritos con coordenadas estables y badges de actividad viva.
* **9 Interiores Especializados:** Módulos funcionales completos para Atelier, Librería, Biblioteca, Club de Puzzles, Observatorio, Oficina, Huerto, Senderismo y Cocina.
* **Motor Universal de Sesiones (`universal-session-engine.ts`):** Ciclo completo de vida de sesión, pausas acumulativas, idempotencia criptográfica SHA-256 y persistencia resiliente ante recargas.
* **Hub de Recursos & Captura Inteligente (`skill-resources-hub.ts`):** Validación estricta de adjuntos (< 5MB y lista blanca MIME), dictado por voz Web Speech API y confirmación humana previa (HITL).
* **Progresión Visual del Pueblo (`visual-village-progression.ts`):** Transformación determinista de hitos en evolución arquitectónica (Tier 1 Cabaña -> Tier 2 Taller -> Tier 3 Santuario Maestro) con vitrina de creaciones y sin degradación por inactividad.
* **Asistentes Contextuales (`cozy-residents-engine.ts`):** Residentes estables con matriz de permisos de 3 niveles, auditoría local en journal y controles de silenciamiento.
* **Suite de Pruebas de Aceptación (`cozy-release-acceptance.test.ts`):** 9 casos de prueba formales para validación de release.

### Modificado
* **Atributos de Accesibilidad:** Incorporación de `role="dialog"`, `aria-modal="true"` y soporte para cierre por teclado con tecla `Escape` en modales.
* **Cumplimiento Táctil:** Botones principales ajustados con tamaño mínimo de 44x44px.
* **Seguridad:** Agregados `wallet_gp` y `vault_gp` a la lista de exclusión tajante `FORBIDDEN_LEVEL_3_FIELDS`.

---

## 3. Checklist Pre-Despliegue

- [x] **Pruebas Automatizadas:** 88 de 88 pruebas unitarias y de integración pasando al 100% (duración 1.6s).
- [x] **Tipos TypeScript:** 0 errores de tipado ejecutando `npx tsc --noEmit`.
- [x] **Compilación de Producción:** 28 de 28 rutas de Next.js compiladas limpiamente en 7.4s (`next build`).
- [x] **Invariante Financiera:** Verificado que ningún módulo Cozy emite GP/XP ficticio; los balances dependen exclusivamente de la Bóveda canónica.
- [x] **Aislamiento Multi-Tenant:** Confirmado que las llaves de almacenamiento segregan estrictamente por identificador de usuario (`<key>_<userId>`).
- [x] **Accesibilidad WCAG 2.1:** Contraste de colores Bark/Parchment en 11.4:1 (supera umbral AAA de 7.0:1), soporte `prefers-reduced-motion` y touch targets `>= 44px`.
- [x] **Resiliencia Offline:** Cola PWA y Service Worker probados ante desconexión de red.
- [ ] **Aprobación Formal del Usuario:** Requerida antes de ejecutar cualquier comando de despliegue a producción.

---

## 4. Protocolo y Plan de Reversión (Rollback Plan)

En caso de detectarse alguna anomalía no prevista durante el encendido controlado:

### 4.1. Punto de Restauración
* **Commit Estable Previo:** `f4ee2bd` (Fin de Fase 10).
* **Commit Actual Integrado:** `2d8ca46` (Fin de Fase 11 / Fase 12).
* **Invarianza de Base de Datos:** Ningún cambio de las Fases 4 a 12 alteró el esquema de Supabase ni las tablas canónicas (`profiles`, `habits`, `skill_sessions`, `wallet_logs`). Toda la persistencia nueva es aditiva o local-first en cliente. Por lo tanto, un rollback de código no requiere migraciones inversas de base de datos.

### 4.2. Procedimiento de Rollback Rápido
1. Si el tráfico debe ser revertido inmediatamente a la versión clásica del dashboard:
   * La ruta clásica permanece intacta en `/dashboard` y `/`.
   * Para desactivar la redirección a `/cozy`, basta con apuntar el router de Next.js a la vista previa.
2. Si se requiere restaurar el código al commit base:
   ```bash
   git revert 2d8ca46
   git push origin main
   ```
3. Limpieza de cachés locales en clientes afectados:
   * En caso de inconsistencia local de borrador, el Service Worker actualiza su versión de caché automáticamente o el usuario puede forzar recarga dura (`Ctrl + Shift + R`).
