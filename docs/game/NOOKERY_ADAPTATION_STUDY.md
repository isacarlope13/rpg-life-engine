# Nookery → OakHaven: estudio de adaptación

Fecha: 11 de noviembre de 2026, America/Bogota. Complementa el plan 5.0 y G01; no reinicia la auditoría ni implementa juego. No se clonó ni compiló Nookery, descargaron assets/ROM ni cambiaron dependencias o servicios locales.

## 1. Método y alcance verificable

Referencia: [flyngmt/Nookery](https://github.com/flyngmt/Nookery), rama `master`, fijada al commit [1295ed1942f88d26329b0d4fb972318b1babb811](https://github.com/flyngmt/Nookery/commit/1295ed1942f88d26329b0d4fb972318b1babb811), cuya fecha de autor informada por GitHub es 8 de noviembre de 2026. Se recuperaron los 13 archivos pedidos mediante el conector de GitHub y se inspeccionaron únicamente declaraciones/secciones pertinentes. Todos estuvieron disponibles. Se añadió una lectura auxiliar de `m_npc_schedule_h.h`, porque el header de scheduler remite allí para sus tipos.

**V-H** significa declaración comprobada en header; **V-I**, implementación inspeccionada; **V-D**, afirmación de documentación. Ninguna significa ejecución comprobada del port. **P** identifica un diseño original propuesto para OakHaven, no una función importada ni algo ya implementado. Los links fijan contenido y líneas para revisión reproducible.

| Ref. | Fuente fijada | Evidencia leída y límite |
|---|---|---|
| N01 · V-H | [m_scene.h](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_scene.h#L39-L55) | Tipos de habitación y puerta con siguiente escena, posición/orientación de salida y transición visual; declara construcción de escena. No demuestra rollback o guardado transaccional |
| N02 · V-H | [m_camera2.h](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_camera2.h#L12-L27) y [peticiones](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_camera2.h#L339-L375) | Modos normal, conversación, objeto, puerta y demo; solicitudes con prioridad y parámetros de transición. No se midieron suavidad ni accesibilidad |
| N03 · V-H | [m_player.h: estados](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_player.h#L103-L125), [animaciones](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_player.h#L286-L304), [peticiones](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_player.h#L2240-L2257) | Movimiento/acción y animación tienen representaciones diferenciadas; peticiones para hablar, sentarse, cama y puerta. No se auditó toda su física ni se propone trasladar sus muchos estados |
| N04 · V-H | [m_npc_schedule.h](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_npc_schedule.h#L11-L15) y [tipos auxiliares](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_npc_schedule_h.h#L11-L40) | Manager y estados ambientales; datos de horario incluyen fin de tramo y estado actual/forzado. No se siguió algoritmo de selección ni horarios concretos |
| N05 · V-H | [m_quest.h](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_quest.h#L40-L74) | Tipos de encargo y campos de progreso/recompensa; el flag no acredita idempotencia durable ni una economía transferible |
| N06 · V-H | [m_inventory_ovl.h](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_inventory_ovl.h#L18-L38) y [datos de overlay](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/include/m_inventory_ovl.h#L68-L113) | Páginas, selección, presentación, animaciones y lifecycle de overlay; no adoptar dimensiones, iconografía, moneda o límites de bolsillo |
| N07 · V-I | [acgc_input_profiles.cpp](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/pc/src/acgc_input_profiles.cpp#L6-L94) | Acciones lógicas separadas de teclas/ejes, bindings editables y guardado cuyo error se informa; hay política de conflicto al reasignar |
| N08 · V-I | [acgc_settings.cpp](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/pc/src/acgc_settings.cpp#L225-L261) | Preferencias de pantalla/UI, texto rápido, volumen master, deadzones y touch. No se encontró aquí prueba de volumen por canal ni autosave; input en background es una opción que NO adoptaremos por defecto |
| N09 · V-I | [acgc_game_editor.cpp](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/pc/src/acgc_game_editor.cpp#L14-L113) y [IME/eventos](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/pc/src/acgc_game_editor.cpp#L160-L225) | Es editor de entrada de texto: sesión de captura, composición IME y cola de comandos. No es un editor del mapa, de inventario o de partidas |
| N10 · V-I | [acgc_texture_replacements.cpp](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/pc/src/acgc_texture_replacements.cpp#L27-L82) | Busca directorio de packs, recarga registros y los descarga al cerrar; no proporciona un pipeline de assets web ni licencia de packs |
| N11 · V-I | [aurora_mouse_cursor.cpp](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/pc/src/aurora_mouse_cursor.cpp#L34-L99) | Cache/captura gráfica e invalidación al cambiar resolución; dibuja cursor visible con offset/aspecto. No es el sistema de click-to-walk ni la normalización de input |
| N12 · V-D | [README](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/README.md#L5-L9) y [features](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/README.md#L57-L74) | Describe port nativo, requiere datos del disco del usuario y enumera mouse, mando y touch; no acredita motor listo para navegador |
| N13 · V-D | [LICENSE](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/LICENSE#L1-L38) | Declara CC0 para decompilación original, MIT para capa PC y adiciones TARGET_PC, y licencia/autor distintos para FixNES. No es una licencia homogénea de todo asset o tercero |

No se verificó un sistema de viaje rápido, autosave robusto o escalado independiente del texto en las secciones inspeccionadas. Su diseño en OakHaven es **P**, aunque el port contenga otras funciones no estudiadas. Ninguna afirmación se infiere solo del nombre del archivo.

## 2. Matriz de adaptación

Complejidad S/M/L es relativa; prioridad P0–P3 sigue la petición actual. «Nuevo» describe trabajo futuro, no archivos creados en esta fase. Componentes locales se revalidaron por búsqueda dirigida sobre G01 y motores existentes.

| Función externa verificada | Archivo/evidencia | Problema que aborda | Equivalente original OakHaven (P) | Reutilizar local | Nuevo requerido | Complejidad | Riesgos | Prioridad |
|---|---|---|---|---|---|---|---|---|
| Puerta con destino y salida (V-H) | N01, 47–55 | Mantener continuidad al cruzar lugares | SceneManager + doorId/spawnId; misma ruta `/play` | `LAYOUTS`, `nearDoor`, lifecycle G01 | Registro de escenas y transición cancelable | M | Spawn bloqueado; doble activación | P1 |
| Tipos de habitación (V-H) | N01, 39–44 | Diferenciar contextos espaciales | Exterior, casa, interiores, espacios especiales con IDs propios | Plaza y Atelier G01 | Scene descriptors y cargas diferidas | M | Convertir cada escena en otra página administrativa | P1 |
| Estado de acción/animación (V-H) | N03 | Movimiento coherente con acción | CharacterController, MovementState, AnimationState | Vector normalizado y sprite G01 | Separación del bloque `update`; CollisionSystem/InteractionRange | M | Cambios de framerate, interacción a distancia | P1 |
| Bindings lógicos (V-I) | N07 | Distintos dispositivos sin duplicar acciones | PlayerInput semántico; remapeo con conflictos/reseteo | Teclado, pad DOM, ruta por toque | InputRouter y preferencias versionadas | M | Teclas capturadas en campos de texto | P1 |
| Captura de texto e IME (V-I) | N09 | Escribir sin activar juego | Contextos de input exclusivo; eventos de composición DOM | Foco/control DOM existentes | Coordinación exploration/overlay/text | M | Enviar actividad al pulsar Enter durante composición | P1 |
| Cámara por solicitud/contexto (V-H) | N02 | Enfocar acción relevante | ContextualCamera con seis estados y reduced motion | Follow/resize de G01 | Prioridades, restauración y transiciones acotadas | M | Mareo; foco que no vuelve al jugador | P1 |
| Scheduler ambiental (V-H) | N04 + auxiliar | Sensación de habitantes presentes | Rutinas deterministas pequeñas, herramientas siempre accesibles | `cozy-residents-engine`, `village-tiers` | NPCState + rutas/animación | L | Bloquear herramientas por horario o culpa por ausencia | P2 |
| Peticiones de acción sobre entorno (V-H) | N03, 2240–2257 | Interacción situada | Objetos con acciones contextuales y servicio detrás | Estaciones, recursos y sesión universal | InteractionRegistry y panel contextual | M/L | Segundo registro/recompensa | P1 |
| Progreso/estado de encargo (V-H) | N05 | Comprender objetivo y avance | QuestPresentation de misiones ya existentes | Catálogo/estado de quests | Proyector y tablón, sin nuevo otorgante de GP | M | Tratar flag visual como prueba de cobro | P0/P1 |
| Overlay de inventario (V-H) | N06 | Consultar sin abandonar mundo | InventoryView de referencias, grupos y filtros originales | `skill-resources-hub`, obras/hitos, wishlist | Vista accesible React; selección restaurable | M | Segundo inventario durable o moneda | P2 |
| Preferencias tipadas y acotadas (V-I) | N08 | Adaptar controles/ritmo | Texto ajustable, animaciones opcionales, master/música/ambiente/efectos | Safe storage y audio existentes | Preferences adapter por usuario | M | Defaults no respetados; audio sin gesto | P2 |
| Recarga/lifecycle de texturas (V-I) | N10 | Resolver recursos visuales variables | Manifest versionado de arte propio + fallback + cleanup | Texturas procedurales G01 | AssetRegistry acotado; sin packs del port | M | Licencias, memoria, rutas externas arbitrarias | P3 |
| Cursor sensible a viewport (V-I) | N11 | Mantener puntero legible | Cursor CSS/sistema y hit targets recalculados tras resize | Resize y controles DOM G01 | Solo indicadores opcionales propios | S | Copiar cursor o interferir con accesibilidad nativa | P2 |
| Mouse/mando/touch declarados (V-D) | N12 | Flexibilidad de acceso | Teclado/mouse/touch primero; Gamepad API/joystick opcionales | G01 y InputRouter propuesto | Spike separado si demanda/dispositivo lo justifica | L opcional | Hotplug, deadzones, móvil sin soporte equivalente | P3 mando |
| No acreditada: viaje rápido/autosave | Sin evidencia en corpus leído | Reducir fricción y evitar pérdida | FastTravel y checkpoint seguro; sesión con confirmación durable | Puertas, snapshots y recuperación existentes | Coordinación de transición/guardado | M/L | Teletransportar saltándose una sesión en envío | P0 guardado / P1 viaje |

## 3. Arquitectura recomendada

Se mantiene **Phaser 4.2.1 + React**. Evidencia local: `/play` ya funciona, dispone de colisiones Arcade, vector de movimiento, navegación y cleanup comprobado; cambiar a otro renderer ahora descartaría trabajo probado sin aportar evidencia de beneficio. G01 tiene dos layouts dentro de una escena, no SceneManager definitivo. Phaser administra objetos gráficos/escenas; el SceneManager de aplicación agrega puertas, spawns, carga/cancelación y preservación del contexto.

| Opción | Evaluación sobre OakHaven |
|---|---|
| Renderer DOM/SVG anterior | Reutilizable como fallback/lista y herramientas; no replicar un motor de movimiento/colisión completo sobre dashboard |
| PixiJS | Renderer viable; obligaría reimplementar partes de gameplay que Arcade/escenas ya ofrecen; reevaluar solo con mediciones o necesidad concreta |
| Phaser actual | Continuar incrementalmente; hay evidencia de build/browser, no de FPS/consumo en Safari real |
| Híbrida | Elegida: Phaser para mundo y React para HUD, texto, inventario y herramientas accesibles, con dominio puro y adaptadores |
| Aurora | Descartada como dependencia web; los mecanismos nativos observados no son un adaptador de navegador |

El chunk diferido de Phaser medido en G01 fue 1.369.519 bytes y 355.210 bytes gzip local; First Load JS de `/play`, 111 kB, no lo incluye. No afirmar que el port nativo prueba buen rendimiento web. Las pruebas pendientes de G01 se conservan.

Contratos originales completos en [TDD, ADR-002](TECHNICAL_DESIGN_DOCUMENT.md#adr-002-patrones-de-interacción-y-contratos-originales). No se crean todavía archivos TS ni nuevas tablas. Ningún sprite, escena o animación importa economía, auth admin o persistencia privilegiada.

### Escenas, personaje y cámara

SceneManager prepara recursos/destino, guarda un punto de retorno y bloquea input de mundo durante transición breve. Solo confirma cambio cuando el destino está listo; si falla, recupera escena, aparición y foco anteriores sin resetear sesión. La ruta Next no cambia al cruzar puerta o usar viaje rápido. Un checkpoint inválido cae en spawn seguro de la misma cuenta.

CharacterController consume PlayerInput y avanza posición con CollisionSystem; AnimationState representa movimiento, no determina tiempo productivo. InteractionRange valida proximidad/objeto en escena; no es autorización financiera. Teclado, mouse y touch producen los mismos intents. Joystick virtual y mandos no son condición para usar herramientas.

| Cámara propuesta | Entrada / salida y bienestar |
|---|---|
| Exploración | Sigue personaje; retorno por defecto tras otra acción |
| Conversación | Encuadre de interlocutores, no bloquear salida ni esconder controles DOM |
| Entrada | Breve encuadre de puerta y aparición; cancelación/timeout restauran contexto |
| Objeto | Acerca lo necesario sin exigir precisión; vuelve al cerrar herramienta |
| Evento narrativo | Omitible y cancelable; sin compromiso económico ni interacción obligatoria |
| Pausa | Congela movimiento/cámara, conserva estado; no finaliza una sesión real implícitamente |

Prioridad propuesta: pausa > transición de puerta > interacción/diálogo > narrativa opcional > exploración. Interacción y diálogo son contextos exclusivos, no solicitudes que se disputan el foco cada frame. Reduced motion usa encuadre inmediato o fundido mínimo, sin zoom forzado/sacudida. Las duraciones no son tiempos de espera obligatorios.

### Habitantes y objetos

Clara, Aura y otros compañeros existentes conservan personalidad/rol propios de OakHaven. Cada NPC tendrá ubicación, comportamiento, animación, diálogo y acciones; horario opcional solo cambia ambiente. Si está ausente, el bastidor/escritorio/tablón sigue accesible. Nunca hacer esperar para registrar, cobrar un costo por despertar a alguien o perder una recompensa por hora de llegada.

| Objeto original | Acción | Autoridad que se reutiliza |
|---|---|---|
| Mesa/bastidor | Iniciar/retomar tejido | Sesión universal y recurso de proyecto existente |
| Estantería | Consultar libros/obras | Colecciones y proyectores existentes |
| Escritorio | Abrir proyectos | Servicios actuales de proyectos |
| Banco | Consultar finanzas | Estado financiero autorizado; no copiar caso de estudio como saldo real |
| Tablón | Presentar misiones | Quest existente; no dar premio por abrir el tablón |
| Cama/asiento | Descansar, pausar o salir | Sin mutación económica; sesión activa requiere elección explícita |

### Inventario y calidad de vida

Una vista original de cuatro grupos: recursos reales (libros/proyectos), decoraciones, herramientas (accesos a funciones) y cosméticos. Son referencias a registros/hitos existentes, no un bolsillo con cantidades nuevas ni monedas. Una obra/hito puede aparecer en dos vistas, pero mantiene un solo ID y un solo origen. No importar 5×3 slots, límites, precios ni arte del inventario externo.

Viaje rápido a lugares accesibles, acceso directo a actividad sin caminata, autosave de metadata validada, recuperación de sesión y recordatorio visible de «pendiente» reducen fricción. El guardado económico sigue en servicio existente y exige confirmación; guardar un checkpoint no demuestra registrar actividad. Preferencias por usuario: teclas, texto ajustable sin cortar, movimiento reducido/animaciones, volumen por canal y silencio inicial. Volumen independiente y autosave son propuestas, no capacidades acreditadas de Nookery por los archivos leídos.

## 4. Funciones descartadas

No integrar C/C++, ABI/bitfields, bancos ROM/DMA, emulador, disc loader, formatos de guardado del juego original, renderer/captura GX-Aurora, packs de texturas ni cursor capturado. No trasladar deudas obligatorias, esperas por horario, presión diaria, castigos por ausencia, límites de bolsillo o premios del juego externo. El GameEditor estudiado inspira captura de texto; no autoriza añadir un editor que altere saldos o partidas.

## 5. Propiedad intelectual y procedencia

La [licencia publicada](https://github.com/flyngmt/Nookery/blob/1295ed1942f88d26329b0d4fb972318b1babb811/LICENSE) distingue el código original de decompilación, la capa PC/adiciones y FixNES. Para la capa PC declara MIT y copyright FlyingMeta 2026; MIT exige conservar avisos en copias/porciones sustanciales y contiene exclusión de garantías. Para FixNES identifica FIX94 y aviso distinto. No se comprobó autoría individual de cada modificación ni licencias de todo tercero. Un header puede combinar origen y adiciones: no clasificar todo un archivo como CC0 solo por su extensión.

El README dice que no distribuye assets del juego y requiere un disco del usuario. Eso no concede derechos sobre personajes, mapas, música, diálogos, interfaces, logos o packs externos. Tampoco la licencia de código acredita permiso para esas expresiones. Se excluyen todos, incluidos íconos/señales propios del port y packs de terceros.

**Decisión de este estudio: cero reutilización literal de código o assets externos.** Solo observación de responsabilidades/patrones generales y contratos originales. Si se reconsidera, abrir ficha por archivo/fragmento con commit, autoría comprobable, licencia aplicable, dependencias y obligaciones antes de copiar; no asumir que el permiso de un directorio cubre todo. No se incorporan ROM, ISO, datos de disco ni archivos de guardado originales.

## 6. Plan integrado, no segundo backlog

Actualizar las tareas ya existentes: G02 tipos/proyecciones/input; G03 confirmación única/recuperación; G05 metadata/checkpoint; G06 personaje/guía; G07 SceneManager/controlador/cámara; G08 objetos; G09 presentación de progreso/quests; G10 NPC/diálogo; G11 aceptación; G12 compatibilidad/rollback. Se agrega G13 para preferencias/viaje rápido e inventario de lectura, dividido antes de ejecutar. No reabrir G00 ni reescribir G01.

Orden: P0 datos y contratos de confirmación → P1 personaje/exploración/objeto/primer ciclo → P2 habitantes, inventario, diálogo y accesibilidad configurable → P3 decoración avanzada/eventos/mandos opcionales. Los elementos de accesibilidad esenciales se implementan con su interacción, no se posponen como cosmética.

La siguiente fase sigue siendo G02, ahora enriquecida por este estudio. Se espera autorización de implementación; esta entrega no crea ningún componente ni contrato en `src`.

## 7. Pruebas de aceptación futuras

1. Puerta exterior → interior → retorno conserva escena/posición/foco válidos y sesión; doble activación o asset fallido no duplica canvas ni pierde contexto.
2. WASD, mouse y touch equivalentes; diagonal sin ventaja, colisión estable tras resize, input en background apagado; texto/IME no mueve personaje ni confirma actividades.
3. Cada estado de cámara vuelve a exploración, respeta pausa y reduced motion; narrativa se puede omitir sin consecuencia.
4. NPC ausente/dormido no bloquea herramientas; cambiar fecha/volver tras descanso no genera deuda, gasto, XP perdido ni misión forzada nuevos.
5. Cada objeto invoca solo el servicio previsto; abrir inventario, tablón, diálogo, cama o mapa no genera sesión ni GP/XP.
6. Reintento de sesión, animación repetida y recarga conservan un único ID y un único efecto económico; error 401/503 deja pendiente del mismo propietario.
7. InventoryView y QuestPresentation reflejan valores/estado autorizados, sin insertar filas equivalentes o ofrecer un segundo botón de premio.
8. Viaje rápido conserva sesión/pendientes; fallo de checkpoint no se anuncia como guardado económico. B no recupera pendientes o preferencias de A.
9. Remapeo detecta conflictos, permite restaurar defaults y no captura teclas del navegador indebidamente; texto ampliado y volumen por canal funcionan con teclado/lector de pantalla.
10. Registro de procedencia de todo asset original/licenciado, sin archivos binarios/fragmentos del port, Aurora ni datos propietarios en paquete.

Estas pruebas no se ejecutaron: son aceptación de trabajo futuro. Esta fase validó fuentes, integridad documental y ausencia de cambios nuevos en código; las 199 pruebas/build de G01 siguen siendo resultados históricos, no una ejecución nueva.

## 8. Trazabilidad del Prompt 0.1

Actualización acotada del estudio previo, sin repetir investigación externa. N01–N13 remiten a las fuentes fijadas de la sección 1; «propia» no atribuye la mecánica a Nookery. Responsabilidades y reutilización detalladas solo en el TDD.

| Mecánica propuesta | Referencia técnica | Implementación existente | Cambio necesario | Riesgo | Prioridad | Prueba de aceptación futura |
|---|---|---|---|---|---|---|
| Crear personaje al registrarse; transición segura de existentes | N03; creador propio | Auth/perfil y onboarding; visitante G01 sin identidad | G04–G06: metadata aditiva, creador omisible después de identidad válida | Reset por onboarding actual | P0 datos / P1 creador | Cuenta antigua conserva exactamente historial/saldos; crear apariencia no llama onboarding destructivo |
| Explorar pueblo | N03, N07, N12 | Movimiento/Arcade/BFS G01 | G02/G07: controlador e input contextual | IME, colisiones, foco | P1 | Teclas/toque equivalentes; escribir no mueve ni envía actividad |
| Entrar y regresar de interiores | N01 | Plaza/Atelier, `build` y puertas G01 | G07: transición cancelable y spawns validados | Fallo de assets o doble entrada | P1 | Fallo restaura escena/foco; doble pulsación no duplica canvas |
| Cámara tranquila | N02 | Follow/resize G01 | G07: contextos y movimiento reducido | Mareo/encuadre bloqueado | P1 | Pausa y cierre vuelven a exploración sin zoom forzado |
| Objetos y actividades reales | N03; integración propia | Estaciones y sesión universal | G03/G08: interacción con coordinador único | Doble recompensa o falsa confirmación | P0 integridad / P1 objeto | Reintento conserva un ID; 503 sigue pendiente sin celebrar progreso |
| Conversar con habitantes | N04, N09 | Residentes, modales y asistentes | G10: presencia, diálogos/foco y rutinas ambientales | Horario bloquea herramienta | P2 | NPC ausente permite la misma actividad por acceso directo |
| Misiones opcionales | N05 | Motor/estado de quests y modal | G09: QuestPresentation de lectura/acción existente | Segundo otorgante de GP | P1 presentación / P0 integridad | Abrir tablón no paga; completar/reintentar tiene un efecto económico |
| Inventario y personalización visual | N06, N10 | Recursos, wishlist, hitos visuales | G05/G13.b: referencias y cosméticos originales | Segunda economía, arte sin procedencia | P2; decoración avanzada P3 | Misma fuente/ID en ambas vistas; sin monedas ni filas de recompensa nuevas |
| Casa/pueblo reflejan progreso | N01; progresión propia | `visual-village-progression`, `village-tiers` | G09: proyectar hitos confirmados en mundo | Progreso optimista falso | P1 base / P3 ampliación | Reabrir reproduce proyección autorizada sin conceder XP |
| Pausa, acceso rápido y descanso libre | N08 para preferencias; viaje rápido propio | Pausa G01, herramientas DOM y audio | G13.a: accesos, texto, silencio/movimiento; checkpoint G05 | Confundir guardado visual con actividad | P1 esencial / P2 preferencias | Sin caminar se registra por mismo servicio; descanso no crea multa ni obligación |
| Conservar datos y recuperar sesión | Diseño propio; N05 no demuestra idempotencia | Persistencia, offline y sesión actuales con defectos pendientes | G03–G05: ownership, confirmación, revisión y recuperación | Fuga entre usuarios/pérdida de actividad | P0 | B no ve pendientes de A; reconexión no duplica efecto; rollback conserva datos |

Esta matriz es planificación, no reporte de pruebas aprobadas. Prompt 0.1 no autoriza Prompt 1 ni ninguna tarea del backlog.
