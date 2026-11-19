import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { inputContext, routeWorldInput, type InputContextState } from "../src/game/domain/input-context.ts";
import type { Character, Dialogue, InteractiveObject, InventoryView, NPC, PlayerInput, QuestPresentation, Scene, SceneTransition, WorldEvent } from "../src/game/domain/contracts.ts";

const active: InputContextState = { focused: true, paused: false, overlayOpen: false, textFocused: false, composing: false };
const move: PlayerInput = { source: "keyboard", context: "exploration", move: { x: 1, y: 1 }, target: { x: 40, y: 20 }, actions: ["interact", "pause", "interact"] };

test("world controls stop for text, IME, overlays, pause and background on every device", () => {
  for (const source of ["keyboard", "pointer", "touch", "gamepad"] as const) {
    for (const change of [{ textFocused: true }, { composing: true }, { overlayOpen: true }, { paused: true }, { focused: false }]) {
      const state = { ...active, ...change };
      const result = routeWorldInput({ ...move, source }, state);
      assert.deepEqual(result.move, { x: 0, y: 0 });
      assert.deepEqual(result.actions, []);
      assert.equal(result.target, undefined);
      assert.equal(result.source, source);
      assert.notEqual(result.context, "exploration");
    }
  }
});

test("IME remains exclusive even after a text field loses focus", () => {
  assert.equal(inputContext({ ...active, composing: true, overlayOpen: true, paused: true }), "text");
  const blocked = routeWorldInput(move, { ...active, composing: true });
  assert.deepEqual(routeWorldInput(blocked, active).actions, []);
  assert.deepEqual(routeWorldInput(blocked, active).move, { x: 0, y: 0 });
  assert.ok(routeWorldInput(move, active).actions.includes("interact"));
});

test("diagonal magnitude is capped, small analog movement survives and inputs stay immutable", () => {
  const before = structuredClone(move);
  const routed = routeWorldInput(move, active);
  assert.ok(Math.abs(Math.hypot(routed.move.x, routed.move.y) - 1) < 1e-12);
  assert.deepEqual(routed.actions, ["interact", "pause"]);
  assert.deepEqual(routeWorldInput({ ...move, move: { x: 0.25, y: 0 } }, active).move, { x: 0.25, y: 0 });
  assert.deepEqual(move, before);
  assert.notEqual(routed.actions, move.actions);
  assert.notEqual(routed.target, move.target);
});

test("malformed vectors and targets cannot propagate nonfinite positions", () => {
  assert.deepEqual(routeWorldInput({ ...move, move: { x: NaN, y: Infinity }, target: { x: NaN, y: 1 } }, active).move, { x: 0, y: 0 });
  assert.equal(routeWorldInput({ ...move, target: { x: 0, y: Infinity } }, active).target, undefined);
  const large = routeWorldInput({ ...move, move: { x: Number.MAX_VALUE, y: Number.MAX_VALUE } }, active);
  assert.ok(Math.abs(Math.hypot(large.move.x, large.move.y) - 1) < 1e-12);
});

