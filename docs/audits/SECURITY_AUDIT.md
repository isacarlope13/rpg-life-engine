# Auditoría de seguridad, IA y automatización

Fecha: 11 de noviembre de 2026. No se hicieron ataques a producción ni se usaron credenciales reales. Las pruebas adicionales usan datos sintéticos en memoria y red simulada. Convenciones y resultados de verificación: [OAKHAVEN_AUDIT.md](OAKHAVEN_AUDIT.md).

La conciliación de cambios concurrentes del informe principal prevalece sobre el estado inicial. Se actualizaron APIs y helper offline durante el trabajo; no fueron cambios de esta auditoría.

## Fronteras de confianza

El navegador puede enviar JSON arbitrario, alterar su almacenamiento y repetir solicitudes. El servidor debe derivar identidad, validar comandos y calcular consecuencias. RLS limita filas visibles; no convierte automáticamente un valor escrito en una operación económica válida. Una propuesta de IA es entrada no confiable y debe pasar por los mismos comandos que una acción humana.

Protecciones observadas: `auth.ts` verifica JWT con Supabase y refresca tokens; cookies usan HttpOnly y SameSite y añaden Secure en producción (`auth.ts:557–589`). Los tokens personales se generan aleatoriamente y se guardan como hash (`auth.ts:344–361`). `requireShortcutUser` obtiene identidad verificada y `scopeIdempotencyKey` incorpora usuario al hash (`request-auth.ts:25–77`). Demo está bloqueada en producción (`app/api/auth/demo/route.ts:9–15`). Esquema define RLS y checks, y triggers bloquean tesorería con `FOR UPDATE` (`schema.sql:440,516,712–749`). Son fortalezas del código, no validación de los permisos remotos actuales.

## Hallazgos

### S-001 · P1 · Datos locales sin propietario en todos los flujos

- **Módulo y referencias:** `lib/offline-sync.ts:52–73`; `lib/sanctuary/bank-engine.ts:18,44–60`; `lib/sanctuary/use-universal-session.ts:35–109`; `components/cozy-rpg-dashboard.tsx:188–204`.
- **Evidencia C actualizada:** cuentas mantienen clave global. El helper de cola ahora acepta usuario y namespace, pero duplica acciones identificadas en cola legacy global; dashboards inspeccionados siguen invocando `processOfflineQueue` sin usuario. El historial del hook se filtra por dominio, no propietario en ese bloque. Hay defaults y notas globales; cámara/posiciones son preferencias menos sensibles.
- **Causa probable:** almacenamiento de prototipo individual reutilizado en aplicación multiusuario. Algunos motores sí reciben usuario, pero no todos los llamadores y claves están alineados.
- **Impacto:** al cambiar cuenta en el mismo navegador pueden verse cuentas/notas/historial ajenos o enviarse pendientes con la sesión nueva. No se probó extracción entre dos usuarios remotos.
- **Solución:** namespace por identidad verificada, limpieza de vistas al logout/cambio, separación de cola por usuario y rechazo de replay con propietario distinto. Migrar claves antiguas sin asignarlas automáticamente a cualquier cuenta.
- **Esfuerzo / riesgo:** medio; medio por datos existentes sin propietario verificable.
- **Aceptación:** A escribe offline y cierra sesión; B no ve ni reenvía sus datos. Volver a A recupera sus pendientes. Probar dos pestañas y recarga.
- **Principio educativo:** persistir un dato y autorizar quién lo usa son problemas distintos; la frontera de usuario debe acompañarlo también en el cliente.

### S-002 · P1 · RLS por usuario permite más escrituras que las reglas económicas

- **Módulo y referencias:** `supabase/schema.sql:724–749`; `supabase/migrations/20261109_v3_5_complete_engine_sync.sql:353–360`; `app/api/shortcuts/habit-log/route.ts:62–96`.
- **Evidencia C:** políticas `FOR ALL` limitan por `auth.uid()`, pero no restringen columnas económicas ni obligan a usar comandos. El handler también acepta recompensas de actividad personalizada; R-002 detalla ese flujo. No se inspeccionaron grants efectivos de la DB desplegada.
- **Causa probable:** asumir que aislamiento de filas equivale a integridad de negocio.
- **Impacto:** si el rol autenticado tiene los permisos de escritura habituales, puede alterar sus propios saldos/XP por REST o cargar recompensas arbitrarias. No es evidencia de acceso a filas de otros usuarios ni de dinero bancario movido.
- **Solución:** permisos de tabla/columna mínimos, escrituras económicas a través de funciones transaccionales con validación y políticas explícitas; server deriva recompensas y verifica propiedad de cada recurso. Revisar `SECURITY DEFINER`, `search_path` y grants de ejecución sin ampliar privilegios.
- **Esfuerzo / riesgo:** grande; alto por clientes que hoy escriben directamente.
- **Aceptación:** dos usuarios de prueba solo leen sus filas; JWT ordinario no puede editar tesorería/XP directamente; comando válido funciona y referencias a recursos ajenos fallan, incluso vía REST.
- **Principio educativo:** RLS responde «¿de quién es esta fila?». El dominio debe responder «¿esta transición está permitida?».

