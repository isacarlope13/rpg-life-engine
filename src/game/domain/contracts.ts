/** Original presentation contracts. IDs and events never grant authorization. */
import type { UserProfile, SkillDomain } from "../../types/rpg";

export type UserId = UserProfile["id"];
export type SceneId = string;
export type EntityId = string;
export type Vec2 = Readonly<{ x: number; y: number }>;
export type Facing = "north" | "south" | "east" | "west";
export type Pose = Readonly<{ sceneId: SceneId; position: Vec2; facing: Facing }>;
export type SourceRef = Readonly<{
  kind: "book" | "project" | "skill-resource" | "milestone" | "wishlist" | "tool";
  id: string;
}>;

export interface Scene {
  readonly id: SceneId;
  readonly kind: "outdoor" | "home" | "interior" | "special";
  readonly assetManifestId: string;
  readonly spawns: Readonly<Record<string, Omit<Pose, "sceneId">>>;
  readonly objectIds: readonly EntityId[];
  readonly doors: readonly Readonly<{
    id: EntityId;
    position: Vec2;
    targetSceneId: SceneId;
    targetSpawnId: string;
  }>[];
}

export interface SceneTransition {
  readonly id: string;
  readonly from: Pose;
  readonly to: Readonly<{ sceneId: SceneId; spawnId: string }>;
  readonly reason: "door" | "fast-travel" | "recovery";
  readonly phase: "preparing" | "entering" | "committed" | "cancelled" | "failed";
  readonly sessionPolicy: "preserve";
  readonly returnFocusId?: EntityId;
}

export type MovementState = "idle" | "walking" | "interacting" | "transitioning" | "paused";
export type AnimationState = Readonly<{ clipId: string; facing: Facing; motion: "full" | "reduced" }>;

export interface Character {
  readonly userId: UserId; // La identidad ya existente, nunca una segunda cuenta.
  readonly appearanceRef: string;
  readonly pose: Pose;
  readonly movement: MovementState;
  readonly animation: AnimationState;
  // XP, GP, nivel y habilidades se obtienen de la proyección RPG existente.
}

export interface PlayerInput {
  readonly source: "keyboard" | "pointer" | "touch" | "gamepad";
  readonly context: "exploration" | "overlay" | "text";
  readonly move: Vec2;
  readonly target?: Vec2;
  readonly actions: readonly ("interact" | "pause" | "back" | "open-inventory")[];
}

export type ObjectAction =
  | Readonly<{ kind: "open-tool"; tool: "session" | "books" | "projects" | "finance" | "quests"; resource?: SourceRef; domain?: SkillDomain }>
  | Readonly<{ kind: "rest"; mode: "pause" | "leave" }>;

export interface InteractiveObject {
  readonly id: EntityId;
  readonly sceneId: SceneId;
  readonly label: string;
  readonly position: Vec2;
  readonly range: number;
  readonly actions: readonly ObjectAction[];
  readonly accessibleActionId: string;
}

export interface NPC {
  readonly id: EntityId;
  readonly residentRef: string;
  readonly role: string;
  readonly pose: Pose;
  readonly behavior: "idle" | "walking" | "working" | "talking" | "resting";
  readonly animation: AnimationState;
  readonly dialogueId: string;
  readonly interactions: readonly EntityId[];
  readonly scheduleId?: string; // Ambiente; nunca requisito para abrir herramientas.
}

export interface Dialogue {
  readonly id: string;
  readonly speakerId: EntityId;
  readonly lines: readonly string[]; // Texto original; renderizado como texto, no HTML.
  readonly choices: readonly Readonly<{ id: string; label: string; action?: ObjectAction }>[];
  readonly skippable: true;
  readonly returnFocusId: string;
}

export interface InventoryView {
  readonly ownerId: UserId;
  readonly groups: readonly Readonly<{
    kind: "activity-resources" | "decorations" | "tools" | "cosmetics";
    entries: readonly Readonly<{ viewId: string; source: SourceRef; label: string; previewAssetId?: string }>[];
  }>[];
  // Vista por referencias: sin saldo, inventario monetario ni cantidades nuevas.
}

export interface QuestPresentation {
  readonly sourceQuestId: string;
  readonly label: string;
  readonly objective: string;
  readonly status: "available" | "active" | "completed" | "unavailable";
  readonly progressLabel: string;
  readonly existingRewardLabel?: string; // Solo representación del resultado/catálogo autorizado.
  readonly openExistingQuestActionId: string;
}

export type WorldEvent = Readonly<{ eventId: string; occurredAt: string } & (
  | { kind: "scene.entered"; transitionId: string; sceneId: SceneId }
  | { kind: "object.focused"; objectId: EntityId }
  | { kind: "activity.confirmed"; operationId: string; sourceSessionId: string }
  | { kind: "progress.refreshed"; projectionId: string }
)>;

export interface CollisionSystem {
  resolve(pose: Pose, desiredDisplacement: Vec2): Readonly<{ pose: Pose; blocked: boolean }>;
}

export interface CharacterController {
  step(current: Character, input: PlayerInput, deltaMs: number, collision: CollisionSystem): Character;
}

export type InteractionRange = Readonly<{ objectId: EntityId; radius: number; requiresSameScene: true }>;
export type CameraMode = "exploration" | "conversation" | "entry" | "object" | "story" | "pause";
