"use client";

import { useEffect } from "react";

export function ChunkErrorHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleChunkError = (event: ErrorEvent) => {
      const msg = event?.message || "";
      const isChunkError =
        msg.includes("ChunkLoadError") ||
        msg.includes("Loading chunk") ||
        msg.includes("failed to fetch dynamically imported module");

      if (isChunkError) {
        console.warn("[ChunkErrorHandler] Detectado fallo de carga de chunk Next.js:", msg);
        const retryKey = "rpg_chunk_reload_attempted";
        const hasRetried = sessionStorage.getItem(retryKey);

        if (!hasRetried) {
          sessionStorage.setItem(retryKey, "true");
          // Si hay service worker, desregistrarlo para obligar a refrescar hashes
          if ("serviceWorker" in navigator) {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
              registrations.forEach((reg) => reg.unregister());
            });
          }
          if ("caches" in window) {
            caches.keys().then((keys) => {
              keys.forEach((k) => caches.delete(k));
            });
          }
          window.location.reload();
        }
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason?.message || String(event?.reason || "");
      if (
        reason.includes("ChunkLoadError") ||
        reason.includes("Loading chunk") ||
        reason.includes("dynamically imported module")
      ) {
        handleChunkError({ message: reason } as ErrorEvent);
      }
    };

    window.addEventListener("error", handleChunkError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleChunkError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
