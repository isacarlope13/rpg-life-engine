/**
 * COZY PIXEL DESIGN SYSTEM — TOKENS VISUALES
 * Paleta oficial, sombras táctiles, bordes y tipografías consistentes.
 */

export const COZY_COLORS = {
  forest: "#314C3C",   // Tono primario bosque, encabezados y botones principales
  sage: "#77936A",     // Verde salvia para acentos secundarios y badges
  meadow: "#B8CCA0",   // Pradera suave para fondos resaltados y barras de progreso
  cream: "#F4EEDC",    // Color base cálido para fondos de tarjetas y ventanas
  wood: "#D8B48A",     // Madera cálida para marcos, biseles y botones secundarios
  clay: "#C88973",     // Arcilla terracota para alertas, estados activos y acentos cálidos
  lake: "#A9C7C7",     // Azul lago sereno para estados de foco, agua y reflejos
  sunlight: "#E7D69C", // Luz dorada para monedas GP, estrellas y momentos destacados
  bark: "#3A2E2B",     // Borde oscuro canónico para el delineado estilo pixel
  parchment: "#FFFDF8",// Blanco apergaminado para fondos de lectura y contenedores
  shadow: "#241C1A",   // Sombra profunda para relieve 3D pixelado
} as const;

export type CozyColorKey = keyof typeof COZY_COLORS;

export const COZY_SHADOWS = {
  sm: "0 2px 0 0 #3A2E2B",
  md: "0 4px 0 0 #3A2E2B",
  lg: "0 6px 0 0 #3A2E2B",
  xl: "0 8px 0 0 #3A2E2B",
  modal: "0 12px 0 0 #3A2E2B",
  inset: "inset 0 2px 4px rgba(58, 46, 43, 0.2)",
} as const;

export const COZY_BORDERS = {
  pixel: "3px solid #3A2E2B",
  pixelThick: "4px solid #3A2E2B",
  pixelThin: "2px solid #3A2E2B",
  subtle: "2px solid rgba(58, 46, 43, 0.15)",
} as const;

export const COZY_RADII = {
  none: "0px",
  sm: "0.5rem",   // 8px
  md: "0.75rem",  // 12px
  lg: "1rem",     // 16px
  xl: "1.25rem",  // 20px
  "2xl": "1.5rem",// 24px
  full: "9999px",
} as const;
