# Auditoría de experiencia de juego y mundo 2D

Fecha: 11 de noviembre de 2026. Análisis de interacción y renderizado desde el código; sin sesión de usuario observada, capturas renderizadas, mediciones de FPS ni prueba táctil real. Las conclusiones visuales se limitan a estructura, controles y representación implementados.

Las cifras de build son baseline inicial. Cambios concurrentes de integridad se concilian en el informe principal; no se validó un nuevo build final y no cambian por sí solos la clasificación de interacción.

## Clasificación del producto actual

Una interfaz administrativa organiza información y formularios. Una interfaz gamificada conserva esos flujos y añade metas, recompensas, representación lúdica y feedback. Una simulación de vida modela un mundo persistente donde entidades, lugares, objetos y rutinas se afectan mediante acciones situadas. Un avatar no es obligatorio para todo juego, pero cámara y estética por sí solas no prueban una simulación.

**OakHaven encaja hoy en interfaz gamificada con navegación espacial y herramientas especializadas.** No es solo una imagen estática: cámara, zoom, edición de edificios, selección de residentes, estado de sesión y progresión visual están implementados. Tampoco se encontró una simulación espacial equivalente a la promesa de un mundo vivo en los archivos de escena y habitación inspeccionados.

## Diez preguntas contrastadas con código

| Pregunta | Estado observado | Evidencia |
|---|---|---|
| ¿Pueblo explorable? | Cámara navegable; moverse con WASD desplaza cámara, no personaje. Seleccionar edificio invoca callback | `use-village-camera.ts:300–353`; `interactive-village-scene.tsx:247–290,465` |
| ¿Edificios escenarios? | Representaciones DOM clicables, con adornos y estados; acceso termina en modal | `village-pixel-building.tsx:109,299–313`; `cozy-rpg-dashboard.tsx:541–568` |
| ¿Interiores habitaciones? | Marco visual de habitación más cabecera, métricas, estaciones y contenido React | `living-interior-room.tsx:126–155,247–270,343–349` |
| ¿Objetos propios? | Estaciones seleccionables por ID y teclado; no se observa modelo espacial de objetos manipulables en ese contrato | `living-interior-room.tsx:22–45,99–115` |
| ¿Feedback? | Haptics, pulsos, luces, indicadores de sesión y tiers | `village-pixel-building.tsx:122–145,229–251`; `visual-village-progression.ts:165,1055` |
| ¿Habitantes? | Avatar asociado a edificio abre diálogo; consejos contextuales deterministas | `village-pixel-building.tsx:299–313`; `cozy-residents-engine.ts:287` |
| ¿Descubrimiento/progresión? | Tiers, decoraciones y hitos existentes; no se encontró progresión de exploración espacial en la escena revisada | `visual-village-progression.ts:19–106,1055` |
| ¿Interrupción de interfaz? | Modales de edificios, compañeros, misiones, captura y scrapbook; estaciones cambian paneles | `cozy-rpg-dashboard.tsx:134–151,541–1015` |
| ¿Actividad real integrada? | Cronómetros y sesión universal vinculada a dominio, edificio y recurso | `use-universal-session.ts:35–74`; `universal-session-engine.ts` |
| ¿Móvil interactivo? | Pointer events y botones de cámara; controles reales en código. Usabilidad táctil y gestos no verificados en dispositivo | `interactive-village-scene.tsx:250–257,622–670`; `use-village-camera.ts:204` |

No se califica como inexistente una capacidad solo porque no esté en un informe previo. Se reconoce la diferencia entre progresión visual ya implementada y simulación todavía no demostrada.

## Hallazgos

### U-001 · P2 · El mapa conduce a paneles en vez de sostener un ciclo de juego

- **Módulo y referencias:** `components/cozy-rpg-dashboard.tsx:134–151,541–647`; `components/sanctuary/interactive-village-scene.tsx:57,465`; `use-village-camera.ts:300–353`.
- **Evidencia C:** selección de edificio cambia `activeBuildingModal`; WASD cambia x/y de cámara; las acciones de trabajo se resuelven dentro de formularios/controles del interior.
- **Causa probable:** la estructura administrativa original sigue siendo la arquitectura de navegación y acción, con el pueblo añadido como selector.
- **Impacto:** el espacio tiene poca función en la decisión del jugador; las acciones importantes lo sacan del pueblo. No se midió cuántas interrupciones percibe un usuario real.
- **Solución:** piloto de un solo edificio con transición espacial, interacción directa con dos o tres objetos y consecuencias ambientales de actividad confirmada. Avatar opcional; tap-to-interact puede bastar si tiene continuidad y sentido espacial. Preservar acceso rápido accesible a herramientas.
- **Esfuerzo / riesgo:** grande; medio–alto por coexistencia de navegación antigua y escena.
- **Aceptación:** usuario inicia tarea desde un objeto, sale y vuelve sin perder contexto; al confirmar actividad cambia un objeto persistente del mundo; recorrido funciona sin pasar por una secuencia de dashboards genéricos.
- **Aprendizaje:** el ciclo central es acción → consecuencia → siguiente decisión. Cambiar la apariencia de un botón no cambia ese ciclo.