// Synthetic presentation fixtures: these references never load or modify an account.
const character: Character = { userId: "fixture-user", appearanceRef: "original-visitor", pose: { sceneId: "plaza", position: { x: 32, y: 32 }, facing: "south" }, movement: "idle", animation: { clipId: "idle", facing: "south", motion: "reduced" } };
const scene: Scene = { id: "plaza", kind: "outdoor", assetManifestId: "original-art", spawns: { entry: { position: { x: 32, y: 32 }, facing: "south" } }, objectIds: ["desk"], doors: [{ id: "door", position: { x: 64, y: 64 }, targetSceneId: "atelier", targetSpawnId: "entry" }] };
const transition: SceneTransition = { id: "fixture-transition", from: character.pose, to: { sceneId: "atelier", spawnId: "entry" }, reason: "door", phase: "preparing", sessionPolicy: "preserve" };
const object: InteractiveObject = { id: "desk", sceneId: scene.id, label: "Mi escritorio", position: { x: 48, y: 32 }, range: 32, actions: [{ kind: "open-tool", tool: "session", resource: { kind: "project", id: "fixture-project" } }, { kind: "rest", mode: "pause" }], accessibleActionId: "open-desk" };
const npc: NPC = { id: "resident", residentRef: "fixture-resident", role: "guide", pose: character.pose, behavior: "resting", animation: character.animation, dialogueId: "greeting", interactions: [object.id] };
const dialogue: Dialogue = { id: npc.dialogueId, speakerId: npc.id, lines: ["Puedes volver cuando quieras."], choices: [], skippable: true, returnFocusId: object.accessibleActionId };
const inventory: InventoryView = { ownerId: character.userId, groups: [{ kind: "activity-resources", entries: [{ viewId: "project-card", source: { kind: "project", id: "fixture-project" }, label: "Mi proyecto" }] }] };
const quest: QuestPresentation = { sourceQuestId: "fixture-quest", label: "Un rato para ti", objective: "Elegir una actividad", status: "available", progressLabel: "Cuando quieras", openExistingQuestActionId: "open-quest" };
const events: readonly WorldEvent[] = [
  { kind: "scene.entered", eventId: "visual-1", occurredAt: "2026-11-11T00:00:00Z", transitionId: transition.id, sceneId: scene.id },
  { kind: "object.focused", eventId: "visual-2", occurredAt: "2026-11-11T00:00:00Z", objectId: object.id },
  { kind: "activity.confirmed", eventId: "visual-3", occurredAt: "2026-11-11T00:00:00Z", operationId: "fixture-operation", sourceSessionId: "fixture-session" },
  { kind: "progress.refreshed", eventId: "visual-4", occurredAt: "2026-11-11T00:00:00Z", projectionId: "fixture-projection" },
];

test("presentation fixtures retain source identities and contain no mutable economy", () => {
  assert.equal(inventory.ownerId, character.userId);
  assert.equal(inventory.groups[0].entries[0].source.id, "fixture-project");
  assert.equal(dialogue.skippable, true);
  assert.equal(transition.sessionPolicy, "preserve");
  for (const value of [character, scene, transition, object, npc, dialogue, inventory, quest, ...events]) {
    assert.equal(Object.keys(value).some(key => ["gp", "xp", "balance", "wallet", "vault"].includes(key)), false);
  }
});

test("domain and game client dependency graph cannot reach privileged application services", () => {
  const root = path.resolve("src/game");
  function check(dir: string): void {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) { check(file); continue; }
      if (!file.endsWith(".ts")) continue;
      const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
      const relative = path.relative(root, file);
      const domain = relative.startsWith(`domain${path.sep}`);
      function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
          const spec = node.moduleSpecifier;
          if (spec && ts.isStringLiteral(spec)) {
            const target = spec.text;
            const typeOnly = ts.isImportDeclaration(node) ? node.importClause?.isTypeOnly : node.isTypeOnly;
            const resolved = path.resolve(path.dirname(file), target);
            const local = target.startsWith(".") && resolved.startsWith(root + path.sep);
            const approvedTypes = typeOnly && resolved === path.resolve("src/types/rpg");
            assert.ok(local || approvedTypes || (!domain && target === "phaser"), `${relative}: forbidden dependency ${target}`);
          }
        }
        if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
          assert.fail(`${relative}: dynamic dependencies require explicit boundary review`);
        }
        ts.forEachChild(node, visit);
      }
      visit(source);
    }
  }
  check(root);
});

// Compile-time regressions checked by tsc --noEmit; never execute invalid mutations.
function typeRegressions(): void {
  // @ts-expect-error character identity is readonly
  character.userId = "another-user";
  // @ts-expect-error progression is not owned by a character sprite
  character.xp = 100;
  // @ts-expect-error inventory references are readonly
  inventory.groups[0].entries.push({});
  // @ts-expect-error rest does not accept a financial action
  const invalidAction: InteractiveObject["actions"][number] = { kind: "grant-gp", amount: 1 };
  // @ts-expect-error confirmed activity must identify its source session
  const missingSource: WorldEvent = { kind: "activity.confirmed", eventId: "x", occurredAt: "x", operationId: "x" };
  void invalidAction; void missingSource;
}
void typeRegressions;