### S-003 · P1 · Spotify comparte identidad global y carece de autenticación en la ruta

- **Módulo y referencias:** `app/api/spotify/now-playing/route.ts:18–79,103–127`.
- **Evidencia C:** `GET()` no resuelve sesión; lee credenciales globales y consulta reproducción de su titular. Sin credenciales devuelve contenido de demostración con `isPlaying:true`; con ausencia de reproducción devuelve un episodio fijo, no una última reproducción recuperada.
- **Causa probable:** integración personal expuesta como API de aplicación multiusuario.
- **Impacto:** si está configurada y accesible, visitantes pueden consultar metadatos de reproducción del titular y generar llamadas externas. Contenido ficticio puede parecer reproducción real. No se llamó Spotify.
- **Solución:** autenticar; definir si integración es personal o por usuario; no ofrecer datos de un titular global a otros. Devolver estado vacío/desconocido ante ausencia o fallo y rotular demo.
- **Esfuerzo / riesgo:** pequeño para cerrar ruta; grande para OAuth multiusuario. Riesgo medio.
- **Aceptación:** anónimo obtiene 401; B nunca obtiene reproducción de A; 204 produce «sin reproducción», no fixture; fallos no aparentan éxito.
- **Principio educativo:** ocultar secretos en variables de entorno protege las claves, pero no protege los datos que una API pública obtiene con ellas.

### S-004 · P1 · Automatización y aprobaciones no tienen garantías de ejecución únicas

- **Módulo y referencias:** `lib/automation/task-queue.ts:19–21,38–42,75–114`; `lib/automation/rule-engine.ts:108–158`; `lib/agents/autonomous-life-manager.ts:52–85`.
- **Evidencia R/C:** dos llamadas simultáneas ejecutan el worker dos veces; `processing` no se rechaza. Resolver aprobación vencida devuelve `approved`; `resolveRequest` no verifica fecha ni recibe identidad autenticada del actor. El índice de cola usa solo clave, no usuario. Estado reside en Maps. `backoffMs` no se convierte en una condición temporal en `processTask`.
- **Causa probable:** biblioteca de prototipo presentada como infraestructura durable.
- **Impacto:** duplicación, pérdida tras reinicio y aceptación de propuestas vencidas. No se encontró una API remota que exponga directamente `resolveRequest`; por tanto no se afirma explotación externa de esa función. Tampoco se encontró runner conectado en `src`.
- **Solución:** reclamación atómica con lease, clave usuario/operación, `next_attempt_at`, almacenamiento durable; aprobación por servidor con actor, propietario, expiración, hash exacto de propuesta y uso único. Conectar solo workers realmente implementados.
- **Esfuerzo / riesgo:** grande; alto al habilitar autonomía.
- **Aceptación:** dos workers ejecutan una sola vez; reinicio recupera pendientes; aprobación vencida/ajena/ya usada se rechaza; retry espera su fecha. Las pruebas verifican la mutación final, no solo el estado de la solicitud.
- **Principio educativo:** una aprobación es una autorización limitada en actor, contenido y tiempo; un estado en memoria no es una capacidad durable.

### S-005 · P1 · Firma de webhook inconsistente con el cuerpo enviado

