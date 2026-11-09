"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  Zap,
  Mic,
  Send,
  Shield,
  Flame,
  Wallet,
  Swords,
  Smartphone,
  Copy,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  Volume2,
  PlusCircle,
} from "lucide-react";

interface QuickEngineState {
  user?: {
    display_name: string;
    character_class: string;
    shortcut_api_key?: string;
  };
  currency?: string;
  player_level: number;
  current_streak_days: number;
  streak_multiplier: number;
  aegis_shields: number;
  wallet_gp: number;
  vault_remaining_gp: number;
  vault_cap_gp: number;
  bosses: Array<{
    id: string;
    name: string;
    current_hp: number;
    max_hp: number;
    interest_rate_ea: number;
    min_monthly_payment_cop: number;
  }>;
  user_skills?: Array<{
    domain: string;
    label: string;
    weekly_target_minutes: number;
  }>;
  recent_logs?: Array<{
    id: string;
    title: string;
    subtitle: string;
    gp_delta: number;
    timestamp: string;
  }>;
}

const PRESET_EXPENSE_BUTTONS = [
  {
    emoji: "🍽️",
    label: "Almuerzo Diario",
    command: "Almuerzo diario 26000",
    amount: 26000,
    tag: "Operativo",
    color: "border-emerald-500/30 bg-emerald-950/20 text-emerald-200",
  },
  {
    emoji: "🚗",
    label: "Uber Sede / Casa",
    command: "Transporte Uber sede 9000",
    amount: 9000,
    tag: "Operativo",
    color: "border-emerald-500/30 bg-emerald-950/20 text-emerald-200",
  },
  {
    emoji: "🅿️",
    label: "Parqueadero Uni",
    command: "Transporte Parqueadero universidad 4000",
    amount: 4000,
    tag: "Operativo",
    color: "border-emerald-500/30 bg-emerald-950/20 text-emerald-200",
  },
  {
    emoji: "⚔️",
    label: "Cuota ADDI",
    command: "Pagué cuota deuda ADDI 100000",
    amount: 100000,
    tag: "Ataque Boss",
    color: "border-rose-500/40 bg-rose-950/25 text-rose-200",
  },
  {
    emoji: "⚔️",
    label: "Cuota Nequi",
    command: "Pagué cuota deuda Nequi 56000",
    amount: 56000,
    tag: "Ataque Boss",
    color: "border-rose-500/40 bg-rose-950/25 text-rose-200",
  },
  {
    emoji: "🍗",
    label: "Alitas / Plan Chicas",
    command: "Salida Alitas con amigas 36000",
    amount: 36000,
    tag: "Bóveda GP",
    color: "border-amber-500/30 bg-amber-950/20 text-amber-200",
  },
  {
    emoji: "🧶",
    label: "Hilos / Cubos / Libros",
    command: "Compra Hobby Cubos Libros Hilos 50000",
    amount: 50000,
    tag: "Bóveda GP",
    color: "border-amber-500/30 bg-amber-950/20 text-amber-200",
  },
  {
    emoji: "💊",
    label: "Pastillas / Salud Fija",
    command: "Pago Pastillas salud fija 180000",
    amount: 180000,
    tag: "Costo Fijo",
    color: "border-indigo-500/30 bg-indigo-950/20 text-indigo-200",
  },
];

const QUICK_HABIT_BUTTONS = [
  {
    emoji: "🧩",
    label: "Cubos (25m)",
    command: "Armé cubo de rubik 25 minutos",
  },
  {
    emoji: "📚",
    label: "Lectura (+20 págs)",
    command: "Leí 20 páginas en 30 minutos",
  },
  {
    emoji: "🧶",
    label: "Tejido (+8 vueltas)",
    command: "Tejí 8 vueltas de crochet en 35 minutos",
  },
  {
    emoji: "🎓",
    label: "Estudio (50m)",
    command: "Estudié 50 minutos pomodoro",
  },
  {
    emoji: "💻",
    label: "Deep Work (60m)",
    command: "Trabajé 60 minutos en entregable clave",
  },
  {
    emoji: "🎮",
    label: "Gaming (40m)",
    command: "Jugué 40 minutos de videojuegos consciente",
  },
  {
    emoji: "🏅",
    label: "Gimnasio / Deporte",
    command: "Entrené 50 minutos en el gimnasio",
  },
];

