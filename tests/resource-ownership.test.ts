import test from "node:test";
import assert from "node:assert/strict";
import { getStoredSkillResources, saveSkillResource, deleteSkillResource } from "../src/lib/sanctuary/skill-resources-hub.ts";

test("resource storage has no default account, refuses false saves and keeps legacy untouched", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const rows = new Map<string, string>();
  const storage = {
    getItem: (key: string) => rows.get(key) ?? null,
    setItem: (key: string, value: string) => { rows.set(key, value); },
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  const resource = { userId: "fixture-A", domain: "reading" as const, type: "book" as const, title: "Synthetic resource", tags: [] };
  try {
    rows.set("rpg_skill_resources_v4_usr_cozy_hero", "legacy-for-recovery");
    assert.deepEqual(getStoredSkillResources("reading"), []);
    assert.throws(() => saveSkillResource(resource));
    assert.throws(() => saveSkillResource(resource, "fixture-B"));
    const created = saveSkillResource(resource, "fixture-A");
    assert.equal(getStoredSkillResources("reading", "fixture-A")[0].id, created.id);
    assert.deepEqual(getStoredSkillResources("reading", "fixture-B"), []);
    assert.equal(deleteSkillResource(created.id, "fixture-B"), false);
    assert.equal(deleteSkillResource("missing", "fixture-A"), false);
    assert.equal(getStoredSkillResources("reading", "fixture-A").length, 1);
    assert.equal(rows.get("rpg_skill_resources_v4_usr_cozy_hero"), "legacy-for-recovery");
    storage.setItem = () => { throw Error("quota exceeded"); };
    assert.throws(() => saveSkillResource(resource, "fixture-A"), /No se pudo guardar/);
    assert.equal(deleteSkillResource(created.id, "fixture-A"), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
