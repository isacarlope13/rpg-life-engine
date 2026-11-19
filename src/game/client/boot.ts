import Phaser from "phaser";
import { WORLD, LAYOUTS, findRoute, movementVector, nearDoor, type Point, type SceneId } from "./spike-model.ts";

export type PlaygroundSnapshot = { scene: SceneId; x: number; y: number; nearDoor: boolean; paused: boolean };
export type PlaygroundRuntime = {
  destroy(): void;
  direction(x: number, y: number): void;
  travelToDoor(): void;
  interact(): void;
  pause(paused: boolean): void;
  reset(): void;
};

/** Only rendering and local input. This module deliberately has no application-service imports. */
export function createPlayground(host: HTMLElement, onSnapshot: (snapshot: PlaygroundSnapshot) => void): PlaygroundRuntime {
  let disposed = false;
  let ready = false;
  let pad: Point = { x: 0, y: 0 };
  let paused = false;
  let current: VillageScene;

  class VillageScene extends Phaser.Scene {
    private place: SceneId = "town";
    private actor!: Phaser.GameObjects.Rectangle;
    private body!: Phaser.Physics.Arcade.Body;
    private visitor!: Phaser.GameObjects.Image;
    private shadow!: Phaser.GameObjects.Ellipse;
    private keys!: Record<string, Phaser.Input.Keyboard.Key>;
    private route: Point[] = [];
    private facing = "down";
    private lastPublish = 0;

    constructor() { super("village"); current = this; }

    create() {
      if (disposed) return;
      this.makeVisitor();
      this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,E,ENTER,ESC", false) as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        host.focus({ preventScroll: true });
        if (!paused) this.route = findRoute(this.actor, { x: pointer.worldX, y: pointer.worldY }, this.place);
      });
      this.scale.on("resize", this.resizeCamera, this);
      this.build("town");
      ready = true;
    }

    private makeVisitor() {
      for (const face of ["up", "down", "left", "right"]) for (let frame = 0; frame < 3; frame++) {
        const key = `visitor-${face}-${frame}`;
        const g = this.add.graphics();
        g.fillStyle(0x493e35).fillRect(7, 3, 10, 8);
        g.fillStyle(0xedc7a1).fillRect(8, 9, 8, 7);
        g.fillStyle(0x425f61).fillRect(5, 16, 14, 10);
        g.fillStyle(0xe9dba9).fillRect(6, 17, 3, 7);
        const stride = frame === 1 ? 2 : frame === 2 ? -2 : 0;
        g.fillStyle(0x51483f).fillRect(7, 26, 4, 4 + Math.max(0, stride)).fillRect(13, 26, 4, 4 + Math.max(0, -stride));
        g.fillStyle(0x334038).fillRect(6, 29 + Math.max(0, stride), 5, 2).fillRect(13, 29 + Math.max(0, -stride), 5, 2);
        g.fillStyle(0xceb17e).fillRect(5, 5, 14, 4).fillRect(3, 8, 18, 3);
        if (face !== "up") {
          g.fillStyle(0x493e35);
          if (face !== "left") g.fillRect(14, 12, 2, 2);
          if (face !== "right") g.fillRect(9, 12, 2, 2);
        }
        g.generateTexture(key, 24, 34); g.destroy();
      }
    }

    private build(place: SceneId, returning = false) {
      this.physics.world.colliders.destroy();
      this.children.removeAll(true);
      this.place = place; this.route = []; pad = { x: 0, y: 0 };
      const g = this.add.graphics();
      const rect = (x: number, y: number, w: number, h: number, color: number) => { g.fillStyle(color).fillRect(x, y, w, h); };
      if (place === "town") {
        rect(0, 0, WORLD.width, WORLD.height, 0xa8bf92);
        for (let i = 0; i < 170; i++) {
          const x = (i * 137 + 31) % 1024, y = (i * 89 + 19) % 768;
          rect(x, y, 3, 7, i % 3 ? 0x93ad7e : 0xc0cc9e); rect(x + 4, y - 2, 3, 6, 0x93ad7e);
        }
        rect(448, 280, 128, 488, 0xdccaa4); rect(208, 544, 544, 96, 0xdccaa4);
        rect(456, 292, 112, 472, 0xe6d5b2); rect(216, 552, 528, 80, 0xe6d5b2);
        for (let i = 0; i < 24; i++) rect(470 + (i % 3) * 33, 344 + Math.floor(i / 3) * 48, 16, 3, 0xc9b998);
        // Original cottage, sign and garden, drawn from simple geometry.
        rect(392, 122, 256, 182, 0x728363); rect(384, 112, 256, 176, 0xf2e1bc);
        rect(384, 240, 256, 48, 0xcaaa82);
        g.fillStyle(0x855e4f).fillTriangle(360, 112, 512, 20, 664, 112);
        g.fillStyle(0xa67359).fillTriangle(376, 100, 512, 32, 648, 100);
        for (let y = 76; y <= 100; y += 12) rect(428 - (y - 76), y, 168 + (y - 76) * 2, 3, 0x95664f);
        rect(484, 214, 56, 74, 0x6b5344); rect(492, 222, 40, 66, 0x8b7054); rect(521, 254, 4, 4, 0xe8ce80);
        for (const x of [410, 566]) {
          rect(x, 154, 48, 52, 0x8b7054); rect(x + 5, 159, 38, 42, 0xb7cfcc);
          rect(x + 22, 158, 4, 44, 0xf7ebd1); rect(x + 4, 178, 40, 4, 0xf7ebd1);
          rect(x - 3, 203, 54, 10, 0x8b7054);
        }
        this.label(512, 126, "ATELIER", "#4e5343", 15);
        // Fountain is solid; tap navigation walks around it.
        g.fillStyle(0x71877c).fillEllipse(512, 480, 118, 60);
        g.fillStyle(0xc6c7b1).fillEllipse(512, 456, 112, 68);
        g.fillStyle(0x7fa8a6).fillEllipse(512, 451, 90, 46);
        rect(502, 420, 20, 34, 0xe0d8bc); rect(496, 416, 32, 8, 0xf2e5c8);
        rect(96, 256, 160, 112, 0xd0b487); rect(88, 248, 176, 24, 0x8c6952);
        rect(112, 280, 128, 6, 0xf0dfbc); this.label(176, 314, "JARDÍN", "#536149", 14);
        rect(800, 288, 160, 256, 0x789d91); rect(812, 300, 136, 232, 0x9bbeb0);
        for (const [x, y] of [[100, 120], [244, 100], [744, 112], [924, 112], [112, 560], [844, 652]]) {
          rect(x - 7, y, 14, 40, 0x80614b); rect(x - 40, y - 64, 80, 72, 0x5c805b);
          rect(x - 30, y - 78, 60, 62, 0x719263); rect(x - 20, y - 84, 34, 26, 0x8ea778);
        }
        for (let i = 0; i < 24; i++) {
          const x = 312 + (i % 4) * 14, y = 206 + Math.floor(i / 4) * 20;
          rect(x, y, 3, 9, 0x5c805b); rect(x - 2, y - 3, 7, 5, i % 2 ? 0xd5a07e : 0xf2db9b);
        }
        this.label(668, 595, "PLAZA DEL SAUCE", "#6e684e", 13);
        this.label(758, 738, "Un paso a la vez.", "#536149", 14);
      } else {
        rect(0, 0, WORLD.width, WORLD.height, 0x665b4d); rect(128, 96, 768, 608, 0xd2b68a);
        for (let y = 144; y < 688; y += 32) rect(176, y, 672, 2, 0xbba077);
        for (const w of LAYOUTS.atelier.walls) rect(w.x, w.y, w.width, w.height, 0x927757);
        rect(176, 144, 672, 30, 0xf0ddba); rect(448, 656, 128, 48, 0xe5d5b5);
        rect(288, 424, 320, 128, 0xa6b39b); rect(300, 436, 296, 104, 0xbdc6a6);
        rect(336, 234, 12, 130, 0x705540); rect(452, 234, 12, 130, 0x705540);
        rect(336, 238, 128, 12, 0xb18b60);
        for (let x = 354; x < 450; x += 8) rect(x, 252, 3, 84, 0xf0dcac);
        rect(353, 287, 95, 40, 0x799390);
        for (let y = 248; y < 400; y += 50) {
          rect(680, y, 80, 8, 0x654d3b);
          for (let x = 688; x < 750; x += 18) rect(x, y - 19, 13, 18, (x % 4) ? 0xc48c77 : 0xb6c29d);
        }
        this.label(512, 190, "ATELIER DE HILADOS", "#614c3b", 20);
        this.label(464, 590, "El taller te espera.", "#675b49", 16);
        this.label(512, 727, "SALIDA A LA PLAZA", "#e8dbbe", 13);
      }
      const solids = this.physics.add.staticGroup();
      for (const w of LAYOUTS[place].walls) {
        const shape = this.add.rectangle(w.x + w.width / 2, w.y + w.height / 2, w.width, w.height, 0, 0);
        solids.add(shape);
      }
      const spawn = returning && place === "town" ? { x: 512, y: 336 } : LAYOUTS[place].spawn;
      this.shadow = this.add.ellipse(spawn.x, spawn.y + 3, 30, 12, 0x3e5845, 0.25);
      this.actor = this.add.rectangle(spawn.x, spawn.y, 24, 18, 0, 0);
      this.physics.add.existing(this.actor);
      this.body = this.actor.body as Phaser.Physics.Arcade.Body;
      this.body.setCollideWorldBounds(true);
      this.physics.world.setBounds(WORLD.inset, WORLD.inset, WORLD.width - WORLD.inset * 2, WORLD.height - WORLD.inset * 2);
      this.physics.add.collider(this.actor, solids);
      this.visitor = this.add.image(spawn.x, spawn.y - 21, "visitor-down-0").setScale(1.5);
      this.cameras.main.setBounds(0, 0, WORLD.width, WORLD.height);
      this.cameras.main.startFollow(this.actor, true, 1, 1);
      this.resizeCamera();
      if (paused) this.physics.pause();
      this.publish();
    }

    private label(x: number, y: number, text: string, color: string, size: number) {
      this.add.text(x, y, text, { fontFamily: "Georgia, serif", fontSize: `${size}px`, color }).setOrigin(0.5);
    }

    private resizeCamera() {
      // Keep the character legible on a narrow screen; the camera reveals the rest by walking.
      this.cameras.main.setZoom(this.scale.width < 600 ? 1 : Math.min(1.1, this.scale.width / 1024));
    }

    private publish() {
      if (!disposed) onSnapshot({ scene: this.place, x: Math.round(this.actor.x), y: Math.round(this.actor.y), nearDoor: nearDoor(this.actor, this.place), paused });
    }

    interact() {
      if (!paused && nearDoor(this.actor, this.place)) this.build(LAYOUTS[this.place].destination, true);
    }

    travel() { if (!paused) this.route = findRoute(this.actor, LAYOUTS[this.place].door, this.place); }
    stop() { pad = { x: 0, y: 0 }; this.route = []; this.body?.setVelocity(0, 0); this.input.keyboard?.resetKeys(); }
    setPaused(value: boolean) { this.stop(); if (value) this.physics.pause(); else this.physics.resume(); this.publish(); }
    reset() { this.stop(); this.build(this.place); }

    update(time: number) {
      if (disposed || !this.body) return;
      const focused = host === document.activeElement || host.contains(document.activeElement) && document.activeElement?.tagName === "CANVAS";
      if (focused && Phaser.Input.Keyboard.JustDown(this.keys.ESC)) { paused = !paused; this.setPaused(paused); }
      if (paused) return;
      if (focused && (Phaser.Input.Keyboard.JustDown(this.keys.E) || Phaser.Input.Keyboard.JustDown(this.keys.ENTER))) { this.interact(); return; }
      let x = pad.x, y = pad.y;
      if (focused) {
        x += Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
        y += Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
      }
      if (x || y) this.route = [];
      else if (this.route.length) {
        const target = this.route[0], dx = target.x - this.actor.x, dy = target.y - this.actor.y;
        if (Math.hypot(dx, dy) < 5) this.route.shift();
        else { x = dx; y = dy; }
      }
      const velocity = movementVector(x, y);
      this.body.setVelocity(velocity.x, velocity.y);
      if (x || y) this.facing = Math.abs(x) > Math.abs(y) ? x > 0 ? "right" : "left" : y > 0 ? "down" : "up";
      const frame = (x || y) ? Math.floor(time / 140) % 3 : 0;
      this.visitor.setTexture(`visitor-${this.facing}-${frame}`).setPosition(this.actor.x, this.actor.y - 21);
      this.shadow.setPosition(this.actor.x, this.actor.y + 3);
      if (time - this.lastPublish > 250) { this.publish(); this.lastPublish = time; }
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    backgroundColor: "#a8bf92",
    pixelArt: true,
    antialias: false,
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.RESIZE, width: host.clientWidth, height: host.clientHeight },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    fps: { target: 60, forceSetTimeOut: false },
    scene: [VillageScene],
  });
  const stop = () => { if (ready && !disposed) current.stop(); };
  const visibility = () => { if (document.hidden) stop(); };
  const preventScroll = (event: KeyboardEvent) => {
    if (document.activeElement === host && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(event.key)) event.preventDefault();
  };
  host.addEventListener("keydown", preventScroll);
  host.addEventListener("focusout", stop);
  window.addEventListener("blur", stop);
  document.addEventListener("visibilitychange", visibility);
  return {
    direction(x, y) { if (!disposed && !paused) pad = { x, y }; },
    travelToDoor() { if (ready && !disposed) current.travel(); },
    interact() { if (ready && !disposed) current.interact(); },
    pause(value) { paused = value; if (ready && !disposed) current.setPaused(value); },
    reset() { if (ready && !disposed) current.reset(); },
    destroy() {
      if (disposed) return;
      stop(); disposed = true;
      host.removeEventListener("keydown", preventScroll);
      host.removeEventListener("focusout", stop);
      window.removeEventListener("blur", stop);
      document.removeEventListener("visibilitychange", visibility);
      // Phaser completes disposal on its next frame, even after the tab was sleeping.
      game.loop.wake(); game.destroy(true); game.canvas?.remove();
    },
  };
}
