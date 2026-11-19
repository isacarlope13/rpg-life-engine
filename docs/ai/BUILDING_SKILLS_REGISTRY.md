# BUILDING SKILLS REGISTRY — LOS 8 ESPECIALISTAS + ROWAN

Registro central implementado en `src/lib/ai/building-skills-registry.ts` (`ALL_RUNTIME_SKILLS`).

| Skill ID | Edificio | Especialista | Rol | Herramientas permitidas (Fase 1) | Autonomía |
|---|---|---|---|---|---|
| `oakhaven.mayor.rowan` | `ayuntamiento` | **Rowan** | Presidente y Orquestador Central | Todas las 9 herramientas de solo lectura | Nivel 1 |
| `oakhaven.specialist.banco.silas` | `banco_oakhaven` | **Silas** | Especialista en Finanzas Personales | `getRecentExpenses`, `getVillageSummary` | Nivel 1 |
| `oakhaven.specialist.estudio.lyra` | `biblioteca` | **Lyra** | Tutora Académica | `getStudyProgress`, `getVillageSummary` | Nivel 1 |
| `oakhaven.specialist.trabajo.aura` | `oficina` | **Aura** | Proyectos y Programación | `getPendingWorkProjects`, `getVillageSummary` | Nivel 1 |
| `oakhaven.specialist.gym.bruno` | `gimnasio` | **Bruno** | Entrenador de Vitalidad | `getLastWorkout`, `getVillageSummary` | Nivel 1 |
| `oakhaven.specialist.cubos.milo` | `club_puzzles` | **Milo** | Entrenador WCA | `getRecentCubeSolves`, `getVillageSummary` | Nivel 1 |
| `oakhaven.specialist.lectura.eldrin` | `libreria` | **Eldrin** | Especialista Literario | `getLastReadBook`, `getVillageSummary` | Nivel 1 |
| `oakhaven.specialist.cine.nora` | `cine` | **Nora** *(nueva)* | Curadora Cultural de Cine y Musicales | `getLastWatchedMedia`, `getVillageSummary` | Nivel 1 |
| `oakhaven.specialist.crochet.clara` | `atelier` | **Clara** | Maestra de Tejido | `getLastKnittingActivity`, `getVillageSummary` | Nivel 1 |

> Todos los especialistas comparten `canExecutePaymentsOrMutateCop: false` y `canMutateGpOrXpDirectly: false` como invariantes de tipo en TypeScript. En Fase 1 solo se expone la interfaz conversacional del Presidente Rowan; las interfaces de los 8 especialistas corresponden a Fase 2.
