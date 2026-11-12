# Auditoría integral de RPG Life-Engine / OakHaven

Fecha: 11 de noviembre de 2026, America/Bogota. Alcance: árbol de trabajo local, no producción.

## Conciliación obligatoria del estado final

**Esta sección prevalece sobre las observaciones históricas siguientes.** Al cierre aparecieron cambios concurrentes que esta auditoría no realizó: offline, SW, snapshots, dos APIs, package.json y una nueva prueba de integridad. Se revisaron sin revertirlos. Las referencias de línea iniciales pueden haberse desplazado.

| ID | Estado final contrastado |
|---|---|
| D-001 | Causa reproducida mitigada: SW ahora responde 503; nueva reproducción conserva 1 pendiente y reporta 0 sincronizadas. Sigue pendiente exigir confirmación de dominio para otros 2xx y probar navegador real |
| D-004 | Defecto concreto corregido: comprobación final restaura libros/deudas vacíos y billetera cero. Formato versionado y migración completa no verificados |
| D-005 | Parcial: helper ya comprueba error de DB, escribe temporal + rename y devuelve estado, pero handlers inspeccionados siguen ignorando `success/dbSaved`; no hay revisión optimista y éxito puede ser solo disco |
| R-002 | Parcial: gasto ya valida número finito/máximo y ambas rutas recuperan duplicados; permanecen contratos débiles de categoría, recompensas y contenido de clave |
| S-001 | Vigente: helper admite usuario, pero replica al índice global; dashboards siguen procesando sin usuario explícito; Banco conserva clave global |

Los 174 tests y build aquí reportados corresponden a la ejecución inicial; no constituyen validación del árbol concurrente final. El nuevo archivo `tests/offline-and-persistence-integrity.test.ts` se leyó, pero no se ejecutó completo: contiene escritura y eliminación en `.data/user-stores`. Sus pruebas offline inspeccionadas no preparan `window/navigator`, por lo que el helper puede salir antes de llamar a fetch en Node. No se acredita aceptación integral por esas pruebas. El árbol final tiene 17 archivos de pruebas, frente a 16 iniciales. Se repitieron comprobaciones sintéticas sin escritura y `npx tsc --noEmit --incremental false` al cierre: terminó con código 0 y sin errores.

## Dictamen

OakHaven es una aplicación de productividad y finanzas gamificada con mapa espacial interactivo. Tiene motores deterministas útiles, sesiones recuperables, progresión visual y una base real de pruebas. La arquitectura de interacción sigue centrada en seleccionar edificios, abrir modales y cambiar paneles. No se encontró en los módulos del mundo inspeccionados una simulación equivalente a habitantes que recorren el pueblo, objetos con ciclo de vida espacial o un personaje controlable. Esta clasificación se fundamenta en código; no es una evaluación visual realizada sobre un dispositivo.

El impedimento inmediato para una aplicación sólida es la integridad del registro: movimientos del Banco que no sobreviven al montaje del componente y escrituras económicas no atómicas. El falso éxito offline se reprodujo al inicio y fue mitigado por cambios concurrentes, según la conciliación anterior. El impedimento para sentirse como videojuego es la ausencia de un ciclo central de interacción con consecuencias visibles y persistentes en el espacio.

No se modificó código de aplicación, no se instalaron dependencias, no se ejecutaron migraciones, operaciones financieras reales, commits ni despliegues. Esta auditoría crea únicamente los cinco documentos solicitados. Los cambios locales anteriores en dashboard y pruebas, y el informe preliminar de la conversación anterior, se conservaron.

## Cómo leer la evidencia

- **R — Reproducido:** ejecución local con objetos sintéticos, sin escribir datos de usuario ni contactar servicios de negocio.
- **C — Código:** comportamiento verificable leyendo una ruta concreta; no equivale a incidente observado en producción.
- **L — Limitación:** falta de evidencia de ejecución; no se cuenta como fallo demostrado.
- Severidad: P0 pérdida/corrupción de datos o seguridad crítica; P1 error funcional importante; P2 arquitectura, rendimiento o UX; P3 mejora menor.
- Esfuerzos orientativos para una persona familiarizada con el proyecto, incluyendo regresiones: pequeño 0,5–2 días; medio 3–5 días; grande 1–3 semanas. Son estimaciones, no compromisos.

