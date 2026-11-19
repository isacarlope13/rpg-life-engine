"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, DoorOpen, Footprints, Home, Pause, Play, RotateCcw } from "lucide-react";
import type { PlaygroundRuntime, PlaygroundSnapshot } from "@/game/client/boot";
import { mountLazyRuntime } from "@/game/client/spike-lifecycle";
import styles from "./game-playground.module.css";

export function GamePlayground() {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<PlaygroundRuntime | null>(null);
  const [snapshot, setSnapshot] = useState<PlaygroundSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [generation, setGeneration] = useState(0);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!mounted || !host.current) return;
    const element = host.current;
    setStatus("loading"); setSnapshot(null);
    let active = true;
    let cancelMount = () => {};
    const timeout = window.setTimeout(() => {
      if (active) { active = false; cancelMount(); runtime.current = null; setStatus("error"); }
    }, 15000);
    const unmount = mountLazyRuntime(
      async () => {
        const { createPlayground } = await import("@/game/client/boot");
        return () => createPlayground(element, (next) => {
          if (!active) return;
          window.clearTimeout(timeout); setSnapshot(next); setStatus("ready");
        });
      },
      (next) => { runtime.current = next; },
      () => { window.clearTimeout(timeout); if (active) setStatus("error"); },
    );
    cancelMount = unmount;
    return () => {
      active = false; window.clearTimeout(timeout);
      unmount(); runtime.current = null;
    };
  }, [mounted, generation]);

  const available = status === "ready" && mounted;
  const indoors = snapshot?.scene === "atelier";
  const interact = () => runtime.current?.interact();
  const directions = [
    { label: "Caminar hacia arriba", x: 0, y: -1, Icon: ArrowUp, area: "up" },
    { label: "Caminar hacia la izquierda", x: -1, y: 0, Icon: ArrowLeft, area: "left" },
    { label: "Caminar hacia abajo", x: 0, y: 1, Icon: ArrowDown, area: "down" },
    { label: "Caminar hacia la derecha", x: 1, y: 0, Icon: ArrowRight, area: "right" },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="OakHaven, volver al inicio"><span className={styles.mark}>O</span> OakHaven<span className={styles.edition}>UN LUGAR PARA CRECER</span></Link>
        <Link href="/dashboard" className={styles.returnLink}><Home size={15} /> Mi partida</Link>
      </header>

      <section className={styles.intro} aria-labelledby="play-title">
        <p className={styles.eyebrow}>EL PUEBLO ABRE SUS PUERTAS</p>
        <h1 id="play-title">Hoy, empieza con un paseo.</h1>
        <p>No hay prisa. Sigue el sendero, encuentra el Atelier y haz tuyo este pequeño rincón.</p>
      </section>

      <section className={styles.world} aria-label="Pueblo explorable de OakHaven"
        data-game-status={mounted ? status : "unmounted"} data-game-scene={snapshot?.scene ?? "loading"}
        data-player-x={snapshot?.x ?? ""} data-player-y={snapshot?.y ?? ""}>
        {mounted && <div ref={host} className={styles.canvas} tabIndex={0} role="region" aria-label="Mundo explorable. Flechas o WASD para caminar; E o Enter para usar la puerta; Escape para pausar." aria-describedby="movement-help" />}
        {(!mounted || status !== "ready") && <div className={styles.loading} role="status">
          <span className={styles.loadingIcon}>✦</span>
          <h2>{!mounted ? "Hasta el próximo paseo." : status === "error" ? "El pueblo aún no pudo abrirse." : "Preparando un rincón para ti…"}</h2>
          <p>{!mounted ? "Puedes regresar cuando quieras." : status === "error" ? "Intenta abrirlo de nuevo o vuelve a tu partida. Tu progreso sigue allí." : "Un momento de calma antes de salir."}</p>
          {status === "error" && mounted && <button className={styles.primary} onClick={() => setGeneration((n) => n + 1)}>Volver a intentar</button>}
        </div>}

        {available && <>
          <div className={styles.location}><span className={styles.locationDot} /><div><span>ESTÁS EN</span><strong>{indoors ? "Atelier de Hilados" : "Plaza del Sauce"}</strong></div></div>
          <button className={styles.pause} onClick={() => runtime.current?.pause(!snapshot?.paused)} aria-label={snapshot?.paused ? "Reanudar paseo" : "Pausar paseo"} aria-pressed={snapshot?.paused}>
            {snapshot?.paused ? <Play size={19} /> : <Pause size={19} />}
          </button>
          {snapshot?.paused && <div className={styles.pauseMessage} role="status"><span>Un respiro también es parte del camino.</span><button className={styles.primary} onClick={() => runtime.current?.pause(false)}>Seguir explorando</button></div>}
          <div className={styles.hint} role="status" aria-live="polite">
            <span className={styles.hintIcon}>{indoors ? "🧶" : "✦"}</span>
            <div><strong>{snapshot?.nearDoor ? indoors ? "La plaza te espera" : "Un taller lleno de posibilidades" : indoors ? "Aquí empieza una obra" : "Cada sendero, un comienzo"}</strong>
              <span>{snapshot?.nearDoor ? "Usa la puerta cuando quieras." : indoors ? "Por ahora puedes recorrer el espacio. Las actividades llegarán después." : "Toca el suelo para caminar o sigue el camino al Atelier."}</span></div>
            {snapshot?.nearDoor && <button className={styles.primary} onClick={interact} disabled={snapshot.paused}><DoorOpen size={16} />{indoors ? "Salir" : "Entrar"}</button>}
          </div>
        </>}
      </section>

      <div className={styles.below}>
        <div><p id="movement-help" className={styles.help}><Footprints size={16} /> Toca un destino o camina con WASD / flechas. E para entrar. Esc para descansar.</p>
          <p className={styles.notice}>Paseo de prueba · No modifica tu cuenta ni entrega GP o XP.</p></div>
        <div className={styles.tools}>
          <button disabled={!available || snapshot?.paused} onClick={() => runtime.current?.travelToDoor()}><DoorOpen size={15} />{indoors ? "Ir a la salida" : "Ir al Atelier"}</button>
          <button disabled={!available} onClick={() => runtime.current?.reset()} aria-label="Volver al punto de llegada"><RotateCcw size={15} /></button>
        </div>
      </div>

      <div className={styles.accessibility}>
        <details><summary>Controles de movimiento y opciones de acceso</summary>
          <p>Mantén pulsada una dirección. También puedes ir hasta la puerta y usarla con los botones. Sin límite de tiempo.</p>
          <div className={styles.accessRow}>
            <div className={styles.pad}>
              {directions.map(({ label, x, y, Icon, area }) => <button key={area} aria-label={label} style={{ gridArea: area }} disabled={!available || snapshot?.paused}
                onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); runtime.current?.direction(x, y); }}
                onPointerUp={() => runtime.current?.direction(0, 0)} onPointerCancel={() => runtime.current?.direction(0, 0)} onLostPointerCapture={() => runtime.current?.direction(0, 0)}
                onKeyDown={(event) => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); runtime.current?.direction(x, y); } }}
                onKeyUp={() => runtime.current?.direction(0, 0)} onBlur={() => runtime.current?.direction(0, 0)}><Icon size={22} /></button>)}
            </div>
            <button className={styles.primary} disabled={!available || !snapshot?.nearDoor || snapshot.paused} onClick={interact}>{indoors ? "Salir a la plaza" : "Usar la puerta del Atelier"}</button>
          </div>
        </details>
        <button className={styles.close} onClick={() => { setMounted((value) => !value); setSnapshot(null); }}>{mounted ? "Cerrar paseo" : "Abrir paseo"}</button>
      </div>
      <footer className={styles.footer}><span>OAKHAVEN</span><span>Tu historia crece a tu ritmo.</span><Link href="/quick">Registro rápido ↗</Link></footer>
    </main>
  );
}
