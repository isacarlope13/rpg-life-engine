import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { RPGEngineMemoryStore } from "../src/lib/demo-store.ts";
import {
  readAtelierPatterns,
  saveAtelierPattern,
  type AtelierProjectPattern,
} from "../src/lib/sanctuary/atelier-patterns-store.ts";
import type { SessionStorage } from "../src/lib/sanctuary/session-storage.ts";

function createMemoryStorage(): SessionStorage {
  const map = new Map<string, string>();
  return {
    getItem(k: string) {
      return map.has(k) ? map.get(k)! : null;
    },
    setItem(k: string, v: string) {
      map.set(k, v);
      return true;
    },
  };
}

describe("BLD-008 — Atelier Híbrido (Crochet)", () => {
  test("Soporta los 4 estados de proyecto (in_progress, paused, completed, archived)", () => {
    const store = new RPGEngineMemoryStore();
    const project = store.addKnittingProject({
      name: "Cardigan Otoño",
      technique: "Crochet",
      total_rows_target: 80,
      yarn_details: "Algodón 4mm",
    });

    assert.equal(project.status, "in_progress");

    const paused = store.updateKnittingProjectStatus(project.id, "paused");
    assert.equal(paused?.status, "paused");

    const completed = store.updateKnittingProjectStatus(project.id, "completed");
    assert.equal(completed?.status, "completed");

    const archived = store.updateKnittingProjectStatus(project.id, "archived");
    assert.equal(archived?.status, "archived");
  });

  test("Aísla patrones e imágenes subidas por usuario y valida formato de imagen", () => {
    const storage = createMemoryStorage();
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";

    const pattern: AtelierProjectPattern = {
      projectId: "knit-1",
      title: "Granny Square",
      steps: ["Anillo mágico 6 pb", "6 aumentos"],
      notes: "Aguja 3.5mm",
      images: [
        {
          id: "img-1",
          name: "grafico.png",
          dataUrl: "data:image/png;base64,iVBORw0KGgo=",
          addedAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    };

    const saved = saveAtelierPattern(storage, userA, pattern);
    assert.equal(saved.ok, true);
    assert.equal(readAtelierPatterns(storage, userA)["knit-1"]?.images.length, 1);
    assert.deepEqual(readAtelierPatterns(storage, userB), {});

    // Rechazar imagen con formato inválido
    const invalid = saveAtelierPattern(storage, userA, {
      ...pattern,
      images: [
        {
          id: "bad-1",
          name: "script.svg",
          dataUrl: "javascript:alert(1)",
          addedAt: new Date().toISOString(),
        },
      ],
    });
    assert.equal(invalid.ok, false);
  });
});
