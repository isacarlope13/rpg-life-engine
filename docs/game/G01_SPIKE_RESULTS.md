# G01 — prototipo de mundo en Next

Fecha: 11 de noviembre de 2026, America/Bogota. Estado: implementación funcional local; validación de hardware móvil y perfil prolongado pendientes. Sin despliegue ni commit. Continúa desde G00 y no modifica su lógica.

## Decisión de dependencia

Se verificaron npm y publicaciones oficiales antes de instalar: **Phaser 4.2.1**, licencia MIT, versión exacta fijada. La propuesta inicial citaba un template de Phaser 3; la versión publicada vigente permite partir de la rama actual sin migrar una integración anterior. Instalación autorizada con `--ignore-scripts`; añade Phaser y eventemitter3, sin wrappers ni framework de estado adicional. npm sincronizó también versión/engines del root del lockfile con package.json. No se actualizaron otras dependencias deliberadamente.

Fuentes: [release oficial 4.2.1](https://github.com/phaserjs/phaser/releases/tag/v4.2.1), [instalación y tipos](https://docs.phaser.io/phaser/getting-started/installation), [física](https://docs.phaser.io/phaser/concepts/physics). La licencia del código original generado aquí no deriva de assets de otro juego. El instalador reportó los mismos dos avisos de dependencias ya presentes en auditoría; no se ejecutó `audit fix --force`.

## Implementación y límites

- `/play` es un paseo de prueba público, rotulado y sin lectura/escritura de perfil, sesiones, finanzas o recompensas. No sustituye login, onboarding, dashboard o Cozy.
- Shell React con import dinámico del renderer dentro del efecto cliente. No importa Phaser en ejecución de servidor. Un host se monta y destruye con cleanup explícito; cancelar import pendiente no crea un juego separado del DOM.
- Una instancia de Phaser con Arcade Physics. Una escena de prototipo reconstruye dos layouts: plaza y Atelier. No pretende ser aún el sistema definitivo de múltiples escenas de G02/G08.
- Personaje original con frames procedurales de cuatro orientaciones; sombras, árboles, casa, fuente y muebles dibujados con geometría propia. Sin descargas de arte, audio, IA ni CDN en runtime.
- Teclas WASD/flechas; interacción E/Enter; pausa Escape; ruta por toque/clic y botón a puerta. Recorrido de cuadrícula rodea sólidos; cuerpo Arcade colisiona con ellos. Entrada/salida cambian layout y el regreso aparece junto al Atelier.
- Controles DOM para direcciones, acercamiento y puerta; foco visible, recuperación del punto de llegada, cierre y reapertura. El detalle de controles es desplegable. El audio está deshabilitado.
- No persiste posición/apariencia: cerrar/reabrir reinicia solo este paseo, no una partida. Todavía no hay creador, NPC, proyecto ni bastidor conectado a sesiones.

Archivos principales: `src/app/play/page.tsx`, `src/components/game/game-playground.tsx` y CSS module, `src/game/client/boot.ts`, `spike-model.ts`, `spike-lifecycle.ts`, `tests/game-playground.test.ts`.

## Evidencia local

| Comprobación | Resultado |
|---|---|
| Ocho regresiones nuevas | Rutas seguras muestreadas entre waypoints, obstáculos/límites, velocidad diagonal, puerta cercana, import cancelado, montaje/cleanup y errores de import: aprobadas |
| Conjunto seguro de tests | 199 aprobadas, 0 fallos; excluye el archivo de integridad que escribe y elimina en `.data` |
| TypeScript | Aprobado tras corregir inferencia genérica de Promise en un test; no se ocultó con `any` |
| Chrome de escritorio | Plaza visible, trayecto alrededor de fuente, entrar al Atelier, pausar/reanudar y regresar verificados en interfaz |
| Cleanup observable | Cerrar: 0 canvas; reabrir: 1 canvas y estado ready. También comprobado en Strict Mode de desarrollo |
| Vista estrecha | Override de ventana 390×844; contenido CSS de 375 px por barra de scroll, mismo ancho de página y viewport, sin desbordamiento horizontal; override restaurado |
| Artefactos | [Escritorio](artifacts/g01-desktop.png), [ventana móvil](artifacts/g01-mobile.png) |

No se presenta la ventana estrecha como emulación completa de un iPhone ni prueba de Safari/táctil físico. No se midieron FPS p95, memoria ni traza reproducible de cinco minutos. La ausencia de canvas duplicados no acredita ausencia total de fugas. El viewport global heredado aún limita zoom; no se modificó en este spike y no se declara conformidad WCAG integral.

El host ejecuta Node 26.12.1; el proyecto declara 22.x. npm avisó esa diferencia. La ejecución en Node 22 no se acredita con estos resultados.

## Build y costo de carga

Build local aprobado: 29 páginas; `/play` reporta 4,06 kB de ruta y 111 kB First Load JS. Esa cifra **no incluye** el runtime diferido de Phaser: su chunk emitido mide 1.369.519 bytes sin comprimir y 355.210 bytes al comprimir localmente con gzip. La transferencia real depende del servidor/cache; no se midió red móvil. El runtime se importa después de entrar a `/play`, no desde layout o rutas anteriores. El tamaño descomprimido del paquete npm no es el payload del navegador.

## Siguiente decisión

**Continuar con G02** para contratos de proyección y puente de servicios, manteniendo G03/G04/G05 como puertas antes de conectar datos reales. No conectar este sprite directamente a `demo-store`, Supabase admin o endpoints económicos. Antes de dar por cerrada la aceptación móvil/rendimiento de G01, ejecutar la matriz pendiente en dispositivo acordado y registrar medidas.

Para probar localmente: `npm run dev -- --hostname 127.0.0.1 --port 3010` y abrir [el paseo](http://127.0.0.1:3010/play). No ejecutar dev y build a la vez sobre la misma `.next`.