### U-002 · P2 · Estaciones funcionan como pestañas, no como objetos de habitación

- **Módulo y referencias:** `living-interior-room.tsx:22–45,75–123,247–270,343–349`; `atelier-building.tsx:1`; `office-building.tsx:1`.
- **Evidencia C:** cada estación tiene ID, nombre, icono, estado y descripción; activar estación cambia contenido. Es una base útil, pero el contrato no incluye posición, alcance, interacción contextual o estado propio persistente de objeto.
- **Causa probable:** reutilizar una interfaz de tabs para representar estaciones.
- **Impacto:** la habitación sirve como marco, el usuario interactúa con paneles. Añadir muebles decorativos sin conectar acciones mantendría el mismo problema.
- **Solución:** conservar IDs y acciones actuales; añadir proyección espacial de estación. Ejemplo propuesto, no implementado: bastidor abre contador mínimo y refleja avance; estantería muestra obra terminada; escritorio mantiene sesión. Reservar formularios largos a un panel auxiliar bajo demanda.
- **Esfuerzo / riesgo:** grande por edificio piloto; medio si reutiliza motor de sesiones y componentes existentes.
- **Aceptación:** objetos tienen estado inspeccionable, acciones por teclado/tacto, feedback específico y persistencia derivada de hitos confirmados; cambiar estación no reinicia sesión ni suma recompensa.
- **Aprendizaje:** separar el comando («registrar avance») de su representación permite activar el mismo comportamiento desde botón, objeto o atajo.

### U-003 · P2 · Habitantes presentan consejo, pero no presencia autónoma verificable

- **Módulo y referencias:** `village-pixel-building.tsx:299–313`; `cozy-residents-engine.ts:187–287`; `agents/autonomous-life-manager.ts:23–36,103–117`.
- **Evidencia C:** residente está asociado a un botón del edificio y genera consejos; el consejo enumera roles y declara salud constante. No se encontró navegación o rutina espacial de habitantes en la escena revisada. La automatización incompleta se detalla en S-004.
- **Causa probable:** personalidad representada mediante diálogo y panel de agentes, no mediante comportamiento del mundo.
- **Impacto:** parecen asistentes de interfaz; anunciar autonomía mayor que la conectada crea expectativas falsas.
- **Solución:** rutinas deterministas pequeñas —estar en taller, caminar a plaza, reaccionar a hito confirmado—, estado observable y explicación de por qué se mueven. IA opcional para diálogo solicitado, sin decidir saldos ni ejecutar pagos.
- **Esfuerzo / riesgo:** grande; medio. Evitar simultáneamente migrar renderer y habilitar agentes financieros.
- **Aceptación:** rutina continúa de forma coherente al volver a la escena, no ejecuta recompensas por animación y respeta usuario/pausa; consejo distingue sugerencia de acción aplicada.
- **Aprendizaje:** autonomía útil requiere un modelo de estado y reglas; generar texto distinto no equivale a simular un habitante.

### U-004 · P2 · Diálogos sin gestión completa de foco

- **Módulo y referencias:** `components/cozy/ui/cozy-modal.tsx:33–75`; `cozy-rpg-dashboard.tsx:541–560`; `living-interior-room.tsx:89–121`.
- **Evidencia C:** existen `role=dialog`, `aria-modal`, Escape y labels; en las implementaciones inspeccionadas no hay foco inicial, atrapado de Tab, restauración del foco o inercia del fondo. Habitación registra atajos globales, aunque excluye campos de edición.
- **Causa probable:** implementar cierre y aspecto del modal sin gestionar su ciclo de accesibilidad completo.
- **Impacto:** teclado/lector de pantalla puede salir al fondo o perder punto de retorno. No se ejecutó auditoría WCAG ni lector de pantalla para afirmar un resultado de conformidad.
- **Solución:** primitiva de diálogo común con foco/retorno/fondo; alcance de atajos limitado al interior activo; modo lista del pueblo para acceso equivalente.
- **Esfuerzo / riesgo:** medio; medio por modales anidados y listeners existentes.
- **Aceptación:** abrir sitúa foco, Tab queda en diálogo, Escape cierra solo capa superior, cerrar devuelve foco al edificio; todo objeto de juego tiene ruta equivalente por teclado y nombre accesible.
- **Aprendizaje:** ARIA describe intención, pero no implementa el comportamiento de foco.

### U-005 · P2 · Renderizado y carga requieren medir antes de migrar

