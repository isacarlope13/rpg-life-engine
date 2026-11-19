# OakHaven 5.0 â€” backlog verificable

Estado: **G00 implementada y verificada localmente; G01 funcional en `/play`; G02.1/G02.2 implementadas y probadas como mÃ³dulos puros**, con validaciÃ³n en dispositivo real y perfil prolongado G01 pendientes. ConexiÃ³n a servicios autenticados y G03â€“G13 pendientes. Referencias del baseline auditado en [GDD](GAME_DESIGN_DOCUMENT.md); contratos en [TDD](TECHNICAL_DESIGN_DOCUMENT.md). Archivos nuevos de tareas pendientes son ubicaciones propuestas, no capacidades ya existentes.

Esfuerzo relativo: S = acotado (1â€“2 puntos), M = varios componentes (3), L = integraciÃ³n (5), XL = requiere dividirse (8). No equivalen a tiempo de cuota; cada L/XL debe partirse antes de ejecutarse. Consultar cuota oficial al iniciar cada unidad y aplicar el Governor. Ninguna tarea autoriza commit, despliegue ni operaciones financieras reales.

Complemento documental: [estudio Nookery](NOOKERY_ADAPTATION_STUDY.md) y contratos originales ADR-002 del TDD. No abre otra lÃ­nea de implementaciÃ³n. Prioridades actualizadas: P0 preservaciÃ³n/seguridad/economÃ­a; P1 personaje, exploraciÃ³n e interacciÃ³n; P2 habitantes/inventario/diÃ¡logo; P3 decoraciÃ³n avanzada, eventos y mandos opcionales. Esta entrega no implementa ninguna tarea adicional.

## Orden y puertas

