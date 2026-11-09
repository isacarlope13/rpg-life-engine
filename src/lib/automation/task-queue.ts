import type { AutomationTask, SystemEvent, TaskStatus } from "./types.ts";

export interface EnqueueTaskParams {
  userId: string;
  idempotencyKey: string;
  event: SystemEvent;
  targetAgent: string;
  maxRetries?: number;
  backoffMs?: number;
}

export type TaskWorker = (
  task: AutomationTask
) => Promise<Record<string, unknown> | void>;

/**
 * TaskQueue: Cola de tareas asíncronas con Idempotencia, Reintentos Exponenciales
 * y Dead-Letter Queue para el Automation Core.
 */
export class AutomationTaskQueue {
  private tasks = new Map<string, AutomationTask>(); // Clave: taskId
  private idempotencyIndex = new Map<string, string>(); // Clave: idempotencyKey -> taskId
  private workers = new Map<string, TaskWorker>(); // Clave: targetAgent -> worker

  /**
   * Registra un worker especializado para un agente objetivo.
   */
  public registerWorker(agentCode: string, worker: TaskWorker): void {
    this.workers.set(agentCode, worker);
  }

  /**
   * Encola una tarea validando idempotencia. Si la clave de idempotencia ya fue
   * procesada o está en progreso, retorna la tarea existente sin duplicar ejecución.
   */
  public enqueue(params: EnqueueTaskParams): {
    task: AutomationTask;
    isDuplicate: boolean;
  } {
    const existingTaskId = this.idempotencyIndex.get(params.idempotencyKey);
    if (existingTaskId) {
      const existingTask = this.tasks.get(existingTaskId);
      if (existingTask) {
        return { task: existingTask, isDuplicate: true };
      }
    }

    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const nowIso = new Date().toISOString();

    const task: AutomationTask = {
      id: taskId,
      userId: params.userId,
      idempotencyKey: params.idempotencyKey,
      eventType: params.event.type,
      event: params.event,
      targetAgent: params.targetAgent,
      status: "pending",
      retries: 0,
      maxRetries: params.maxRetries ?? 3,
      backoffMs: params.backoffMs ?? 200,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.tasks.set(taskId, task);
    this.idempotencyIndex.set(params.idempotencyKey, taskId);

    return { task, isDuplicate: false };
  }

  /**
   * Procesa la siguiente tarea pendiente o una tarea específica por ID.
   */
  public async processTask(taskId: string): Promise<AutomationTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Tarea con ID ${taskId} no encontrada en la cola.`);
    }

    if (task.status === "completed" || task.status === "dead_letter") {
      return task;
    }

    const worker = this.workers.get(task.targetAgent);
    if (!worker) {
      task.status = "failed";
      task.error = `No hay worker registrado para el agente: ${task.targetAgent}`;
      task.updatedAt = new Date().toISOString();
      return task;
    }

    task.status = "processing";
    task.updatedAt = new Date().toISOString();

    try {
      const output = await worker(task);
      task.status = "completed";
      task.result = output || { success: true };
      task.executedAt = new Date().toISOString();
      task.updatedAt = task.executedAt;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      task.retries += 1;
      task.error = errMsg;

      if (task.retries >= task.maxRetries) {
        task.status = "dead_letter";
      } else {
        task.status = "pending"; // Elegible para reintento tras backoff
      }
      task.updatedAt = new Date().toISOString();
    }

    return task;
  }

  /**
   * Obtiene una tarea por su clave de idempotencia o ID.
   */
  public getByIdempotencyKey(key: string): AutomationTask | null {
    const taskId = this.idempotencyIndex.get(key);
    return taskId ? this.tasks.get(taskId) || null : null;
  }

  public getTask(taskId: string): AutomationTask | null {
    return this.tasks.get(taskId) || null;
  }

  public getAllTasks(userId?: string): AutomationTask[] {
    const list = Array.from(this.tasks.values());
    if (userId) {
      return list.filter((t) => t.userId === userId);
    }
    return list;
  }

  public clear(): void {
    this.tasks.clear();
    this.idempotencyIndex.clear();
    this.workers.clear();
  }
}

// Singleton global de TaskQueue
const globalForQueue = globalThis as unknown as {
  rpgTaskQueue?: AutomationTaskQueue;
};

export const defaultTaskQueue =
  globalForQueue.rpgTaskQueue ?? new AutomationTaskQueue();

if (process.env.NODE_ENV !== "production") {
  globalForQueue.rpgTaskQueue = defaultTaskQueue;
}
