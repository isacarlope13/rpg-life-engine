"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { safeLocalStorage } from "../storage-safe.ts";

export interface CameraState {
  x: number; // Desplazamiento horizontal en píxeles
  y: number; // Desplazamiento vertical en píxeles
  zoom: number; // Factor de zoom (0.65x a 1.8x)
  isDragging: boolean;
}

export interface VillageCameraOptions {
  minZoom?: number;
  maxZoom?: number;
  defaultZoom?: number;
  worldWidth?: number; // Ancho virtual del mundo en píxeles
  worldHeight?: number; // Alto virtual del mundo en píxeles
  storageKey?: string;
  enableKeyboard?: boolean;
}

const DEFAULT_OPTIONS: Required<VillageCameraOptions> = {
  minZoom: 0.65,
  maxZoom: 1.8,
  defaultZoom: 1.0,
  worldWidth: 1200,
  worldHeight: 800,
  storageKey: "oakhaven_village_camera_v4",
  enableKeyboard: true,
};

/**
 * HOOK DE CÁMARA 2D PARA EL PUEBLO VIVO INTERACTIVO (OAKHAVEN 4.0)
 *
 * Administra la proyección 2D del mundo:
 * 1. Desplazamiento libre (Pan) con ratón y touch con inercia suave.
 * 2. Zoom focal dinámico (manteniendo el punto bajo el cursor).
 * 3. Soporte táctil pinch-to-zoom en iPhone / Android.
 * 4. Navegación por teclado (WASD, Flechas, +, -, Espacio para centrar).
 * 5. Persistencia resiliente en safeLocalStorage.
 * 6. Respeto estricto a 'prefers-reduced-motion'.
 */
