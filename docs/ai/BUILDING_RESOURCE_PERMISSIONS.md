# BUILDING RESOURCE PERMISSIONS — MATRIZ ESTRICTA POR EDIFICIO

Definida como fuente única de verdad en `src/lib/ai/building-resources-engine.ts` (`BUILDING_LIBRARY_CONFIG`) y validada tanto en el frontend como en el backend (`POST /api/resources`).

| Edificio | Biblioteca temática | Tipos permitidos (`resource_type`) | Protección financiera | Quién puede leer texto extraído |
|---|---|---|---|---|
| **Banco (`banco_oakhaven`)** | Archivo Financiero | `receipt`, `bank_statement`, `budget`, `financial_document` | **SÍ (`is_sensitive_financial: true`)** | **Nadie automáticamente** (excluido del contexto de IA) |
| **Estudio (`biblioteca`)** | Estantería Académica | `study_notes`, `lecture_pdf`, `assignment`, `course_resource`, `flashcards_source` | No | Lyra (`biblioteca`) y Rowan |
| **Trabajo (`oficina`)** | Archivo de Proyectos | `project_document`, `technical_spec`, `source_file`, `task_attachment`, `deliverable` | No | Aura (`oficina`) y Rowan |
| **Gym (`gimnasio`)** | Pizarra de Rutinas | `workout_plan`, `exercise_reference`, `progress_photo`, `training_note` | No | Bruno (`gimnasio`) y Rowan |
| **Cubos (`club_puzzles`)** | Cuaderno de Algoritmos | `algorithm_sheet`, `scramble_reference`, `cube_manual`, `training_note` | No | Milo (`club_puzzles`) y Rowan |
| **Lectura (`libreria`)** | Estantería Literaria | `book_cover`, `reading_note`, `quotation`, `reading_reference` | No | Eldrin (`libreria`) y Rowan |
| **Cine (`cine`)** | Cartelera Personal | `poster`, `review`, `watchlist_import`, `media_reference` | No | Nora (`cine`) y Rowan |
| **Crochet (`atelier`)** | Carpeta de Patrones | `crochet_pattern`, `stitch_diagram`, `progress_photo`, `yarn_reference`, `material_list` | No | Clara (`atelier`) y Rowan |

## Seguridad multicapa
1. **Verificación de Magic Bytes (`sniffFileMagicBytes`):** rechaza ejecutables (MZ/ELF), archivos con bytes nulos o archivos disfrazados (ej. `.exe` renombrado a `.png`).
2. **Coherencia Extensión ↔ MIME ↔ Contenido:** rechaza cualquier discrepancia.
3. **Anti Path Traversal (`sanitizeSafeFilename`):** bloquea `../`, rutas absolutas y caracteres peligrosos; genera rutas internas `${ownerId}/${buildingId}/${resourceId}_${safeName}`.
4. **Anti Prompt Injection en Documentos (`extractAndSanitizeDocumentText`):** trata todo texto como dato no confiable y elimina instrucciones maliciosas antes de exponerlo a una Skill autorizada.