export default function MobileQuickActionPage() {
  const [state, setState] = useState<QuickEngineState | null>(null);
  const [omniInput, setOmniInput] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customConcept, setCustomConcept] = useState("");
  const [customType, setCustomType] = useState<
    "operativo" | "boveda" | "fijo" | "deuda"
  >("operativo");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [ttsReply, setTtsReply] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [widgetCode, setWidgetCode] = useState<string>("");

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {
      // mantener estado previo
    }
  }, []);

  useEffect(() => {
    fetchState();
    fetch("/api/shortcuts/widget-summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.ios_scriptable_widget_code) {
          setWidgetCode(d.ios_scriptable_widget_code);
        }
      })
      .catch(() => null);
  }, [fetchState]);

  const executeOmniCommand = async (commandText: string) => {
    if (!commandText.trim() || busy) return;
    setBusy(true);
    setTtsReply(null);
    try {
      const res = await fetch("/api/shortcuts/omni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: commandText.trim(),
          use_aegis_shield: true,
        }),
      });
      const data = await res.json();
      if (data.shortcut_tts_message) {
        setTtsReply(data.shortcut_tts_message);
      } else if (data.error) {
        setTtsReply(`⚠️ ${data.error}`);
      }
      setOmniInput("");
      await fetchState();
    } finally {
      setBusy(false);
    }
  };

  const handleCustomQuickExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(customAmount);
    if (!amt || amt <= 0) return;
    const concept = customConcept.trim() || "Movimiento rápido";
    const prefix =
      customType === "deuda"
        ? `Pagué cuota deuda ${ state?.bosses?.[0]?.name || "ADDI" } ${amt} ${concept}`
        : customType === "fijo"
        ? `Pago internet costo fijo ${concept} ${amt}`
        : customType === "operativo"
        ? `Almuerzo transporte operativo ${concept} ${amt}`
        : `Salida antojo ${concept} ${amt}`;
    await executeOmniCommand(prefix);
    setCustomAmount("");
    setCustomConcept("");
  };

  const startVoiceDictation = () => {
    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setTtsReply(
        "ℹ️ En tu celular, toca el micrófono del teclado para dictar en 2 segundos."
      );
      return;
    }

    try {
      const recognition = new SpeechRecognitionCtor() as {
        lang: string;
        interimResults: boolean;
        maxAlternatives: number;
        onstart: () => void;
        onend: () => void;
        onresult: (event: {
          results: ArrayLike<ArrayLike<{ transcript: string }>>;
        }) => void;
        start: () => void;
      };
      recognition.lang = "es-CO";
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onstart = () => setListening(true);
      recognition.onend = () => setListening(false);
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript || "";
        if (transcript) {
          setOmniInput(transcript);
          executeOmniCommand(transcript);
        }
      };
      recognition.start();
    } catch {
      setListening(false);
    }
  };

  const copyText = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const fmt = (n: number | undefined) =>
    (Number(n) || 0).toLocaleString("es-CO");

  const activeBoss =
    state?.bosses?.find((b) => b.current_hp > 0) || state?.bosses?.[0] || null;

  const originUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : getAppBaseUrl();

  const userApiKey = state?.user?.shortcut_api_key?.trim();
  const apiKey = userApiKey || "TU_TOKEN_PERSONAL";
  const hasConfiguredApiKey = Boolean(userApiKey);

  return (
    <div className="min-h-screen bg-[#070b14] px-3 py-5 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        {/* BARRA SUPERIOR MÓVIL */}
        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/90 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-sm font-extrabold text-white">
                Modo Bolsillo · 5 Segundos
              </h1>
              <p className="text-[11px] text-slate-400">
                {state?.user?.display_name || "Aventurero"} · NVL{" "}
                {state?.player_level ?? 1}
              </p>
            </div>
          </div>
          <a
            href="/dashboard"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard Completo
          </a>
        </div>

        {/* MINI-HUD EN VIVO (BILLETERA, BÓVEDA, RACHA Y BOSS) */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-400">
              <Wallet className="h-3.5 w-3.5" /> Billetera GP
            </div>
            <p className="mt-1 text-base font-extrabold text-white">
              ${fmt(state?.wallet_gp)}
            </p>
            <p className="text-[10px] text-slate-400">
              Bóveda: ${fmt(state?.vault_remaining_gp)}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-400">
              <Flame className="h-3.5 w-3.5" /> Racha & Aegis
            </div>
            <p className="mt-1 text-base font-extrabold text-white">
              {state?.current_streak_days ?? 2}d ({state?.streak_multiplier ?? 1}x)
            </p>
            <p className="flex items-center gap-1 text-[10px] text-cyan-300">
              <Shield className="h-3 w-3" /> {state?.aegis_shields ?? 1} Escudo(s)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-3">
            <div className="flex items-center gap-1 text-[10px] font-bold uppercase text-rose-400">
              <Swords className="h-3.5 w-3.5" />{" "}
              {activeBoss ? activeBoss.name : "Modo Ahorro"}
            </div>
            <p className="mt-1 text-base font-extrabold text-white">
              {activeBoss ? `$${fmt(activeBoss.current_hp)}` : "Libre"}
            </p>
            <p className="text-[10px] text-slate-400">
              {activeBoss
                ? `Cuota $${fmt(activeBoss.min_monthly_payment_cop)}`
                : "0 deudas"}
            </p>
          </div>
        </div>

        {/* RESPUESTA DEL GAME MASTER / SIRI TTS */}
        {ttsReply && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-500/40 bg-emerald-950/30 p-3.5 text-xs text-emerald-200">
            <Volume2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            <div className="flex-1">
              <p className="font-bold text-white">Respuesta en Vivo:</p>
              <p className="mt-0.5">{ttsReply}</p>
            </div>
          </div>
        )}

        {/* 1. BARRA OMNICANAL IA (VOZ, WHATSAPP, SMS O TEXTO EN 3 SEGUNDOS) */}
        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" /> Comando Omnicanal (Gasto o
              Hábito)
            </span>
            <span className="text-[10px] text-slate-400">
              Voz · Texto · SMS Bancario
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-300">
            Escribe o dicta cualquier cosa:{" "}
            <span className="text-emerald-300">&quot;Almuerzo 26 mil&quot;</span>,{" "}
            <span className="text-rose-300">&quot;Pagué 100 mil de Addi&quot;</span> o{" "}
            <span className="text-amber-300">&quot;Leí 25 páginas&quot;</span>.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeOmniCommand(omniInput);
            }}
            className="mt-2.5 flex gap-2"
          >
            <input
              type="text"
              value={omniInput}
              onChange={(e) => setOmniInput(e.target.value)}
              placeholder="Ej: Uber sede 9000  ó  Tejí 10 vueltas..."
              className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={startVoiceDictation}
              title="Dictar por voz"
              className={`flex items-center justify-center rounded-xl border px-3 transition ${
                listening
                  ? " animate-pulse border-rose-500 bg-rose-500/20 text-rose-300"
                  : "border-slate-700 bg-slate-900 text-slate-300 hover:border-indigo-400"
              }`}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              type="submit"
              disabled={busy || !omniInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* 2. BOTONES DE 1-TOQUE: TUS GASTOS FRECUENTES DEL CSV */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            ⚡ 1-Toque · Tus Movimientos Frecuentes (Sep–Nov CSV)
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Toca un botón para registrarlo al instante en la categoría correcta:
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {PRESET_EXPENSE_BUTTONS.map((btn) => (
              <button
                key={btn.label}
                type="button"
                disabled={busy}
                onClick={() => executeOmniCommand(btn.command)}
                className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition hover:brightness-110 disabled:opacity-40 ${btn.color}`}
              >
                <div>
                  <p className="text-xs font-bold">
                    {btn.emoji} {btn.label}
                  </p>
                  <p className="text-[10px] opacity-80">
                    ${btn.amount.toLocaleString("es-CO")} · {btn.tag}
                  </p>
                </div>
                <PlusCircle className="h-4 w-4 shrink-0 opacity-75" />
              </button>
            ))}
          </div>

          {/* FORMULARIO RÁPIDO CON MONTO PERSONALIZADO */}
          <form
            onSubmit={handleCustomQuickExpense}
            className="mt-3 grid grid-cols-12 gap-2 border-t border-slate-800 pt-3"
          >
            <input
              type="number"
              min={100}
              placeholder="Monto $"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              className="col-span-4 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Descripción (ej. Desayuno)"
              value={customConcept}
              onChange={(e) => setCustomConcept(e.target.value)}
              className="col-span-4 rounded-xl border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white"
            />
            <select
              value={customType}
              onChange={(e) =>
                setCustomType(
                  e.target.value as "operativo" | "boveda" | "fijo" | "deuda"
                )
              }
              className="col-span-2 rounded-xl border border-slate-700 bg-slate-950 px-1.5 py-2 text-[11px] text-slate-200"
            >
              <option value="operativo">Operativo</option>
              <option value="boveda">Bóveda</option>
              <option value="deuda">Deuda</option>
              <option value="fijo">Fijo</option>
            </select>
            <button
              type="submit"
              disabled={busy || !customAmount}
              className="col-span-2 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
            >
              +
            </button>
          </form>
        </div>

        {/* 3. BOTONES DE 1-TOQUE: REGISTRAR HÁBITO Y LIBERAR GP EN 3 SEGUNDOS */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
            🔥 1-Toque · Completar Sesión de Hábito (Desbloquea GP)
          </h2>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {QUICK_HABIT_BUTTONS.map((hb) => (
              <button
                key={hb.label}
                type="button"
                disabled={busy}
                onClick={() => executeOmniCommand(hb.command)}
                className="rounded-xl border border-emerald-500/30 bg-emerald-950/25 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-900/40 disabled:opacity-40"
              >
                {hb.emoji} {hb.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. GUÍA DE AUTOMATIZACIÓN EN IPHONE (ATAJOS DE iOS / APPLE PAY / SIRI / WHATSAPP) */}
        <div className="space-y-3 rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-4">
          <div className="flex items-center gap-2 text-cyan-300">
            <Smartphone className="h-4 w-4" />
            <h2 className="text-xs font-bold uppercase tracking-wider">
              Conectar con tu Celular (Atajos de iOS, Siri, Apple Pay & Widget)
            </h2>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
            <p className="font-bold text-white">
              Opción A · Instalar como App de 1 Toque en tu Pantalla de Inicio
              (Sin configurar nada)
            </p>
            <p className="text-[11px] text-slate-300">
              Abre <strong>{originUrl}/quick</strong> en Safari (iPhone) o
              Chrome (Android) $\rightarrow$ toca <strong>Compartir</strong>{" "}
              $\rightarrow$ <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
              Tendrás este panel en tu celular para registrar gastos o hábitos
              en 3 segundos.
            </p>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-white">
                  Opción B · Atajo de iOS Automático (SMS Bancolombia/Nequi, Apple
                  Pay o &quot;Oye Siri&quot;)
                </p>
                {!hasConfiguredApiKey && (
                  <p className="text-[10px] text-amber-400">
                    ⚠️ Token no detectado. Configura tu token personal en Perfil para máxima seguridad.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!hasConfiguredApiKey) {
                    alert("Para vincular Atajos de iOS, dirígete a tu Perfil en el Dashboard y genera o copia tu token personal secreto.");
                    return;
                  }
                  copyText("token", apiKey);
                }}
                className="inline-flex items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/30"
              >
                {copiedKey === "token" ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Copiado
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> {hasConfiguredApiKey ? "Copiar Token Personal" : "Configurar Token"}
                  </>
                )}
              </button>
            </div>
            <ol className="list-inside list-decimal space-y-1 text-[11px] text-slate-300">
              <li>
                En la app <strong>Atajos (Shortcuts)</strong> de tu iPhone, crea
                un Atajo o una Automatización (<em>&quot;Cuando recibo un mensaje de Bancolombia/Nequi&quot;</em> o <em>&quot;Dictar texto&quot;</em>).
              </li>
              <li>
                Añade la acción <strong>&quot;Obtener contenido de URL&quot;</strong> apuntando a:{" "}
                <code className="rounded bg-slate-900 px-1.5 py-0.5 text-cyan-300">
                  {originUrl}/api/shortcuts/omni
                </code>
              </li>
              <li>
                Método: <strong>POST</strong> · Encabezado:{" "}
                <code className="rounded bg-slate-900 px-1 text-amber-300">
                  x-api-key: {hasConfiguredApiKey ? apiKey : "TU_TOKEN_PERSONAL_DEL_PERFIL"}
                </code>{" "}
                · Cuerpo JSON:{" "}
                <code className="rounded bg-slate-900 px-1 text-emerald-300">
                  {`{"text": "Texto del SMS o Dictado"}`}
                </code>
              </li>
              <li>
                Añade la acción <strong>&quot;Leer texto con voz&quot;</strong> tomando el campo{" "}
                <code className="text-emerald-300">shortcut_tts_message</code>{" "}
                para que Siri te confirme cuántos GP te quedan.
              </li>
            </ol>
          </div>

          {widgetCode && (
            <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="font-bold text-white">
                  Opción C · Widget en Pantalla de Inicio (App Scriptable iOS)
                </p>
                <button
                  type="button"
                  onClick={() => copyText("widget", widgetCode)}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200"
                >
                  {copiedKey === "widget" ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Código Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar Script del Widget
                    </>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                Muestra tu Nivel, Billetera GP, Racha y la vida restante de ADDI
                / Nequi siempre visible en la pantalla de tu iPhone.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
