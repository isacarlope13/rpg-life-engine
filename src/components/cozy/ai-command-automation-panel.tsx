"use client";

import React, { useMemo, useState } from "react";
import { Bot, Check, Play, ShieldAlert, Sparkles, X } from "lucide-react";
import {
  createInitialCommandCenterState,
  enqueueCommandTask,
  getRegisteredAgentCatalog,
  resolveCommandApproval,
  type CommandCenterState,
} from "@/lib/ai/command-center-core";
import {
  DEFAULT_PERSONAL_AUTOMATION_RULES,
  createInitialAutomationState,
  runAutomationCycle,
  type AutomationContextSnapshot,
  type AutomationCoreState,
} from "@/lib/automation/personal-automation-core";
import { CozyButton, CozyProgress } from "@/components/cozy/ui";

interface AiCommandAutomationPanelProps {
  automationContext: AutomationContextSnapshot;
}

export function AiCommandAutomationPanel({
  automationContext,
}: AiCommandAutomationPanelProps) {
  const catalog = useMemo(() => getRegisteredAgentCatalog(), []);
  const [cmdState, setCmdState] = useState<CommandCenterState>(() =>
    createInitialCommandCenterState(20000)
  );
  const [autoState, setAutoState] = useState<AutomationCoreState>(() =>
    createInitialAutomationState()
  );
  const [promptInput, setPromptInput] = useState("");

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptInput.trim()) return;
    const { nextState } = enqueueCommandTask(cmdState, {
      prompt: promptInput,
      deterministic: true,
    });
    setCmdState(nextState);
    setPromptInput("");
  };

  const handleRunAutomations = (simulate: boolean) => {
    const { nextState } = runAutomationCycle(autoState, automationContext, { simulate });
    setAutoState(nextState);
  };

  return (
    <div className="space-y-4">
      {/* AI Command Center */}
      <section className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A2E2B]/10 pb-2">
          <h3 className="text-sm font-black uppercase text-[#3A2E2B] flex items-center gap-2">
            <Bot className="h-4 w-4 text-[#314C3C]" />
            AI Command Center ({catalog.length} especialistas activos)
          </h3>
          <div className="w-44">
            <CozyProgress
              value={cmdState.tokensUsedToday}
              max={cmdState.tokenBudgetDaily}
              label="Presupuesto tokens"
              size="sm"
              variant="forest"
            />
          </div>
        </div>

        <form onSubmit={handleDispatch} className="flex gap-2">
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="Ej. Revisa mi patrón de Filet Crochet o reorganiza mis tareas..."
            className="flex-1 rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-2 text-xs font-bold text-[#3A2E2B]"
          />
          <CozyButton type="submit" size="sm" variant="forest" icon={<Sparkles className="h-3.5 w-3.5" />}>
            Enrutar
          </CozyButton>
        </form>

        {cmdState.tasks.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {cmdState.tasks.slice(0, 6).map((t) => (
              <div
                key={t.id}
                className="rounded-xl border-2 border-[#3A2E2B]/25 bg-[#F4EEDC]/70 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-black text-[#3A2E2B]">
                    {t.targetAgentName} · {t.status}
                  </span>
                  <p className="text-[11px] text-[#5C381E]">{t.resultSummary}</p>
                </div>
                {t.status === "pending_approval" && (
                  <div className="flex items-center gap-1">
                    <CozyButton
                      size="sm"
                      variant="forest"
                      onClick={() => setCmdState((s) => resolveCommandApproval(s, t.id, "approve"))}
                      icon={<Check className="h-3 w-3" />}
                    >
                      Aprobar
                    </CozyButton>
                    <CozyButton
                      size="sm"
                      variant="clay"
                      onClick={() => setCmdState((s) => resolveCommandApproval(s, t.id, "reject"))}
                      icon={<X className="h-3 w-3" />}
                    >
                      Rechazar
                    </CozyButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Automation Core */}
      <section className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_6px_0_#3A2E2B] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#3A2E2B]/10 pb-2">
          <h3 className="text-sm font-black uppercase text-[#3A2E2B]">
            Automation Core ({DEFAULT_PERSONAL_AUTOMATION_RULES.length} reglas personales)
          </h3>
          <div className="flex flex-wrap items-center gap-1.5">
            <CozyButton
              size="sm"
              variant="sunlight"
              onClick={() => handleRunAutomations(true)}
              icon={<Play className="h-3 w-3" />}
            >
              Simular (Dry-Run)
            </CozyButton>
            <CozyButton
              size="sm"
              variant="forest"
              disabled={autoState.emergencyStop}
              onClick={() => handleRunAutomations(false)}
            >
              Ejecutar ciclo
            </CozyButton>
            <CozyButton
              size="sm"
              variant={autoState.emergencyStop ? "clay" : "cream"}
              onClick={() =>
                setAutoState((s) => ({ ...s, emergencyStop: !s.emergencyStop }))
              }
              icon={<ShieldAlert className="h-3.5 w-3.5" />}
            >
              {autoState.emergencyStop ? "Emergencia: ACTIVA" : "Interruptor emergencia"}
            </CozyButton>
          </div>
        </div>

        {autoState.history.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {autoState.history.slice(0, 8).map((rec) => (
              <div
                key={rec.id}
                className="rounded-xl border border-[#3A2E2B]/25 bg-[#F7F4EB] p-2.5 text-[11px]"
              >
                <span className="font-black text-[#3A2E2B]">
                  [{rec.status}] {rec.ruleName}
                </span>
                <p className="text-[#5C381E] mt-0.5">{rec.proposal}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
