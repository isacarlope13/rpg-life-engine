# G03 â€” resultado del ciclo autÃ³nomo

12 de noviembre de 2026. Cambios locales sobre `main`, HEAD `013def1c03e9d17197d474c9abaa72912beeba85`. No commits ni despliegue remoto.

## Cambios verificados

- `session-command.ts` captura payload e idempotencia antes del envÃ­o y los reutiliza sin recalcular minutos, pÃ¡ginas o vueltas. Mantiene pendiente ante red, 401/409/503, JSON invÃ¡lido y falsos 200. Requiere `success` e ID de sesiÃ³n; una respuesta genÃ©rica no basta. Comparte una peticiÃ³n concurrente por operaciÃ³n en esta pÃ¡gina y guarda recibo local para no reenviar una confirmaciÃ³n ya recibida.
- Hook universal y cronÃ³metro conservan tiempo pausado mientras esperan confirmaciÃ³n. No limpian sesiÃ³n/formulario ante error. Impiden aÃ±adir tiempo a una captura pendiente. Respuestas antiguas no limpian una actividad nueva. Cero tiempo no se convierte automÃ¡ticamente en un minuto; se conserva la duraciÃ³n explÃ­cita declarada por el usuario en formularios manuales existentes.
- Gimnasio y diario ya no envÃ­an una segunda actividad despuÃ©s de finalizar el hook. Un test de arquitectura impide reintroducir ambos caminos en un mismo handler.
- Interiores muestran error accesible y ofrecen reintento conservando estado. El Ã©xito hÃ¡ptico de gimnasio/diario ocurre tras confirmaciÃ³n.
- Cola offline exige el ID correspondiente al endpoint: sesiÃ³n, actividad o transacciÃ³n. No descarta pendientes por un simple HTTP 200.
- Persistencia de perfil confirma la fila actualizada; cero filas, otra identidad o fallo no equivalen a guardado. La ruta de sesiÃ³n devuelve 503 si no confirma el almacenamiento requerido. Replays del cache en memoria no repiten efectos SQL secundarios.
- Panel de recursos usa el contexto autenticado, sin usuario por defecto ni sobreescritura por props contradictorias. Un fallo de almacenamiento no anuncia Ã©xito. Los datos legacy permanecen intactos.
- Notas y borradores se separan por identidad y se ocultan en el primer render de otra cuenta. El almacenamiento global antiguo se conserva sin adopciÃ³n automÃ¡tica.

No se modificaron fÃ³rmulas de GP/XP, no se ejecutaron migraciones, no se operaron finanzas reales ni se utilizaron cuentas reales para QA.

## ValidaciÃ³n actual

- `npm test`: **252 aprobadas, 0 fallos, 0 omitidas**. La prueba de integridad antes excluida ahora usa un directorio temporal propio y `localOnly`; no escribe ni borra archivos de `.data` del proyecto ni contacta Supabase.
- `npx tsc --noEmit`: aprobado.
- `npm run build`: aprobado, 29 pÃ¡ginas. Se ejecutÃ³ fuera del sandbox por la limitaciÃ³n conocida de empaquetado standalone en Windows.
- `npm run test:session-browser`: **14 escenarios aprobados** en Chrome con React/Strict Mode, mocks de fetch e identidades sintÃ©ticas. Incluye cambio Aâ†’Bâ†’A, respuesta tardÃ­a, 409, reintento tras 503 con payload idÃ©ntico, deduplicaciÃ³n de clics, recursos y notas/borradores. Abrir loopback `http://127.0.0.1:3021` al ejecutar el harness; debe terminar en `ALL PASSED`.
- `git diff --check`: aprobado. Las pruebas de navegador no acreditan Safari fÃ­sico ni producciÃ³n; host Node 26, Node 22 sigue pendiente.

## Despliegue y recuperaciÃ³n

La peticiÃ³n actual autoriza desplegar cambios necesarios de bajo riesgo, pero no hay destino utilizable verificado. Existen `vercel.json` y `railway.json`; no hay CLI, credenciales de despliegue ni proyecto `.vercel` enlazado. Descubrimiento de plugins encontrÃ³ Vercel/Railway disponibles pero no instalados. Sites estÃ¡ disponible, pero no hay `.openai/hosting.json` ni Sites existentes en el inventario consultado. No se creÃ³ otro servicio o repositorio para sortear esto.

Para desplegar posteriormente: enlazar el proveedor del proyecto existente, verificar entorno de preview aislado y sus variables por nombre sin exponer valores, publicar el estado revisado y comprobar health/UI. No copiar credenciales locales a un servicio nuevo. No atribuir un build o una vista local a un despliegue remoto.

Se conserva HEAD y todo el trabajo previo sin staging/commits; revisar archivos nuevos con `git status --short` ademÃ¡s del diff tracked. El handoff contiene alcance, pruebas, riesgos y siguiente tarea. Las claves globales antiguas no fueron borradas.

## LÃ­mite importante

Un recibo del cliente no vuelve atÃ³mica una secuencia SQL. Persiste pendiente el cierre transaccional de actividad, progreso de recurso y snapshot, especialmente tras reinicios o entre instancias/pestaÃ±as. El cache en memoria no acredita idempotencia durable. No declarar G03 completa ni seguridad integral de finanzas/onboarding. Para un piloto real aÃºn aplican G03.2b, G04/G05 y los hallazgos financieros de la auditorÃ­a.

## ActualizaciÃ³n posterior: recuperaciÃ³n y borrador transaccional