- **Módulo y referencias:** `lib/integrations/webhooks.ts:21–38`; `tests/integrations.test.ts`, prueba «Integrations 3».
- **Evidencia R:** HMAC se calcula antes de añadir `payload.signature`; se envía un segundo JSON con el campo añadido. Verificar el HMAC del cuerpo enviado contra el encabezado devuelve falso. La prueba existente sustituye `dispatchNotification`, evitando ejercitarlo.
- **Causa probable:** mezclar firma en header y dentro del payload sin protocolo de canonicalización.
- **Impacto:** un receptor que verifica los bytes recibidos rechaza mensajes legítimos. No se afirma que permita falsificar firmas.
- **Solución:** serializar una vez y firmar exactamente esos bytes; enviar firma solo en encabezado o definir canonicalización explícita con el receptor. Añadir timestamp/replay según contrato. Validar destinos y timeout antes de permitir URLs ingresadas por usuarios; no se probó una superficie SSRF accesible.
- **Esfuerzo / riesgo:** pequeño; medio por compatibilidad de receptores.
- **Aceptación:** receptor de prueba verifica firma de bytes capturados; cambiar un byte falla; red simulada no sustituye el firmador; pruebas de timeout y reintento conservan ID.
- **Principio educativo:** una firma autentica bytes exactos, no dos objetos «casi iguales».

### S-006 · P1 · Avisos de seguridad en dependencia transitiva de producción

