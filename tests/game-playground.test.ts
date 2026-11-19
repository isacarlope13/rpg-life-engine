import test from "node:test";
import assert from "node:assert/strict";
import { LAYOUTS, WORLD, canStand, findRoute, movementVector, nearDoor, type SceneId } from "../src/game/client/spike-model.ts";
import { mountLazyRuntime } from "../src/game/client/spike-lifecycle.ts";

test("a visitor can spawn and reach each entrance without crossing a solid wall", () => {
  for (const scene of ["town", "atelier"] as SceneId[]) {
    const { spawn, door } = LAYOUTS[scene];
    assert.ok(canStand(spawn, scene));
    const route = findRoute(spawn, door, scene);
    assert.ok(route.length > 1);
    assert.deepEqual(route.at(-1), door);
    let from = spawn;
    for (const to of route) {
      // Sample the actual segments as well as waypoints: a safe endpoint alone is insufficient.
      for (let i = 0; i <= 20; i++) {
        assert.ok(canStand({ x: from.x + (to.x - from.x) * i / 20, y: from.y + (to.y - from.y) * i / 20 }, scene));
      }
      from = to;
    }
  }
});

test("tapping the fountain, water or outside the world never produces a walking route", () => {
  for (const target of [{ x: 512, y: 456 }, { x: 850, y: 400 }, { x: -50, y: 0 }, { x: 2000, y: 2000 }]) {
    assert.deepEqual(findRoute(LAYOUTS.town.spawn, target, "town"), []);
  }
});

test("collision clearance accounts for the visitor's footprint at walls and map bounds", () => {
  assert.equal(canStand({ x: 380, y: 200 }, "town"), false);
  assert.equal(canStand({ x: WORLD.width - 1, y: 100 }, "town"), false);
  assert.equal(canStand({ x: 16, y: 100 }, "town"), false);
  assert.equal(canStand({ x: 100, y: 100 }, "town"), true);
});

test("diagonal input and long pointer destinations keep the same walking speed", () => {
  for (const direction of [{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 350, y: -100 }]) {
    const v = movementVector(direction.x, direction.y);
    assert.ok(Math.abs(Math.hypot(v.x, v.y) - 180) < 0.001);
  }
  assert.deepEqual(movementVector(0, 0), { x: 0, y: 0 });
});

test("the door only opens nearby and its destination leads back to the plaza", () => {
  assert.equal(nearDoor(LAYOUTS.town.spawn, "town"), false);
  assert.equal(nearDoor(LAYOUTS.town.door, "town"), true);
  assert.equal(LAYOUTS[LAYOUTS.town.destination].destination, "town");
});

test("React cleanup during a pending dynamic import never constructs a detached game", async () => {
  let resolve!: (factory: () => { destroy(): void }) => void;
  let created = 0, ready = 0;
  const cancel = mountLazyRuntime(() => new Promise<() => { destroy(): void }>((r) => { resolve = r; }), () => ready++, () => assert.fail("unexpected error"));
  cancel();
  resolve(() => { created++; return { destroy() {} }; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(created, 0); assert.equal(ready, 0);
});

test("mount-cleanup-mount keeps one active runtime and cleanup is idempotent", async () => {
  let active = 0, destroyed = 0;
  const load = async () => () => { active++; return { destroy() { active--; destroyed++; } }; };
  const first = mountLazyRuntime(load, () => {}, () => assert.fail("unexpected error"));
  await Promise.resolve(); first(); first();
  const second = mountLazyRuntime(load, () => {}, () => assert.fail("unexpected error"));
  await Promise.resolve();
  assert.equal(active, 1); assert.equal(destroyed, 1);
  second(); assert.equal(active, 0); assert.equal(destroyed, 2);
});

test("a rejected game import reports failure instead of leaving an unhandled rejection", async () => {
  let errors = 0;
  const cancel = mountLazyRuntime(() => Promise.reject(new Error("synthetic import failure")), () => assert.fail("not ready"), () => errors++);
  await Promise.resolve(); await Promise.resolve();
  assert.equal(errors, 1); cancel();
});