- `skill-session-state.ts` conserva historial especializado y recibos de sesiÃ³n en el mismo snapshot, con versiÃ³n y propietario explÃ­cito. Nunca serializa claves de Limit Break ni otros comandos financieros. No inventa recibos para snapshots antiguos ni acepta estados de otra identidad.
- `skill-session-recovery.ts` recupera ese cache antes del primer log_session de un proceso remoto; comparte la lectura inicial por store y deja reintentar una lectura fallida. No restaura saldos desde ese paso. La ruta responde 503 antes de registrar si la recuperaciÃ³n existente es invÃ¡lida o no verificable.
- Ocho regresiones nuevas incluyen otro proceso Node que lee un archivo temporal escrito atÃ³micamente y repite la operaciÃ³n sin otro pago, XP, pÃ¡gina o vuelta. Se cubren GP capado a cero y confirmaciones desde perfil simulado. Esto protege el reinicio **cuando existe un snapshot completo**; no soluciona un crash anterior a ese snapshot ni dos instancias concurrentes.
- `supabase/drafts/20261112_atomic_skill_session.sql` es un borrador **inactivo** y no fue aplicado a una base externa. Usa el trigger RPG existente sin cambiarlo, recibo durable privado, bloqueo por operaciÃ³n/tesorerÃ­a, control de revisiÃ³n del perfil y una transacciÃ³n para actividad, recurso y snapshot. El recibo reproduce el importe efectivo; propuestas de snapshot no sustituyen saldos autoritativos.
- Catorce pruebas ejecutan ese SQL en PostgreSQL WASM con PGlite 0.5.16, dependencia solo de desarrollo. La fixture reutiliza tablas y trigger del schema real. Cubren rollback tras fallo final, aislamiento de dueÃ±o, claves compartidas entre cuentas, revisiÃ³n obsoleta, recibos sin GP, lectura/tejido/Rubik, recreaciÃ³n del motor y recuperaciÃ³n del cache desde un recibo SQL capado. Invocaciones paralelas desde JS se serializan en una instancia: no equivalen a clientes PostgreSQL nativos en mÃºltiples procesos.
- Suite completa actual: **276 pruebas aprobadas, cero fallos/omitidas**; TypeScript aprobado. El resultado del build y vista local final se registra en el handoff. Los 14 escenarios browser de la secciÃ³n anterior son histÃ³ricos de aquel ciclo; no se usaron cuentas reales para esta actualizaciÃ³n.

## Ajuste de seguridad de dependencias

El audit identificÃ³ la copia PostCSS 8.4.31 incluida por Next. Se mantiene Next 15.5.29 y se limita un override de su PostCSS a 8.5.32; Tailwind ya utilizaba esa versiÃ³n. La resoluciÃ³n efectiva de Next ahora es 8.5.32 y `npm audit --omit=dev` devuelve **0 vulnerabilidades conocidas**. `npm ci --dry-run --ignore-scripts --no-audit --no-fund` verifica el lockfile sin reinstalar todo.

El [aviso del mantenedor](https://github.com/postcss/postcss/security/advisories/GHSA-fxqj-rqcc-2cmp) declara parche desde 8.5.23; [las releases oficiales](https://github.com/postcss/postcss/releases) documentan 8.5.32. Se aÃ±adieron regresiones sobre la resoluciÃ³n de Next y un mapa CSS sintÃ©tico absoluto sin `from`, sin leer archivos privados reales. Npm retuvo inicialmente su copia antigua; se conservÃ³ solo ese paquete en una copia temporal y se regenerÃ³ su entrada de resoluciÃ³n. No se ejecutÃ³ `audit fix --force` ni se migrÃ³ Next de versiÃ³n mayor.

PGlite se justificÃ³ porque Docker no tiene motor activo y se requiere ejecutar PL/pgSQL real sin servicios ajenos. Su [documentaciÃ³n oficial](https://pglite.dev/docs/about) contempla pruebas en memoria; la [API](https://pglite.dev/docs/api) permite exportar/recrear el motor para probar reinicios. No es el motor de la aplicaciÃ³n ni un cambio de proveedor.


## Adaptador tipado G03.2b.3 — inactivo

`src/lib/atomic-skill-session.ts` usa una copia profunda del motor y captura su llamada completeActivity para obtener GP base, sin duplicar fórmulas ni tocar saldos, recursos o cache del store en uso. Exige contexto de servidor con dueño/tesorería/revisión, clave estable y recurso explícito; elimina campos ajenos al contrato del fingerprint. La propuesta y respuesta son copias independientes. RPC fallido o confirmación incompleta conserva semántica pendiente y nunca recurre al protocolo antiguo. La respuesta SQL determina el GP efectivo y el ID original en un replay, incluso si un proceso nuevo preparó otro UUID.

Seis pruebas unitarias y una integración adicional con el SQL real en WASM verifican aislamiento de cambios anidados, propuestas de lectura/tejido/Rubik, GP sin cap/multiplicador y pérdida de respuesta después de commit. Suite completa: **283 aprobadas**; tras endurecer validación de tesorería, **21 pruebas dirigidas aprobadas**. TypeScript y diff verificados; no se repitió build/browser por no incorporar el módulo a la ruta ni modificar cliente. `ATOMIC_SKILL_SESSION_ENABLED = false` es un gate de release, no una activación operativa por entorno. La API actual sigue sin usar el adaptador. Para conectarlo faltan concurrencia PostgreSQL nativa, carga autoritativa/revisión del snapshot, reconciliación legacy y los gates de migración. Sin SQL externo, datos reales o despliegue.
