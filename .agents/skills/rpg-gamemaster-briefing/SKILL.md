---
name: rpg-gamemaster-briefing
description: Skill especializada para generar la Crónica Táctica del Game Master en exactamente 3 oraciones accionables basadas en las métricas reales del jugador.
---

# Skill 3: Crónica Táctica del Game Master (`rpg-gamemaster-briefing`)

## 1. Propósito y Endpoint
Se activa al cargar o refrescar el tablero táctico principal:
- `GET /api/engine-state` (`generateGameMasterBriefing`)
- Función asociada: `generateGameMasterBriefing` en `src/lib/gemini.ts` / `src/lib/ai-skills-prompts.ts`.

## 2. Reglas Anti-Alucinación
1. Prohibido inventar saldos, tasas o tiempos de resolución de cubos que no estén en `stateSnapshot`.
2. Estructura fija de 3 oraciones:
   - **Oración 1:** Racha activa, Escudos Aegis y récord actual en el Santuario de Habilidades (`rubik_pb` / `rubik_ao5`).
   - **Oración 2:** Estado de la Bóveda GP y multas `1.2x` acumuladas en el mes.
   - **Oración 3:** Recomendación táctica sobre cuál Debt Boss atacar primero y cuánto interés ahorra con Avalancha vs Bola de Nieve.
