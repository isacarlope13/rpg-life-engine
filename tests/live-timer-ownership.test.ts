import test from "node:test";
import assert from "node:assert/strict";
import { advanceLiveTimer, liveTimerKey, loadLiveTimer, saveLiveTimer, type OwnedLiveTimer } from "../src/lib/sanctuary/live-timer.ts";

function memory() {
  const rows = new Map<string, string>();
  return { rows, storage: { getItem: (key: string) => rows.get(key) ?? null, setItem: (key: string, value: string) => { rows.set(key, value); } } };
}
const timer = (ownerId = "fixture-A"): OwnedLiveTimer => ({ ownerId, domain: "reading", seconds: 10, paused: false, lastTimestamp: 1000 });

test("live timer namespaces separate A/B and punctuation without an anonymous key", () => {
  assert.equal(liveTimerKey(), null);
  assert.equal(liveTimerKey("anonymous"), null);
  assert.notEqual(liveTimerKey("fixture:A"), liveTimerKey("fixture_A"));
  const { storage } = memory();
  saveLiveTimer(storage, "fixture-A", timer());
  assert.equal(loadLiveTimer(storage, "fixture-B", 5000), null);
  assert.equal(loadLiveTimer(storage, "fixture-A", 5000)?.seconds, 14);
});

test("legacy global storage is neither read nor changed by load, save or reset", () => {
  const { rows, storage } = memory();
  rows.set("rpg_live_timer_state", "legacy-for-recovery");
  assert.equal(loadLiveTimer(storage, "fixture-A", 5000), null);
  saveLiveTimer(storage, "fixture-A", timer());
  saveLiveTimer(storage, "fixture-A", { ...timer(), domain: null, seconds: 0 });
  assert.equal(rows.get("rpg_live_timer_state"), "legacy-for-recovery");
});

test("clock recovery adds only running time; pauses, empty timers and backwards clocks stay stable", () => {
  assert.equal(advanceLiveTimer(timer(), 6000).seconds, 15);
  assert.equal(advanceLiveTimer({ ...timer(), paused: true }, 6000).seconds, 10);
  assert.equal(advanceLiveTimer({ ...timer(), domain: null }, 6000).seconds, 10);
  assert.equal(advanceLiveTimer(timer(), 500).seconds, 10);
  assert.equal(timer().lastTimestamp, 1000);
});

test("scoped storage requires matching owner, never trusts key location alone", () => {
  const { rows, storage } = memory();
  rows.set(liveTimerKey("fixture-B")!, JSON.stringify(timer()));
  assert.equal(loadLiveTimer(storage, "fixture-B", 5000), null);
  const before = [...rows];
  assert.equal(saveLiveTimer(storage, "fixture-B", timer()), false);
  assert.equal(saveLiveTimer(storage, undefined, timer()), false);
  assert.deepEqual([...rows], before);
});

test("malformed and incomplete checkpoints are retained without starting a timer", () => {
  const { rows, storage } = memory();
  const key = liveTimerKey("fixture-A")!;
  for (const raw of ["not-json", "null", "{}", ...[
    { ...timer(), ownerId: undefined }, { ...timer(), seconds: "10" },
    { ...timer(), seconds: -1 }, { ...timer(), paused: "false" },
    { ...timer(), domain: "unknown" }, { ...timer(), lastTimestamp: null },
  ].map(value => JSON.stringify(value))]) {
    rows.set(key, raw);
    assert.equal(loadLiveTimer(storage, "fixture-A", 5000), null);
    assert.equal(rows.get(key), raw);
  }
});

test("resetting B leaves A checkpoint intact", () => {
  const { rows, storage } = memory();
  saveLiveTimer(storage, "fixture-A", timer());
  const a = rows.get(liveTimerKey("fixture-A")!);
  saveLiveTimer(storage, "fixture-B", { ...timer("fixture-B"), domain: null, seconds: 0 });
  assert.equal(rows.get(liveTimerKey("fixture-A")!), a);
  assert.equal(loadLiveTimer(storage, "fixture-B", 5000)?.domain, null);
});

test("storage access failures remain contained", () => {
  const failed = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  assert.equal(loadLiveTimer(failed, "fixture-A", 5000), null);
  assert.equal(saveLiveTimer(failed, "fixture-A", timer()), false);
});
