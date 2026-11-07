import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RPG Productivity & Personal Finance Life-Engine",
    short_name: "RPG Life-Engine",
    description:
      "Motor gamificado de finanzas personales, Santuario de Habilidades (Rubik, Lectura, Galería de Libros) y combate de Debt Bosses con iOS Shortcuts + Gemini AI",
    start_url: "/",
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#10b981",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "⚡ Modo Celular 5s (Gasto o Hábito)",
        short_name: "Modo 5s",
        description:
          "Registra un gasto por voz/SMS o una sesión rápida en menos de 5 segundos",
        url: "/quick",
      },
      {
        name: "⚔️ Tablero Táctico RPG",
        short_name: "Tablero",
        description:
          "Abre el Santuario de Habilidades, Galería de Libros y Debt Bosses",
        url: "/",
      },
    ],
  };
}
