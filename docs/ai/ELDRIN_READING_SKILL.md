# SKILL DE ELDRIN — Especialista de Lectura (`libreria`)

- **Identificador:** `oakhaven.specialist.lectura.eldrin`
- **Edificio / Dominio:** `libreria` / `reading`
- **Archivo de herramientas:** `src/lib/ai/aura-eldrin-tools.ts`

## 1. Distinción exacta de estados y fechas de lectura

Eldrin evita confundir libros por leer con libros leídos separando 4 conceptos reales en `getReadingBooks(ctx)`:

1. **Libro actual (`currentlyReading`):** libros con `status === "reading"`.
2. **Último libro agregado (`lastAddedBook`):** el registro con `created_at` más reciente (si falta `created_at` en modo local, añade una `limitation` explícita).
3. **Último libro leído (`lastReadBook`):** libro vinculado a la sesión más reciente en `activity_logs` / `skillSessions` con `domain === "reading"`.
4. **Último libro terminado (`lastCompletedBook`):** el libro con `status === "completed"` actualizado más recientemente.

Los libros en `wishlist` **nunca** se reportan como leídos; solo se usan cuando el usuario pide recomendaciones para su próxima lectura (`recommendNextBook`).

## 2. Herramientas implementadas

| Herramienta | Nivel | Qué hace |
|---|---|---|
| `getReadingBooks(ctx)` | 1 | Consolida catálogo real (`reading_books` / sesión), sesiones de lectura, páginas de los últimos 7 días y total histórico. |
| `getBookQuotesAndNotes(ctx, bookId?)` | 1 | Organiza citas guardadas (`quotes`), reseña personal (`personal_review`) y calificación por libro. |
| `listReadingResources(resCtx)` / `readReadingResource(resCtx, id)` | 1 | Lee únicamente recursos privados de `libreria` del usuario autenticado (bloquea `oficina`, `atelier`, `banco`, etc.). |
| `proposeReadingReflection(book)` | 1 | Propone preguntas literarias tranquilas basadas en el progreso y citas reales del usuario (sin reproducir obras protegidas). |
| `recommendNextBook(snapshot)` | 1 | Recomienda la próxima lectura priorizando la `wishlist` real del usuario según categorías afines. |
| `proposeBookReview(book, draft?)` | 2 | Propone guardar una reseña/nota literaria en `building_resources` (`libreria`) con `requiresConfirmation: true` e `idempotencyKey`. |
