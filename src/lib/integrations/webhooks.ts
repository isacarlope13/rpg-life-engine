import { createHmac } from "crypto";
import type {
  IWebhookNotificationAdapter,
  WebhookNotificationPayload,
} from "./types.ts";
import { AutomationEventBus, defaultEventBus } from "../automation/event-bus.ts";

/**
 * WebhookNotificationAdapter: Adaptador de webhooks salientes con firma criptográfica HMAC
 * para notificar a Discord, Telegram o plataformas de automatización (Make, n8n, Zapier).
 */
export class WebhookNotificationAdapter implements IWebhookNotificationAdapter {
  /**
   * Envía una notificación HTTP POST con firma HMAC SHA-256.
   */
  public async dispatchNotification(
    targetUrl: string,
    payload: WebhookNotificationPayload,
    secretKey?: string
  ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const rawBody = JSON.stringify(payload);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "RPG-Life-Engine-Webhook/3.5",
    };

    if (secretKey) {
      const signature = createHmac("sha256", secretKey).update(rawBody).digest("hex");
      headers["x-rpg-signature"] = signature;
      payload.signature = signature;
    }

    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      return {
        success: response.ok,
        statusCode: response.status,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: msg,
      };
    }
  }

  /**
   * Conecta el adaptador con el EventBus para emitir alertas automáticamente.
   */
  public attachToEventBus(
    eventBus: AutomationEventBus = defaultEventBus,
    targetUrl: string,
    secretKey?: string
  ): () => void {
    const unsub1 = eventBus.on("STREAK_AT_RISK", async (e) => {
      await this.dispatchNotification(
        targetUrl,
        {
          eventType: "STREAK_AT_RISK",
          title: "🔥 ¡Racha Diaria en Riesgo!",
          message: `Tu racha de ${e.payload.streakDays} días está en riesgo. Faltan ${e.payload.hoursUntilMidnight} horas para la medianoche.`,
          urgency: "critical",
          timestamp: e.timestamp,
          data: e.payload,
        },
        secretKey
      );
    });

    const unsub2 = eventBus.on("BOSS_ENRAGE_WARNING", async (e) => {
      await this.dispatchNotification(
        targetUrl,
        {
          eventType: "BOSS_ENRAGE_WARNING",
          title: "⚠️ ¡Jefe de Deuda en Alerta de Enrage!",
          message: `El jefe "${e.payload.bossName}" vencerá en ${e.payload.hoursRemaining}h. Realiza un abono para evitar penalizaciones.`,
          urgency: "critical",
          timestamp: e.timestamp,
          data: e.payload,
        },
        secretKey
      );
    });

    return () => {
      unsub1();
      unsub2();
    };
  }
}

export const defaultWebhookNotificationAdapter = new WebhookNotificationAdapter();
