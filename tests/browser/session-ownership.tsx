import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useUniversalSession } from "../../src/lib/sanctuary/use-universal-session";
import { SessionIdentityProvider } from "../../src/lib/sanctuary/session-identity";
import { loadOwnedHistory, loadOwnedSession } from "../../src/lib/sanctuary/session-storage";
import { useOwnedLiveTimer } from "../../src/lib/sanctuary/use-owned-live-timer";
import { liveTimerKey } from "../../src/lib/sanctuary/live-timer";
import { SkillResourceHubPanel } from "../../src/components/sanctuary/skill-resource-hub-panel";
import { saveSkillResource } from "../../src/lib/sanctuary/skill-resources-hub";
import { useOwnedNotes } from "../../src/lib/sanctuary/use-owned-notes";

// Isolated loopback harness. Uses synthetic IDs/storage only; fetch is intercepted below.
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById("root")!);
let controls: ReturnType<typeof useUniversalSession>;
let liveControls: ReturnType<typeof useOwnedLiveTimer>;
const liveRenders: { owner?: string; domain: string | null }[] = [];
let notesControls: ReturnType<typeof useOwnedNotes>;
const noteRenders: { owner?: string; notes: string[]; draft: string }[] = [];
function NotesProbe({ owner }: { owner?: string }) {
  notesControls = useOwnedNotes(owner);
  noteRenders.push({ owner, notes: notesControls.notesList, draft: notesControls.quickNote });
  return <output>{notesControls.notesList.join("|")}</output>;
}
function LiveProbe({ owner }: { owner?: string }) {
  liveControls = useOwnedLiveTimer(owner);
  liveRenders.push({ owner, domain: liveControls.liveTimerDomain });
  return <output>{liveControls.liveTimerDomain ?? "no-timer"}</output>;
}
function Probe() {
  controls = useUniversalSession("reading", "fixture-library");
  return <output>{controls.session?.userId ?? "no-session"}</output>;
}
const results: string[] = [];
const realFetch = globalThis.fetch;
function check(condition: unknown, message: string): void {
  if (!condition) throw Error(message);
}
async function mount(userId?: string) {
  await act(async () => { root.render(<StrictMode><SessionIdentityProvider userId={userId}><Probe /></SessionIdentityProvider></StrictMode>); });
}
async function run() {
  const prefix = "fixture-browser-";
  const ownerA = prefix + crypto.randomUUID();
  const ownerB = prefix + crypto.randomUUID();
  const legacyKey = "rpg_universal_session_v4";
  const legacyBefore = localStorage.getItem(legacyKey);
  await mount();
  await act(async () => { controls.startSession(); });
  check(controls.session === null, "missing identity must not create a session");
  results.push("PASS no identity fallback");

  await mount(ownerA);
  await act(async () => { controls.prepareSession(); });
  await act(async () => { controls.startSession(); controls.updateNotes("A private synthetic note"); });
  const sessionA = controls.session!;
  check(sessionA.userId === ownerA && sessionA.notes === "A private synthetic note", "A must own its session");
  await mount(ownerB);
  check(controls.session === null && controls.history.length === 0, "B must not see A session/history");
  check(loadOwnedSession(localStorage, ownerA)?.sessionId === sessionA.sessionId, "A checkpoint must remain");
  results.push("PASS A to B hides A and preserves checkpoint");

  await act(async () => { controls.startSession(); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1100)); });
  const sessionB = controls.session!;
  check(loadOwnedSession(localStorage, ownerB)?.sessionId === sessionB.sessionId, "Strict Mode direct start must persist the displayed session ID");
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = async (_url, init) => {
    check(new Headers(init?.headers).get("X-RPG-Offline-Owner") === ownerB, "request must assert B owner");
    return new Promise<Response>(resolve => { release = resolve; });
  };
  let pending: Promise<unknown>;
  await act(async () => { pending = controls.finishSession(); });
  await mount(ownerA);
  check(controls.session?.sessionId === sessionA.sessionId, "returning A must recover A session");
  await act(async () => { release!(Response.json({ success: true, session_logged: { id: "fixture-confirmed-session" } })); await pending!; });
  check(controls.session?.sessionId === sessionA.sessionId && controls.history.length === 0, "late B response must not mutate A");
  check(loadOwnedSession(localStorage, ownerB)?.sessionId === sessionB.sessionId, "late response must preserve B pending checkpoint");
  results.push("PASS in-flight B response cannot change A");

  globalThis.fetch = async () => Response.json({ error: "different authenticated owner" }, { status: 409 });
  let rejected: unknown;
  await act(async () => { rejected = await controls.finishSession(); });
  check(rejected === null && !!controls.submissionError && controls.session?.sessionId === sessionA.sessionId, "409 must preserve pending session");
  check(controls.history.length === 0, "409 must not append success history");
  results.push("PASS owner rejection preserves pending session");

  globalThis.fetch = async (_url, init) => {
    check(new Headers(init?.headers).get("X-RPG-Offline-Owner") === ownerA, "request must assert A owner");
    return Response.json({ success: true, session_logged: { id: "fixture-confirmed-session" } });
  };
  await act(async () => { await controls.finishSession(); });
  check(controls.session === null && controls.history.length === 1, "confirmed A session must move to own history");
  check(loadOwnedHistory(localStorage, ownerB).length === 0, "B history must remain untouched");
  await mount(ownerB);
  check(controls.session?.sessionId === sessionB.sessionId && controls.history.length === 0, "B recovers only B");
  results.push("PASS completion and history remain owner-scoped");
  await mount();
  check(controls.session === null && controls.history.length === 0, "logout must hide session/history");
  check(localStorage.getItem(legacyKey) === legacyBefore, "legacy storage must remain unchanged");
  results.push("PASS logout and untouched legacy");

  // Keep the same LiveProbe instance across owners, as in the legacy dashboard.
  const liveA = ownerA + "-live";
  const liveB = ownerB + "-live";
  const globalTimerBefore = localStorage.getItem("rpg_live_timer_state");
  localStorage.setItem(liveTimerKey(liveA)!, JSON.stringify({ ownerId: liveA, domain: "reading", seconds: 17, paused: true, lastTimestamp: Date.now() }));
  const mountLive = async (owner?: string) => { await act(async () => { root.render(<StrictMode><LiveProbe owner={owner} /></StrictMode>); }); };
  await mountLive(liveA);
  check(liveControls.liveTimerSeconds === 17 && liveControls.liveTimerPaused, "live A checkpoint must recover paused");
  const staleResetA = liveControls.resetLiveTimer;
  await mountLive(liveB);
  check(liveControls.liveTimerDomain === null && liveControls.liveTimerSeconds === 0, "live B cannot see A");
  check(localStorage.getItem(liveTimerKey(liveB)!) === null, "hydration must not write A into B namespace");
  check(liveRenders.filter(render => render.owner === liveB).every(render => render.domain !== "reading"), "even first B render must hide A timer");
  results.push("PASS live timer hides A immediately and avoids hydration overwrite");
  await act(async () => { liveControls.startLiveTimer("work"); });
  await act(async () => { check(staleResetA() === false, "stale A callback must be rejected"); });
  check(liveControls.liveTimerDomain === "work", "stale callback cannot reset B");
  await act(async () => { liveControls.resetLiveTimer(); });
  await mountLive(liveA);
  check(liveControls.liveTimerSeconds === 17 && liveControls.liveTimerDomain === "reading", "B reset cannot affect A");
  await act(async () => { liveControls.startLiveTimer("reading"); });
  check(liveControls.liveTimerSeconds === 17 && !liveControls.liveTimerPaused, "resume must preserve elapsed A time");
  results.push("PASS live timer callbacks and reset stay owner-scoped");
  let timerRequests = 0;
  let capturedPayload: string | undefined;
  globalThis.fetch = async (_url, init) => {
    timerRequests++;
    capturedPayload = init?.body as string;
    return Response.json({ offline: true }, { status: 503 });
  };
  await act(async () => { await liveControls.finishLiveTimer({ pages_read: 3 }); });
  check(liveControls.liveTimerPaused && liveControls.liveTimerSeconds >= 17 && !!liveControls.liveTimerError, "503 must keep time paused and show an error");
  const firstPayload = capturedPayload;
  await act(async () => { check(liveControls.resumeLiveTimer() === false, "pending snapshot must not accumulate extra time"); });
  globalThis.fetch = async (_url, init) => {
    timerRequests++;
    check(init?.body === firstPayload, "retry must retain identical payload despite changed form values");
    return Response.json({ success: true, session_logged: { id: "fixture-live-confirmed" } });
  };
  await act(async () => { await Promise.all([liveControls.finishLiveTimer({ pages_read: 99 }), liveControls.finishLiveTimer({ pages_read: 100 })]); });
  check(timerRequests === 2, "parallel completion retry must send only once");
  check(liveControls.liveTimerDomain === null, "only confirmed live completion clears timer");
  results.push("PASS live completion preserves pending payload and deduplicates retries");
  await mountLive();
  await act(async () => { check(liveControls.startLiveTimer("work") === false, "identity missing cannot start live timer"); });
  check(liveControls.liveTimerDomain === null, "logout hides live timer");
  check(localStorage.getItem("rpg_live_timer_state") === globalTimerBefore, "live timer legacy global stays intact");
  results.push("PASS live timer logout and untouched legacy");
  const resourceTitle = "Synthetic private resource " + crypto.randomUUID();
  saveSkillResource({ userId: ownerA, domain: "reading", type: "book", title: resourceTitle, tags: [] }, ownerA);
  await act(async () => { root.render(<SessionIdentityProvider userId={ownerA}><SkillResourceHubPanel domain="reading" /></SessionIdentityProvider>); });
  check(document.getElementById("root")!.textContent?.includes(resourceTitle), "resource A must load from authenticated context");
  await act(async () => { root.render(<SessionIdentityProvider userId={ownerB}><SkillResourceHubPanel domain="reading" /></SessionIdentityProvider>); });
  check(!document.getElementById("root")!.textContent?.includes(resourceTitle), "B cannot see A resources");
  await act(async () => { root.render(<SessionIdentityProvider userId={ownerB}><SkillResourceHubPanel domain="reading" userId={ownerA} /></SessionIdentityProvider>); });
  check(!document.getElementById("root")!.textContent?.includes(resourceTitle), "props cannot override authenticated resource owner");
  results.push("PASS resource context isolation and conflicting-owner rejection");
  await act(async () => { root.render(<SkillResourceHubPanel domain="reading" />); });
  check(document.getElementById("root")!.textContent?.includes("Inicia sesión"), "resource panel requires identity");
  results.push("PASS resources never fall back to demo identity");
  const globalNotesBefore = localStorage.getItem("cozy_oakhaven_notes_v1");
  const mountNotes = async (owner?: string) => { await act(async () => { root.render(<StrictMode><NotesProbe owner={owner} /></StrictMode>); }); };
  await mountNotes(ownerA);
  await act(async () => { notesControls.addNote("A private note"); notesControls.setQuickNote("A private draft"); });
  const staleAddA = notesControls.addNote;
  await mountNotes(ownerB);
  check(notesControls.notesList.length === 0 && !notesControls.quickNote, "B must not see A notes or draft");
  check(noteRenders.filter(render => render.owner === ownerB).every(render => !render.notes.includes("A private note") && render.draft !== "A private draft"), "first B render must mask notes and draft");
  await act(async () => { check(staleAddA("stale") === false, "stale note callback must be rejected"); notesControls.addNote("B private note"); });
  await mountNotes(ownerA);
  check(notesControls.notesList.join("|") === "A private note", "A recovery must exclude B notes");
  results.push("PASS notes and drafts stay private across same-instance account switch");
  await mountNotes();
  await act(async () => { check(notesControls.addNote("no owner") === false, "ownerless note cannot save"); });
  check(notesControls.notesList.length === 0 && localStorage.getItem("cozy_oakhaven_notes_v1") === globalNotesBefore, "logout hides notes and preserves legacy");
  results.push("PASS notes require identity and keep legacy unchanged");
  await act(async () => { root.unmount(); });
}
run().then(() => {
  document.getElementById("result")!.textContent = results.join("\n") + "\nALL PASSED";
}).catch(error => {
  document.getElementById("result")!.textContent = results.join("\n") + "\nFAILED: " + String(error);
}).finally(() => { globalThis.fetch = realFetch; });