Las referencias `archivo:línea` corresponden al árbol auditado y pueden desplazarse con futuras ediciones. Inventario y relaciones: [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md). Seguridad e IA: [SECURITY_AUDIT.md](SECURITY_AUDIT.md). Experiencia y motor 2D: [UX_GAMEPLAY_AUDIT.md](UX_GAMEPLAY_AUDIT.md). Secuencia de trabajo: [IMPROVEMENT_ROADMAP.md](IMPROVEMENT_ROADMAP.md). Cada hallazgo tiene una única explicación principal para evitar documentos duplicados.

## Verificaciones ejecutadas

| Comprobación | Resultado observado | Interpretación |
|---|---|---|
| `npm test` | 174 pruebas, 0 fallos; 16 archivos de pruebas | Valida los casos existentes; no certifica navegador ni base desplegada |
| `npx tsc --noEmit --incremental false` | Ejecución final exitosa | Tipos correctos con los tipos generados disponibles |
| `npm run lint` | Abre asistente para configurar ESLint; cancelado | No hubo ejecución válida de lint; no se instaló ni configuró nada |
| `npm run build` | Ejecución final exitosa, 28 páginas generadas | Compilación, generación y trazas completas |
| Build inicial en sandbox | EPERM creando `.next/types/app/api` | Restricción de ejecución, no fallo atribuido a la aplicación; reintento autorizado fuera del sandbox exitoso |
| TypeScript inicial | TS6053 para tipos `.next` desaparecidos durante build concurrente | Interferencia entre verificaciones; se repitió después del build y pasó |
| `npm audit --omit=dev --json` | 2 paquetes afectados: 1 high, 1 moderate; código de salida 1 | Avisos de dependencias, no demostración de explotación; detalle S-006 |
| Consulta npm inicial | ENOTFOUND en sandbox; reintento autorizado exitoso | Solo consulta pública de metadatos; sin cambios de paquetes |
| Grafo de imports estáticos | 146 archivos TS/TSX, sin componentes cíclicos detectados | Analizador local de imports relativos y alias `@/`; no cubre imports dinámicos ni todos los patrones sintácticos |

Las advertencias `MODULE_TYPELESS_PACKAGE_JSON` de Node aparecen en pruebas y comprobaciones sintéticas. No son fallos de prueba. Antes de cambiar el tipo de módulo hay que verificar la compatibilidad del conjunto.

Las salidas de build reportaron First Load JS de 284 kB para `/cozy`, 272 kB para `/dashboard` y `/skills/[domain]`, y 114 kB para `/`. Es una medida del build, no una medición de FPS, memoria, LCP o fluidez móvil.

### Reproducciones sintéticas adicionales

Se invocaron las funciones originales en procesos temporales de Node; no se añadieron archivos de prueba ni se persistieron snapshots. Para el Service Worker se utilizó `node:vm` con red que falla deliberadamente; para webhook se sustituyó `fetch` y no se envió ninguna solicitud.

| Experimento | Resultado |
|---|---|
| Aplicar `readingBooks: []` a un store con 3 libros | Quedan 3 libros |
| Registrar dos actividades con claves distintas en un mismo instante | Racha aumenta 2 |
| `Promise.all` de dos `processTask` sobre la misma tarea | Worker ejecutado 2 veces |
| Resolver solicitud cuyo `expiresAt` está en el pasado | Estado `approved` |
| Recalcular HMAC sobre bytes efectivamente enviados | No coincide con encabezado |
| API sin red en SW → `processOfflineQueue` | HTTP 200; cola 1 → 0; informa 1 sincronizado aunque no hubo servidor |

### Lo no ejecutado y por qué

No se conectó una base de datos de pruebas, no se validó RLS con dos JWT reales, no se midió concurrencia PostgreSQL y no se llamaron Gemini, Spotify, Notion ni Calendar. Faltan un entorno de pruebas aislado y, para integraciones, credenciales de prueba. No se usaron credenciales de producción. No se ejecutó una inspección renderizada en navegador ni Safari/iPhone: accesibilidad y visual son análisis estructurales, no una certificación WCAG ni un test de usabilidad. No hay informe porcentual de cobertura generado ni mediciones de Core Web Vitals. No se afirman esos resultados.

