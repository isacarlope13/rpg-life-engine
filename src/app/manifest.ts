import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RPG Productivity & Personal Finance Life-Engine",
    short_name: "RPG Finance",
    description:
      "Motor gamificado de finanzas personales, Bóveda/Billetera GP y combate de Debt Bosses con iOS Shortcuts + Gemini AI",
    start_url: "/",
    display: "standalone",
    background_color: "#090d16",
    theme_color: "#10b981",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
