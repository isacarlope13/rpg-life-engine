"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  Bot,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  Send,
  Database,
  Search,
  Activity,
  AlertTriangle,
  RefreshCw,
  Sun,
  Moon,
  Briefcase,
  Coffee,
} from "lucide-react";
import {
  defaultAutonomousLifeManager,
  defaultLifeCaptureAgent,
  defaultSmartExpenseEngine,
  defaultDailyPlannerAgent,
  defaultDynamicQuestGenerator,
} from "@/lib/agents/index";
import {
  defaultApprovalGateway,
  defaultAuditLogger,
  defaultCircadianScheduler,
} from "@/lib/automation/index";
import type { ApprovalRequest, SystemAuditLogEntry } from "@/lib/automation/types";
import type { AgentState } from "@/lib/agents/types";

interface AICommandCenterProps {
  userId?: string;
  currentStreak?: number;
  wakeUpTime?: string;
  sleepTime?: string;
  workStartHour?: string;
  workEndHour?: string;
}

export function AICommandCenter({
  userId = "usr_pilot_master",
  currentStreak = 7,
  wakeUpTime = "06:00",
  sleepTime = "22:30",
  workStartHour = "08:00",
  workEndHour = "17:30",
}: AICommandCenterProps) {
  // Estado local para interacción reactiva
  const [agents, setAgents] = useState<AgentState[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<SystemAuditLogEntry[]>([]);
  const [naturalInput, setNaturalInput] = useState("");
  const [isProcessingInput, setIsProcessingInput] = useState(false);
  const [lastNormalized, setLastNormalized] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [circadianPhase, setCircadianPhase] = useState<string>("evening_sanctuary");

  // Carga inicial y sincronización con los singletons en memoria
  const refreshState = () => {
    const council = defaultAutonomousLifeManager.getCouncilStatus(userId);
    setAgents(council.agents);

    const pending = defaultApprovalGateway.getPendingRequests(userId);
    setPendingApprovals([...pending]);

    const logs = defaultAuditLogger.getRecentLogs(userId, 15);
    setAuditLogs([...logs]);

    const now = new Date();
    const timeStr = now.toTimeString().slice(0, 5);
    const phase = defaultCircadianScheduler.getCircadianPhase(
      timeStr,
      wakeUpTime,
      workStartHour,
      workEndHour,
      sleepTime
    );
    setCircadianPhase(phase);
  };

  useEffect(() => {
    refreshState();

    // Si no hay solicitudes iniciales para probar la UI, generamos una propuesta didáctica
    const currentPending = defaultApprovalGateway.getPendingRequests(userId);
    if (currentPending.length === 0) {
      defaultApprovalGateway.createRequest({
        userId,
        agentSource: "smart_expense",
        actionCategory: "financial_rebalance",
        title: "Rebalanceo por Detección de Fugas Hormiga",
        summaryRationale:
          "Se detectaron 5 compras menores (< $15.000 COP) acumulando $54.500 COP esta semana. Se sugiere transferir $25.000 COP a la Bóveda de Ahorro para mitigar la fuga.",
        diffPayload: {
          current: { variable_ops: 80000, vault_savings: 300000 },
          proposed: { variable_ops: 55000, vault_savings: 325000, amountCop: 25000 },
        },
        expiresAt: new Date(Date.now() + 48 * 3600000).toISOString(),
      });
      refreshState();
    }
  }, [userId, wakeUpTime, sleepTime, workStartHour, workEndHour]);

  // Manejo de Ingesta en Lenguaje Natural con LifeCaptureAgent
  const handleIngestNaturalInput = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!naturalInput.trim()) return;

    setIsProcessingInput(true);
    try {
      const outcome = await defaultLifeCaptureAgent.ingestAndDispatch({
        userId,
        rawText: naturalInput.trim(),
        source: "command_bar",
      });

      setLastNormalized(outcome.normalized);
      setNaturalInput("");
      setToastMessage(
        `⚡ Evento tipado emitido: ${outcome.normalized.eventType} (Confianza: ${Math.round(
          outcome.normalized.confidence * 100
        )}%)`
      );

      // Si el evento fue un gasto grande simulado, el SystemGuardian generará una solicitud HITL
      if (
        outcome.normalized.eventType === "EXPENSE_RECORDED" &&
        Number(outcome.normalized.data.amountCop || 0) >= 20000
      ) {
        await defaultSmartExpenseEngine.proposeRebalance({
          userId,
          amountCop: Number(outcome.normalized.data.amountCop),
          fromBucket: "variable_ops",
          toBucket: "vault_savings",
          rationale: `Gasto significativo detectado: "${outcome.normalized.title}". Sugerencia de salvaguarda presupuestal.`,
          mutationExecutor: async () => ({ recorded: true }),
        });
      }

      refreshState();
      setTimeout(() => setToastMessage(null), 4500);
    } finally {
      setIsProcessingInput(false);
    }
  };

  // Resolución de Solicitud Humana (Aprobar / Rechazar)
  const handleResolveApproval = (
    requestId: string,
    status: "approved" | "rejected"
  ) => {
    try {
      defaultApprovalGateway.resolveRequest(requestId, status, "user");
      defaultAuditLogger.logAction({
        userId,
        actorType: "user",
        actorId: "human_operator",
        actionName: `HITL_MANUAL_RESOLUTION:${status.toUpperCase()}`,
        resourceAffected: "approval_requests",
        previousState: { requestId, status: "pending" },
        newState: { requestId, status },
      });

      setToastMessage(
        status === "approved"
          ? "✅ Propuesta aprobada por el operador humano y registrada en auditoría criptográfica."
          : "🚫 Propuesta rechazada por el operador humano. Parámetros preservados."
      );
      refreshState();
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: unknown) {
      console.error("Error resolviendo aprobación:", err);
    }
  };

  const getPhaseDisplay = (phase: string) => {
    switch (phase) {
      case "morning_window":
        return { label: "Ventana Matutina de Enfoque", icon: "☀️", color: "text-amber-300" };
      case "work_window":
        return { label: "Bloque de Trabajo Principal", icon: "💼", color: "text-blue-300" };
      case "evening_sanctuary":
        return { label: "Santuario Nocturno Libre de Culpa", icon: "🌙", color: "text-emerald-300" };
      default:
        return { label: "Preparación de Sueño & Descanso", icon: "💤", color: "text-indigo-300" };
    }
  };

  const phaseInfo = getPhaseDisplay(circadianPhase);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. HEADER DE COMANDO & HEALTH STATUS */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#161E2E]/80 backdrop-blur-md p-5 shadow-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
              </span>
              <h2 className="text-xl font-black text-[#F1F5F9] tracking-tight">
                AI COMMAND CENTER
              </h2>
              <span className="rounded-full bg-indigo-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-indigo-400 ring-1 ring-indigo-500/30">
                v3.5 AUTÓNOMO
              </span>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Ecosistema Multiagente de Inteligencia Personal • Orquestación, Ingesta en Lenguaje Natural y Firewall Financiero
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-2">
            <div className="rounded-xl border border-white/[0.06] bg-slate-900/90 px-3 py-2 text-center">
              <span className="block text-[10px] font-mono text-[#94A3B8]">Agentes Activos</span>
              <span className="font-mono text-sm font-bold text-emerald-400">11 / 11</span>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-slate-900/90 px-3 py-2 text-center">
              <span className="block text-[10px] font-mono text-[#94A3B8]">Aprobaciones HITL</span>
              <span
                className={`font-mono text-sm font-bold ${
                  pendingApprovals.length > 0 ? "text-amber-400 animate-pulse" : "text-slate-400"
                }`}
              >
                {pendingApprovals.length}
              </span>
            </div>

            <button
              type="button"
              onClick={refreshState}
              className="rounded-xl border border-white/[0.06] bg-slate-900/90 p-2.5 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              title="Refrescar estado del consejo"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notificación Toast si existe */}
        {toastMessage && (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/40 p-3 text-xs font-bold text-emerald-300 flex items-center justify-between animate-in fade-in">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400 shrink-0" />
              {toastMessage}
            </span>
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="text-emerald-400 hover:text-white font-mono"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* 2. INGESTA EN LENGUAJE NATURAL (LIFE CAPTURE AGENT INTERACTIVO) */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#161E2E]/80 backdrop-blur-md p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-indigo-400" />
            <h3 className="font-bold text-sm text-[#F1F5F9]">Life Capture Agent • Ingestor Omnicanal</h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">0 ms latencia • Extracción de Entidades</span>
        </div>

        <form onSubmit={handleIngestNaturalInput} className="flex gap-2">
          <input
            type="text"
            value={naturalInput}
            onChange={(e) => setNaturalInput(e.target.value)}
            placeholder="Escribe libremente: ej. 'Gasté $18.500 en almuerzo', 'cubo 3x3 en 13.8s', 'Leí 30 páginas de Hábitos Atómicos'..."
            className="w-full rounded-xl border border-white/[0.08] bg-slate-950/80 px-3.5 py-2.5 text-xs text-[#F1F5F9] placeholder:text-slate-500 focus:outline-none focus:border-indigo-500/60 transition"
          />
          <button
            type="submit"
            disabled={isProcessingInput || !naturalInput.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:from-indigo-500 hover:to-purple-500 transition cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Ingestar</span>
          </button>
        </form>

        {/* Previsualización del último evento normalizado */}
        {lastNormalized && (
          <div className="mt-3 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 text-xs">
            <div className="flex items-center justify-between text-[11px] font-mono text-indigo-300">
              <span>Intención: {lastNormalized.intent.toUpperCase()}</span>
              <span>Confianza: {Math.round(lastNormalized.confidence * 100)}%</span>
            </div>
            <p className="mt-1 font-bold text-white text-xs">{lastNormalized.title}</p>
            <div className="mt-1.5 text-[10px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded-lg truncate">
              {JSON.stringify(lastNormalized.data)}
            </div>
          </div>
        )}
      </div>

      {/* 3. BANDEJA DE APROBACIONES HUMANAS (HUMAN-IN-THE-LOOP - HITL) */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#161E2E]/80 backdrop-blur-md p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <h3 className="font-bold text-sm text-[#F1F5F9]">
              Bandeja de Aprobaciones Humanas (HITL)
            </h3>
          </div>
          <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-amber-400 ring-1 ring-amber-500/30">
            {pendingApprovals.length} Pendiente{pendingApprovals.length !== 1 ? "s" : ""}
          </span>
        </div>

        {pendingApprovals.length === 0 ? (
          <div className="rounded-xl border border-white/[0.04] bg-slate-950/40 p-6 text-center text-xs text-[#94A3B8]">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="font-bold text-slate-300">Consejo en Equilibrio Óptimo</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Todas las operaciones automáticas operan dentro de los márgenes seguros. Ninguna acción requiere confirmación manual en este momento.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {pendingApprovals.map((req) => (
              <div
                key={req.id}
                className="rounded-xl border border-amber-500/30 bg-slate-950/90 p-4 transition-all hover:border-amber-500/50"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.06] pb-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                      {req.actionCategory.toUpperCase()}
                    </span>
                    <span className="font-bold text-white text-xs">{req.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Origen: {req.agentSource}
                  </span>
                </div>

                <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                  {req.summaryRationale}
                </p>

                {/* Diff visual de la propuesta */}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                  <div className="rounded-lg bg-slate-900/80 p-2 border border-white/[0.04]">
                    <span className="text-slate-400 block mb-1">Estado Actual:</span>
                    <span className="text-slate-300 truncate block">
                      {JSON.stringify(req.diffPayload.current)}
                    </span>
                  </div>
                  <div className="rounded-lg bg-amber-950/20 p-2 border border-amber-500/30">
                    <span className="text-amber-400 block mb-1">Propuesta del Agente:</span>
                    <span className="text-amber-200 truncate block">
                      {JSON.stringify(req.diffPayload.proposed)}
                    </span>
                  </div>
                </div>

                {/* Botones de Acción HITL */}
                <div className="mt-3.5 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleResolveApproval(req.id, "rejected")}
                    className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5 text-rose-400" />
                    <span>Rechazar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveApproval(req.id, "approved")}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                    <span>Aprobar Acción</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. CONSEJO DE 11 AGENTES ESPECIALIZADOS (GRID) */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#161E2E]/80 backdrop-blur-md p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="font-bold text-sm text-[#F1F5F9]">
              Consejo de Agentes Especializados (11 Agentes)
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Principio de Mínimo Privilegio • Firewall Activo
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {agents.map((agent) => (
            <div
              key={agent.code}
              className="rounded-xl border border-white/[0.06] bg-slate-950/70 p-3.5 transition-all hover:border-slate-700 space-y-2"
            >
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-xs text-white truncate">{agent.name}</h4>
                <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {agent.status.toUpperCase()}
                </span>
              </div>

              <p className="text-[11px] text-[#94A3B8] line-clamp-2 leading-relaxed">
                {agent.role}
              </p>

              <div className="flex flex-wrap items-center justify-between gap-1 border-t border-white/[0.04] pt-2 text-[9px] font-mono">
                <span className="text-slate-400">
                  Confianza: <strong className="text-indigo-300">{Math.round(agent.confidenceScore * 100)}%</strong>
                </span>
                <span
                  className={`rounded px-1.5 py-0.2 ${
                    agent.permissions.canMutateState
                      ? "bg-amber-500/15 text-amber-300"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {agent.permissions.canMutateState ? "Mutación Controlada" : "Solo Lectura"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. MONITOR CIRCADIANO & AUDITORÍA CRIPTOGRÁFICA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monitor Circadiano */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#161E2E]/80 backdrop-blur-md p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2">
            <h3 className="font-bold text-sm text-[#F1F5F9] flex items-center gap-2">
              <Clock className="h-4 w-4 text-cyan-400" />
              Monitor Circadiano en Tiempo Real
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">Scheduler Circadiano</span>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-slate-950/80 p-3.5 flex items-center gap-3">
            <span className="text-2xl">{phaseInfo.icon}</span>
            <div>
              <span className={`text-xs font-bold block ${phaseInfo.color}`}>
                {phaseInfo.label}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Vigilia: {wakeUpTime} • Trabajo: {workStartHour}-{workEndHour} • Descanso: {sleepTime}
              </span>
            </div>
          </div>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-[11px] text-slate-300 p-2 rounded-lg bg-slate-950/50">
              <span>Racha Activa:</span>
              <strong className="text-amber-300 font-mono">{currentStreak} días consecutivos</strong>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-300 p-2 rounded-lg bg-slate-950/50">
              <span>Garantía de Sueño Fisiológico:</span>
              <strong className="text-emerald-400 font-mono">Mínimo 6.5h aseguradas</strong>
            </div>
          </div>
        </div>

        {/* Auditoría Criptográfica SHA-256 */}
        <div className="rounded-2xl border border-white/[0.05] bg-[#161E2E]/80 backdrop-blur-md p-5 shadow-xl">
          <div className="mb-3 flex items-center justify-between border-b border-white/[0.06] pb-2">
            <h3 className="font-bold text-sm text-[#F1F5F9] flex items-center gap-2">
              <Database className="h-4 w-4 text-purple-400" />
              Auditoría Criptográfica (SHA-256)
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">No Repudio • Inmutable</span>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-500 font-mono">
              Sin registros de auditoría recientes.
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg bg-slate-950/80 p-2 border border-white/[0.04] text-[10px] space-y-1 font-mono"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="text-purple-300 font-bold">{log.actionName}</span>
                    <span className="text-slate-500">{new Date(log.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-500 truncate" title={log.securityHash}>
                    SHA-256: {log.securityHash}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
