import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0B0F19",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "RPG Productivity & Personal Finance Life-Engine",
  description:
    "Motor gamificado de finanzas personales, control de Bóveda/Billetera GP, Galería de Libros, Cubos WCA y combate de deudas con iOS Shortcuts + Gemini AI",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "RPG Life-Engine",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-[#0B0F19] text-[#F1F5F9] antialiased selection:bg-emerald-500/30">
        {children}
      </body>
    </html>
  );
}
