export type Disposable = { destroy(): void };

/** A cancelled import must never create a game in an unmounted React host. */
export function mountLazyRuntime<T extends Disposable>(
  load: () => Promise<() => T>,
  onReady: (runtime: T) => void,
  onError: (error: unknown) => void,
): () => void {
  let cancelled = false;
  let runtime: T | undefined;
  void load().then((create) => {
    if (cancelled) return;
    runtime = create();
    if (cancelled) { runtime.destroy(); return; }
    onReady(runtime);
  }).catch((error: unknown) => { if (!cancelled) onError(error); });
  return () => {
    if (cancelled) return;
    cancelled = true;
    runtime?.destroy();
  };
}
