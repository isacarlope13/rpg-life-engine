"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw, Trash2, Home, Copy, Check, ChevronDown, ChevronUp } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorBoundary({ error, reset }: ErrorProps) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [userAgent, setUserAgent] = useState("");
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setUserAgent(navigator.userAgent);
      console.error("[Oakhaven ErrorBoundary] Error capturado en cliente:", error);
    }
  }, [error]);

  const handleClearCacheAndReload = async () => {
    setClearing(true);
    try {
      if (typeof window !== "undefined") {
        // Desregistrar Service Workers
        if ("serviceWorker" in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const reg of registrations) {
            await reg.unregister();
          }
        }
        // Limpiar todas las cachés
        if ("caches" in window) {
          const keys = await caches.keys();
          for (const key of keys) {
            await caches.delete(key);
          }
        }
        // Limpiar almacenamiento de sesión
        try {
          sessionStorage.clear();
        } catch {}
      }
    } catch (e) {
      console.warn("Fallo al limpiar caché:", e);
    } finally {
      window.location.reload();
    }
  };

  const copyDiagnostic = () => {
    const diagnostic = {
      name: error.name,
      message: error.message,
      digest: error.digest,
      stack: error.stack,
      url: typeof window !== "undefined" ? window.location.href : "unknown",
      userAgent: userAgent || "unknown",
      timestamp: new Date().toISOString(),
    };
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(diagnostic, null, 2)).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }).catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-rose-900/40 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              Neblina en el Valle de Oakhaven
            </h1>
            <p className="text-xs text-slate-400">
              Ocurrió una excepción en el navegador al cargar la interfaz.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-rose-950/60 bg-rose-950/20 p-3.5 mb-5 text-xs text-rose-200">
          <p className="font-semibold">{error.name || "Error del Cliente"}:</p>
          <p className="font-mono text-[11px] text-rose-300 mt-1 break-words">
            {error.message || "Error desconocido durante la ejecución en cliente."}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition active:scale-95 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar Render
          </button>
          <button
            onClick={handleClearCacheAndReload}
            disabled={clearing}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-600/90 hover:bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {clearing ? "Limpiando..." : "Limpiar Caché y Recargar"}
          </button>
        </div>

        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
          <button
            onClick={() => (window.location.href = "/")}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <Home className="h-3.5 w-3.5" />
            Ir a Portada
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          >
            <span>Diagnóstico técnico</span>
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

        {showDetails && (
          <div className="mt-4 rounded-xl border border-slate-800 bg-[#0B0F19] p-3 text-[11px] text-slate-400">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-slate-300">Detalles para depuración:</span>
              <button
                onClick={copyDiagnostic}
                className="flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-700 transition cursor-pointer"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copiado" : "Copiar Diagnóstico"}
              </button>
            </div>
            {error.digest && (
              <p className="font-mono text-[10px] text-slate-500 mb-1">
                Digest: {error.digest}
              </p>
            )}
            <p className="font-mono text-[10px] text-slate-500 mb-2 truncate">
              User-Agent: {userAgent}
            </p>
            <pre className="max-h-40 overflow-auto font-mono text-[10px] text-rose-300/80 whitespace-pre-wrap">
              {error.stack || "Sin stack trace disponible"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
