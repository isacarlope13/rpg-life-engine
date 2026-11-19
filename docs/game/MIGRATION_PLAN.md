# OakHaven 5.0 — plan de migración y recuperación

Estado: plan aditivo con un borrador SQL validado solo en PostgreSQL WASM (gate G03.2b al final). No se aplicó ninguna migración externa. El despliegue y acceso a producción requieren autorización concreta. Referencia de invariantes: [GDD](GAME_DESIGN_DOCUMENT.md).

## Regla de conservación

La misma cuenta conserva sus IDs y valores existentes de GP, XP, nivel, racha, bóveda, billetera, deudas, misiones, wishlist, proyectos y sesiones. Apariencia, posición y tutorial no inicializan ni recalculan esas tablas. No llamar al onboarding anterior para crear personaje, no reenviar todos sus campos con valores iniciales y no asignar snapshots de otra cuenta.

Ninguna fase borra cuentas, progreso, archivos locales ni el mundo anterior. No se ofrece un script «limpiar para migrar». No aplicar un backfill desde casos financieros de ejemplo. Antes de migrar se distingue origen local, Supabase, snapshot y datos reales: la coexistencia actual de fuentes requiere reconciliación por propietario, no elegir siempre el más reciente sin validar.

## Modelo aditivo propuesto

| Entidad nueva | Claves y datos | Permisos / límites |
|---|---|---|
| `game_characters` | `user_id` PK y FK a identidad existente; apariencia JSON validada/versionada, estado creador/tutorial, revisión, fechas | Una fila por usuario; RLS propietario en lectura/escritura; sin columnas GP/XP, email ni nueva contraseña |
| `game_world_checkpoints` | PK `user_id`; escena, spawn/posición válida, versión de mapa, revisión | Metadata no económica; validar escenas/posiciones y manejar formato antiguo |

Usar FK a `auth.users(id)` con estrategia **RESTRICT** inicialmente; no añadir cascadas destructivas. Si el modelo de eliminación de cuenta exige otra cosa, diseñarlo por separado con consentimiento y respaldo. RLS `auth.uid() = user_id`, índices/uniqueness y grants explícitos; cliente ordinario no puede editar metadata de otro. Una tabla distinta es un agregado de apariencia/ubicación, no una segunda identidad ni economía.

No crear `game_wallet`, `game_xp`, `game_reward_log` ni inventario fungible. Hitos/obras se proyectan desde recursos existentes; si se requiere recordar una celebración vista, es preferencia acotada que no acredita pago. No sincronizar reloj de sesión en checkpoint de escena: sigue en coordinador/motor actual.

## Secuencia expandir → adoptar → conservar compatibilidad

### M0. Baseline y puertas

Inventariar esquema aplicado realmente, ownership y configuración del entorno; documentación SQL no acredita estado desplegado. Identificar G-SEC-01, onboarding destructivo, aislamiento y confirmaciones. Preparar DB aislada sin credenciales de producción; capturar una muestra anonimizada y respaldos por fuente con autorización. Nada se escribe mientras se prepara este plan.

Aceptar solo con un baseline de conteos/IDs y estados económicos por usuario. Una comparación de hashes normalizados puede ayudar, pero incluir valores y relaciones relevantes; nunca registrar datos privados en logs de CI. No usar lectura bootstrap que aprovisiona valores por defecto para «medir antes».

### M1. Expandir metadata en pruebas

Crear tablas/políticas versionadas aditivas en entorno aislado. Usuarios existentes no necesitan filas masivas: un GET puede devolver default **transitorio no persistido**; un PUT crea su fila explícitamente por identidad. No cambiar `profiles.onboarding_completed`, `avatar_url` ni clase. Probar migración desde DB vacía y copia anonimizada existente, así como coexistencia con versión antigua.

El esquema existente debe instalarse con orden verificado: la migración completa no basta para demostrar que estén aplicados los triggers del esquema base. No recrear tablas ni reejecutar seed global en cuentas con progreso.

### M2. Adoptar con bandera apagada por defecto

Añadir `/play` opt-in y servicios de metadata. Datos existentes alimentan proyecciones; solo el jugador personaliza. Nada migra premios retrospectivos. Si faltan assets o metadata, usar defaults visuales sin guardarlos sobre la versión desconocida.

La cuenta local de demostración queda en repositorio local de prueba separado y rotulado. No subir sus fondos/catálogos al usuario Supabase. Una futura importación real requerirá identidad demostrada, preview y reconciliación; queda fuera del corte 5.0.

### M3. Reconciliar sesiones y storage

Identificar claves antiguas con propietario verificable. Un registro sin dueño queda pendiente de revisión/exportación, nunca se adjudica al usuario que acaba de entrar. Usar copia de lectura, marcar migración por versión y conservar origen para recuperación. No vaciar localStorage global; no borrar `.data`.

La actualización de SW necesita revisión: la cache actual se llama `rpg-life-engine-v4.0`. Planear versionado y limpieza solo de caches de assets de la aplicación; nunca confundir cache con cola de datos. Probar usuario con SW anterior, nueva ruta y assets retirados. No forzar refresh durante formulario o envío sin conservar pendiente.

