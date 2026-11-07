import { NextResponse } from "next/server";
import { demoStore } from "@/lib/demo-store";
import { requireShortcutUser } from "@/lib/request-auth";

export async function GET(req: Request) {
  const authCtx = await requireShortcutUser(req);
  const store = authCtx.ok ? authCtx.store : demoStore;

  const activeBoss =
    store.bosses.find((b) => b.current_hp > 0) || store.bosses[0] || null;
  const bossHpPct =
    activeBoss && activeBoss.max_hp > 0
      ? Math.round((activeBoss.current_hp / activeBoss.max_hp) * 100)
      : 0;

  const scriptableCode = `// Copia este script en la app gratuita "Scriptable" en iOS
// y agrégalo como Widget en tu Pantalla de Bloqueo o Inicio.
const req = new Request("https://TU-DOMINIO.vercel.app/api/shortcuts/widget-summary");
const data = await req.loadJSON();

const w = new ListWidget();
w.backgroundColor = new Color("#090d16");
w.setPadding(12, 14, 12, 14);

const title = w.addText("⚔️ RPG LIFE-ENGINE • LVL " + data.player_level);
title.font = Font.boldSystemFont(11);
title.textColor = new Color("#34d399");

w.addSpacer(6);
const wallet = w.addText("Billetera: " + data.wallet_gp_formatted + " GP");
wallet.font = Font.heavySystemFont(16);
wallet.textColor = data.wallet_gp < 0 ? new Color("#fb7185") : Color.white();

const streak = w.addText("🔥 Racha " + data.streak_days + "d (" + data.streak_multiplier + "x) • 🛡️ " + data.aegis_shields);
streak.font = Font.mediumSystemFont(11);
streak.textColor = new Color("#94a3b8");

w.addSpacer(6);
const boss = w.addText(data.active_boss.name === "Modo Ahorro" ? "🏦 Modo Ahorro Activo" : "Boss " + data.active_boss.name + ": $" + data.active_boss.hp_formatted + " (" + data.active_boss.hp_pct + "%)");
boss.font = Font.boldSystemFont(11);
boss.textColor = new Color("#f43f5e");

Script.setWidget(w);
Script.complete();`;

  return NextResponse.json({
    player_level: store.player_level,
    wallet_gp: store.wallet_gp,
    wallet_gp_formatted: store.wallet_gp.toLocaleString("es-CO"),
    vault_remaining_gp: store.vault_remaining_gp,
    streak_days: store.current_streak_days,
    streak_multiplier: store.streak_multiplier,
    aegis_shields: store.aegis_shields,
    active_boss: activeBoss
      ? {
          name: activeBoss.name,
          current_hp: activeBoss.current_hp,
          hp_formatted: activeBoss.current_hp.toLocaleString("es-CO"),
          hp_pct: bossHpPct,
          status: activeBoss.status,
        }
      : {
          name: "Modo Ahorro",
          current_hp: 0,
          hp_formatted: "0",
          hp_pct: 0,
          status: "defeated",
        },
    ios_scriptable_widget_code: scriptableCode,
  });
}
