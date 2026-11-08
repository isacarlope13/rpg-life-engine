"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "signup") {
        setMode("signup");
      }
    }
  }, []);

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
      window.location.href = mode === "signup" ? "/onboarding" : "/dashboard";
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
            {mode === "login"
              ? "Inicia sesión para continuar"
              : "Crea tu cuenta (activación inmediata sin esperar correo)"}
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

        <p className="text-[11px] text-slate-400 text-center leading-relaxed">
          Al continuar, autorizas el tratamiento de tus datos conforme a nuestra{" "}
          <Link
            href="/privacidad"
            target="_blank"
            className="text-emerald-400 underline hover:text-emerald-300 font-medium"
          >
            Política de Privacidad & Habeas Data
          </Link>.
        </p>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 cursor-pointer"
        >
          {submitting
            ? "Procesando..."
            : mode === "login"
            ? "Entrar"
            : "Crear cuenta y pasar a Onboarding"}
        </button>

        {/* Tarjeta de Credenciales Maestras Pre-Calibradas */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/15 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-300">
              🔑 Cuenta Maestra Pre-Calibrada
            </span>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setEmail("player1@rpg-life-engine.local");
                setPassword("RpgLifeEngine2026!");
                setError(null);
                setInfo(null);
              }}
              className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30 cursor-pointer"
            >
              Autocompletar
            </button>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-300">
            Correo: <span className="text-white">player1@rpg-life-engine.local</span>
            <br />
            Clave: <span className="text-white">RpgLifeEngine2026!</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
          className="w-full text-center text-xs text-slate-400 hover:text-emerald-400 cursor-pointer"
        >
          {mode === "login"
            ? "¿No tienes cuenta? Regístrate (sin confirmación por correo)"
            : "¿Ya tienes cuenta? Inicia sesión"}
        </button>

        <div className="pt-2 border-t border-slate-800 text-center">
          <Link
            href="/"
            className="text-xs text-slate-400 hover:text-white transition"
          >
            ← Volver a la Página Principal
          </Link>
        </div>
      </form>
    </div>
  );
}