### M4. Piloto voluntario y activación gradual

Primero fixture sintético aislado y solo después cuentas preparadas autorizadas. Pasar G11 de aceptación y conservar rutas antiguas. Configurar rollback antes de habilitar bandera. No activar por «build pasó» ni hacer rollout automático por fecha.

## Validaciones de conservación

| Momento | Comprobación |
|---|---|
| Crear personaje / omitir / cambiar ropa | Misma identidad; saldos, XP, deudas y conteos de sesiones iguales |
| Entrar/salir y mover personaje | Solo metadata espacial; 0 nuevas actividades/transacciones |
| Sesión única confirmada | Efectos exactamente iguales al contrato existente, un solo ID/recompensa |
| Reintentar y reiniciar | Misma operación, sin doble avance de páginas/vueltas ni GP/XP |
| Dos pestañas | Conflicto optimista de metadata; no pérdida silenciosa |
| Dos usuarios | Ningún acceso RLS ni cache/cola cruzada |
| Motor antiguo + cliente nuevo | Ambas vistas proyectan mismo progreso; nueva metadata no rompe lectura antigua |
| Cancelar piloto | Volver a rutas existentes sin editar datos económicos |

Snapshot corrupto o versión futura se reporta y se conserva para revisión; no se reemplaza por un seed. Si falla servicio económico no se muestra el store demo como saldo válido. Un checkpoint inválido se degrada a plaza segura, sin tocar sesión ni progreso.

## Rollback operativo propuesto

1. Desactivar acceso opt-in a renderer nuevo; ofrecer `/dashboard`, `/cozy` y `/quick`.
2. Detener solo escrituras nuevas de metadata mientras se diagnostica; preservar pendientes y sesión del mismo usuario.
3. Mantener tablas aditivas y descriptor; el código anterior puede ignorarlos. No hacer down migration que destruya personalización.
4. Si un comando existente tuvo éxito pero se perdió respuesta, reconciliar por clave. Nunca restaurar una DB entera para resolver un asset roto.
5. Restauración de respaldo económico solo ante incidente identificado y con autorización, alcance y conciliación explícitos; no es el rollback normal del cliente.

## Puertas de autorización

Este plan autoriza documentación, no aplicar SQL ni desplegar. Una futura tarea puede preparar scripts y pruebas en aislamiento; producción, cambio de auth y migración real deben tener alcance explícito y resultado revisable. No solicitar permisos ahora para un cambio que aún no está implementado.

Tareas con objetivo, archivos, pruebas y esfuerzo: G00/G01/G04/G05/G12 en [IMPLEMENTATION_BACKLOG.md](IMPLEMENTATION_BACKLOG.md).
## Gate adicional G03.2b — núcleo transaccional de sesiones

El archivo `supabase/drafts/20261112_atomic_skill_session.sql` es un borrador **fuera de cualquier migración automática**. No está conectado a la ruta y no fue aplicado a Supabase. Introduce solo un ledger privado de recibos y una función server-only; reutiliza las tablas/trigger existentes y no altera fórmulas RPG.

Antes de aplicar/activar:

1. Verificar columnas/enums y versión del trigger en una copia aislada del esquema del destino, sin cuentas reales. Las pruebas PGlite reutilizan el schema del repositorio; no demuestran que producción tenga ese mismo esquema.
2. Mantener `service_role` solo en servidor. La función exige ese rol y no concede lectura/escritura del recibo ni EXECUTE a anon/authenticated. El propietario siempre proviene de la autenticación verificada del API, nunca del cuerpo del navegador.
3. Crear un adaptador de propuesta con el motor existente, sin mutar el store vivo antes del commit. Pasar la recompensa base esperada al trigger una sola vez: no usar como solicitud un GP ya multiplicado/capado por el cálculo local. Normalizar el resultado con el GP efectivo de SQL.
4. Leer revisión de perfil y derivar el snapshot desde estado autoritativo. El kernel rechaza revisión obsoleta, protege saldos de propuestas y corrige proyecciones del recurso activo. Probar coordinación y reintentos con varias conexiones PostgreSQL nativas; PGlite de una instancia no valida esa contención.
5. Resolver operaciones legacy que tienen activity_log sin recibo: el borrador falla cerrado sin pagar otra vez. No crear recibos retroactivos a partir de suposiciones sobre efectos secundarios.
6. Mantener bandera de activación apagada hasta validar el contrato completo. No alternar silenciosamente al flujo legacy si falla RPC: podría ejecutar dos protocolos para el mismo intento. Preview aislado y comprobación posterior antes de un despliegue financiero.
7. Revisar retención/borrado del ledger y sus referencias antes de activarlo. Eliminar un recibo sin reconciliar una operación permitiría otro pago por el mismo intento; la política de borrado de cuenta y auditoría debe ser explícita.

Rollback de activación: deshabilitar la bandera y conservar recibos y datos; no borrar el ledger ni reiniciar cuentas. La compatibilidad de pendientes entre protocolos debe probarse antes de habilitar cualquier fallback. Aplicar el SQL o modificar producción requiere una autorización concreta posterior; esta preparación no la presupone.