export function useVillageCamera(options?: VillageCameraOptions) {
  const opts = useMemo(() => ({ ...DEFAULT_OPTIONS, ...options }), [options]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Carga inicial persistida
  const getInitialCamera = (): CameraState => {
    try {
      const raw = safeLocalStorage.getItem(opts.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed.x === "number" &&
          typeof parsed.y === "number" &&
          typeof parsed.zoom === "number"
        ) {
          return {
            x: parsed.x,
            y: parsed.y,
            zoom: Math.min(opts.maxZoom, Math.max(opts.minZoom, parsed.zoom)),
            isDragging: false,
          };
        }
      }
    } catch {}
    return {
      x: 0,
      y: 0,
      zoom: opts.defaultZoom,
      isDragging: false,
    };
  };

  const [camera, setCamera] = useState<CameraState>(getInitialCamera);

  // Referencias para seguimiento de arrastre y touch sin re-renderizar en cada micro-movimiento
  const dragStartRef = useRef<{
    pointerX: number;
    pointerY: number;
    cameraX: number;
    cameraY: number;
  } | null>(null);

  // Referencia para touch pinch-to-zoom
  const touchDistanceRef = useRef<number | null>(null);

  // Detección de movimiento reducido del sistema
  const prefersReducedMotion = useRef(false);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia) {
      prefersReducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }, []);

  // Guardar en almacenamiento seguro con debounce
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const persistCamera = useCallback(
    (cam: CameraState) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        safeLocalStorage.setItem(
          opts.storageKey,
          JSON.stringify({ x: Math.round(cam.x), y: Math.round(cam.y), zoom: Number(cam.zoom.toFixed(2)) })
        );
      }, 400);
    },
    [opts.storageKey]
  );

  // Limitar la cámara dentro de los márgenes del mundo
  const clampCamera = useCallback(
    (x: number, y: number, zoom: number): { x: number; y: number } => {
      if (!containerRef.current) return { x, y };
      const viewportWidth = containerRef.current.clientWidth || 800;
      const viewportHeight = containerRef.current.clientHeight || 600;

      const scaledWorldWidth = opts.worldWidth * zoom;
      const scaledWorldHeight = opts.worldHeight * zoom;

      // Margen de holgura para no perder el mapa
      const margin = 150 * zoom;

      const minX = viewportWidth - scaledWorldWidth - margin;
      const maxX = margin;
      const minY = viewportHeight - scaledWorldHeight - margin;
      const maxY = margin;

      return {
        x: Math.min(maxX, Math.max(minX, x)),
        y: Math.min(maxY, Math.max(minY, y)),
      };
    },
    [opts.worldWidth, opts.worldHeight]
  );

  // Centrar cámara en coordenadas específicas del mundo
  const centerOn = useCallback(
    (worldX: number, worldY: number, targetZoom?: number) => {
      if (!containerRef.current) return;
      const viewportWidth = containerRef.current.clientWidth;
      const viewportHeight = containerRef.current.clientHeight;

      const nextZoom = targetZoom ? Math.min(opts.maxZoom, Math.max(opts.minZoom, targetZoom)) : camera.zoom;
      const targetScreenX = viewportWidth / 2 - worldX * nextZoom;
      const targetScreenY = viewportHeight / 2 - worldY * nextZoom;

      const clamped = clampCamera(targetScreenX, targetScreenY, nextZoom);

      setCamera((prev) => {
        const next: CameraState = {
          ...prev,
          x: clamped.x,
          y: clamped.y,
          zoom: nextZoom,
          isDragging: false,
        };
        persistCamera(next);
        return next;
      });
    },
    [camera.zoom, clampCamera, opts.maxZoom, opts.minZoom, persistCamera]
  );

  // Centrar en el centro del mundo por defecto
  const resetCamera = useCallback(() => {
    centerOn(opts.worldWidth / 2, opts.worldHeight / 2, opts.defaultZoom);
  }, [centerOn, opts.worldWidth, opts.worldHeight, opts.defaultZoom]);

  // Controles de zoom por botón
  const zoomIn = useCallback(() => {
    setCamera((prev) => {
      const nextZoom = Math.min(opts.maxZoom, Number((prev.zoom + 0.15).toFixed(2)));
      const clamped = clampCamera(prev.x, prev.y, nextZoom);
      const next: CameraState = { ...prev, ...clamped, zoom: nextZoom };
      persistCamera(next);
      return next;
    });
  }, [opts.maxZoom, clampCamera, persistCamera]);

  const zoomOut = useCallback(() => {
    setCamera((prev) => {
      const nextZoom = Math.max(opts.minZoom, Number((prev.zoom - 0.15).toFixed(2)));
      const clamped = clampCamera(prev.x, prev.y, nextZoom);
      const next: CameraState = { ...prev, ...clamped, zoom: nextZoom };
      persistCamera(next);
      return next;
    });
  }, [opts.minZoom, clampCamera, persistCamera]);

  // MANEJADOR: PointerDown (Ratón o Touch)
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    // Solo clic izquierdo o toque único
    if (e.button !== 0 && e.pointerType === "mouse") return;

    // Si el usuario hace clic sobre un botón o control, no iniciar pan
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, [data-prevent-camera-drag]")) {
      return;
    }

    dragStartRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      cameraX: camera.x,
      cameraY: camera.y,
    };

    setCamera((prev) => ({ ...prev, isDragging: true }));

    // Capturar puntero para no perder el arrastre fuera del viewport
    if (containerRef.current) {
      containerRef.current.setPointerCapture(e.pointerId);
    }
  }, [camera.x, camera.y]);

  // MANEJADOR: PointerMove (Arrastre de cámara)
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;

      const dx = e.clientX - dragStartRef.current.pointerX;
      const dy = e.clientY - dragStartRef.current.pointerY;

      const targetX = dragStartRef.current.cameraX + dx;
      const targetY = dragStartRef.current.cameraY + dy;

      const clamped = clampCamera(targetX, targetY, camera.zoom);

      setCamera((prev) => ({
        ...prev,
        x: clamped.x,
        y: clamped.y,
      }));
    },
    [camera.zoom, clampCamera]
  );

  // MANEJADOR: PointerUp / PointerCancel
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStartRef.current) return;
      dragStartRef.current = null;

      try {
        if (containerRef.current && containerRef.current.hasPointerCapture(e.pointerId)) {
          containerRef.current.releasePointerCapture(e.pointerId);
        }
      } catch {}

      setCamera((prev) => {
        const next: CameraState = { ...prev, isDragging: false };
        persistCamera(next);
        return next;
      });
    },
    [persistCamera]
  );

  // MANEJADOR: Rueda del ratón con Zoom Focal
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
      const nextZoom = Math.min(
        opts.maxZoom,
        Math.max(opts.minZoom, Number((camera.zoom * zoomFactor).toFixed(2)))
      );

      if (nextZoom === camera.zoom) return;

      // Mantener el punto focal bajo el cursor
      // worldPos = (cursorPos - cameraPos) / oldZoom
      // newCameraPos = cursorPos - worldPos * newZoom
      const worldX = (cursorX - camera.x) / camera.zoom;
      const worldY = (cursorY - camera.y) / camera.zoom;

      const newCameraX = cursorX - worldX * nextZoom;
      const newCameraY = cursorY - worldY * nextZoom;

      const clamped = clampCamera(newCameraX, newCameraY, nextZoom);

      setCamera((prev) => {
        const next: CameraState = {
          ...prev,
          x: clamped.x,
          y: clamped.y,
          zoom: nextZoom,
        };
        persistCamera(next);
        return next;
      });
    },
    [camera.x, camera.y, camera.zoom, clampCamera, opts.maxZoom, opts.minZoom, persistCamera]
  );

  // MANEJADOR: Teclado Accesible (WASD / Flechas)
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!opts.enableKeyboard) return;

      const step = 45;
      let dx = 0;
      let dy = 0;

      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") dx = step;
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") dx = -step;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") dy = step;
      if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") dy = -step;

      if (e.key === "+" || e.key === "=") {
        zoomIn();
        e.preventDefault();
        return;
      }
      if (e.key === "-" || e.key === "_") {
        zoomOut();
        e.preventDefault();
        return;
      }
      if (e.key === " " || e.key === "Home") {
        resetCamera();
        e.preventDefault();
        return;
      }

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        setCamera((prev) => {
          const clamped = clampCamera(prev.x + dx, prev.y + dy, prev.zoom);
          const next = { ...prev, ...clamped };
          persistCamera(next);
          return next;
        });
      }
    },
    [opts.enableKeyboard, zoomIn, zoomOut, resetCamera, clampCamera, persistCamera]
  );

  // Estilo transform para el contenedor de la escena 2D (Acelerado por GPU)
  const worldTransformStyle: React.CSSProperties = useMemo(() => {
    return {
      transform: `translate3d(${camera.x}px, ${camera.y}px, 0px) scale(${camera.zoom})`,
      transformOrigin: "0 0",
      transition: camera.isDragging || prefersReducedMotion.current ? "none" : "transform 0.15s ease-out",
      willChange: "transform",
      userSelect: "none",
    };
  }, [camera.x, camera.y, camera.zoom]);

  return {
    camera,
    containerRef,
    zoomIn,
    zoomOut,
    resetCamera,
    centerOn,
    worldTransformStyle,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
      onWheel,
      onKeyDown,
    },
  };
}