- **Módulo y referencias:** `interactive-village-scene.tsx:247–290,428–465`; `use-village-camera.ts:204–353`; `cozy-rpg-dashboard.tsx:296–317`; imports de interiores en dashboards.
- **Evidencia C/build:** mundo DOM/SVG de 1400×900 con transform CSS; pointer move actualiza estado React de cámara; escena itera edificios y adornos; reloj del dashboard actualiza cada segundo. Build: `/cozy` First Load JS 284 kB. No se tomaron trazas React ni medidas de frame.
- **Causa probable:** interacción de alta frecuencia dentro del árbol de UI y carga amplia de herramientas.
- **Impacto:** riesgo de trabajo React innecesario y carga inicial mayor; no demuestra renders costosos de todos los hijos ni bajo FPS en cada dispositivo.
- **Solución:** perfilar primero; aislar reloj/timer, estado de cámara y escena; batch por frame donde proceda; lazy-load de interiores; reducir animación al ocultar pantalla y respetar reduced motion. Mantener reloj basado en timestamp, no en contar ticks.
- **Esfuerzo / riesgo:** medio; medio por eventos y sincronización de hooks.
- **Aceptación:** comparar mismo dispositivo/escena antes/después, registrar frame p95, memoria, JS y tareas largas; sesionar con pantalla en segundo plano no cambia duración ni duplica recompensa.
- **Aprendizaje:** React es adecuado para formularios y HUD; animación continua necesita un presupuesto por frame independiente del estado de negocio.

## Comparación arquitectónica de renderer

La recomendación es una **arquitectura híbrida por límites de responsabilidad**, con un piloto antes de elegir migración completa. React conserva auth, accesibilidad, formularios y finanzas; el mundo emite intenciones y recibe proyecciones confirmadas. El motor gráfico nunca es dueño de GP/XP.

| Opción | Complejidad y aprendizaje | Interacción y rendimiento | Móvil / mantenimiento | Costo y migración |
|---|---|---|---|---|
| A. Mejorar DOM/SVG actual | Menor cambio; conocimientos ya presentes | Suficiente para mapa y pocos objetos; requiere implementar rutinas/hit testing avanzados según diseño y medir trabajo React | DOM facilita accesibilidad; Pointer Events ya presentes; probar táctil | Menor costo inicial y riesgo; costo creciente si se construye un motor completo a mano |
| B. PixiJS | Aprender scene graph, ticker, assets y puente React | Renderer GPU y loop explícito; la lógica de juego/rutinas debe diseñarse | Canvas requiere alternativa accesible; lifecycle y GPU deben probarse | Costo medio de piloto; migrar sprites/escenas sin tocar servicios; no sustituye diseño de juego |
| C. Phaser | Más conceptos y modelo de escenas; herramientas de juego integradas | Escenas, cámaras, input, animación y lifecycle apropiados para avatar y habitantes | Soporte de puntero y escalado; probar memoria, batería y suspensión Safari; DOM overlay para formularios | Mayor migración inicial; menos infraestructura de juego propia si el objetivo es simulación amplia |
| D. Híbrida React + mundo aislado | Contrato de eventos y una proyección clara | Evita que frames gobiernen negocio; puede usar A al comienzo y B/C después | Conserva componentes accesibles y herramientas; responsabilidad de sincronizar montaje/desmontaje | Reutiliza mayor parte del proyecto; riesgo medio en puente y dos sistemas de estado si se diseña mal |

PixiJS documenta su loop de ticker, actualización de scene graph y render GPU; no proporciona por sí solo el ciclo de productividad ni la semántica económica. [Documentación oficial](https://pixijs.com/8.x/guides/concepts/render-loop).

Phaser documenta escenas con input, tweens, cámaras y objetos propios y lifecycle de pausa/reanudación; esto reduce infraestructura necesaria para un mundo con rutinas. [Escenas](https://docs.phaser.io/phaser/concepts/scenes) e [input](https://docs.phaser.io/phaser/concepts/input). Estas capacidades no garantizan mejor rendimiento sin medir la escena real.

Si el objetivo inmediato es interacción con muebles y transiciones, empezar por A dentro de D conserva todo lo existente. Si el piloto exige avatar, rutas, múltiples habitantes y animaciones coordinadas, **Phaser dentro de D** es el candidato más alineado. Si se busca principalmente renderizar muchos sprites con lógica propia ya separada, evaluar **PixiJS dentro de D**. No hay evidencia para imponer hoy una reescritura total.

No se cotizaron licencias, servicios o assets ni se contrataron recursos. El costo principal estimado aquí es desarrollo, arte, pruebas y mantenimiento; verificar condiciones de cualquier paquete/asset al adoptarlo.

## Piloto propuesto

Atelier es buen candidato porque ya hay recurso, contador, cronómetro, sesión recuperable e hitos. Diseñar un recorrido pequeño: plaza → puerta → bastidor → iniciar sesión → registrar avance → finalizar → objeto terminado visible → volver. Reutilizar motor universal, eventos de hitos y servicios; no crear recompensas nuevas.

Preservar un acceso directo rápido para registrar cuando el usuario esté en la calle. La experiencia de juego debe ofrecer sentido y disfrute, no imponer una caminata para cada gasto. Medir comprensión, tiempo hasta primera acción y continuidad de contexto con usuarios reales antes de extender a los demás edificios.
