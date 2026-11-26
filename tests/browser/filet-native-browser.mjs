import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

export function prepareFiletBrowserFixture() {
  mkdirSync("src/app/filet-qa", { recursive: true });
  copyFileSync("tests/browser/filet-native-fixture.tsx", "src/app/filet-qa/page.tsx");
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(fn) {
  for (let i = 0; i < 120; i++) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (error) {
      if (i === 119) throw error;
    }
    await sleep(250);
  }
  throw new Error("Browser fixture condition timed out");
}

export async function runFiletBrowser({ origin, root, check }) {
  const evidence = join(root, "browser-evidence");
  mkdirSync(evidence, { recursive: true });
  const chrome = spawn(process.env.FILET_BROWSER_EXE, [
    "--headless=new", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=43177",
    "--disable-background-networking", "--disable-sync", "--no-proxy-server",
    "--user-data-dir=" + join(root, "browser-profile"),
  ], { stdio: "ignore", windowsHide: true });
  let socket;
  try {
    const target = await waitFor(async () => {
      const response = await fetch("http://127.0.0.1:43177/json/version");
      return response.json();
    });
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener("open", resolve, { once: true });
      socket.addEventListener("error", reject, { once: true });
    });
    let id = 0;
    const replies = new Map();
    socket.addEventListener("message", event => {
      const response = JSON.parse(event.data);
      const waiting = replies.get(response.id);
      if (!waiting) return;
      replies.delete(response.id);
      if (response.error) waiting.reject(new Error(response.error.message));
      else waiting.resolve(response.result);
    });
    function command(method, params = {}, sessionId) {
      const callId = ++id;
      return new Promise((resolve, reject) => {
        replies.set(callId, { resolve, reject });
        socket.send(JSON.stringify({ id: callId, method, params, sessionId }));
      });
    }
    async function context() {
      const { browserContextId } = await command("Target.createBrowserContext");
      const { targetId } = await command("Target.createTarget", { url: "about:blank", browserContextId });
      const { sessionId } = await command("Target.attachToTarget", { targetId, flatten: true });
      const send = (method, params) => command(method, params, sessionId);
      await send("Page.enable");
      await send("Network.enable");
      await send("Network.setCookie", { name: "rpg_access_token", value: "owner", url: origin });
      await send("Page.navigate", { url: origin + "/filet-qa" });
      async function evaluate(expression) {
        const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
        return result.result.value;
      }
      await waitFor(() => evaluate("Boolean(window.filetQA)"));
      return {
        send, evaluate,
        state: () => evaluate("document.querySelector('#sync-status').textContent"),
        online: online => send("Network.emulateNetworkConditions", {
          offline: !online, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
        }),
        async post(path, body) {
          return evaluate(`fetch(${JSON.stringify(path)}, { method: "POST", headers: {
            "content-type": "application/json", "x-oakhaven-filet-write": "1"
          }, body: JSON.stringify(${JSON.stringify(body)}) }).then(async res => [res.status, await res.json()])`);
        },
      };
    }
    const a = await context();
    const snapshot = await a.evaluate("window.filetQA.prepare()");
    assert.equal(snapshot.grid_width, 80);
    await waitFor(async () => (await a.state()) === "confirmed").catch(async () => {
      const details = await a.evaluate(`(async () => {
        const key = Object.keys(localStorage).find(k => k.startsWith("oakhaven_filet_sync_v1_"));
        const pending = key && JSON.parse(localStorage.getItem(key)).pending;
        if (!pending) return "No persisted operation";
        const response = await fetch("/api/filet/workspace", {
          method: "POST", headers: { "content-type": "application/json", "x-oakhaven-filet-write": "1" },
          body: JSON.stringify(pending),
        });
        return response.status + " " + JSON.stringify(await response.json());
      })()`);
      throw new Error("First workspace did not sync: " + await a.state() + "; " + details);
    });
    console.log("Browser A: synthetic alphabet and 80-column pattern synced");
    const [created, response] = await a.post("/api/shortcuts/skill-session", {
      action: "add_knitting_project", title: "Baby Lucio", knitting_technique: "Crochet", linked_filet_pattern: snapshot,
    });
    assert.equal(created, 201, JSON.stringify(response));
    const projectId = response.project.id;
    const operation = {
      projectId, versionId: snapshot.version_id, operationId: "50000000-0000-4000-8000-000000000099",
      action: "confirm", row: 1, revision: 0, segments: await a.evaluate(`window.filetQA.segments(${JSON.stringify(snapshot)}, 1)`),
    };
    const [confirmed, progress] = await a.post("/api/filet/progress", operation);
    assert.equal(confirmed, 200);
    assert.equal(progress.completed_rows, 1);

    const b = await context();
    await waitFor(async () => (await b.state()) === "conflict");
    await b.evaluate("window.filetQA.useRemote()");
    await waitFor(async () => (await b.state()) === "confirmed");
    assert.equal(await b.evaluate("document.querySelector('#pattern').textContent"), "Baby Lucio / 1");
    const remote = await b.evaluate(`fetch('/api/filet/progress?projectId=${projectId}').then(res => res.json())`);
    assert.deepEqual(remote.confirmed_rows, [1]);
    const [duplicate, replay] = await b.post("/api/filet/progress", operation);
    assert.equal(duplicate, 200);
    assert.equal(replay.replayed, true);
    assert.equal(replay.completed_rows, 1);
    console.log("Browser B: alphabet, version and confirmed row recovered");

    await a.online(false);
    await a.evaluate("window.filetQA.revise()");
    await waitFor(async () => (await a.state()) === "offline");
    assert.equal(await a.evaluate("Object.keys(localStorage).some(k => k.startsWith('oakhaven_filet_sync_v1_') && Boolean(JSON.parse(localStorage.getItem(k)).pending))"), true);
    const session = await a.evaluate(`window.filetQA.createSession(${JSON.stringify(projectId)})`);
    const queued = await a.evaluate(`window.filetQA.queue(${JSON.stringify(session)}, ${JSON.stringify(snapshot.version_id)})`);
    const failed = await a.evaluate(`window.filetQA.finish(${JSON.stringify(queued)})`);
    assert.equal(failed.outcome, "pending");
    await a.online(true);
    await a.send("Page.reload");
    await waitFor(() => a.evaluate("Boolean(window.filetQA)"));
    await waitFor(async () => (await a.state()) === "confirmed");
    await b.send("Page.reload");
    await waitFor(() => b.evaluate("Boolean(window.filetQA)"));
    await waitFor(async () => (await b.state()) === "conflict");
    await b.evaluate("window.filetQA.useRemote()");
    await waitFor(async () => (await b.state()) === "confirmed");
    assert.equal(await b.evaluate("document.querySelector('#alphabet').textContent"), "Alfabeto editado offline");
    assert.equal(await b.evaluate("document.querySelector('#pattern').textContent"), "Baby Lucio / 1");

    const alias = await b.evaluate(`window.filetQA.queue(${JSON.stringify(session)}, ${JSON.stringify(snapshot.version_id)}, 'browser-b-alias')`);
    const statuses = await Promise.all([
      a.evaluate(`window.filetQA.finish(${JSON.stringify(queued)})`),
      b.evaluate(`window.filetQA.finish(${JSON.stringify(alias)})`),
    ]);
    assert.equal(statuses[0].outcome, "confirmed", JSON.stringify(statuses));
    assert.equal(statuses[1].outcome, "confirmed", JSON.stringify(statuses));
    assert.equal(statuses[0].sessionId, statuses[1].sessionId);
    const result = await check(projectId);
    assert.deepEqual(result, [1, 1, 7, 65, 2800]);
    const screenshot = await b.send("Page.captureScreenshot", { format: "png" });
    writeFileSync(join(evidence, "baby-lucio-browser-b.png"), Buffer.from(screenshot.data, "base64"));
    writeFileSync(join(evidence, "result.json"), JSON.stringify({
      contexts: 2, width: 80, version: 1, confirmedRows: remote.confirmed_rows,
      finished: result, alphabetRecovered: true, offlineQueueRecovered: true,
    }, null, 2));
    console.log("Baby Lucio | 2 browser contexts | rows, activities, minutes, XP, GP:", result);
  } finally {
    socket?.close();
    if (chrome.pid && chrome.exitCode === null) {
      await promisify(execFile)("taskkill.exe", ["/PID", String(chrome.pid), "/T", "/F"], { windowsHide: true }).catch(() => {});
    }
  }
}