**Cierre Prompt 0.1:** arquitectura actualizada, sin iniciar Prompt 1. Su alcance recomendado, sujeto a autorizaciÃ³n, es Ãºnicamente G02.1: contratos originales y estados/input contextual con fixtures y comprobaciÃ³n de lÃ­mites de imports. No implementar todavÃ­a creador, nuevo runtime ni integraciÃ³n econÃ³mica. G02.2 y las siguientes tareas mantienen sus dependencias; la [matriz de aceptaciÃ³n](NOOKERY_ADAPTATION_STUDY.md#8-trazabilidad-del-prompt-01) no es una segunda lista de tareas.

Siguiente trabajo tras G02 puro: G03.1, aislamiento por propietario de sesiones/offline con pruebas sintÃ©ticas; fraccionar G03 antes de modificar. Completar medidas mÃ³viles/rendimiento de G01 antes de acreditar esa aceptaciÃ³n. G00/G01 no se desplegaron. Prototipo espacial con fixtures: G01 â†’ G02 â†’ G07 â†’ G08. Piloto con cuenta real: ademÃ¡s exige G00, G03, G04, G05, G06, G09 y G11. G10 enriquece presencia, sin ser condiciÃ³n de un registro correcto. G12 siempre es posterior y requiere autorizaciÃ³n.

## G00 Â· P0 Â· Cerrar riesgo de apropiaciÃ³n de cuenta en signup

**Estado local:** completada. Handler aislado en `src/lib/auth-login.ts`; ruta usa ese mismo handler. RegresiÃ³n inicial: 5 fallos de 9 casos, incluida alteraciÃ³n reproducida de contraseÃ±a sintÃ©tica. Tras correcciÃ³n: 17 regresiones de auth y 191 pruebas del conjunto seguro aprobadas; TypeScript y build de producciÃ³n local aprobados. Build requiriÃ³ reintento autorizado fuera del sandbox por EPERM de archivos standalone. No se usÃ³ Supabase real. Se eliminÃ³ actualizaciÃ³n/auto-confirmaciÃ³n de cuentas existentes, se evita identidad local por sesiÃ³n remota ausente y el bootstrap piloto se limita al entorno no productivo. Se conserva la creaciÃ³n inmediata de usuarios nuevos con admin ya existente; no se implementÃ³ un nuevo sistema de recuperaciÃ³n ni se acredita seguridad integral de todas las rutas.

- **Objetivo:** impedir que registro duplicado actualice contraseÃ±a/confirmaciÃ³n de una identidad cuya propiedad no se ha demostrado (G-SEC-01).
- **Dependencias:** ninguna; se autorizÃ³ esta unidad de implementaciÃ³n tras entregar el diseÃ±o.
- **Archivos probables:** `src/app/api/auth/login/route.ts`, prueba nueva `tests/auth-signup-ownership.test.ts`; extraer helper mÃ­nimo si facilita simular proveedor sin servidor real.
- **AceptaciÃ³n:** registro de email existente jamÃ¡s llama admin update de contraseÃ±a; login vÃ¡lido conserva comportamiento; recuperaciÃ³n de cuenta ocurre por mecanismo verificado del proveedor, no repeticiÃ³n de signup. No ampliar auto-confirmaciones.
- **Pruebas:** cliente Supabase simulado, credenciales totalmente sintÃ©ticas, casos duplicado/incorrecto/propietario vÃ¡lido; verificar que no se invoca mutaciÃ³n privilegiada. Ninguna cuenta real ni envÃ­o de correo.
- **Riesgos:** cambiar compatibilidad del acceso piloto; error UI debe ser claro sin enumerar cuentas innecesariamente.
- **Esfuerzo:** M, dividir test y correcciÃ³n revisable. Bloquea ampliaciÃ³n del registro.

## G01 Â· P1 Â· Spike de Phaser dentro de Next

**Estado local:** runtime Phaser 4.2.1 fijado (MIT), plaza/interior con sprite original, cuerpo Arcade, navegaciÃ³n alrededor de obstÃ¡culos y controles React. Cleanup probado 0/1 canvas al cerrar/reabrir. Ocho regresiones nuevas, conjunto seguro de 199 pruebas, TypeScript y build aprobados. Chrome escritorio y ventana estrecha verificados; no Safari/dispositivo tÃ¡ctil real ni traza prolongada de FPS/memoria. Resultado: continuar con contratos G02; aceptaciÃ³n mÃ³vil/rendimiento condicionada a completar esas medidas. [Resultados y capturas](G01_SPIKE_RESULTS.md).

- **Objetivo:** validar decisiÃ³n de renderer con una plaza mÃ­nima, sprite original, pared y entrada.
- **Dependencias:** ADR-001 del TDD. Antes de instalar justificar/pinar versiÃ³n y revisar herramientas existentes.
- **Archivos probables:** `src/app/play/page.tsx`, `src/components/game/game-canvas.tsx`, `src/game/client/boot.ts`, `package.json`/lockfile solo cuando la implementaciÃ³n tenga alcance autorizado.
- **AceptaciÃ³n:** carga solo en cliente, un canvas, movimiento/colisiÃ³n simple y limpieza en desmontaje; ninguna llamada de negocio. No reemplazar app por plantilla Vite.
- **Pruebas:** montaje/desmontaje/Strict Mode, resize/orientaciÃ³n/suspensiÃ³n y traza de cinco minutos en dispositivo de referencia; registrar bundle e input. Si no hay dispositivo, declarar esa parte pendiente.
- **Riesgos:** tamaÃ±o JS, GPU/Safari, listeners duplicados; fallback a herramientas existentes.
- **Esfuerzo:** M; resultado go/no-go documentado antes de ampliar escenas.

## G02 Â· P1 Â· Contratos de dominio y adaptador de lectura

**G02.2 completada en alcance puro:** `src/game/domain/projection.ts` adapta snapshots ya obtenidos a progreso, habilidades, QuestPresentation e InventoryView, con siete pruebas nuevas. Preserva valores exactos e IDs, saldo negativo incluido; no recalcula nivel/XP ni recompensas. Faltantes/malformados producen `null`, listas con incidencias y estado degraded, nunca valores financieros de ejemplo. Misiones antiguas sin estado quedan unavailable; no se infiere cumplimiento. ProyecciÃ³n profundamente congelada y separada del input; evita copiar email/tokens. Proveniencia fixture/provided-state explÃ­cita y rechazo por propietario distinto antes de leer datos. El sobre de propietario lo deberÃ¡ construir un host confiable: este chequeo no autentica ni valida pertenencia en servidor. Sin fetch, bootstrap, persistencia o conexiÃ³n runtime. Suite segura: 212 aprobadas; TypeScript aprobado. Puente HTTP/identidad real sigue condicionado a G03/G04.

**Prompt 1 / G02.1 completado localmente:** diez contratos originales y tipos auxiliares en `src/game/domain/contracts.ts`; contexto/filtro puro en `input-context.ts`, sin integraciÃ³n runtime ni DOM. Seis regresiones de bloqueo por contexto/dispositivo, IME, vectores finitos, fixtures por referencias y lÃ­mites de imports; restricciones de readonly/sin economÃ­a verificadas por TypeScript. Suite segura aprobada, excluyendo el test de integridad que escribe/elimina `.data`. Sin dependencias nuevas, servicios, datos reales, migraciones, commits ni despliegue. G02.2 (proyecciones/adaptadores) sigue pendiente; ningÃºn evento tipado acredita confirmaciÃ³n del servidor.

**DivisiÃ³n integrada:** G02.1 define los diez contratos originales del TDD (Scene, SceneTransition, Character, PlayerInput, InteractiveObject, NPC, Dialogue, InventoryView, QuestPresentation, WorldEvent), mÃ¡s estados de movimiento/animaciÃ³n e input contextual; G02.2 proyectarÃ¡ desde fixtures/servicios actuales sin nueva economÃ­a. No portar structs/bitfields externos. Contratos no equivalen a autorizaciÃ³n ni a confirmaciÃ³n durable.

- **Objetivo:** proyecciÃ³n Ãºnica de personaje/progreso y puente tipado entre renderer, HUD y servicios existentes.
- **Dependencias:** GDD/TDD; G01 para validar lifecycle real, tipos puros pueden precederlo.
- **Archivos probables:** `src/game/domain/{character,world,projection,events}.ts`, `src/game/application/game-services.ts`, `src/game/adapters/existing-rpg-services.ts`, `src/types/rpg.ts` solo donde falte contrato compartido.
- **AceptaciÃ³n:** nivel/XP/GP/habilidades/misiones derivan de estado actual; renderer no importa servidor privilegiado ni almacena otra economÃ­a; fixture rotulado no contamina cuenta real. InventoryView/QuestPresentation referencian IDs existentes y WorldEvent no ofrece operaciones para otorgar GP/XP. Input de texto/IME es un contexto distinto de explorar.
- **Pruebas:** fixtures antiguos, faltantes y estado degradado; comparaciÃ³n exacta de proyecciones y test de imports prohibidos. No usar `/api/state` como bootstrap inocuo para nuevos sin preparaciÃ³n.
- **Riesgos:** normalizaciÃ³n que oculta errores o reinterpreta saldos; preservar incertidumbre explÃ­cita.
- **Esfuerzo:** M.

## G03 Â· P0 Â· Una sesiÃ³n y una confirmaciÃ³n durable

**Ciclo autÃ³nomo posterior: G03.2a local completada y endurecimiento parcial de persistencia.** Captura/reintento inmutable, confirmaciÃ³n por ID, recibo local, tiempo pausado pendiente, deduplicaciÃ³n en pÃ¡gina y error visible. Eliminados envÃ­os duplicados de gimnasio/diario y mÃ­nimos ficticios de cero tiempo (duraciÃ³n manual explÃ­cita conservada). Cola exige ack canÃ³nico; perfil exige fila persistida. Notas/recursos/borradores usan identidad real y preservan legacy. Resultado y lÃ­mites en [G03_SESSION_RELIABILITY_RESULTS.md](G03_SESSION_RELIABILITY_RESULTS.md). **252 pruebas completas, 14 escenarios browser, tipos y build aprobados.** Sin nuevos paquetes/commits/despliegues.

**G03.2b pendiente:** transacciÃ³n/idempotencia durable para todos los efectos tras reinicio y entre instancias. Las mejoras de cliente y el guard de replay en memoria no lo resuelven. DiseÃ±ar regresiones de restart/concurrencia y estrategia aditiva de operaciÃ³n/receipt antes de modificar SQL; no ejecutar migraciones o finanzas reales. G03 global no completa. PublicaciÃ³n de bajo riesgo autorizada por el Ãºltimo usuario, pero bloqueada por falta de proveedor enlazado/autenticado; no crear un proveedor nuevo ni publicar el backend financiero como si estuviera validado.

**G03.2b.1 integrada localmente:** recuperaciÃ³n por propietario de historial/recibos desde snapshot atÃ³mico y perfil antes del primer comando. Ocho pruebas incluyen otro proceso Node; sin segundo pago ni progreso de recurso para snapshots completos. No cubre el intervalo anterior al snapshot ni concurrencia distribuida.

**G03.2b.2 preparada, no activada:** borrador SQL transaccional y 14 pruebas PostgreSQL WASM, sin base externa ni cambio de ruta a RPC. PGlite 0.5.16 solo dev, justificado para pruebas SQL sin iniciar Docker. Datos financieros provienen del trigger existente. PostCSS de Next parcheado mediante override acotado: audit runtime 0, sin major de Next. Evidencia en el documento de resultados.

**G03.2b.3 preparada y verificada, inactiva (M):** objetivo conectar un adaptador server-only al contrato atÃ³mico sin doble aplicaciÃ³n local/SQL; depende de b.1/b.2 y de la revisiÃ³n de [MIGRATION_PLAN.md](MIGRATION_PLAN.md). Archivos probables: servicio/adaptador de sesiÃ³n, ruta skill-session y pruebas de integraciÃ³n. AceptaciÃ³n: bandera apagada por defecto, propuesta por el motor existente sin mutar el store vivo antes del commit, GP efectivo SQL autoritativo, sin fallback legacy al fallar RPC y sin duplicados por reintento. Pruebas: contrato completo, rollback y varias conexiones PostgreSQL nativas antes de activar. Riesgos: mezcla de protocolos, revisiÃ³n de perfil, doble multiplicador y restauraciÃ³n legacy. No aplicar migraciones a producciÃ³n ni afirmar G03 completada.

**G03.1a local: cola offline aislada.** `offline-sync.ts` exige propietario explÃ­cito para leer/encolar/procesar; no copia ni adopta la cola global antigua. IDs codificados sin colisiones por reemplazo. Ambos dashboards pasan ID de estado autenticado y comprueban rechazo al encolar. ReenvÃ­o con `X-RPG-Offline-Owner`; `requireShortcutUser` compara contra identidad verificada antes de dar acceso al store y devuelve 409 ante otra cuenta. Reintentos preservan claves, solo una sincronizaciÃ³n por dueÃ±o en esta pestaÃ±a y lectura final conserva nuevas acciones. Filas corruptas/desconocidas y legacy quedan intactas, sin replay automÃ¡tico; URLs restringidas a los tres shortcuts propios. Cinco pruebas nuevas, Safari ajustado a dueÃ±o explÃ­cito, 217 pruebas seguras y TypeScript aprobados. Sin build/browser/cuentas reales en este ciclo. No acredita idempotencia durable ni sincronizaciÃ³n entre pestaÃ±as.

**Siguiente G03.1b:** aislar hook/engine/history de sesiÃ³n y retirar identidades por defecto solo con propagaciÃ³n segura de identidad a sus consumidores. Las claves globales y adaptaciÃ³n v3 actuales siguen pendientes; no anunciar aislamiento integral. G03.2 despuÃ©s: confirmaciÃ³n durable/HTTP, recuperaciÃ³n e idempotencia efectiva. Storage seguro mantiene fallback volÃ¡til; `queueOfflineAction=true` no garantiza supervivencia a recarga si almacenamiento nativo falla. RecuperaciÃ³n de cola legacy requiere plan explÃ­cito sin atribuir datos sin dueÃ±o.

**G03.1b.1 completada; G03.1b parcial:** hidrataciÃ³n exige dueÃ±o esperado explÃ­cito/no anÃ³nimo y coincidencia exacta; rechaza registros sin dueÃ±o. Fallback v3 del hook ya no sobrescribe propietario/clave ni descarta datos existentes. Dos regresiones nuevas (una roja antes de corregir), 219 pruebas seguras y TypeScript aprobados. Datos legacy intactos. No acredita aislamiento del historial ni cambio de cuenta en React: pendientes G03.1b.2 (propagar identidad real, retirar defaults, claves por usuario, historial y limpieza de estado Aâ†’B). Unidad reducida por cuota oficial 24 % al iniciar, conforme Governor; no ampliar hasta margen suficiente.

**G03.1b.2 completada posteriormente; G03.1b del hook terminada localmente:** contexto `SessionIdentityProvider` en ambos dashboards, alimentado por `state.user.id`, con remount de consumidores al cambiar identidad. Hook y creaciÃ³n de sesiÃ³n sin usuario demo por defecto; sin identidad no arranca. Nuevas claves v5 por dueÃ±o para sesiÃ³n/history mediante `session-storage.ts`, sin leer/copiar/borrar globales v3/v4. Filtro de ownership aun dentro de claves scoped; datos corruptos de historial preservados, deduplicaciÃ³n por sesiÃ³n. Respuesta tardÃ­a de una identidad anterior no altera estado/history/checkpoint; header de propietario tambiÃ©n al finalizar y rechazo HTTP conserva pendiente. CreaciÃ³n fuera de state updater evita dos IDs bajo Strict Mode.

ValidaciÃ³n actual: 226 pruebas seguras, tipos y build local aprobados; seis escenarios de React en Chrome con Strict Mode y fetch sintÃ©tico, incluyendo Aâ†’Bâ†’A, finalizaciÃ³n tardÃ­a, 409, historial y logout. Harness reproducible: `npm run test:session-browser`, abrir loopback 3021 y comprobar ALL PASSED; usa webpack ya incluido por Next, sin dependencias nuevas. No prueba cuentas reales, Safari fÃ­sico ni transacciones backend. Build requiriÃ³ reintento autorizado fuera del sandbox por EPERM del empaquetado standalone. No despliegue/commit.

**G03.1c siguiente:** cronÃ³metro independiente antiguo `rpg_live_timer_state` de rpg-dashboard conserva clave global y no usa el hook. Aislarlo/retirarlo de forma recuperable antes de afirmar aislamiento de todos los temporizadores. Defaults de resource-hub/notas y otros datos locales mantienen sus hallazgos propios; este cambio no los resuelve. G03.2 sigue pendiente para confirmaciÃ³n durable e idempotencia econÃ³mica; G03 aÃºn no estÃ¡ terminada.

**G03.1c completada posteriormente:** cronÃ³metro extraÃ­do a `use-owned-live-timer.ts` y modelo/storage puro `live-timer.ts`. El dashboard usa propietario autenticado; clave v2 por usuario, validaciÃ³n del dueÃ±o y checkpoint, estado visible filtrado desde el primer render y escritura solo tras hidratar ese propietario. Pausa/reanudaciÃ³n y compensaciÃ³n de tiempo conservadas; reiniciar B no toca A. Callback antiguo de A se rechaza bajo B. La clave global legacy no se lee, copia ni borra; reset escribe un checkpoint vacÃ­o solo del dueÃ±o actual. El envÃ­o directo de `submitSkillSession` aÃ±ade el mismo header de propietario contrastado por servidor.

ValidaciÃ³n: siete nuevas pruebas de modelo/storage; 233 tests seguros y TypeScript aprobados. Harness React/Strict Mode en Chrome: nueve escenarios aprobados (seis anteriores y tres de cronÃ³metro, sin remount artificial entre A/B para LiveProbe). Build y evidencia final en continuidad. No integra un coordinador Ãºnico ni lock entre pestaÃ±as. **G03.2 siguiente:** el flujo antiguo `stopAndLogLiveTimer` aÃºn resetea antes de confirmaciÃ³n y usa mÃ­nimo de un minuto; corregir contrato/recuperaciÃ³n e idempotencia sin alterar fÃ³rmulas arbitrariamente. Recovery manual legacy y otros datos locales siguen pendientes.

- **Objetivo:** resolver G-SESSION-01 y aislamiento offline S-001; un coordinador para toda escena. Corregir replay R-004 sin cambiar fÃ³rmulas.
- **Dependencias:** G02; autoridad/contrato de persistencia definido. Fraccionar en aislamiento, confirmaciÃ³n y coordinator.
- **Archivos probables:** `src/lib/sanctuary/use-universal-session.ts`, `src/lib/offline-sync.ts`, `src/app/api/shortcuts/skill-session/route.ts`, `habit-log/route.ts`, `quick-expense/route.ts`, `src/game/application/{session-coordinator,command-result}.ts`, tests pertinentes.
- **AceptaciÃ³n:** propietario obligatorio real; 401/503 no limpian sesiÃ³n ni generan Ã©xito; doble clic/retry mismo ID; replay devuelve mismos GP efectivos; escena no inicia otro timer. No otorgar un minuto por probar controles.
- **Pruebas:** fetch simulado que realmente se ejecuta, A/B, dos pestaÃ±as, respuesta perdida tras commit, reinicio y regreso de escena; DB aislada para idempotencia durable. Si no existe DB de pruebas no acreditar esa garantÃ­a.
- **Riesgos:** cola legacy sin dueÃ±o y endpoint que muta store/DB por separado; no resolver descartando datos ni con un segundo envÃ­o de premio.
- **Esfuerzo:** XL, dividir antes de comenzar; puerta para sesiones reales.

## G04 Â· P0 Â· Readiness y entrada financiera no destructiva

- **Objetivo:** separar creador/tutorial de configuraciÃ³n financiera y evitar reset de progreso (G-DATA-01).
- **Dependencias:** G00, G02. Preparar especificaciÃ³n de comando create-if-absent antes de cambiarlo.
- **Archivos probables:** lectura de perfil/readiness autenticada nueva bajo `src/app/api/game`, adaptador; `src/app/api/onboarding/route.ts`, `src/lib/auth.ts`, `src/lib/state-builder.ts` solo para aislar provisiÃ³n/configuraciÃ³n con contrato preservado.
- **AceptaciÃ³n:** explorar no crea ingreso/bÃ³veda de ejemplo; setup explÃ­cito de cuenta nueva inicializa una vez; cuenta con tesorerÃ­a nunca se resetea por personalizar ni repetir setup; datos existentes se revisan sin reemplazo silencioso. No exigir inventar un costo fijo para entrar al pueblo.
- **Pruebas:** copia anonimizada y fixtures de usuario nuevo, configurado, parcialmente provisionado y con sesiÃ³n activa; comparar todos los campos econÃ³micos y recursos antes/despuÃ©s; repeticiÃ³n/concurrencia no recrea deudas ni quests.
- **Riesgos:** efectos secundarios de bootstrap actual y clientes antiguos; cambiar solo la inicializaciÃ³n necesaria, no la matemÃ¡tica financiera.
- **Esfuerzo:** XL, dividir readiness/guardas/setup/compatibilidad; puerta de nuevos usuarios con recompensa.

## G05 Â· P1 Â· Metadata aditiva de personaje y checkpoint

- **Objetivo:** persistir apariencia, tutorial y punto seguro por identidad existente.
- **Dependencias:** G02, modelo de [CHARACTER_SYSTEM.md](CHARACTER_SYSTEM.md); [MIGRATION_PLAN.md](MIGRATION_PLAN.md). DB de pruebas aislada disponible.
- **Archivos probables:** futura migraciÃ³n SQL fechada en `supabase/migrations`, `src/app/api/game/{character,world-state}/route.ts`, `src/game/adapters/character-repository.ts`.
- **AceptaciÃ³n:** una fila por ID, catÃ¡logo permitido, revisiÃ³n optimista, RLS propietario; sin columnas de economÃ­a; lectura ausente ofrece default sin escribir; formato futuro no se sobreescribe por fallback.
- **Pruebas:** migraciÃ³n desde vacÃ­o y copia existente, dos JWT/REST directo, payload extra, actualizaciÃ³n concurrente, checkpoint invÃ¡lido y conservaciÃ³n exacta del progreso.
- **Riesgos:** migraciÃ³n aplicada sin esquema base, pÃ©rdida de identidad local o FK/grants incorrectos. No ejecutar en producciÃ³n como parte de la prueba.
- **Esfuerzo:** L; dividir schema, repositorio y endpoints.

## G06 Â· P1 Â· Creador y onboarding lÃºdico omisibles

- **Objetivo:** registro existente â†’ aspecto â†’ bienvenida â†’ pueblo, con transiciÃ³n no bloqueante para usuarios antiguos.
- **Dependencias:** G04/G05; G03 si se recupera sesiÃ³n activa.
- **Archivos probables:** `src/components/game/{character-creator,onboarding-guide,game-shell}.tsx`, ruta `/play`; integraciÃ³n de destino de login solo en fase posterior autorizada.
- **AceptaciÃ³n:** guardar/omitir solo metadata; no POST al onboarding financiero; nombre/clase/avatar histÃ³rico conservados; sesiÃ³n activa se puede continuar antes; sin tutorial premiado.
- **Pruebas:** teclado/foco, contraste, reduced motion, red al guardar, retorno tras interrupciÃ³n, usuario nuevo/antiguo/diferido y comparaciÃ³n econÃ³mica.
- **Riesgos:** flag `onboarding_completed` confundido con personaje, guardado que bloquea acceso o cambios de perfil involuntarios.
- **Esfuerzo:** L; separar creador y guÃ­a.

## G07 Â· P1 Â· Plaza explorable y controles accesibles

**AmpliaciÃ³n integrada:** SceneManager con doorId/spawnId y transiciÃ³n cancelable exterior/casa/interior/especial; CharacterController, MovementState, AnimationState, CollisionSystem e InteractionRange. AÃ±adir cÃ¡mara de exploraciÃ³n/conversaciÃ³n/entrada/objeto/narrativa/pausa con reduced motion. Reutilizar G01 por extracciÃ³n incremental, no reescribirlo. Dividir movimiento, escenas y cÃ¡mara antes de ejecutar.

- **Objetivo:** movimiento de personaje y acciÃ³n contextual situados en el mundo.
- **Dependencias:** G01/G02; fixture aislado antes de G05/G06.
- **Archivos probables:** `src/game/client/scenes/town-scene.ts`, `input`, geometrÃ­a de mundo, `src/components/game/{context-hud,accessible-world}.tsx`, assets originales mÃ­nimos bajo `public/game`.
- **AceptaciÃ³n:** WASD/flechas y toque-destino, diagonal normalizada, lÃ­mites y colisiÃ³n de pies; puerta accesible por proximidad y lista DOM equivalente. Movimiento jamÃ¡s genera GP/XP ni exige fullscreen. Cruzar/volver conserva sesiÃ³n y foco sin navegar a otra ruta Next; fallo de asset restaura contexto. Cada modo de cÃ¡mara tiene salida y no impone esperas.
- **Pruebas:** reloj simulado y geometrÃ­a; resize, foco y composiciÃ³n IME bloquean input del mundo; regreso de pestaÃ±a no teletransporta; mobile hit targets; doble puerta/cancelaciÃ³n/carga fallida, retorno de cÃ¡mara y movimiento reducido.
- **Riesgos:** cÃ¡mara que se confunde con avatar, input duplicado, jugador atrapado; spawn seguro y reset de posiciÃ³n no econÃ³mico.
- **Esfuerzo:** L; separar controles y mapa.

## G08 Â· P1 Â· Atelier transitable y bastidor funcional

**AmpliaciÃ³n integrada:** registro de objetos con acciones contextuales: mesa/estanterÃ­a/escritorio/Banco/tablÃ³n/cama. El piloto conecta solo bastidor tras puertas P0; los demÃ¡s se implementan gradualmente, reutilizando sus herramientas. Cama/pausa no altera economÃ­a ni finaliza sesiÃ³n implÃ­citamente; abrir tablÃ³n/inventario no completa misiones.

- **Objetivo:** primer interior con objeto que inicia/retoma actividad sin convertirse en dashboard a pantalla completa.
- **Dependencias:** G07; G03/G04/G05 para usar datos reales.
- **Archivos probables:** `src/game/client/scenes/atelier-scene.ts`, `interactions`, `src/components/game/activity-panel.tsx`; reutilizar acciones de `src/components/sanctuary/atelier-building.tsx` por servicio/hook compartido, no copiar el componente entero.
- **AceptaciÃ³n:** puerta â†’ residente â†’ bastidor â†’ proyecto propio â†’ sesiÃ³n â†’ regreso; pausar/cambiar escena no duplica sesiÃ³n; falta de proyecto ofrece creaciÃ³n explÃ­cita sin compra ni recurso ficticio.
- **Pruebas:** recurso ajeno rechazado, doble interacciÃ³n, salir/reentrar, sesiÃ³n activa en otro dominio, falta de preparaciÃ³n financiera y ruta equivalente DOM.
- **Riesgos:** hooks por edificio crean identidades por defecto o contadores paralelos; no importar estado del componente anterior como nueva autoridad.
- **Esfuerzo:** L.

## G09 Â· P1 Â· Consecuencia visual desde progreso confirmado

**AmpliaciÃ³n integrada:** QuestPresentation e InventoryView solo reflejan el mismo origen/ID autorizado. No se adapta el flag visual de recompensa de un encargo externo como protecciÃ³n de pago. CelebraciÃ³n, reload y visita al tablÃ³n nunca son comandos de recompensa.

- **Objetivo:** bastidor y estanterÃ­a reflejan avance real y muestran recompensa efectiva una sola vez.
- **Dependencias:** G03/G08; proyectores actuales de `visual-village-progression.ts`.
- **Archivos probables:** `src/game/domain/projection.ts`, adaptador de hitos, objetos de Atelier, HUD.
- **AceptaciÃ³n:** parcial no equivale a obra final; respuesta perdida deja pendiente; rehidratar no reclama nuevo premio; animaciÃ³n de completar no invoca API de actividad.
- **Pruebas:** misma operaciÃ³n recibida dos veces, reload antes/despuÃ©s de confirmaciÃ³n, recurso archivado y GP limitado por bÃ³veda; ambas interfaces coinciden.
- **Riesgos:** celebrar estimaciones o tratar hitos como otro motor de recompensa.
- **Esfuerzo:** M.

## G10 Â· P2 Â· Habitante con presencia y descanso respetuoso

**AmpliaciÃ³n integrada:** adaptar compaÃ±eros propios con ubicaciÃ³n, comportamiento, animaciÃ³n, rol, diÃ¡logo y acciones; horario ambiental opcional. Si NPC no estÃ¡, el objeto/herramienta esencial sigue accesible. Texto original, conversaciones omitibles, sin presiÃ³n diaria ni espera obligatoria.

- **Objetivo:** Clara tiene ubicaciÃ³n/rutina sencilla y diÃ¡logo omisible sin llamadas IA por frame.
- **Dependencias:** G07/G08 y catÃ¡logo de residentes existente.
- **Archivos probables:** `src/game/domain/world.ts`, `src/game/client` rutinas/NPC, `src/components/game/dialogue-panel.tsx`; adaptador de `cozy-residents-engine.ts`.
- **AceptaciÃ³n:** NPC no bloquea salida, conversaciÃ³n tiene foco/retorno, descanso/ausencia no genera penalizaciÃ³n ni recorta progreso; ninguna acciÃ³n financiera autÃ³noma.
- **Pruebas:** reloj simulado, interrupciÃ³n de diÃ¡logo, NPC cerca de puerta, vuelta tras ausencia y cero llamadas LLM/red al caminar.
- **Riesgos:** rutinas costosas o prometer una autonomÃ­a inexistente; mantener reglas deterministas pequeÃ±as.
- **Esfuerzo:** M.

## G11 Â· P1 Â· AceptaciÃ³n del primer recorrido completo

- **Objetivo:** demostrar el itinerario del GDD y lÃ­mites de datos en navegador y DB aislada.
- **Dependencias:** G00 y G03â€“G09; G10 si se anuncia habitante vivo; G13.a para preferencias/controles esenciales de las interacciones incluidas. Revisar herramientas existentes antes de instalar test runner.
- **Archivos probables:** pruebas de game domain, fixtures sintÃ©ticos, futuros tests E2E/contratos DB; documentaciÃ³n mÃ­nima de resultados en `docs/game`.
- **AceptaciÃ³n:** usuario antiguo conserva todo; usuario nuevo explora sin dinero ficticio y solo cobra tras setup; moverse/omitir/descansar no cambia economÃ­a; una sesiÃ³n da un resultado; rollback de renderer conserva historial.
- **Pruebas:** desktop teclado, navegador mÃ³vil y Safari real cuando estÃ© disponible; A/B, dos pestaÃ±as, 401/503, red que cae tras commit, storage bloqueado, recarga/Strict Mode y assets fallidos. AÃ±adir matriz del estudio Nookery: IME, seis modos de cÃ¡mara, NPC ausente, viaje rÃ¡pido y vista de inventario sin efecto econÃ³mico. Registrar dispositivo y garantÃ­as faltantes.
- **Riesgos:** pruebas de funciones o bÃºsqueda de cadenas presentadas como E2E; fixtures que toquen `.data` o cuentas reales. Aislar almacenamiento y red explÃ­citamente.
- **Esfuerzo:** L, dividir matriz funcional/seguridad/rendimiento/accesibilidad.

## G12 Â· P1 Â· RecuperaciÃ³n y activaciÃ³n gradual

- **Objetivo:** habilitar juego como interfaz principal solo tras aceptaciÃ³n y con vuelta segura a herramientas actuales.
- **Dependencias:** G11 y plan de migraciÃ³n probado; autorizaciÃ³n explÃ­cita para despliegue/producciÃ³n.
- **Archivos probables:** bandera de entrada en shell/rutas, configuraciÃ³n de assets/SW, runbook de recuperaciÃ³n y handoff. No quitar rutas anteriores.
- **AceptaciÃ³n:** bandera apagada recupera app existente; personalizaciÃ³n/datos se conservan; no refresh forzado con registro pendiente; ningÃºn rollback econÃ³mico por fallo visual.
- **Pruebas:** SW antiguo/nuevo, bandera off/on, asset ausente, salida a `/dashboard`/`/quick`, sesiÃ³n en vuelo y consistencia tras volver.
- **Riesgos:** caches antiguas y activaciÃ³n global prematura; no confundir revertir cliente con restaurar DB.
- **Esfuerzo:** M; no ejecutable sin alcance de despliegue autorizado.

## G13 Â· P1/P2 Â· Calidad de vida e inventario de lectura

- **Objetivo:** G13.a acceso rÃ¡pido/viaje sin costo, texto ajustable, animaciones opcionales y controles configurables; G13.b inventario visual por referencias y audio independiente; nunca segunda economÃ­a. P3 queda para decoraciÃ³n avanzada, eventos y mandos/joystick opcionales.
- **Dependencias:** G13.a depende de G02/G07; para autosave/recuperaciÃ³n real, G03/G05. G13.b requiere G02/G05/G09. No esperar a NPC ni a completar misiones para opciones esenciales.
- **Archivos probables:** futuros `src/game/application/fast-travel.ts`, `src/game/domain/preferences.ts`, `src/components/game/{inventory-view,preferences-panel}.tsx` y adaptadores de recursos/audio existentes; sin importar Aurora o packs del port.
- **AceptaciÃ³n:** viajar preserva sesiÃ³n/pendientes; metadata confirmada no se confunde con actividad guardada; teclas se remapean con detecciÃ³n de conflictos y restauraciÃ³n. Texto crece sin recorte, audio master/mÃºsica/ambiente/efectos respeta gesto/silencio. Inventario agrupa recursos reales, decoraciÃ³n, herramientas y cosmÃ©ticos por origen, sin filas econÃ³micas duplicadas ni nuevos lÃ­mites de bolsillo.
- **Pruebas:** teclado/lector, remapeo e IME, resize/texto ampliado, mute por canal, dos usuarios y cambio de cuenta; red al guardar checkpoint, sesiÃ³n en envÃ­o durante viaje, inventario/tablÃ³n abierto repetidamente con cero nuevas recompensas. No anunciar soporte de mando sin spike y dispositivo/browser verificados.
- **Riesgos:** alcance demasiado amplio, preferencias globales, audio autoplay y duplicaciÃ³n de colecciÃ³n. Dividir G13.a/G13.b en unidades menores; no bloquear la utilidad de la plataforma por cosmÃ©ticos.
- **Esfuerzo:** XL como conjunto; dividir en S/M antes de implementar. No se implementa en este estudio.

## Prueba de Â«primer recorrido terminadoÂ»

Preparar dos identidades sintÃ©ticas con progreso distinto y un recurso de tejido propio para A. A entra/crea o difiere aspecto, camina, entra al Atelier, usa bastidor y registra una Ãºnica actividad con reloj controlado solo en test. Sale, recarga y vuelve: misma identidad, mismo resultado y objeto proyectado. Repetir el envÃ­o no altera otro saldo. B no puede ver personaje, pendiente ni proyecto de A. Omitir tutorial/descansar/navegar genera cero actividades. Ejecutar el mismo flujo en cuenta nueva sin preparar: explora pero no cobra ni recibe bÃ³veda de ejemplo.

La implementaciÃ³n solo se considera jugable al ejecutar el recorrido con renderer real y controles; solo se considera segura con datos al pasar ademÃ¡s los contratos de identidad, confirmaciÃ³n y migraciÃ³n. Esta documentaciÃ³n no acredita ninguna de esas capacidades como ya implementada.


**Resultado G03.2b.3:** `atomic-skill-session.ts` prepara un plan tipado en una copia profunda del motor, captura GP base antes del multiplicador/cap y nunca muta el store vivo. Contexto de servidor separado del comando, recursos explícitos y recibo SQL validado; errores no usan fallback legacy. Bandera de release constante `false`, sin importación ni activación en la ruta actual. Seis regresiones de adaptador y una integración SQL adicional verifican pérdida de confirmación/reconstrucción del plan, un solo pago y recibo canónico. Suite: 283 aprobadas; validación final dirigida: 21 aprobadas.

**Siguiente G03.2b.4 (M):** objetivo validar el protocolo con varias conexiones PostgreSQL nativas en entorno aislado antes de conectar la ruta; depende de b.3 y gates de MIGRATION_PLAN. Archivos probables: harness SQL aislado, adaptador y tests. Aceptación: dos clientes/mismo comando = un efecto, conflictos de revisión sin efectos parciales, reintento tras desconexión recupera recibo, schema real compatible. Pruebas: concurrencia nativa, roles, rollback y reconciliación legacy. Riesgos: autoridad de snapshot, mezcla de protocolos y retención de recibos. Requiere motor PostgreSQL de pruebas disponible; no activar por variable de entorno ni aplicar SQL externo automáticamente.
