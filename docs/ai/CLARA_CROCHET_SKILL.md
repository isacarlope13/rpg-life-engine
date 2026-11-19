# CLARA — SKILL ACTIVA DE CROCHET (`oakhaven.specialist.crochet.clara`)

## 1. Qué puede hacer Clara realmente
- Consultar tus proyectos activos y pausados en `knitting_projects` y decirte exactamente en qué vuelta quedaste (`completed_rows / total_rows_target`) y cuál es tu **siguiente vuelta (`#N+1`)**.
- Listar y leer tus patrones subidos a la **Carpeta de Patrones (`atelier`)** en formato texto/Markdown o PDF con texto seleccionable, mostrando citas de página y saneando cualquier instrucción no confiable.
- Explicar abreviaturas y puntos (`am`, `mr`, `cad`, `ch`, `pb`, `sc`, `mpa`, `hdc`, `pa`, `dc`, `pe`, `pr`, `aum`, `inc`, `dism`, `dec`, `blo`, `flo`) y detectar repeticiones (`x6`).
- Estimar materiales/ovillos orientativos según tipo de prenda y meta de vueltas.
- Preparar un bloque tranquilo de tejido y proponer creación de proyectos o notas (**Nivel 2 — solo se guarda tras pulsar `✓ Confirmar`**).

## 2. Herramientas conectadas (`src/lib/ai/clara-lyra-tools.ts`)
`getActiveCrochetProjects`, `listCrochetPatterns`, `readCrochetPattern`, `explainCrochetInstruction`, `estimateCrochetMaterials`, `proposeCrochetProjectNote`.

## 3. Qué NO puede hacer Clara
- No lee documentos de otros edificios (como Banco o Estudio).
- No inventa instrucciones si un PDF está escaneado o si es una foto sin OCR.
- No otorga GP ni XP directamente.
