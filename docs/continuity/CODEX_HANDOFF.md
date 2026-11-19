# CODEX HANDOFF — Auditoría Total OakHaven (Fase 0)

- **Estado**: Fase 2.1 **IMPLEMENTADA** — Piloto `BLD-008 CROCHET` (Atelier Híbrido, Alternativa B) implementado y verificado con pruebas (`285/285` tests en verde). Sin commits ni despliegues automáticos hasta autorización del usuario.
- **Cambios realizados**:
  - `src/components/sanctuary/atelier-building.tsx`: Escena híbrida ilustrada con 5 objetos interactivos, cronómetro obligatorio para habilitar el contador táctil grande (`-1`, `+1 Vuelta`, `+5`, `Deshacer`), visor de patrón acoplado junto al contador con subida directa de imágenes + lightbox, 4 estados de proyecto (`En curso`, `Pausado sin culpa`, `Terminado`, `Archivado`), Vitrina/Historial ahora accesible y Clara sin duplicación.
  - `src/lib/sanctuary/atelier-patterns-store.ts`: Persistencia aislada por usuario de patrones, pasos vuelta a vuelta e imágenes.
  - `src/app/api/shortcuts/skill-session/route.ts`, `src/lib/demo-store.ts`, `src/types/rpg.ts`: Corrección del bug `knitting_name`/`title` en `add_knitting_project` y soporte para `update_knitting_project_status` con los 4 estados.
  - `tests/atelier-hybrid-crochet.test.ts` y `package.json`: Nuevas pruebas unitarias para el Atelier.
- **Próxima revisión recomendada**:
  - Confirmar si el usuario desea probar/ajustar el Atelier o pasar al diseño detallado del siguiente edificio de los 8 confirmados.
