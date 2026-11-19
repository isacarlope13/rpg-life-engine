import type { PlayerInput } from "./contracts.ts";

/** Supplied by the host; no DOM, device listeners or account state in the domain. */
export interface InputContextState {
  readonly focused: boolean;
  readonly paused: boolean;
  readonly overlayOpen: boolean;
  readonly textFocused: boolean;
  readonly composing: boolean;
}

export function inputContext(state: InputContextState): PlayerInput["context"] {
  if (state.textFocused || state.composing) return "text";
  if (state.overlayOpen || state.paused || !state.focused) return "overlay";
  return "exploration";
}

/** Call on every sample. The host must clear held keys/routes on blur or context changes. */
export function routeWorldInput(input: PlayerInput, state: InputContextState): PlayerInput {
  const context = inputContext(state);
  if (context !== "exploration" || input.context !== "exploration") {
    return { source: input.source, context, move: { x: 0, y: 0 }, actions: [] };
  }
  const x = Number.isFinite(input.move.x) ? input.move.x : 0;
  const y = Number.isFinite(input.move.y) ? input.move.y : 0;
  // Scale first to avoid overflow for malformed large vectors.
  const scale = Math.max(1, Math.abs(x), Math.abs(y));
  const sx = x / scale;
  const sy = y / scale;
  const divisor = Math.max(1 / scale, Math.hypot(sx, sy));
  const target = input.target && Number.isFinite(input.target.x) && Number.isFinite(input.target.y)
    ? { x: input.target.x, y: input.target.y } : undefined;
  return {
    source: input.source,
    context,
    move: { x: sx / divisor, y: sy / divisor },
    ...(target ? { target } : {}),
    actions: [...new Set(input.actions)],
  };
}
