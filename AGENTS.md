# OakHaven — Codex Development Governor

## Inicio de cada ciclo

1. Consultar uso oficial de Codex con `get_usage_limits` si está disponible. Preferir `rateLimitsByLimitId`; restante = 100 menos `usedPercent`. Valores ausentes significan desconocido, no cero uso. Comprobar ventana de 300 minutos y semanal de 10080 minutos y sus restablecimientos en America/Bogota. No guardar identificadores de cuenta.
2. Si no hay mecanismo oficial o faltan datos, informar y solicitar al usuario comprobar Settings → Usage o `/status`. No iniciar trabajo importante dependiente del margen desconocido.
3. Leer este archivo y `docs/continuity/CODEX_HANDOFF.md`; revisar `git status`, diferencias y pruebas afectadas. No repetir auditorías completas sin cambios que lo justifiquen.
4. Elegir una unidad pequeña, verificable y de alcance explícito; estimar que puede cerrarse con margen. Elegir modelo/esfuerzo proporcional cuando haya controles disponibles; no afirmar haberlos cambiado sin confirmación. Usar esfuerzo bajo para tareas triviales, mayor solo si lo exige el riesgo. No delegar sin justificación y autorización aplicable.

## Umbrales: porcentaje restante de cada ventana

Aplicar la condición más restrictiva de ambas cuotas:

- Ambas por encima del 25 %: tareas acotadas permitidas.
- Alguna entre más del 10 % y el 25 % inclusive: no iniciar tareas grandes; cerrar trabajo y preparar continuidad.
- Alguna en el 10 % o menos: no iniciar nuevos trabajos; detenerse en un punto seguro y dejar el handoff de la operación en curso.

Consultar antes de tareas importantes y al cerrar un ciclo, y nuevamente si cambia materialmente el alcance. El dato puede retrasarse y no permite predecir con exactitud el costo de una tarea. Esta política no es un corte automático verificable ni garantiza reservar exactamente el 10 %. No comprar créditos, consumir resets, eludir límites ni reiniciar trabajo automáticamente.

## Desarrollo

Priorizar correcciones críticas, experiencia de juego, refactorizaciones necesarias, regresiones y documentación mínima. Conservar reglas económicas y datos salvo instrucción explícita. Usar búsquedas dirigidas y diferencias; evitar reescrituras, duplicación y dependencias innecesarias. Atribuir cambios concurrentes correctamente; no revertir trabajo ajeno.

No operar finanzas reales, borrar datos, exponer secretos, desplegar ni modificar producción. No crear commits sin autorización expresa. No programar recordatorios o reanudaciones sin autorización; nunca afirmar que existe una alarma sin confirmación del sistema.

## Cierre y continuidad

Actualizar `docs/continuity/CODEX_HANDOFF.md` antes de detenerse: rama/commit, objetivo, terminado/pendiente, archivos, pruebas y resultados, problemas, riesgos, siguiente unidad y comando o instrucción de reanudación. Distinguir pruebas actuales de resultados históricos. No guardar tokens, contraseñas, datos personales ni identificadores de cuenta.

Terminar operación en curso si es seguro; ejecutar comprobaciones pertinentes con margen. Informar Git, trabajo realizado/verificado/pendiente, cuota oficial si está disponible, siguiente paso y momento recomendado para reanudar. No hacer pruebas repetitivas por cambios exclusivamente documentales. Si una cuota requiere pausa, avisar y ofrecer programación solo con autorización.
