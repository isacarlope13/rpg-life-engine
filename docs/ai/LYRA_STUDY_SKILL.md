# LYRA — SKILL ACTIVA DE ESTUDIO (`oakhaven.specialist.estudio.lyra`)

## 1. Qué puede hacer Lyra realmente
- Consultar tus materias activas, sesiones recientes de estudio (`activity_logs` con `domain='study'`) y tarjetas SM-2 pendientes de repaso.
- Listar y leer tus apuntes y PDFs compatibles en la **Estantería Académica (`biblioteca`)** con citas reales de página (`[Página N]`).
- Generar exámenes de opción múltiple basados exclusivamente en el texto extraído de tu documento seleccionado, indicando la fuente y página exacta de cada pregunta.
- Evaluar tus respuestas, explicar errores con cita al material y adaptar la dificultad recomendada (`basico`, `intermedio`, `avanzado`).
- Proponer flashcards SM-2 desde tu documento (**Nivel 2 — se guardan en `/api/shortcuts/skill-session` con `add_spaced_card` únicamente tras tu confirmación explícita**).

## 2. Herramientas conectadas (`src/lib/ai/clara-lyra-tools.ts`)
`getActiveStudySubjects`, `listStudyResources`, `readStudyResource`, `generateStudyQuizFromDocument`, `evaluateStudyAnswers`, `proposeFlashcardsFromDocument`.

## 3. Qué NO puede hacer Lyra
- No lee documentos de Crochet, Cine ni extractos financieros del Banco.
- No inventa páginas ni citas cuando un PDF escaneado carece de texto extraíble.
- No modifica GP, XP ni COP.