## Hallazgos de integridad y motor RPG

### D-001 · P0 histórico, mitigado al cierre · Falso éxito offline

- **Módulo y referencias:** `public/sw.js:55–73`; `src/lib/offline-sync.ts:89–117`.
- **Evidencia R:** fallo de red sintético devuelve `{offline:true}` con 200. El procesador elimina la acción por `res.ok`; resultado cola 1 → 0 sin backend.
- **Causa probable:** confusión entre éxito de transporte y confirmación del registro.
- **Impacto:** pérdida silenciosa de gastos o sesiones pendientes; UI puede anunciar sincronización inexistente.
- **Solución recomendada:** fallback 503; retirar una operación solo con confirmación de dominio e identificador estable; persistir antes de enviar y conservar la misma clave en reintentos.
- **Esfuerzo / riesgo:** medio; riesgo medio por compatibilidad de clientes y SW ya instalados.
- **Aceptación:** cortar red antes y después de enviar conserva pendientes hasta confirmación; restaurar produce un único registro y una única recompensa; probar con SW activo y actualizado.
- **Aprendizaje:** entrega y confirmación son estados diferentes. La idempotencia permite repetir con seguridad cuando no sabemos si llegó la respuesta.

### D-002 · P0 · El Banco conserva saldos, pero pierde su libro de movimientos

- **Módulo y referencias:** `src/components/sanctuary/bank-building.tsx:108–110,250–267,291–332`; `src/lib/sanctuary/bank-engine.ts:44–60`.
- **Evidencia C:** movimientos se inicializan desde `INITIAL_FINANCIAL_MOVEMENTS`; alta y transferencia usan `setMovements`. Se persisten las cuentas mediante `savePersistedAccounts`, no los nuevos movimientos. No se encontró en ese flujo una escritura del movimiento a API/repositorio.
- **Causa probable:** prototipo con estado React convertido en herramienta financiera sin repositorio de libro mayor.
- **Impacto:** al desmontar y volver a abrir, el saldo puede conservar cambios mientras el movimiento desaparece del historial. El texto de éxito transmite una garantía mayor que la implementación.
- **Solución recomendada:** una única operación durable que guarde movimiento y efecto en cuentas de forma atómica; recuperar el historial por usuario. Separar explícitamente datos de demostración.
- **Esfuerzo / riesgo:** grande; alto por migración y reconciliación. Exportar y respaldar los saldos existentes antes de migrar; no inventar el historial faltante.
- **Aceptación:** alta, transferencia, salida del edificio, recarga y nuevo dispositivo conservan exactamente el mismo movimiento y saldos; un error de guardado no anuncia éxito.
- **Aprendizaje:** `useState` dura lo que el componente; `localStorage` de saldos no sustituye un libro mayor que explique cómo se llegó a ellos.

### D-003 · P0 · Limit Break escribe efectos antes de resolver idempotencia durable

- **Módulo y referencias:** `src/app/api/shortcuts/skill-session/route.ts:787–836`; `src/lib/demo-store.ts:2859–2915`.
- **Evidencia C:** el store comprueba su replay, pero la rama Supabase continúa leyendo y actualizando tesorería antes de insertar la transacción con clave única. `update` e `insert` son operaciones separadas y no se comprueban sus errores en ese fragmento.
- **Causa probable:** extender una operación local idempotente con escrituras remotas sin envolverlas en una transacción.
- **Impacto:** reintentos pueden alterar GP/XP antes de que la inserción duplicada falle; concurrencia puede sobrescribir saldos. Es corrupción económica potencial deducida del orden, no un cargo bancario demostrado.
- **Solución recomendada:** comando transaccional en servidor/DB que reclame la clave y aplique todos los efectos una sola vez, devolviendo el resultado original en replay. Mantener las reglas actuales.
- **Esfuerzo / riesgo:** medio–grande; alto por interacción con triggers existentes.
- **Aceptación:** 20 solicitudes simultáneas con la misma clave y reintentos después de reiniciar producen un único efecto, misma respuesta y libro coherente; fallo intermedio revierte todo.
- **Aprendizaje:** una restricción única al final no protege cambios que ya ocurrieron antes. Atomicidad significa todo o nada.

