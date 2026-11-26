"use client";

import { useCallback, useState } from "react";
import {
  composePhraseOnCanvas, createAlphabetCollection, createDefaultCanvasSpec, createFiletGlyph,
  createFiletTechnicalConvention, createStarterFiletWorkspace, createVersionedPattern,
} from "@/lib/sanctuary/filet-crochet-engine";
import { readFiletStudioWorkspaceSafe, saveFiletStudioWorkspaceSafe } from "@/lib/sanctuary/filet-crochet-store";
import { useFiletWorkspaceSync } from "@/lib/sanctuary/use-filet-workspace-sync";
import { buildLinkedFiletPatternSnapshot, getGuidedRowInstruction } from "@/lib/sanctuary/filet-guided-engine";
import { buildSkillSessionPayload, createUniversalSession, finishUniversalSession } from "@/lib/sanctuary/universal-session-engine";
import { captureSessionCommand, executeSessionCommand } from "@/lib/sanctuary/session-command";

const owner = "10000000-0000-4000-8000-000000000011";
type Command = ReturnType<typeof captureSessionCommand>;
type Snapshot = ReturnType<typeof buildLinkedFiletPatternSnapshot>;
declare global {
  interface Window {
    filetQA: {
      prepare(): Snapshot;
      revise(): void;
      useRemote(): Promise<void>;
      segments(snapshot: Snapshot, row: number): number[];
      createSession(projectId: string): ReturnType<typeof createUniversalSession>;
      queue(session: ReturnType<typeof createUniversalSession>, version: string, alias?: string): Command;
      finish(command: Command): ReturnType<typeof executeSessionCommand>;
    };
  }
}

export default function FiletBrowserFixture() {
  const [workspace, setWorkspace] = useState(() => readFiletStudioWorkspaceSafe(owner));
  const sync = useFiletWorkspaceSync(owner, workspace, setWorkspace);
  const save = useCallback((value: typeof workspace) => {
    const result = saveFiletStudioWorkspaceSafe(owner, value);
    if (!result.ok) throw new Error(result.error);
    setWorkspace(result.workspace);
  }, []);
  if (typeof window !== "undefined") {
    window.filetQA = {
      prepare() {
        const collection = createAlphabetCollection({
          name: "Alfabeto sintético",
          glyphs: Array.from(new Set("BABYLUCIO")).map((symbol, index) => createFiletGlyph({
            symbol,
            matrix: [[1, 0, 1], [0, 1, index % 2 === 0 ? 1 : 0], [1, 0, 1]],
          })),
        });
        const composed = composePhraseOnCanvas({
          collection, phrase: "Baby Lucio", canvas: createDefaultCanvasSpec(80, 12),
          letterSpacingCols: 1, wordSpacingCols: 4,
        });
        if (composed.missingCharacters.length || composed.matrix[0].length !== 80) throw new Error("Invalid synthetic design");
        const pattern = createVersionedPattern({ title: "Baby Lucio", matrix: composed.matrix, note: "Synthetic v1" });
        save({ ...createStarterFiletWorkspace(), collections: [collection], patterns: [pattern] });
        return buildLinkedFiletPatternSnapshot({
          patternId: pattern.id, patternName: pattern.title, version: pattern.versions[0],
          convention: createFiletTechnicalConvention(3, "rtl"), orientation: "bottom_to_top",
        });
      },
      revise() {
        save({ ...workspace, collections: workspace.collections.map(collection => ({ ...collection, name: "Alfabeto editado offline" })) });
      },
      useRemote: () => sync.resolveConflict("remote"),
      segments: (snapshot, row) => getGuidedRowInstruction(snapshot, row)?.runs.map((_, index) => index) ?? [],
      createSession: projectId => createUniversalSession({
        userId: owner, domain: "knitting", buildingId: "atelier", resourceId: projectId, resourceTitle: "Baby Lucio",
      }),
      queue(session, version, alias) {
        const finished = finishUniversalSession(session, undefined, Date.parse(session.startedAt) + 7 * 60_000);
        const payload = buildSkillSessionPayload(finished, {
          filet_pattern_version_id: version, project_id: session.resourceId, duration_minutes: 7,
        });
        return captureSessionCommand(localStorage, { ownerId: owner, operationId: alias ?? session.idempotencyKey, payload });
      },
      finish: command => executeSessionCommand(localStorage, command),
    };
  }
  return (
    <main>
      <h1>Filet QA — Baby Lucio</h1>
      <p id="sync-status">{sync.status}</p>
      <p id="alphabet">{workspace.collections[0]?.name}</p>
      <p id="pattern">{workspace.patterns[0]?.title}{workspace.patterns[0] ? " / " + workspace.patterns[0].currentVersion : ""}</p>
    </main>
  );
}
