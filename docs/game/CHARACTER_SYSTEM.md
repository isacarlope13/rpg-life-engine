# OakHaven 5.0 — sistema de personaje

Estado: contrato propuesto, no tablas ni tipos implementados. Separa identidad, apariencia y progresión. La cuenta actual sigue siendo la única identidad.

## Modelo

Un personaje por usuario autenticado. `character.userId` es exactamente `UserProfile.id` / `auth.users.id`, no un ID de cuenta alternativo. En modo local de desarrollo se requiere repositorio aislado identificado por esa sesión; no introducir usuarios predeterminados para continuar una sesión real. No migrar un UUID local a Supabase por coincidencia de nombre/email sin procedimiento verificado.

| Campo lógico | Origen / persistencia | Restricciones |
|---|---|---|
| `userId` | Identidad existente | Derivado en servidor; no editable |
| `displayName` | `profiles.display_name` | Se conserva. El creador inicial no fuerza renombrar ni cambiar unicidad |
| `characterClassLabel` | `profiles.character_class` | Etiqueta existente; no añade multiplicadores |
| `level`, `xp`, habilidades | Estado RPG actual | Solo lectura/proyección, sin duplicarlas en tabla de personaje |
| `appearanceVersion` | Metadata nueva | Entero de formato soportado |
| `bodyPresetId`, `skinPaletteId`, `hairId`, `hairPaletteId`, `outfitId` | Catálogo cosmético original | IDs permitidos; sin URLs, HTML ni blobs arbitrarios |
| `accessoryIds` | Metadata cosmética | Lista pequeña limitada a catálogo; no compra ni boost nuevo |
| `customizationState` | `deferred` / `customized` | Omitir es válido; no bloquea exploración |
| `tutorialVersion`, `tutorialStep`, `tutorialState` | Metadata | Pendiente, omitido o completado; no misión económica |
| `revision`, fechas | Servidor | Control optimista; cliente no define timestamps de autoridad |

El descriptor no almacena correo, PIN, edad, deuda, ingresos ni saldo. Pronombres o biografía se dejan fuera del primer corte: no son necesarios para movimiento ni apariencia. No reemplazar `avatar_url` existente: conservarlo para las interfaces anteriores, aunque el mundo use sprites de catálogo.

## Progresión e inventario visual

La ficha del personaje lee nivel y XP del motor existente. Cada habilidad muestra métricas actuales y preferencias de activo/pausado/archivado. No asignar puntos nuevos por profesión o apariencia. La selección de interés del tutorial solo decide a dónde acompañar al jugador; no crea habilidad, quest o recompensa adicional sin usar la operación ya definida.

Inventario visual es una proyección de obras, libros y hitos confirmados, más elecciones de decoración sin valor económico nuevo. Cada elemento referencia su recurso/hito de origen mediante ID estable. No añadir madera, gemas, energía, hambre o moneda 5.0. Si un cosmético futuro exige wishlist, su coste y canje deben pasar por el sistema vigente una sola vez, fuera del primer corte.

Un proyecto al 40 % aparece en bastidor, no como obra final terminada. Un recurso archivado se conserva en memoria/historial sin exigir que su edificio siga activo. Cambiar de skin nunca mueve GP ni XP.

## Creador breve y reversible

Una pantalla con previsualización y controles DOM de cuerpo/paleta, cabello y ropa; accesibles por nombre, sin rasgos de «mejor personaje». Acciones: «Guardar y explorar» y «Ahora no». Valores predeterminados cosméticos neutrales; no se deducen características personales desde profesión, finanzas o nombre.

El creador toma nombre/clase como lectura. Editar esos campos puede ofrecer enlace posterior al editor de perfil seguro, sin reutilizar onboarding completo. Se conserva la apariencia anterior hasta confirmación de guardado; fallo permite reintentar o explorar con versión previa/default sin pérdida de progreso.

## Contrato de metadata propuesto

`GET /api/game/character`: autentica con resolver existente, devuelve descriptor o default transitorio si no existe; no crea tesorería. `PUT /api/game/character`: acepta solo IDs cosméticos permitidos, estado de personalización y revisión esperada. Obtiene usuario del servidor, actualiza metadata propia y devuelve descriptor confirmado. Los flags de tutorial usan operación de metadata equivalente, sin permisos económicos.

Primera creación idempotente por PK de usuario; dos peticiones concurrentes no crean dos personajes. Actualización `expectedRevision` evita que dos pestañas se sobrescriban. Conflicto devuelve 409 y permite recuperar versión actual. Anónimo 401; intento de otro propietario se rechaza/ignora antes de escribir; campo extra de saldo/XP debe rechazarse.

No llamar `/api/auth/login`, `/api/onboarding`, `applyOnboarding`, completar misión o registrar sesión al guardar personaje. Es una metadata lateral, no una recreación de usuario.

## Sprite y movimiento

Prototipo de sprite original, base propuesta de 32×48 píxeles con cuatro orientaciones y ciclos breves de reposo/caminar. La medida es un punto de partida de arte, no una obligación de engine. Colisionador rectangular reducido en los pies; sombras y techo son decoración, orden de profundidad por base del sprite. Apariencia compuesta mediante atlas/capas compatibles, con fallback visible si falta un asset.

Moverse no consume puntos ni da XP. Un bloqueo no daña al jugador. Al entrar/salir se recupera punto de puerta válido. Al editar disposición de edificios, si una ubicación guardada queda inválida se usa spawn seguro. Posición no se trata como prueba de una actividad productiva.

## Usuarios existentes y casos límite

- Perfil antiguo sin metadata: ofrecer creador sin enviar formulario financiero; omitir crea estado diferido solo cuando puede guardarse de forma segura.
- Cuenta sin datos de progreso: estado de preparación explícito; no sustituir por datos de ejemplo.
- Cuenta con sesión activa: rehidratar primero o permitir posponer creador; personalizar no finaliza ni reinicia sesión.
- Storage bloqueado: informar que el borrador es temporal, usar descriptor confirmado; no prometer respaldo por fallback RAM.
- Cuenta cambiada: destruir contexto y nunca mostrar cache de la anterior.
- Asset no reconocido en formato futuro: fallback de lectura conservando descriptor original; no escribir una «reparación» destructiva automáticamente.

## Verificación

Contratos puros validan catálogo y formato. Prueba de conservación compara, antes/después de crear/editar/omitir personaje, ID, XP, GP, nivel, racha, bóveda, deudas, quests, proyectos y sesiones: iguales. Dos cuentas prueban aislamiento, dos pestañas conflicto y reintento primera creación una sola fila. Navegador prueba teclado, lector de pantalla de referencia, preview reducido y retorno al pueblo. Tareas G05/G06 en [backlog](IMPLEMENTATION_BACKLOG.md).
