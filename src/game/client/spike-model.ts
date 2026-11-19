/** Geometry for the isolated G01 playground. No application data or rewards. */
export type Point = { x: number; y: number };
export type SceneId = "town" | "atelier";
export type Wall = Point & { width: number; height: number };
export const WORLD = { width: 1024, height: 768, step: 32, playerRadius: 15, inset: 16 };
export const LAYOUTS = {
  town: {
    label: "Plaza del Sauce",
    spawn: { x: 624, y: 656 },
    door: { x: 512, y: 320 },
    destination: "atelier" as SceneId,
    walls: [
      { x: 384, y: 96, width: 256, height: 192 },
      { x: 464, y: 432, width: 96, height: 64 },
      { x: 96, y: 256, width: 160, height: 112 },
      { x: 800, y: 288, width: 160, height: 256 },
    ],
  },
  atelier: {
    label: "Atelier de Hilados",
    spawn: { x: 512, y: 560 },
    door: { x: 512, y: 656 },
    destination: "town" as SceneId,
    walls: [
      { x: 128, y: 96, width: 768, height: 48 },
      { x: 128, y: 144, width: 48, height: 512 },
      { x: 848, y: 144, width: 48, height: 512 },
      { x: 128, y: 656, width: 320, height: 48 },
      { x: 576, y: 656, width: 320, height: 48 },
      { x: 320, y: 256, width: 160, height: 96 },
      { x: 672, y: 224, width: 96, height: 192 },
    ],
  },
} satisfies Record<SceneId, { label: string; spawn: Point; door: Point; destination: SceneId; walls: Wall[] }>;

export function canStand(point: Point, scene: SceneId): boolean {
  const r = WORLD.playerRadius;
  return point.x >= WORLD.inset + r && point.y >= WORLD.inset + r && point.x <= WORLD.width - WORLD.inset - r && point.y <= WORLD.height - WORLD.inset - r &&
    !LAYOUTS[scene].walls.some((w) => point.x + r > w.x && point.x - r < w.x + w.width && point.y + r > w.y && point.y - r < w.y + w.height);
}

export function nearDoor(point: Point, scene: SceneId): boolean {
  const door = LAYOUTS[scene].door;
  return Math.hypot(point.x - door.x, point.y - door.y) <= 64;
}

export function movementVector(x: number, y: number, speed = 180): Point {
  const length = Math.hypot(x, y);
  return length ? { x: x / length * speed, y: y / length * speed } : { x: 0, y: 0 };
}

/** Small four-neighbour route search: every waypoint clears the same solid walls. */
export function findRoute(from: Point, target: Point, scene: SceneId): Point[] {
  if (!canStand(target, scene)) return [];
  const step = WORLD.step;
  const cell = (p: Point) => ({ x: Math.floor(p.x / step), y: Math.floor(p.y / step) });
  const center = (p: Point) => ({ x: p.x * step + step / 2, y: p.y * step + step / 2 });
  const key = (p: Point) => `${p.x},${p.y}`;
  const start = cell(from), end = cell(target);
  if (!canStand(center(start), scene) || !canStand(center(end), scene)) return [];
  const queue = [start], parents = new Map<string, Point | null>([[key(start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (key(current) === key(end)) {
      const route: Point[] = [target];
      let next: Point | null = current;
      while (next) { route.push(center(next)); next = parents.get(key(next)) ?? null; }
      return route.reverse();
    }
    for (const delta of [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }]) {
      const next = { x: current.x + delta.x, y: current.y + delta.y };
      if (!parents.has(key(next)) && canStand(center(next), scene)) {
        parents.set(key(next), current); queue.push(next);
      }
    }
  }
  return [];
}
