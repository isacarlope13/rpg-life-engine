import type {
  ActionCategory,
  ApprovalRequest,
  InvariantValidationResult,
  SystemEvent,
} from "../automation/types.ts";

export type AgentRoleCode =
  | "autonomous_life_manager"
  | "system_guardian"
  | "life_capture"
  | "life_analyst"
  | "daily_planner"
  | "goal_predictor"
  | "dynamic_quest_generator"
  | "smart_expense"
  | "economic_intelligence"
  | "skill_evolution"
  | "reward_optimizer";

export type AgentOperationalStatus = "idle" | "evaluating" | "executing" | "waiting_user" | "alert";

export interface AgentState {
  code: AgentRoleCode;
  name: string;
  role: string;
  status: AgentOperationalStatus;
  lastHeartbeat: string;
  confidenceScore: number; // 0.0 - 1.0
  workingMemory: Record<string, unknown>;
  permissions: {
    canMutateState: boolean;
    allowedCategories: ActionCategory[];
    maxAutonomousFinancialLimitCop: number;
  };
}

export interface AgentExecutionProposal {
  agentCode: AgentRoleCode;
  userId: string;
  category: ActionCategory;
  actionName: string;
  rationale: string;
  payload: Record<string, unknown>;
  correlationId?: string;
}

export interface AgentExecutionOutcome {
  executed: boolean;
  requiresApproval: boolean;
  approvalRequest?: ApprovalRequest;
  result?: Record<string, unknown>;
  reason?: string;
  violationCode?: string;
}
