"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Swords,
  Shield,
  Zap,
  Flame,
  Wallet,
  Vault,
  Trophy,
  BookOpen,
  Box,
  Briefcase,
  Smartphone,
  Brain,
  TrendingDown,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Lock,
  Layers,
  FileSpreadsheet,
  Download,
  Terminal,
  BarChart3,
} from "lucide-react";

export function LandingPage() {
  const [sessionUser, setSessionUser] = useState<{
    display_name?: string;
    character_class?: string;
    player_level?: number;
  } | null>(null);
  const [demoLoggingIn, setDemoLoggingIn] = useState(false);

  useEffect(() => {
    fetch("/api/state", { cache: "no-store" })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.user) {
          setSessionUser({
            display_name: data.user.display_name,
            character_class: data.user.character_class,
            player_level: data.player_level ?? 1,
          });
        }
      })
      .catch(() => null);
  }, []);

  const handleQuickDemoLogin = async () => {
    setDemoLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "player1@rpg-life-engine.local",
          password: "RpgLifeEngine2026!",
          action: "login",
        }),
      });
      if (res.ok) {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/login";
      }
    } catch {
      window.location.href = "/login";
    } finally {
      setDemoLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* =====================================================================
          1. HEADER / NAVBAR
         ===================================================================== */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#070b14]/85 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 text-emerald-400 ring-1 ring-emerald-500/40 shadow-lg shadow-emerald-950/40">
              <Swords className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight text-white">
                  RPG Life-Engine
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  v3.4
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Productivity & Personal Finance Engine
              </p>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-300">
            <a href="#economia" className="hover:text-emerald-400 transition">
              Economía RPG
            </a>
            <a href="#bosses" className="hover:text-rose-400 transition">
              Debt Bosses
            </a>
            <a href="#santuario" className="hover:text-cyan-400 transition">
              Santuario Habilidades
            </a>
            <a href="#movil" className="hover:text-amber-400 transition">
              Modo Móvil 5s
            </a>
            <a
              href="https://github.com/isacarlope13/rpg-life-engine/blob/main/docs/MANUAL_DE_USUARIO.md"
              target="_blank"
              rel="noreferrer"
              className="hover:text-indigo-400 transition"
            >
              📖 Manual Oficial
            </a>
            <Link href="/privacidad" className="hover:text-emerald-400 transition">
              🛡️ Privacidad & Datos
            </Link>
          </nav>

          <div className="flex items-center gap-2.5">
            {sessionUser ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/50 hover:brightness-110 transition cursor-pointer"
              >
                <span>⚔️</span> Ir a mi Tablero (NVL {sessionUser.player_level})
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-2 text-xs font-bold text-slate-200 transition cursor-pointer"
                >
                  🔑 Entrar
                </Link>
                <Link
                  href="/login?mode=signup"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 transition cursor-pointer"
                >
                  🚀 Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* BANNER SI TIENE SESIÓN INICIADA */}
      {sessionUser && (
        <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border-b border-emerald-500/30 px-4 py-2 text-center text-xs text-emerald-200 flex items-center justify-center gap-2">
          <span>⚔️ Sesión activa detectada:</span>
          <strong className="text-white">
            {sessionUser.display_name || "Aventurero"} • {sessionUser.character_class}
          </strong>
          <Link
            href="/dashboard"
            className="underline text-emerald-300 hover:text-white font-bold ml-2"
          >
            Abrir mi Tablero RPG ➔
          </Link>
        </div>
      )}

      {/* =====================================================================
          2. HERO SECTION
         ===================================================================== */}
      <section className="relative overflow-hidden px-4 pt-16 pb-20 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-950/30 via-[#070b14] to-[#070b14]" />
        
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold text-emerald-300 shadow-inner mb-6">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span>Sistema Integral de Tracking de Vida, Rendimiento & Sistematización de Datos • v3.4</span>
          </div>

          <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl sm:leading-[1.15]">
            Convierte tu Productividad, Datos y Habilidades en un{" "}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Sistema de Alto Rendimiento
            </span>
          </h1>

          <p className="mx-auto mt-6 max-w-3xl text-base text-slate-300 sm:text-lg leading-relaxed">
            Sistematiza tus <strong>Proyectos Ágiles (Scrum, Kanban, Lean)</strong>, métricas cuantitativas en el <strong>Santuario de Habilidades</strong> (Speedcubing WCA, Biblioteca con Repetición Espaciada SM-2, Deep Work), <strong>Heatmaps Anuales de Constancia</strong> y un motor económico de <strong>XP/GP</strong> con cámara financiera opcional.
          </p>

          {/* BOTONES PRINCIPALES DE ACCIÓN */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 px-7 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-emerald-950/60 hover:brightness-110 transition cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>🎮</span> Comenzar Aventura (Registrarse Gratis)
              <ArrowRight className="h-4 w-4" />
            </Link>

            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/90 hover:bg-slate-800 px-6 py-3.5 text-sm font-bold text-slate-200 transition cursor-pointer"
            >
              <span>🔑</span> Iniciar Sesión (Entrar)
            </Link>

            <button
              type="button"
              disabled={demoLoggingIn}
              onClick={handleQuickDemoLogin}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-5 py-3.5 text-sm font-bold text-amber-300 transition cursor-pointer"
              title="Entra en 1 toque con la cuenta maestra precalibrada"
            >
              <span>⚡</span> {demoLoggingIn ? "Cargando..." : "Probar Demo Inmediata"}
            </button>
          </div>

          <p className="mt-3 text-xs text-slate-400">
            Sin tarjeta de crédito • Base de datos segura • Modo Offline PWA para iPhone y Android
          </p>

          {/* SIMULACIÓN INTERACTIVA DEL TABLERO EN EL HERO */}
          <div className="mt-12 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950 p-6 shadow-2xl text-left">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 text-xl">
                  ⚔️
                </span>
                <div>
                  <h3 className="font-bold text-white text-base">Aventurero del Código · Nivel 5</h3>
                  <p className="text-xs text-slate-400">Guerrero de Sistemas • Racha 7 días (Buff 1.25x GP) • 1 Escudo Aegis 🛡️</p>
                </div>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs font-bold">
                <span className="rounded-lg bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 text-indigo-300">
                  Bóveda: 400.000 GP
                </span>
                <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-emerald-300">
                  Billetera: 120.000 GP
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tarjeta 1: Analítica & Heatmap de Constancia */}
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4" /> Analítica de Vida & Hábitos
                  </span>
                  <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                    Consistencia: 94%
                  </span>
                </div>
                <p className="text-lg font-mono font-extrabold text-white">
                  🔥 21 Días de Racha Activa
                </p>
                <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[94%]" />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>365 días monitoreados</span>
                  <span className="text-emerald-400 font-bold">+18.400 XP Forjados</span>
                </div>
              </div>

              {/* Tarjeta 2: Santuario Cubos & Lectura */}
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                    <Box className="h-4 w-4" /> Rubik WCA & Lectura SM-2
                  </span>
                  <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300 font-mono">
                    Ao5: 18.42s
                  </span>
                </div>
                <p className="text-lg font-mono font-extrabold text-white">
                  +1.250 XP · +45k GP
                </p>
                <p className="text-xs text-slate-300 leading-snug">
                  12 solves cronometrados WCA y 32 páginas de <em>Hábitos Atómicos</em> leídas hoy.
                </p>
                <div className="text-[11px] text-cyan-400 font-semibold pt-1">
                  🧠 Duelo de Memoria SM-2: 3 tarjetas repasadas
                </div>
              </div>

              {/* Tarjeta 3: Trabajo Ágil Trello */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Briefcase className="h-4 w-4" /> Trabajo Ágil & Trello
                  </span>
                  <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Scrum / Kanban / Lean
                  </span>
                </div>
                <p className="text-lg font-mono font-extrabold text-white">
                  3 Tarjetas Hechas
                </p>
                <p className="text-xs text-slate-300 leading-snug">
                  Automatización de órdenes y validación de plantillas completada (+5.000 GP).
                </p>
                <div className="text-[11px] text-emerald-400 font-semibold pt-1">
                  🚀 Planificado con Gemini IA Skill
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          3. SECCIÓN: ¿CÓMO FUNCIONA EL MOTOR DE VIDA?
         ===================================================================== */}
      <section id="economia" className="border-t border-slate-800/80 bg-slate-950/60 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Arquitectura del Sistema
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              Diseñado para Erradicar la Fricción y Sistematizar tus Días
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              El motor combina productividad cuantitativa, marcos ágiles de trabajo y una economía de restricción gamificada:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pilar 1 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 shadow-lg hover:border-indigo-500/40 transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15 text-indigo-400">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">1. Analítica & Heatmap 365d</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Visualiza tu constancia diaria estilo GitHub con analítica de hábitos, distribución porcentual de energía de vida y exportación a Notion y CSV.
              </p>
            </div>

            {/* Pilar 2 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 shadow-lg hover:border-emerald-500/40 transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
                <Briefcase className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">2. Proyectos Ágiles Duales</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Separación nítida entre Actividades Diarias operativas y Proyectos de Alto Impacto con marcos <strong>Scrum, Kanban y Lean</strong> asistidos por Gemini IA.
              </p>
            </div>

            {/* Pilar 3 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 shadow-lg hover:border-cyan-500/40 transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400">
                <Box className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">3. Santuario de Habilidades</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Speedcubing WCA con algoritmos oficiales, biblioteca con repetición espaciada SM-2, tejido y cronómetros de Deep Work en vivo.
              </p>
            </div>

            {/* Pilar 4 */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3 shadow-lg hover:border-amber-500/40 transition">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
                <Vault className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">4. Economía de Restricción</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Tus gustos en la <strong>Tienda Wishlist</strong> exigen una racha mínima activa de hábitos y saldo positivo, con cámara de pasivos opcional.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          4. SECCIÓN: DEBT BOSSES & SIMULADOR BOLA DE NIEVE VS AVALANCHA
         ===================================================================== */}
      <section id="bosses" className="border-t border-slate-800/80 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-6 space-y-5">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400">
              Estrategia Financiera Cuantitativa
            </span>
            <h2 className="text-3xl font-extrabold text-white sm:text-4xl leading-tight">
              Combate a tus Deudas con Algoritmos Financieros Comprobados
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              El motor compara en tiempo real las dos metodologías más efectivas del mundo:
            </p>
            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Método Bola de Nieve:</strong> Liquida primero las deudas de menor saldo (Nequi ➔ ADDI ➔ Bancolombia) para conseguir victorias psicológicas rápidas y liberar flujo de caja.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Método Avalancha:</strong> Ataca primero las deudas con mayor tasa de interés E.A. para ahorrar la máxima cantidad de dinero en intereses compuestos.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Gráfica de Libertad Financiera ($0 COP):</strong> Proyecta la fecha exacta en la que estarás 100% libre de deudas y cuánto dinero salvarás.
                </span>
              </li>
            </ul>
            <div className="pt-2">
              <Link
                href="/login?mode=signup"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-500 px-5 py-2.5 text-xs font-bold text-white transition shadow-lg shadow-rose-950/40 cursor-pointer"
              >
                Configurar mis Debt Bosses ➔
              </Link>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl border border-rose-500/30 bg-slate-900/80 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-bold text-sm text-white flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-rose-400" />
                Simulador de Ahorro en Intereses
              </span>
              <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-300">
                Ahorro: +$420.000 COP
              </span>
            </div>
            <div className="space-y-3 text-xs">
              <div className="rounded-xl bg-slate-950 p-3 border border-slate-800 flex justify-between items-center">
                <span>🔴 Pago Mínimo Pasivo</span>
                <span className="font-mono text-slate-400">18 meses · Interés alto</span>
              </div>
              <div className="rounded-xl bg-emerald-950/30 p-3 border border-emerald-500/30 flex justify-between items-center text-emerald-200">
                <span>⚡ Aceleración Bola de Nieve RPG</span>
                <span className="font-mono font-bold text-emerald-300">10 meses (-8 meses antes)</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              *Calculado sobre tus excedentes mensuales de nómina inyectados como daño directo a capital.
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================================
          5. SECCIÓN: SANTUARIO DE HABILIDADES
         ===================================================================== */}
      <section id="santuario" className="border-t border-slate-800/80 bg-slate-950/60 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Productividad de Élite
            </span>
            <h2 className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              El Santuario de Habilidades
            </h2>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Tus pasiones no son una pérdida de tiempo: aquí son la fuente de energía de tu personaje.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Rubik */}
            <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/60 p-6 space-y-3 shadow-lg hover:border-cyan-400 transition">
              <span className="text-3xl">🧩</span>
              <h3 className="text-base font-bold text-white">Cubos de Rubik WCA</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cronómetro con barra espaciadora y toque táctil, scrambles oficiales WCA (2x2 a 7x7, Megaminx, Pyraminx), promedios Ao5/Ao12 bajo regla 9f9 (+2s/DNF), curva de rendimiento interactiva y cuaderno de lubricación.
              </p>
            </div>

            {/* Lectura */}
            <div className="rounded-2xl border border-emerald-500/30 bg-slate-900/60 p-6 space-y-3 shadow-lg hover:border-emerald-400 transition">
              <span className="text-3xl">📖</span>
              <h3 className="text-base font-bold text-white">Reading Hub 2.0 (SM-2)</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Repetición Espaciada SM-2 con tarjetas flip para tus citas y reflexiones, cálculo automático de velocidad en WPM y ritmo en min/pág, dictado por voz de frases y galería visual de libros con portadas.
              </p>
            </div>

            {/* Trabajo Ágil Trello */}
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-900/60 p-6 space-y-3 shadow-lg hover:border-indigo-400 transition">
              <span className="text-3xl">💼</span>
              <h3 className="text-base font-bold text-white">Trabajo Ágil & Trello</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Dualidad entre Actividades Operativas (cargas de precios, OPGs) y Proyectos Estratégicos (Scrum, Kanban, Lean). Tablero interactivo con arrastre de tarjetas y generador de proyectos con IA de Gemini.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          6. SECCIÓN: MODO MÓVIL PWA & OFFLINE
         ===================================================================== */}
      <section id="movil" className="border-t border-slate-800/80 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300">
            <Smartphone className="h-4 w-4" />
            <span>PWA Instalable en iPhone y Android</span>
          </div>

          <h2 className="text-3xl font-extrabold text-white sm:text-4xl">
            Llévalo en tu Bolsillo con Modo Offline Total
          </h2>

          <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Instálalo directamente desde Safari o Chrome como una aplicación nativa. Si estás en el metro o sin señal practicando cubos o leyendo, tus registros se guardan en tu teléfono y se sincronizan solos al recuperar internet.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left pt-6 max-w-3xl mx-auto">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h4 className="text-xs font-bold text-white mb-1">⚡ Modo Celular 5s (`/quick`)</h4>
              <p className="text-[11px] text-slate-400">Botones rápidos para almuerzo, transporte y gastos hormiga en segundos.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h4 className="text-xs font-bold text-white mb-1">🎙️ Dictado por Voz</h4>
              <p className="text-[11px] text-slate-400">Toca el micrófono y di tu gasto o páginas leídas para que el Game Master te responda.</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h4 className="text-xs font-bold text-white mb-1">📲 Atajos de iOS Siri</h4>
              <p className="text-[11px] text-slate-400">Descarga el archivo `.shortcut` preconfigurado con tu API Key personal.</p>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          7. CTA FINAL & ACCESO
         ===================================================================== */}
      <section className="border-t border-slate-800/80 bg-gradient-to-b from-slate-950 to-[#070b14] px-4 py-20 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <span className="text-4xl">🏆</span>
          <h2 className="text-3xl font-black text-white sm:text-4xl">
            ¿Listo para Despertar a tu Aventurero?
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Comienza hoy tu camino hacia la libertad financiera, el enfoque inquebrantable y el dominio de tus habilidades.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              href="/login?mode=signup"
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-8 py-3.5 text-sm font-extrabold text-white shadow-xl shadow-emerald-950/60 hover:brightness-110 transition cursor-pointer"
            >
              🚀 Crear Cuenta Gratis
            </Link>
            <Link
              href="/login"
              className="rounded-2xl border border-slate-700 bg-slate-800/90 hover:bg-slate-700 px-6 py-3.5 text-sm font-bold text-slate-200 transition cursor-pointer"
            >
              🔑 Iniciar Sesión (Entrar)
            </Link>
          </div>

          <div className="pt-8 border-t border-slate-800/60 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
            <a
              href="https://github.com/isacarlope13/rpg-life-engine/blob/main/docs/MANUAL_DE_USUARIO.md"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition"
            >
              📖 Manual de Usuario Completo
            </a>
            <a
              href="https://github.com/isacarlope13/rpg-life-engine/blob/main/docs/GUIA_IPHONE.md"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition"
            >
              📱 Guía iPhone & PWA
            </a>
            <Link href="/quick" className="hover:text-emerald-400 transition">
              ⚡ Modo Móvil 5s
            </Link>
            <Link href="/privacidad" className="hover:text-emerald-400 transition font-semibold text-slate-300">
              🛡️ Política de Tratamiento de Datos (Habeas Data)
            </Link>
            <a
              href="https://rpg-life-engine-production.up.railway.app/api/health"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-400 transition"
            >
              🟢 Estado del Servidor
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
