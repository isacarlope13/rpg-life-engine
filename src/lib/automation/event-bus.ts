import type { SystemEvent, SystemEventType, EventHandler } from "./types.ts";

/**
 * EventBus: Bus de eventos asíncrono y desacoplado para el Automation Core.
 * Permite suscribir manejadores de eventos por tipo y emitir eventos de forma
 * segura con trazabilidad y protección ante fallos de handlers individuales.
 */
export class AutomationEventBus {
  private handlers = new Map<SystemEventType, Set<EventHandler<any>>>();
  private history: SystemEvent[] = [];
  private maxHistory = 100;

  /**
   * Suscribe un handler a un tipo de evento específico.
   * Retorna una función para cancelar la suscripción (unsubscribe).
   */
  public on<T = Record<string, unknown>>(
    type: SystemEventType,
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    const handlersSet = this.handlers.get(type)!;
    handlersSet.add(handler as EventHandler<any>);

    return () => {
      handlersSet.delete(handler as EventHandler<any>);
      if (handlersSet.size === 0) {
        this.handlers.delete(type);
      }
    };
  }

  /**
   * Emite un evento a todos los suscriptores registrados.
   * Los handlers se ejecutan de manera concurrente con Promise.allSettled
   * para asegurar que el fallo de un handler no impida la ejecución de los demás.
   */
  public async emit<T = Record<string, unknown>>(
    event: SystemEvent<T>
  ): Promise<void> {
    // Registrar en historial en memoria
    this.history.unshift(event as SystemEvent<any>);
    if (this.history.length > this.maxHistory) {
      this.history.pop();
    }

    const handlersSet = this.handlers.get(event.type);
    if (!handlersSet || handlersSet.size === 0) {
      return;
    }

    const promises = Array.from(handlersSet).map(async (handler) => {
      try {
        await handler(event);
      } catch (err) {
        console.error(
          `[EventBus Error] Error en handler para evento ${event.type} (ID: ${event.id}):`,
          err
        );
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Obtiene los eventos recientes emitidos en el sistema.
   */
  public getRecentHistory(limit = 20): SystemEvent[] {
    return this.history.slice(0, limit);
  }

  /**
   * Limpia todos los suscriptores e historial (útil en pruebas unitarias).
   */
  public clear(): void {
    this.handlers.clear();
    this.history = [];
  }
}

// Singleton global del EventBus para el ciclo de vida de la aplicación
const globalForAutomation = globalThis as unknown as {
  rpgEventBus?: AutomationEventBus;
};

export const defaultEventBus =
  globalForAutomation.rpgEventBus ?? new AutomationEventBus();

if (process.env.NODE_ENV !== "production") {
  globalForAutomation.rpgEventBus = defaultEventBus;
}
