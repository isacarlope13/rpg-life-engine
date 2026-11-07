---
name: rpg-book-catalog-extractor
description: Skill especializada para extraer fichas bibliográficas de libros (ISBN-13, portada OpenLibrary, densidad cognitiva, sinopsis de galería, biografía del autor, frase célebre, takeaways prácticos y precio estimado en COP).
---

# Skill 5: Bibliotecario IA & Curador de Galería de Libros (`rpg-book-catalog-extractor`)

## 1. Propósito y Endpoint
Se activa al buscar o registrar un libro para la Galería Visual de Libros (`#register-book-section`):
- `POST /api/shortcuts/skill-session` (`action: "extract_book_specs"`)
- Función asociada: `extractBookSpecsWithGemini` y `sanitizeBookSpecs` en `src/lib/gemini.ts` / `src/lib/ai-skills-prompts.ts`.

## 2. Reglas Anti-Error Bibliográficas
1. **Respeto a páginas explícitas:** Si el usuario escribe `"Clean Code 464 páginas"`, `total_pages` debe ser exactamente `464`.
2. **ISBN-13 y Portada Automática:** Devuelve un ISBN-13 limpio compatible con `https://covers.openlibrary.org/b/isbn/{ISBN}-L.jpg` en `cover_url`.
3. **Calibración por Densidad Cognitiva (`complexity`):**
   - `denso_tecnico`: Ingeniería, arquitectura de software, ciencias exactas -> Meta `15 págs/día`, `140 GP/pág`, Bono `+6.500 GP`.
   - `intermedio`: Finanzas, psicología, productividad, ensayos -> Meta `20 págs/día`, `115 GP/pág`, Bono `+5.500 GP`.
   - `ligero`: Narrativa, biografías cortas, hábitos ligeros -> Meta `25 págs/día`, `100 GP/pág`, Bono `+5.000 GP`.

## 3. Información Adicional Enriquecida con IA (Galería, Frases y Compra)
Además de la ficha técnica, la Skill devuelve siempre:
- `synopsis`: Sinopsis literaria lista para mostrar en la tarjeta de la Galería de Libros.
- `author_bio_short`: Contexto del autor y relevancia de la obra.
- `famous_quote`: Una frase célebre representativa del libro (que el usuario puede agregar en 1 clic a su colección de frases).
- `practical_takeaways`: 3 aprendizajes o ejercicios accionables del libro.
- `estimated_market_price_cop`: Precio estimado en librerías de Colombia (`Panamericana / Buscalibre`) para autocompletar el costo de compra.
- `recommended_store`: Librería o fuente sugerida.