- **Módulo y referencias:** `package-lock.json`, entrada `node_modules/next/node_modules/postcss`; Next resuelto 15.5.29 y PostCSS anidado 8.4.31.
- **Evidencia R externa:** `npm audit --omit=dev --json` reporta 2 paquetes afectados: PostCSS high y Next moderate por dependencia. No significa dos incidentes ni dos CVE únicos: PostCSS contiene varios avisos en el reporte.
- **Avisos públicos:** [lectura de sourcemaps](https://github.com/advisories/GHSA-6g55-p6wh-862q), [corrección incompleta](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp), [path traversal de sourcemaps](https://github.com/advisories/GHSA-r28c-9q8g-f849) y [stringify CSS](https://github.com/advisories/GHSA-qx2v-qp2m-jg93). Son las referencias devueltas por npm.
- **Causa probable:** versión transitiva anidada antigua; actualizar la dependencia de Tailwind no implica actualizar la copia incluida en Next.
- **Impacto:** riesgo condicionado a alcanzar el procesamiento de CSS/sourcemaps controlado por atacante. No se demostró esa entrada en esta aplicación. No clasificar automáticamente como RCE ni exposición de secretos.
- **Solución:** evaluar una versión compatible mantenida o una resolución transitiva soportada; revisar árbol y avisos antes de actualizar. npm propone salto mayor de Next: no aplicarlo ciegamente ni ejecutar `audit fix --force`.
- **Esfuerzo / riesgo:** pequeño–medio para evaluación; medio–alto si exige migración mayor.
- **Aceptación:** nuevo audit no reporta el rango vulnerable, lockfile reproducible, build y pruebas pasan, y se verifica el camino de exposición relevante.
- **Principio educativo:** severidad de una biblioteca y explotabilidad de una aplicación son medidas relacionadas, pero distintas.

### S-007 · P2 · La cuota de IA no es siempre por usuario ni compartida entre instancias

- **Módulo y referencias:** `lib/gemini.ts:252,380,1029,1451,1590`; `lib/ai-cache-and-ratelimit.ts:21–94`; contraste `app/api/onboarding/ai/route.ts:26–27`.
- **Evidencia C:** varios extractores pasan claves constantes por función; contadores son Maps por proceso. Onboarding sí incorpora `session.userId`; no generalizar el fallo a todas las rutas.
- **Causa probable:** helper reutilizado sin propagar identidad y límite diseñado para un solo proceso.
- **Impacto:** un usuario puede consumir cuota de otro en un extractor; réplicas cuentan por separado; no hay presupuesto económico global durable comprobado.
- **Solución:** contexto autenticado al invocar IA, contador atómico compartido por usuario/ventana y presupuesto global; caché versionada con TTL y deduplicación de consultas en vuelo.
- **Esfuerzo / riesgo:** medio; medio por disponibilidad y costes.
- **Aceptación:** A agota cuota sin bloquear B; dos procesos comparten límite; 20 consultas iguales producen una generación cuando hay cache miss; no almacenar texto financiero privado en catálogo compartido.
- **Principio educativo:** un Map del servidor pertenece a una instancia, no a todo el sistema.

### S-008 · P2 · El log con hash no es una auditoría inmutable

- **Módulo y referencias:** `lib/automation/rule-engine.ts:170–212`; `lib/agents/autonomous-life-manager.ts:103–117`; `app/api/health/route.ts:17–46`.
- **Evidencia C:** hash incluye IDs, actor, acción y fecha, pero no estados anterior/nuevo completos; entradas viven en array mutable que recorta a 500. Salud del consejo siempre devuelve `optimal`; health deriva conexión de configuración, no de consulta real.
- **Causa probable:** indicador y trazabilidad de demostración tratados como garantía operativa.
- **Impacto:** modificar payload puede no alterar hash; reiniciar pierde log y un fallo operativo puede seguir mostrando salud óptima. No hay evidencia de no repudio criptográfico durable.
- **Solución:** eventos append-only persistentes con payload canónico, correlación, actor/usuario y controles de acceso; salud por métricas reales. Hash encadenado solo si lo exige el modelo de amenaza, sin prometer inmutabilidad absoluta.
- **Esfuerzo / riesgo:** medio; medio por volumen y datos sensibles.
- **Aceptación:** mutar contenido se detecta; reinicio conserva eventos; datos privados se redactan; tarea fallida y DB no disponible degradan indicadores correspondientes.
- **Principio educativo:** un checksum ayuda a detectar cambios bajo un protocolo; no convierte una lista editable en registro inmutable.

## Autenticación y secretos: límites pendientes

`git ls-files` para archivos de entorno/PEM/secretos encontró `.env.example`; `.gitignore` excluye `.env*.local`, `.data`, PEM y builds. No se imprimieron contenidos de `.env.local`. Esa comprobación por nombre no es un escaneo completo del historial Git ni acredita ausencia absoluta de secretos en assets o commits anteriores.

El registro local de usuarios, sesiones y tokens vive en Maps (`auth.ts:36–43,230–283,741`). No equivale a identidad durable. La validación local de contraseña comprueba longitud mínima, aunque el texto afirma PIN numérico y longitud acotada. No se encontró rate limiter en el handler de login local inspeccionado; los límites propios de Supabase no se verificaron. Antes de habilitar modo local en un entorno real, definir explícitamente su uso, expiración server-side y persistencia de identidad. No se publican credenciales de ejemplo del código.

## IA: qué existe y qué conviene automatizar

`ai-skills-prompts.ts:35–178` registra nueve conjuntos de instrucciones: SMS, recibos, briefing, cubos, libros, profesiones, finanzas, misiones y proyectos ágiles. Las llamadas reales se concentran en `gemini.ts` y `onboarding-ai.ts`, con modelo `gemini-2.5-flash`, schemas JSON y temperaturas por tarea. Hay fallbacks deterministas y caché de catálogos. No se midieron tokens, latencia ni costo por usuario; no se hicieron llamadas facturables. No se encontró instrumentación de `usageMetadata` en los módulos de generación buscados.

| Trabajo | Enfoque recomendado | Motivo |
|---|---|---|
| GP/XP, saldos, tasas, cuotas, rachas, límites, idempotencia | Código determinista y DB | Debe ser reproducible, auditable y transaccional |
| SMS de formatos conocidos | Parser determinista primero | Más barato y comprobable; IA solo ante ambigüedad |
| OCR de recibo / texto libre | IA para extracción, validación posterior | La percepción es útil; el importe y la categoría requieren validación |
| Narrativa y diálogo contextual | Plantillas o IA acotada bajo demanda | Evitar llamada por frame, click de navegación o segundo de timer |
| Catálogo de libros/cubos | Fuentes verificables, caché y enriquecimiento IA | IA no garantiza ISBN, precio ni cumplimiento normativo |
| Plan financiero | Cálculo determinista; IA explica | No delegar disponibilidad ni efecto económico al texto generado |
| Misiones | Selección y límites deterministas; texto opcional IA | Conservar economía sin generar recompensas arbitrarias |

SystemGuardian sí valida categorías y algunos invariantes antes de ejecutar un callback (`system-guardian.ts:128–230`). Sin embargo, su contrato confía en `actionName` y `payload`; no demuestra que un callback arbitrario haga exactamente lo declarado. Antes de ampliar autonomía, sustituir callbacks genéricos por comandos permitidos con argumentos validados en servidor. Los modelos no necesitan acceso directo a clientes admin ni a saldos mutables.

No se verificó que todos los endpoints pasen por Guardian; las acciones manuales de API tienen su propio camino. Una matriz de permisos en biblioteca no sustituye autorización central. Residentes deterministas y propuestas supervisadas son útiles y pueden mantenerse con bajo costo; los once roles del consejo no deben confundirse con once agentes LLM ejecutándose. Inventario exacto en [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md).
