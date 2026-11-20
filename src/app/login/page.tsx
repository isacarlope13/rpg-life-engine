"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound, ShieldCheck, Lock, ArrowLeft, Eye, EyeOff, Mail } from "lucide-react";

type AuthMode = "login" | "signup" | "recover" | "reset";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [publicSignupEnabled, setPublicSignupEnabled] = useState(false);
  const [privateMode, setPrivateMode] = useState(true);
  const [ownerConfigured, setOwnerConfigured] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryToken, setRecoveryToken] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [acceptDataPolicy, setAcceptDataPolicy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const hashToken = hashParams.get("access_token");
      const hashType = hashParams.get("type");
      const m = params.get("mode");

      if (hashToken && (hashType === "recovery" || hashType === "invite" || m === "reset")) {
        // Guardar el token de invitación/recuperación únicamente en memoria y limpiar el hash de la URL
        setRecoveryToken(hashToken);
        setMode("reset");
        window.history.replaceState(null, "", "/login?mode=reset");
        return;
      }

      if (m === "recover" || m === "login" || m === "reset") {
        setMode(m);
      }

      fetch("/api/auth/login")
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg: { privateMode?: boolean; publicSignupEnabled?: boolean; ownerConfigured?: boolean } | null) => {
          if (!cfg) return;
          setPrivateMode(Boolean(cfg.privateMode));
          setOwnerConfigured(cfg.ownerConfigured !== false);
          if (cfg.publicSignupEnabled === true) {
            setPublicSignupEnabled(true);
            if (m === "signup") {
              setMode("signup");
            }
          } else {
            setPublicSignupEnabled(false);
            setMode((prev) => (prev === "signup" ? "login" : prev));
          }
        })
        .catch(() => {});
    }
  }, []);

  const passwordChecks = useMemo(
    () => ({
      length: password.length >= 10,
      hasLetter: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password),
      hasDigit: /\d/.test(password),
      notOnlyDigits: !/^\d+$/.test(password),
    }),
    [password]
  );

  const isStrongSignupPassword =
    passwordChecks.length &&
    passwordChecks.hasLetter &&
    passwordChecks.hasDigit &&
    passwordChecks.notOnlyDigits;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (mode === "reset") {
      if (!recoveryToken) {
        setError("El enlace de recuperación no es válido o expiró. Solicita uno nuevo.");
        return;
      }
      if (!isStrongSignupPassword) {
        setError(
          "Usa una nueva contraseña segura de al menos 10 caracteres que combine letras y números."
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
    }

    if (mode === "signup") {
      if (!isStrongSignupPassword) {
        setError(
          "Usa una contraseña segura de al menos 10 caracteres que combine letras y números."
        );
        return;
      }
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.");
        return;
      }
      if (!acceptDataPolicy) {
        setError(
          "Debes aceptar expresamente la Política de Tratamiento de Datos Personales para crear tu cuenta."
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "reset"
            ? {
                action: "update_password",
                recovery_access_token: recoveryToken,
                password,
              }
            : {
                email: email.trim(),
                password: mode === "recover" ? undefined : password,
                action: mode,
                display_name: mode === "signup" && displayName.trim() ? displayName.trim() : undefined,
                data_privacy_accepted: mode === "signup" ? acceptDataPolicy : undefined,
              }
        ),
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        needs_confirmation?: boolean;
        recovery_sent?: boolean;
        password_updated?: boolean;
        message?: string;
      };
      if (!res.ok || json.error) {
        setError(json.error || `Error ${res.status}`);
        return;
      }
      if (json.password_updated || json.recovery_sent || json.needs_confirmation) {
        setInfo(
          json.message ||
            "Revisa tu correo electrónico para confirmar tu cuenta o completar la recuperación."
        );
        setRecoveryToken("");
        setPassword("");
        setConfirmPassword("");
        setMode("login");
        return;
      }
      window.location.href = mode === "signup" ? "/onboarding" : "/cozy";
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4EEDC] p-4 text-[#3A2E2B] selection:bg-[#E7D69C]">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-4 rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_8px_0_#3A2E2B]"
      >
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B]">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h1 className="text-lg font-black text-[#3A2E2B] leading-tight">
                OakHaven — Acceso Seguro
              </h1>
              <span className="text-[11px] font-bold text-[#314C3C]">
                {privateMode
                  ? "Modo Privado · Propietario Único · Supabase Auth"
                  : "Identidad verificada por correo · Supabase Auth"}
              </span>
            </div>
          </div>
          <p className="mt-2 text-xs text-[#795548]">
            {mode === "login"
              ? "Inicia sesión con tu correo verificado y contraseña."
              : mode === "signup"
              ? "Crea tu cuenta personal con contraseña robusta y verificación real de correo."
              : mode === "reset"
              ? "Establece una contraseña robusta (10+ caracteres) para activar tu invitación o completar tu recuperación de acceso."
              : "Te enviaremos un enlace seguro si existe una cuenta asociada a tu correo."}
          </p>
        </div>

        {!ownerConfigured && (
          <p role="alert" className="rounded-2xl border-2 border-amber-700 bg-amber-50 p-3 text-xs font-bold text-amber-950">
            Instancia privada pendiente de configuración del propietario autorizado. El acceso permanece cerrado por seguridad.
          </p>
        )}

        {mode === "reset" && !recoveryToken && (
          <p role="alert" className="rounded-2xl border-2 border-amber-700 bg-amber-50 p-3 text-xs font-bold text-amber-950">
            Abre esta pantalla directamente desde el enlace recibido en tu correo de recuperación, o solicita un nuevo enlace.
          </p>
        )}

        {mode === "signup" && (
          <div>
            <label htmlFor="auth-display-name" className="block text-xs font-black text-[#3A2E2B] mb-1">
              Nombre de Aventurero
            </label>
            <input
              id="auth-display-name"
              type="text"
              maxLength={60}
              placeholder="Ej. tu nombre único en OakHaven"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3.5 py-2.5 text-xs font-bold text-[#3A2E2B] placeholder-[#795548]/60 outline-none focus:bg-[#FFFDF8] focus:ring-2 focus:ring-[#314C3C]"
            />
          </div>
        )}

        {mode !== "reset" && (
          <div>
            <label htmlFor="auth-email" className="block text-xs font-black text-[#3A2E2B] mb-1">
              Correo Electrónico
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#795548]" />
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                placeholder="tu-correo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] pl-9 pr-3.5 py-2.5 text-xs font-bold text-[#3A2E2B] placeholder-[#795548]/60 outline-none focus:bg-[#FFFDF8] focus:ring-2 focus:ring-[#314C3C]"
              />
            </div>
          </div>
        )}

        {mode !== "recover" && (
          <div>
            <label htmlFor="auth-password" className="block text-xs font-black text-[#3A2E2B] mb-1">
              {mode === "reset" ? "Nueva Contraseña (mínimo 10 caracteres)" : `Contraseña ${mode === "signup" ? "(mínimo 10 caracteres)" : ""}`}
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#795548]" />
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signup" || mode === "reset" ? "new-password" : "current-password"}
                required
                minLength={mode === "signup" || mode === "reset" ? 10 : 4}
                maxLength={128}
                placeholder={
                  mode === "signup" || mode === "reset"
                    ? "Combina letras y números (10+ caracteres)"
                    : "Ingresa tu contraseña"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] pl-9 pr-10 py-2.5 text-xs font-bold text-[#3A2E2B] placeholder-[#795548]/60 outline-none focus:bg-[#FFFDF8] focus:ring-2 focus:ring-[#314C3C]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#795548] hover:text-[#3A2E2B] cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {(mode === "signup" || mode === "reset") && (
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                <span className={passwordChecks.length ? "text-[#314C3C]" : "text-[#795548]"}>
                  {passwordChecks.length ? "✓" : "○"} 10+ caracteres
                </span>
                <span className={passwordChecks.hasLetter ? "text-[#314C3C]" : "text-[#795548]"}>
                  {passwordChecks.hasLetter ? "✓" : "○"} Al menos 1 letra
                </span>
                <span className={passwordChecks.hasDigit ? "text-[#314C3C]" : "text-[#795548]"}>
                  {passwordChecks.hasDigit ? "✓" : "○"} Al menos 1 número
                </span>
                <span className={passwordChecks.notOnlyDigits ? "text-[#314C3C]" : "text-[#795548]"}>
                  {passwordChecks.notOnlyDigits ? "✓" : "○"} No solo dígitos
                </span>
              </div>
            )}
          </div>
        )}

        {(mode === "signup" || mode === "reset") && (
          <div>
            <label htmlFor="auth-confirm-password" className="block text-xs font-black text-[#3A2E2B] mb-1">
              Confirmar Contraseña
            </label>
            <input
              id="auth-confirm-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={128}
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3.5 py-2.5 text-xs font-bold text-[#3A2E2B] placeholder-[#795548]/60 outline-none focus:bg-[#FFFDF8] focus:ring-2 focus:ring-[#314C3C]"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-2xl border-2 border-rose-700 bg-rose-50 p-3 text-xs font-bold text-rose-900">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-2xl border-2 border-[#314C3C] bg-[#EAF3ED] p-3 text-xs font-bold text-[#1A2B20]">
            {info}
          </p>
        )}

        {mode === "signup" && (
          <label className="flex items-start gap-2.5 rounded-2xl border-2 border-[#3A2E2B]/30 bg-[#F7F4EB] p-3 text-xs cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={acceptDataPolicy}
              onChange={(e) => setAcceptDataPolicy(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-[#3A2E2B] text-[#314C3C] shrink-0 cursor-pointer"
            />
            <span className="text-[#5C4033] leading-snug text-[11px] font-medium">
              Acepto expresamente la{" "}
              <Link
                href="/privacidad"
                target="_blank"
                className="text-[#314C3C] underline font-black"
              >
                Política de Tratamiento de Datos Personales
              </Link>{" "}
              y autorizo la verificación de mi correo electrónico.
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={
            submitting ||
            (mode === "signup" && !acceptDataPolicy) ||
            (mode === "reset" && !recoveryToken)
          }
          className="w-full rounded-2xl border-3 border-[#3A2E2B] bg-[#314C3C] py-3 text-xs font-black text-[#FFFDF8] shadow-[0_4px_0_#1A2B20] hover:bg-[#273E30] disabled:opacity-40 transition cursor-pointer"
        >
          {submitting
            ? "Procesando de forma segura..."
            : mode === "login"
            ? "Iniciar Sesión"
            : mode === "signup"
            ? "Crear Cuenta y Enviar Confirmación"
            : mode === "reset"
            ? "Guardar Nueva Contraseña"
            : "Enviar Enlace de Recuperación"}
        </button>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-bold">
          {publicSignupEnabled ? (
            mode !== "signup" ? (
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setInfo(null);
                }}
                className="text-[#314C3C] hover:underline cursor-pointer"
              >
                Crear cuenta nueva
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setInfo(null);
                }}
                className="text-[#314C3C] hover:underline cursor-pointer"
              >
                Ya tengo cuenta
              </button>
            )
          ) : (
            <span className="text-[11px] font-bold text-[#795548]">
              🔒 Registro público cerrado
            </span>
          )}

          {mode !== "recover" ? (
            <button
              type="button"
              onClick={() => {
                setMode("recover");
                setError(null);
                setInfo(null);
              }}
              className="text-[#795548] hover:text-[#3A2E2B] hover:underline cursor-pointer"
            >
              ¿Olvidaste tu contraseña?
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setInfo(null);
              }}
              className="text-[#795548] hover:text-[#3A2E2B] hover:underline cursor-pointer"
            >
              Volver a iniciar sesión
            </button>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t-2 border-[#3A2E2B]/15 text-[11px] font-bold text-[#795548]">
          <Link href="/" className="inline-flex items-center gap-1 hover:text-[#3A2E2B]">
            <ArrowLeft className="h-3.5 w-3.5" /> Volver al Inicio
          </Link>
          <span className="inline-flex items-center gap-1 text-[#314C3C]">
            <ShieldCheck className="h-3.5 w-3.5" /> Sin contraseñas compartidas
          </span>
        </div>
      </form>
    </div>
  );
}
