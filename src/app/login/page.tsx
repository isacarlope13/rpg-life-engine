"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, Shield, CheckCircle2, Lock, ArrowLeft, Delete } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [acceptDataPolicy, setAcceptDataPolicy] = useState(false);
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

  const handleKeypadPress = (digit: string) => {
    if (password.length < 8) {
      setPassword((prev) => prev + digit);
    }
  };

  const handleKeypadBackspace = () => {
    setPassword((prev) => prev.slice(0, -1));
  };

  const handleKeypadClear = () => {
    setPassword("");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    // Validar formato numérico de PIN
    if (!/^\d{4,8}$/.test(password)) {
      setError("El PIN de acceso debe ser numérico y tener entre 4 y 8 dígitos (ej. 202611).");
      return;
    }

    if (mode === "signup" && !acceptDataPolicy) {
      setError(
        "Debes aceptar la Política de Tratamiento de Datos Personales para crear tu cuenta."
      );
      return;
    }

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
          data_privacy_accepted: mode === "signup" ? acceptDataPolicy : undefined,
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
    <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] p-4 text-slate-100 selection:bg-emerald-500/30">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-white/5 bg-[#131B2E]/70 p-6 shadow-2xl backdrop-blur-md"
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <KeyRound className="h-4 w-4" />
            </span>
            <h1 className="text-lg font-extrabold text-slate-100">RPG Life-Engine</h1>
            <span className="rounded bg-white/5 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-400">
              PIN Lock
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {mode === "login"
              ? "Ingresa tu correo y tu PIN numérico de acceso"
              : "Crea tu cuenta con un PIN de 4 a 8 dígitos"}
          </p>
        </div>

        {mode === "signup" && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 mb-1">
              Nombre de Aventurero
            </label>
            <input
              type="text"
              placeholder="Ej. Comandante Alex"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-white/5 bg-[#0B0F19] px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500/50 transition"
            />
          </div>
        )}

        <div>
          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
            Correo Electrónico
          </label>
          <input
            type="email"
            required
            placeholder="aventurero@rpg-life-engine.local"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-white/5 bg-[#0B0F19] px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500/50 transition"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-semibold text-slate-300">
              PIN Numérico de Seguridad (4–8 dígitos)
            </label>
            <span className="text-[10px] font-mono text-slate-400">
              {password.length}/8 dígitos
            </span>
          </div>

          <div className="relative">
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              maxLength={8}
              placeholder="Introduce tu PIN numérico..."
              value={password}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                setPassword(val);
              }}
              className="w-full rounded-xl border border-white/5 bg-[#0B0F19] px-3 py-2.5 font-mono text-center text-base tracking-widest text-slate-100 placeholder-slate-600 outline-none focus:border-emerald-500/50 transition"
            />
          </div>

          {/* Indicador visual de puntos de PIN */}
          <div className="mt-2 flex items-center justify-center gap-2">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <span
                key={idx}
                className={`h-2.5 w-2.5 rounded-full transition-all ${
                  password.length > idx
                    ? "bg-emerald-400 ring-2 ring-emerald-500/40 shadow-sm"
                    : "border border-white/10 bg-white/5"
                }`}
              />
            ))}
          </div>

          {/* Teclado numérico virtual para toque rápido (móvil y escritorio) */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl border border-white/5 bg-[#0B0F19]/40 p-2">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleKeypadPress(num)}
                className="rounded-lg bg-white/5 py-2 font-mono text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white transition active:scale-95 cursor-pointer"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              onClick={handleKeypadClear}
              className="rounded-lg bg-white/5 py-2 text-[10px] font-bold text-slate-400 hover:bg-rose-500/20 hover:text-rose-300 transition active:scale-95 cursor-pointer"
              title="Borrar todo"
            >
              C
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress("0")}
              className="rounded-lg bg-white/5 py-2 font-mono text-xs font-bold text-slate-200 hover:bg-white/10 hover:text-white transition active:scale-95 cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleKeypadBackspace}
              className="flex items-center justify-center rounded-lg bg-white/5 py-2 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition active:scale-95 cursor-pointer"
              title="Borrar último dígito"
            >
              <Delete className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-2.5 text-xs text-rose-300">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5 text-xs text-emerald-300">
            {info}
          </p>
        )}

        {mode === "signup" && (
          <label className="flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/15 p-3 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={acceptDataPolicy}
              onChange={(e) => setAcceptDataPolicy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
            />
            <span className="text-slate-300 leading-snug text-[11px]">
              Acepto expresamente la{" "}
              <Link
                href="/privacidad"
                target="_blank"
                className="text-emerald-400 underline hover:text-emerald-300 font-bold"
              >
                Política de Tratamiento de Datos
              </Link>
              {" "}bajo Habeas Data y sus actualizaciones.
            </span>
          </label>
        )}

        {mode === "login" && (
          <p className="text-[11px] text-slate-400 text-center leading-relaxed">
            Al continuar, autorizas el tratamiento de tus datos conforme a nuestra{" "}
            <Link
              href="/privacidad"
              target="_blank"
              className="text-emerald-400 underline hover:text-emerald-300 font-medium"
            >
              Política de Privacidad
            </Link>.
          </p>
        )}

        <button
          type="submit"
          disabled={submitting || (mode === "signup" && !acceptDataPolicy)}
          className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 disabled:opacity-40 transition cursor-pointer"
        >
          {submitting
            ? "Verificando PIN..."
            : mode === "login"
            ? "Desbloquear con PIN"
            : "Crear Cuenta con este PIN"}
        </button>

        {/* Tarjeta de Cuenta Maestra Pre-Calibrada */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-300 text-[11px]">
              🔑 Cuenta Maestra Pre-Calibrada
            </span>
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setEmail("player1@rpg-life-engine.local");
                setPassword("202611");
                setError(null);
                setInfo(null);
              }}
              className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/25 cursor-pointer transition"
            >
              Autocompletar PIN
            </button>
          </div>
          <p className="mt-1 font-mono text-[11px] text-slate-300">
            Correo: <span className="text-white">player1@rpg-life-engine.local</span>
            <br />
            PIN: <span className="text-amber-400 font-bold">202611</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setInfo(null);
          }}
          className="w-full text-center text-xs text-slate-400 hover:text-emerald-400 cursor-pointer transition"
        >
          {mode === "login"
            ? "¿No tienes cuenta? Crea una con tu PIN"
            : "¿Ya tienes cuenta? Inicia sesión con tu PIN"}
        </button>

        <div className="pt-2 border-t border-white/5 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-3 w-3" /> Volver al Inicio
          </Link>
        </div>
      </form>
    </div>
  );
}
