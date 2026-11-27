# Manual Personal de OakHaven (Release 4.0)

Bienvenido a tu **Personal Life Operating System** privado (`https://rpg-life-engine-production.up.railway.app`).  
Este manual documenta **únicamente funcionalidades reales y verificadas**, indicando claramente qué está activo en producción y qué permanece pendiente de autorización.

---

## 1. Cómo organizar tu día y utilizar Rowan (Disponible hoy)
1. Inicia sesión en `/login` con tu cuenta propietaria autorizada (`@gmail.com`). El registro público está cerrado (*fail-closed*).
2. En `/cozy`, arriba del tablero Bento verás la **Tarjeta de Decisión Diaria · Rowan** (100 % determinista, 0 costo IA):
   - Elige tu **Energía disponible hoy** (`Baja`, `Media`, `Alta`).
   - Rowan recalcula al instante tu **capacidad en minutos**, **ritmo sugerido** (`15/10`, `25/5` o `45/10` min), **descanso protegido** y tus **3 prioridades explicables**.
   - Si tu carga supera tu capacidad, aparece una alerta de **sobreplanificación** con propuesta de reprogramación (nunca modifica tu agenda automáticamente).
   - Pulsa **Abrir edificio** en cualquier prioridad para ir directo a ese módulo.

## 2. Cómo registrar hábitos y sesiones (Disponible hoy)
- **Captura rápida:** usa el botón de captura rápida en el encabezado de `/cozy` o el buscador global **`Ctrl+K` → Captura Rápida Omni**.
- **Desde cada edificio:** entra al edificio (Atelier, Biblioteca, Oficina, Gimnasio, Taller) e inicia o registra tu sesión.
- **Seguridad de recompensas:** toda escritura en `activity_logs` pasa por el servidor autorizado (`service_role`, Migración #5 verificada) con idempotencia y protección anti-duplicados; tu billetera GP y XP se calculan desde la fuente canónica única `player_treasury`.

## 3. Cómo gestionar proyectos y crear patrones Filet Crochet (Disponible hoy)
1. Abre **El Atelier de Crochet & Tejido (Clara)** desde `/cozy` o con `Ctrl+K`.
2. Dentro de **Filet Crochet Studio**:
   - **Digitalizador Histórico (PDF/Img):**
     - **Paso 1:** Sube una foto o PDF (hasta `5 MB` y `160×160` cuadros).
     - **Paso 2:** Pulsa **Ajustar** y arrastra para encuadrar el dibujo.
     - **Paso 3:** Elige 1 estilo (*Gráfico blanco y negro*, *Revista antigua con cruces `X`* para láminas tipo *Priscilla / DMC / Antique Pattern Library*, o *Foto de tejido real*) y pulsa **Detectar cuadrícula automáticamente**.
     - Pulsa **`Usar directo como Patrón (Ir al Compositor ➜)`** (no necesitas inventar letras de alfabeto).
   - **Compositor Visual:** ajusta tu patrón, consulta las cadenetas iniciales y las instrucciones vuelta por vuelta (`Der→Izq` / `Izq→Der`).
   - **Mesa de Tejido Guiada:** sigue vuelta por vuelta con progreso atómico guardado en servidor sin duplicar conteos.
   - **Exportaciones:** descarga PDF técnico, PNG, SVG o JSON reutilizable.
   - **Clara:** pregúntale desde conceptos básicos de principiante hasta gráficos antiguos con `X`, `Lacet/Bar` o conversión de hilos `#10–#80`.

## 4. Cómo utilizar OakHaven Ink, Wrist/Atajos de iOS y Portabilidad (PR #9 — Integrado en `/cozy`)
Pulsa el botón **`✍️ Ink (S Pen) · ⌚ Wrist & Atajos · 📦 Portabilidad`** en `/cozy`:
- **OakHaven Ink:** crea páginas, cambia plantillas de papel (`Puntos`, `Cuadrícula`, `Rayado`, `Blanco`), usa Lápiz/Borrador/Seleccionar, Deshacer/Rehacer, exporta a SVG y vincula tu cuaderno a un proyecto. *Guardado automático offline en almacenamiento local (`safeLocalStorage`). Pendiente: sincronización remota entre dispositivos y prueba física en Galaxy Tab real con S Pen.*
- **Atajos de iOS y Apple Watch:** consulta [docs/IOS_SHORTCUTS_GUIDE.md](file:///C:/Users/isaca_6khxtdy/.gemini/antigravity/scratch/rpg-life-engine/docs/IOS_SHORTCUTS_GUIDE.md) para configurar Atajos HTTP en iPhone/Watch. *Pendiente de autorización: emisión de tokens personales revocables en producción. Una app nativa watchOS es fase futura.*
- **Portabilidad JSON:** selecciona qué módulos exportar (proyectos de tejido, libros, notas — excluyendo automáticamente secretos, tokens y dinero real COP) y descarga tu respaldo JSON. También puedes simular una importación para ver detección de duplicados antes de confirmar.

## 5. Cómo utilizar AI Command Center, Automatizaciones y `Ctrl+K` (PR #10 — Integrado en `/cozy`)
- Pulsa **`Ctrl+K`** (o el botón **`🔍 Buscar (Ctrl+K)`**) para saltar al instante entre edificios, especialistas y herramientas.
- Pulsa **`🤖 AI Command Center & Automatizaciones`** en `/cozy`:
  - **AI Command Center:** escribe una solicitud; el motor determinista la enruta al especialista correcto (Clara, Silas, Rowan, Lyra, Aura, Eldrin, Bruno, Milo o Nora), respeta el presupuesto diario de tokens y solicita tu **Aprobación / Rechazo** antes de cualquier acción sensible.
  - **Automation Core (10 reglas):** pulsa **`Simular (Dry-Run)`** para previsualizar qué propondrían las 10 reglas (resumen diario, tareas vencidas, proyectos abandonados, descanso, calendario, alertas presupuestarias COP, aprendizaje, tejido, resumen semanal y metas) sin ejecutar cambios externos. Usa **`Interruptor emergencia`** para pausar todo al instante. *Nota: todas las automatizaciones operan en modo simulación/propuesta; no hay ejecución autónoma externa activa.*

## 6. Cómo gestionar Finanzas Personales en COP (PR #8 — Pendiente de autorización final)
- **Estado actual:** implementada y probada (`411/411` pruebas, ruta `/finance` y ledger SQL aislado en `bigint` COP sin mezclar GP), pendiente de tu autorización en **CHECKPOINT E** para aplicar `supabase/owner_finance_ledger.sql` en producción y fusionar PR #8.
