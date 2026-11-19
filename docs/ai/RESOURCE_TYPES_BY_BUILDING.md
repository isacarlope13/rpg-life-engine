# RESOURCE TYPES BY BUILDING — CONTRATO DE RECURSOS

Definido y validado en `src/lib/ai/building-skills-registry.ts` (`RESOURCE_CONTRACT_BY_BUILDING` y `validateBuildingResourceUpload`).

| Edificio | Categorías permitidas | Tipos MIME permitidos | Límite |
|---|---|---|---|
| **Crochet (`atelier`)** | `pattern`, `diagram`, `note`, `image`, `pdf` | `image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `text/plain`, `text/markdown` | 5 MB |
| **Estudio (`biblioteca`)** | `study_guide`, `academic_material`, `note`, `pdf`, `image` | `application/pdf`, `text/plain`, `text/markdown`, `image/png`, `image/jpeg`, `image/webp` | 10 MB |
| **Trabajo (`oficina`)** | `project_spec`, `code_snippet`, `deliverable`, `note`, `pdf` | `application/pdf`, `text/plain`, `text/markdown`, `application/json`, `image/png`, `image/jpeg` | 10 MB |
| **Cine (`cine`)** | `poster`, `review`, `watchlist_export`, `cultural_link`, `note` | `image/png`, `image/jpeg`, `image/webp`, `text/plain`, `text/markdown`, `application/json` | 5 MB |
| **Banco (`banco_oakhaven`)** | `bank_statement`, `receipt`, `budget_sheet` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `text/csv` | 8 MB |
| **Gym (`gimnasio`)** | `workout_plan`, `note`, `image`, `pdf` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `text/plain`, `text/markdown` | 5 MB |
| **Cubos (`club_puzzles`)** | `algorithm_sheet`, `note`, `image`, `pdf` | `application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `text/plain`, `text/markdown` | 5 MB |
| **Lectura (`libreria`)** | `book_quote`, `reading_note`, `note`, `image`, `pdf` | `image/png`, `image/jpeg`, `image/webp`, `text/plain`, `text/markdown`, `application/pdf` | 5 MB |

## Reglas de validación
- Cada carga valida: propietario (`ownerId === authenticatedUserId`), categoría permitida para ese edificio específico (ej. rechaza `pattern` en `banco_oakhaven`), tipo MIME real (rechaza ejecutables/HTML/JS) y tamaño máximo.
- No se han creado buckets nuevos en Supabase Storage sin autorización.