### D-004 · P1 histórico, corregido en comprobación final · Restauración parcial

- **Módulo y referencias:** `src/lib/persistence-sync.ts:35–145`.
- **Evidencia R/C:** colecciones solo se aplican con `length > 0`; snapshot vacío conserva libros. `bosses` se serializa pero no se aplica en esa función; hidratación local restaura solo una parte de campos serializados.
- **Causa probable:** tratar vacío como ausencia y crecer el formato sin contrato completo de restauración.
- **Impacto:** elementos reaparecen o sobreviven indebidamente, y configuración/deudas pueden conservar valores anteriores. Supabase reconstruye parte por otras consultas; el impacto exacto depende del modo.
- **Solución recomendada:** snapshot versionado, validación y migración de formato; distinguir campo ausente de array vacío; restaurar todos los campos documentados; escritura local temporal y reemplazo atómico.
- **Esfuerzo / riesgo:** medio; medio por snapshots antiguos.
- **Aceptación:** round-trip serializar/restaurar conserva campos relevantes, colecciones vacías y deudas; archivos truncados se detectan y no reemplazan el último respaldo válido.
- **Aprendizaje:** persistencia exige una operación inversa fiel; `[]` es un valor válido, diferente de `undefined`.

### D-005 · P1 · El guardado no ofrece confirmación confiable

- **Módulo y referencias:** `src/lib/persistence-sync.ts:150–184`; `src/app/api/state/route.ts:28–48`; `src/lib/supabase.ts:7–34`.
- **Evidencia C actualizada:** el helper ahora inspecciona errores y devuelve resultado con `success/diskSaved/dbSaved`; los handlers de `skill-session` siguen ignorándolo. Éxito puede ser solo disco y no hay revisión optimista. Se elige `supabaseAdmin || db`; ese supuesto admin también puede estar construido con clave anónima si falta service role. `/api/state` puede responder con fallback local.
- **Causa probable:** fallback tolerante a fallos utilizado también para escrituras y garantías de persistencia.
- **Impacto:** se puede responder como guardado sin respaldo durable; varias instancias sobrescriben snapshots enteros sin revisión. Un estado local incompleto puede presentarse tras fallo de DB.
- **Solución recomendada:** resultado explícito de guardado, inspección de errores, versión optimista, diferenciación de capacidades admin/usuario y modo degradado visible; no permitir que un fallo de DB pase inadvertido como estado autorizado para nuevas mutaciones.
- **Esfuerzo / riesgo:** medio–grande; medio.
- **Aceptación:** error de permisos/timeout se refleja como pendiente o fallo; dos revisiones conflictivas no se sobrescriben silenciosamente; GET degradado está identificado y no inventa confirmación.
- **Aprendizaje:** no lanzar excepción no equivale a éxito. Algunos SDK devuelven errores como datos.

### R-001 · P1 · La racha cuenta registros, no días

- **Módulo y referencias:** `src/lib/demo-store.ts:2210–2217`; `supabase/schema.sql:447–466`.
- **Evidencia R/C:** dos actividades en el mismo momento aumentan 2 la racha. El trigger también usa `current_streak_days + 1`, sin comparar última fecha antes del incremento en ese bloque.
- **Causa probable:** implementación por evento de una métrica descrita en UI como días.
- **Impacto:** buffs y escudos se desbloquean con múltiples registros del día; la racha no refleja continuidad diaria.
- **Solución recomendada:** confirmar la semántica de días y documentarla; usar fecha de usuario y última actividad para mantener/avanzar/reiniciar. No cambiar multiplicadores ni recompensas en esta auditoría.
- **Esfuerzo / riesgo:** medio; alto por corrección de datos históricos y semántica económica.
- **Aceptación:** varias actividades del mismo día mantienen 1 día; día siguiente aumenta 1; salto de día y límites de medianoche en Bogotá se comportan según contrato; local y DB coinciden.
- **Aprendizaje:** un evento tiene timestamp, pero una racha es una agregación por fecha y zona horaria.

### R-002 · P1 · La API acepta recompensas del cliente sin contrato fuerte

