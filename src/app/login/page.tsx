"use client";

import React, { useState } from "react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          action: mode,
          display_name: displayName || undefined,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        needs_confirmation?: boolean;
        message?: string;
      };
      if (!res.ok || json.error) {
        setError(json.error || `Error ${res.status}`);
        return;
      }
      if (json.needs_confirmation) {
        setInfo(json.message || "Revisa tu correo para confirmar la cuenta.");
        setMode("login");
        return;
      }
      window.location.href = mode === "signup" ? "/onboarding" : "/";
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#090d16] p-6 text-slate-200">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-6"
      >
        <div>
          <h1 className="text-xl font-bold text-white">RPG Life-Engine</h1>
          <p className="text-sm text-slate-400">
            {mode === "login" ? "Inicia sesión para continuar" : "Crea tu cuenta"}
          </p>
        </div>

        {mode === "signup" && (
          <input
            type="text"
            placeholder="Nombre de aventurero (opcional)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        )}
        <input
          type="email"
          required
          placeholder="Correo"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Contraseña (mín. 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />

        {error && <p className="text-sm text-rose-400">{error}</p>}
        {info && <p className="text-sm text-emerald-400">{info}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {submitting ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
        </button>

        {process.env.NODE_ENV !== "production" && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setError(null);
                setSubmitting(true);
                try {
                  const res = await fetch("/api/auth/demo", { method: "POST" });
                  if (!res.ok) {
                    setError("No se pudo iniciar el modo demo.");
                    return;
                  }
                  window.location.href = "/";
                } finally {
                  setSubmitting(false);
                }
              }}
              className="w-full rounded-lg border border-amber-500/40 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/10 disabled:opacity-50"
            >
              🎮 Entrar en modo demo (Dashboard directo)
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={async () => {
                setError(null);
                setSubmitting(true);
                try {
                  const res = await fetch("/api/auth/demo", { method: "POST" });
                  if (!res.ok) {
                    setError("No se pudo iniciar el modo demo.");
                    return;
                  }
                  window.location.href = "/onboarding";
                } finally {
                  setSubmitting(false);
                }
              }}
              className="w-full rounded-lg border border-emerald-500/40 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
            >
              ✨ Probar Onboarding de Usuario Nuevo (5 pasos)
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="w-full text-center text-xs text-slate-400 hover:text-slate-200"
        >
          {mode === "login"
            ? "¿No tienes cuenta? Regístrate"
            : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </form>
    </div>
  );
}
