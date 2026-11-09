/**
 * Utilidad centralizada para resolver la URL base de la aplicación.
 * Garantiza que en entornos de producción, móviles y SSR nunca se filtre 'localhost:3000'.
 */
export const PRODUCTION_DEFAULT_URL = "https://rpg-life-engine-production.up.railway.app";

export function getAppBaseUrl(): string {
  // 1. Cliente en el navegador
  if (typeof window !== "undefined" && window.location.origin) {
    // Si estamos en localhost deliberadamente en desarrollo local, lo respeta
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return window.location.origin;
    }
    return window.location.origin;
  }

  // 2. Variable pública explícita
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  // 3. Fallback según NODE_ENV
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3000";
  }

  return PRODUCTION_DEFAULT_URL;
}