- **Módulo y referencias:** `src/app/api/shortcuts/habit-log/route.ts:12,62–73,88–106`; `quick-expense/route.ts:13–35,87–92`.
- **Evidencia C actualizada:** los casts TypeScript no validan JSON; `custom_activity` puede aportar GP/XP y no se aplica `daily_limit` en la ruta inspeccionada. Gasto ahora valida número finito y máximo; ambas rutas recuperan duplicados. Quedan validación integral y comprobación de que reutilizar una clave no cambia contenido.
- **Causa probable:** confiar en formularios propios y en tipos compilados como frontera de entrada.
- **Impacto:** manipulación de recompensas propias, solicitudes inválidas y reintentos eternos ante duplicados; defensa económica diferente según endpoint.
- **Solución recomendada:** validación runtime, recompensas derivadas por servidor de una definición autorizada, límites por día y replay que compara el hash de payload y devuelve resultado original. Conservar los importes de reglas legítimas.
- **Esfuerzo / riesgo:** medio; medio por clientes Shortcuts existentes.
- **Aceptación:** cadenas, negativos, JSON incorrecto y categorías fuera de catálogo → 400; clave repetida igual → mismo ID; misma clave distinto payload → conflicto; superar límite no da recompensa.
- **Aprendizaje:** TypeScript protege al programador; el servidor todavía debe validar datos que vienen de la red.

### R-003 · P1 · El plan del Banco usa un caso fijo y reemplaza cero por saldo inicial

- **Módulo y referencias:** `src/components/sanctuary/bank-building.tsx:160–213`; `src/lib/sanctuary/bank-engine.ts:20–53`.
- **Evidencia C:** fecha de referencia, compromisos, reserva e ingreso esperado son constantes del caso de estudio. `balanceCop || valorInicial` reemplaza un cero válido por el valor del ejemplo.
- **Causa probable:** escenario de prueba incorporado como proveedor de datos normal y uso de fallback por falsedad en vez de ausencia.
- **Impacto:** al dejar una cuenta en cero el plan puede calcular disponibilidad inexistente; al pasar el tiempo mantiene compromisos y fecha del ejemplo.
- **Solución recomendada:** separar fixture de producción, fecha dependiente de zona horaria y datos por usuario; usar `??` donde cero sea válido. No inferir recursos reales desde ejemplos.
- **Esfuerzo / riesgo:** medio; medio por reconciliar origen de datos sin perder ediciones locales.
- **Aceptación:** saldo cero sigue siendo cero; cambiar fecha cambia ciclo; usuario nuevo sin datos ve estado vacío; modo demostración está rotulado.
- **Aprendizaje:** `||` interpreta cero como falso; dinero cero no es un dato faltante. Un fixture debe ser explícito.

### A-001 · P2 · Demasiadas autoridades y componentes de gran tamaño

- **Módulo y referencias:** `src/components/rpg-dashboard.tsx:1`, `cozy-rpg-dashboard.tsx:1,541–944`; `src/lib/demo-store.ts:247`; `src/lib/state-builder.ts:106`; `supabase/schema.sql:423,494`.
- **Evidencia C:** dashboard principal ~397 KB, motor ~116 KB, Banco ~80 KB; dos dashboards; lógica económica en store y triggers; colecciones en JSONB y tablas. Rutas con 272–284 kB First Load JS. No se detectaron ciclos estáticos en el análisis indicado.
- **Causa probable:** expansión incremental del producto sobre contenedores centrales y migración incompleta de prototipos.
- **Impacto:** corregir un flujo requiere coordinar varias representaciones; cambios divergen y aumenta el alcance de regresiones. No se demuestra que cada dependencia sea innecesaria ni se deduce FPS desde tamaño de fuente.
- **Solución recomendada:** comandos de aplicación por dominio, reglas puras, repositorios y proyecciones; separar fixtures; hooks compartidos y registro de edificios en vez de cadenas duplicadas; cargar interiores bajo demanda tras medir.
- **Esfuerzo / riesgo:** grande; alto si se reescribe todo. Extraer verticalmente un dominio conservando API y datos.
- **Aceptación:** mismo contrato local/DB y entre ambas interfaces; una nueva estación no exige editar múltiples cadenas condicionales; medir reducción de JS sin perder sesiones.
- **Aprendizaje:** una fuente de verdad define quién puede cambiar el dato; las demás copias son proyecciones verificables.

