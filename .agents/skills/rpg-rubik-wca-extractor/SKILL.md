---
name: rpg-rubik-wca-extractor
description: Skill especializada para extraer fichas técnicas de cubos de Rubik (3x3, 2x2, 4x4, Pyraminx, Megaminx), validar reglamento WCA, estimar precio comercial en COP y generar guía de sensación de giro, corte de esquinas y mantenimiento con IA.
---

# Skill 4: Extractor Técnico WCA & Asesor de Hardware de Cubos (`rpg-rubik-wca-extractor`)

## 1. Propósito y Endpoint
Se activa cuando el usuario consulta o registra un nuevo cubo en el Santuario de Habilidades (`#register-cube-section`):
- `POST /api/shortcuts/skill-session` (`action: "extract_cube_specs"`)
- Función asociada: `extractCubeSpecsWithGemini` y `sanitizeCubeSpecs` en `src/lib/gemini.ts` / `src/lib/ai-skills-prompts.ts`.

## 2. Reglas Anti-Error de Hardware & Reglamento WCA
1. **Categoría WCA (`cube_type`):** Restringida estrictamente a `"3x3"`, `"2x2"`, `"4x4"`, `"Pyraminx"`, `"Megaminx"`.
2. **Legalidad en Torneo Oficial (`wca_legal` - Regla WCA 3a):**
   - Cubos con Bluetooth, sensores electrónicos o giroscopio (`GAN 12 ui`, `GAN i Carry`, `MoYu AI`, `GoCube`) -> `wca_legal: false`.
   - Cubos magnéticos/MagLev mecánicos -> `wca_legal: true`.
3. **Rangos Físicos Validados:**
   - `size_mm`: Entre `30mm` y `150mm` (ej. `55.5mm` o `56mm` en 3x3).
   - `weight_grams`: Entre `25g` y `350g` (ej. `68g–71g` en 3x3 flagship).
   - `target_sub_seconds`: Meta realista Sub-X calibrada a la categoría.

## 3. Información Adicional Enriquecida con IA (Compra y Rendimiento)
Además del hardware básico, la Skill devuelve siempre:
- `estimated_market_price_cop`: Precio promedio estimado en pesos colombianos (COP) en tiendas de speedcubing de Colombia para autocompletar cuánto costó el cubo.
- `recommended_store`: Tiendas de referencia (`Edurubiks / Speedcube Colombia / Moyu Store`).
- `release_tier`: Gama tecnológica (`Flagship Tope de Gama`, `Competitivo Calidad/Precio`, `Magnético de Entrada`).
- `turning_feel_and_cutting`: Sensación de giro y ángulos de corte directo/inverso (`55° / 35°`).
- `pro_cuber_notes`: Recomendación táctica para mejorar el Ao5/Ao12 con ese modelo.
- `maintenance_guide`: Frecuencia de limpieza y tipo de lubricante ideal (core vs piezas).
