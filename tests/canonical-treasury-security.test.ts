import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  computeSafeVaultProgressPct,
  resolveCanonicalTreasury,
} from "../src/lib/canonical-treasury.ts";
import { buildSafeTreasuryPatch } from "../src/lib/onboarding/onboarding-persistence.ts";

describe("OAKHAVEN — Fuente Canónica Única de Tesorería y Seguridad", () => {
  test("1. resolveCanonicalTreasury deriva vault_cap_gp seguro cuando estaba en 0 con saldo activo", () => {
    const snap = resolveCanonicalTreasury({
      billing_period: "2026-11",
      wallet_gp: 4000,
      vault_cap_gp: 0,
      vault_remaining_gp: 346000,
      current_xp: 89,
      player_level: 1,
      current_streak_days: 1,
      streak_multiplier: 1,
    });
    assert.equal(snap.wallet_gp, 4000);
    assert.equal(snap.vault_remaining_gp, 346000);
    assert.equal(snap.vault_cap_gp, 350000);
    assert.equal(computeSafeVaultProgressPct(snap.vault_cap_gp, snap.vault_remaining_gp), 1);
  });

  test("2. computeSafeVaultProgressPct nunca produce NaN ni Infinity con vault_cap_gp = 0", () => {
    assert.equal(computeSafeVaultProgressPct(0, 346000), 0);
    assert.equal(computeSafeVaultProgressPct(-100, 500), 0);
    assert.equal(computeSafeVaultProgressPct(400000, 240353), 40);
  });

  test("3. buildSafeTreasuryPatch en modo edit jamás sobreescribe vault_cap_gp a 0 si ya existía bóveda", () => {
    const res = buildSafeTreasuryPatch({
      userId: "00000000-0000-4000-8000-000000000001",
      billingPeriod: "2026-11",
      existingTreasury: {
        vault_cap_gp: 400000,
        vault_remaining_gp: 350000,
        wallet_gp: 55647,
      },
      monthlyIncome: 2415000,
      totalFixed: 846000,
      variableOps: 610000,
      vaultCap: 0,
      debtStrategy: "snowball",
    });
    assert.equal(res.mode, "edit");
    assert.equal(res.patch.vault_cap_gp, 400000);
  });

  test("4. /cozy lee vault_remaining_gp canónico en lugar de vault_gp inexistente", () => {
    const cozySrc = fs.readFileSync(
      new URL("../src/components/cozy-rpg-dashboard.tsx", import.meta.url),
      "utf8"
    );
    assert.match(cozySrc, /state\?\.vault_remaining_gp \?\? state\?\.vault_gp \?\? 0/);
  });
});