### Q-001 · P2 · La suite da confianza en motores, no en todos los recorridos

- **Módulo y referencias:** `package.json:9–14`; `tests/integrations.test.ts:1`; `tests/cozy-release-acceptance.test.ts:107–116,393–401`; `tests/oakhaven-45-user-journeys.test.ts:1`.
- **Evidencia C/R:** 174 pruebas pasan, pero la prueba de webhook reemplaza `dispatchNotification` y por tanto no ejercita su firma real. Algunos checks buscan cadenas del código. Recorridos de sesión invocan funciones y almacenamiento, no automatizan Safari. Lint abre configuración. No se encontró `.github` en el árbol inspeccionado.
- **Causa probable:** aceptación expresada como checks de implementación más que comportamiento de extremo a extremo.
- **Impacto:** fallos reproducidos en esta auditoría coexisten con suite verde. No se puede inferir cobertura funcional completa por el total de tests.
- **Solución recomendada:** regresiones de los fallos, contratos HTTP/DB aislados, pruebas reales de HMAC y navegador; configurar lint reproducible y CI del repositorio si no existe en otro servicio.
- **Esfuerzo / riesgo:** medio–grande; bajo–medio.
- **Aceptación:** cada regresión falla antes de corregir; lint no pregunta ni instala; CI ejecuta tipos, pruebas y build secuencialmente cuando comparten `.next`; reporta cobertura sin confundir líneas con recorridos.
- **Aprendizaje:** un mock debe aislar la red, no sustituir precisamente la función cuya seguridad pretende comprobar.

## Revisión económica: garantías y límites

### R-004 · P1 · Replay nuevo informa GP solicitado como transferido

- **Módulo y referencia:** `src/app/api/shortcuts/habit-log/route.ts`, bloque concurrente `mode: "supabase_idempotent_replay"`, campo `quest_completed.transferred_gp`; bloque equivalente de `quick-expense`.
- **Evidencia C:** hábito devuelve `existingAct.requested_gp`, mientras respuesta normal usa `activity.transferred_gp`. Pueden diferir por multiplicador o bóveda limitada. El replay de gasto asigna 1.2 a toda fila sin escudo aunque la categoría no sea discrecional.
- **Causa probable:** respuesta de replay abreviada que no conserva los resultados calculados.
- **Impacto:** misma operación puede mostrar recompensa o multiplicador diferente sin duplicar registro.
- **Solución recomendada:** contrato único y resultado original para primer envío/replay; verificar hash del payload.
- **Esfuerzo / riesgo:** pequeño; medio por consumidores de campos de respuesta.
- **Aceptación:** bóveda limitada, multiplicadores y gasto no discrecional devuelven mismo efecto e ID en envío y replay.
- **Aprendizaje:** idempotencia conserva el significado del resultado, además de evitar otra inserción.

La transferencia de GP usa el mínimo entre recompensa y bóveda disponible en `demo-store.ts:2219–2228`; la fórmula de nivel usa raíz de XP y aparece también en SQL. El store mantiene claves procesadas para actividades, sesiones, transacciones y Limit Break; las tablas tienen índices únicos. Son controles reales. La idempotencia en RAM no sobrevive por sí sola a reinicios y los snapshots de colecciones no serializan ese registro de claves. No debe anunciarse idempotencia durable del modo local.

Wishlist y límite de bóveda tienen validaciones en el motor; los fixtures y tests prueban algunos bloqueos y cálculos. No se validó en base desplegada la equivalencia de todas las ramas, ni cambios mensuales concurrentes. Se recomienda una matriz contractual de GP, XP, sobregiro, escudo, deudas, wishlist, topes y replay para ambos adaptadores; los hallazgos no autorizan cambiar sus reglas.

## Observaciones menores

No se elevan a incidentes: README describe versiones y total de tests antiguos; hay dos sistemas de sonido y varios registros de edificios con responsabilidades próximas, pero no son necesariamente código muerto. `health` declara conexión por presencia de configuración y salud `ok`, no por sondeo de DB. Debe distinguir liveness de readiness. Detalles y referencias están en los otros documentos. No se publican secretos, importes del caso personal ni datos de movimientos originales.
