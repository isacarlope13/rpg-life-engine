"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isOfflineOwner } from "../offline-owner.ts";
import { safeLocalStorage } from "../storage-safe.ts";
import type { SessionStorage } from "./session-storage.ts";

function key(owner: string) { return `cozy_oakhaven_notes_v2_${encodeURIComponent(owner)}`; }
function valid(value: unknown, owner: string): value is { ownerId: string; notes: string[] } {
  if (!value || typeof value !== "object") return false;
  const data = value as { ownerId?: unknown; notes?: unknown };
  return data.ownerId === owner && Array.isArray(data.notes) && data.notes.every(note => typeof note === "string");
}
export function readOwnedNotes(storage: SessionStorage, owner?: string): string[] {
  if (!isOfflineOwner(owner)) return [];
  try { const data: unknown = JSON.parse(storage.getItem(key(owner)) ?? "null"); return valid(data, owner) ? data.notes : []; }
  catch { return []; }
}
export function saveOwnedNotes(storage: SessionStorage, owner: string | undefined, notes: string[]): boolean {
  if (!isOfflineOwner(owner) || !notes.every(note => typeof note === "string")) return false;
  try {
    const raw = storage.getItem(key(owner));
    if (raw && !valid(JSON.parse(raw), owner)) return false;
    return storage.setItem(key(owner), JSON.stringify({ ownerId: owner, notes })) !== false;
  } catch { return false; }
}

export function useOwnedNotes(userId?: string) {
  const owner = isOfflineOwner(userId) ? userId : undefined;
  const current = useRef(owner); current.current = owner;
  const ready = useRef<string | undefined>(undefined);
  const snapshot = useRef<string[]>([]);
  const [stored, setStored] = useState<{ owner?: string; notes: string[] }>({ notes: [] });
  const [draft, setDraft] = useState<{ owner?: string; text: string }>({ text: "" });
  const [error, setError] = useState<{ owner?: string; text: string }>({ text: "" });
  useEffect(() => {
    ready.current = owner;
    snapshot.current = readOwnedNotes(safeLocalStorage, owner);
    setStored({ owner, notes: snapshot.current });
    setDraft({ owner, text: "" });
    setError({ owner, text: "" });
    return () => { ready.current = undefined; };
  }, [owner]);
  const write = useCallback((notes: string[]) => {
    if (!owner || current.current !== owner || ready.current !== owner) return false;
    if (!saveOwnedNotes(safeLocalStorage, owner, notes)) {
      setError({ owner, text: "No se confirmó el guardado de notas. Conserva el texto y reintenta." }); return false;
    }
    snapshot.current = notes;
    setStored({ owner, notes });
    setError({ owner, text: "" });
    return true;
  }, [owner]);
  return {
    notesList: owner && stored.owner === owner ? stored.notes : [],
    quickNote: owner && draft.owner === owner ? draft.text : "",
    notesError: owner && error.owner === owner ? error.text : "",
    setQuickNote(text: string) { if (owner && current.current === owner) setDraft({ owner, text }); },
    addNote(text: string) { return !!text.trim() && write([text.trim(), ...snapshot.current]); },
    removeNote(index: number) { return index >= 0 && index < snapshot.current.length && write(snapshot.current.filter((_, i) => i !== index)); },
  };
}
