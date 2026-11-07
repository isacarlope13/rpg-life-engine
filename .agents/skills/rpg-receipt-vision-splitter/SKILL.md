---
name: rpg-receipt-vision-splitter
description: Skill especializada para auditar facturas de supermercado por OCR o foto (Gemini Vision) separando mercado esencial vs antojos no presupuestados (multa 1.2x).
---

# Skill 2: Auditor OCR & Divisor de Facturas (`rpg-receipt-vision-splitter`)

## 1. Propósito y Endpoint
Se activa cuando el usuario sube el texto o la foto de una factura de supermercado a:
- `POST /api/shortcuts/receipt-ocr`
- Función asociada: `parseReceiptWithGeminiVision` y `sanitizeReceiptSplit` en `src/lib/gemini.ts` / `src/lib/ai-skills-prompts.ts`.

## 2. Reglas Anti-Error en Lectura de Líneas de Factura
1. **No confundir medidas con precios:**
   - Ignorar sufijos de peso/volumen (`500g`, `1000ml`, `250gr`, `1.5L`, `x30`) al extraer el valor en COP de cada línea.
2. **No duplicar el Total:**
   - Ignorar las líneas que empiezan por `TOTAL`, `SUBTOTAL`, `IVA` o `CAMBIO` al sumar los ítems individuales.
3. **Invariante Matemática:**
   - `total_cop` debe ser siempre exactamente igual a `operational_essential_cop + discretionary_unbudgeted_cop`.

## 3. Separación de Rubros
- **Mercado Esencial (`operational_essential_cop`):** Proteínas, huevos, arroz, granos, verduras, frutas, lácteos básicos, aseo del hogar e higiene personal (se descuenta de Variables Operativos sin multa).
- **Antojo Infiltrado (`discretionary_unbudgeted_cop`):** Cerveza, licores, gaseosas, papas de paquete, dulces, chocolatinas, helados, snacks ultra-procesados (aplica multa `1.2x` contra la Bóveda GP).
