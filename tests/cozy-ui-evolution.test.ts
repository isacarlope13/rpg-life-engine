import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

describe("OAKHAVEN — Evolución Visual Cozy RPG y Accesibilidad", () => {
  test("1. globals.css incluye microinteracciones GPU-aceleradas y respeta prefers-reduced-motion", () => {
    const css = fs.readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
    assert.match(css, /\.cozy-surface-enter/);
    assert.match(css, /\.cozy-card-interactive/);
    assert.match(css, /\.cozy-progress-sheen/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    assert.match(css, /data-ambient-paused="true"/);
  });

  test("2. CozyButton, CozyCard y CozyProgress incluyen focus-visible, aria-busy y protección contra max=0", () => {
    const btn = fs.readFileSync(
      new URL("../src/components/cozy/ui/cozy-button.tsx", import.meta.url),
      "utf8"
    );
    const card = fs.readFileSync(
      new URL("../src/components/cozy/ui/cozy-card.tsx", import.meta.url),
      "utf8"
    );
    const prog = fs.readFileSync(
      new URL("../src/components/cozy/ui/cozy-progress.tsx", import.meta.url),
      "utf8"
    );
    assert.match(btn, /focus-visible:ring-4/);
    assert.match(btn, /aria-busy/);
    assert.match(card, /cozy-card-interactive/);
    assert.match(prog, /safeMax = Number\.isFinite\(max\) && max > 0/);
  });
});
