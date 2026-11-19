"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Plus,
  Minus,
  Crosshair,
  Pencil,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Layers,
  Move,
  AlertTriangle,
} from "lucide-react";
import type { SkillDomain, SkillDomainSummary, SkillSessionRecord } from "@/types/rpg";
import {
  calculateBuildingTier,
  COZY_VILLAGE_RESIDENTS,
  type VillageResident,
} from "@/lib/sanctuary/village-tiers";
import type { VillageBuildingDefinition } from "@/lib/sanctuary/village-buildings-registry";
import { useUniversalSession } from "@/lib/sanctuary/use-universal-session";
import {
  useVillageCamera,
  type CameraState,
} from "@/lib/sanctuary/use-village-camera";
import {
  loadCustomVillageCoordinates,
  saveCustomVillageCoordinates,
  resetCustomVillageCoordinates,
  getEffectiveCoordinates,
  validateBuildingPlacement,
  type CustomPositionsMap,
} from "@/lib/sanctuary/village-slot-layout";
import { VillagePixelBuilding } from "@/components/cozy/village-pixel-building";
import { triggerHaptic } from "@/lib/offline-sync";
import type { VillageWeather } from "@/components/sanctuary/cozy-village-map";
import { getSkillByBuildingId } from "@/lib/ai/building-skills-registry";
import {
  DEFAULT_EXPLORER_POS,
  clampExplorerPosition,
  stepExplorerPosition,
  findNearestBuilding,
  loadDisabledAiSkills,
  type ExplorerPosition,
} from "@/lib/sanctuary/living-village-engine";

const WORLD_WIDTH = 1400;
const WORLD_HEIGHT = 900;

interface InteractiveVillageSceneProps {
  buildings: VillageBuildingDefinition[];
  skillSummaries: SkillDomainSummary[];
  recentSessions: SkillSessionRecord[];
  activeBooksCount?: number;
  activeKnittingProjectsCount?: number;
  rubikSolvesCount?: number;
  weather: VillageWeather;
  ambientAnimEnabled: boolean;
  hoveredBuildingId: string | null;
  setHoveredBuildingId: (id: string | null) => void;
  selectedBuildingDetail: VillageBuildingDefinition | null;
  onSelectBuildingDetail: (building: VillageBuildingDefinition | null) => void;
  onEnterBuilding: (buildingId: string, domain: SkillDomain) => void;
  onSelectResident?: (resident: VillageResident) => void;
  onOpenMayorRowan?: () => void;
  isEditMode: boolean;
  setIsEditMode: (editing: boolean) => void;
}

export function InteractiveVillageScene({
  buildings,
  skillSummaries,
  recentSessions,
  activeBooksCount = 0,
  activeKnittingProjectsCount = 0,
  rubikSolvesCount = 0,
  weather,
  ambientAnimEnabled,
  hoveredBuildingId,
  setHoveredBuildingId,
  selectedBuildingDetail,
  onSelectBuildingDetail,
  onEnterBuilding,
  onSelectResident,
  onOpenMayorRowan,
  isEditMode,
  setIsEditMode,
}: InteractiveVillageSceneProps) {
  // 1. Motor de Cámara 2D
  const {
    camera,
    containerRef,
    zoomIn,
    zoomOut,
    resetCamera,
    centerOn,
    worldTransformStyle,
    handlers: cameraHandlers,
  } = useVillageCamera({
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    minZoom: 0.65,
    maxZoom: 1.8,
    defaultZoom: 1.0,
  });

  // 2. Estado de posiciones personalizadas (Persistido por usuario)
  const [customPositions, setCustomPositions] = useState<CustomPositionsMap>(() =>
    loadCustomVillageCoordinates()
  );

  // 3. Reactividad del Pueblo Vivo: Detección de sesiones activas en segundo plano
  const { session: activeUniversalSession, isActive: isSessionRunning } = useUniversalSession();

  // 4. Arrastre de edificios en Modo Edición
  const [draggingBuildingId, setDraggingBuildingId] = useState<string | null>(null);
  const [dragCurrentCoords, setDragCurrentCoords] = useState<{ x: number; y: number } | null>(null);
  const [isPlacementValid, setIsPlacementValid] = useState<boolean>(true);
  const [collisionWarning, setCollisionWarning] = useState<string | null>(null);

  // 5. Pueblo Vivo 5.0: Avatar explorador opcional, pausa off-screen y presencia de Rowan
  const [explorerPos, setExplorerPos] = useState<ExplorerPosition>(DEFAULT_EXPLORER_POS);
  const [walkMode, setWalkMode] = useState<boolean>(false);
  const [isSceneVisible, setIsSceneVisible] = useState<boolean>(true);
  const [rowanSpeechOpen, setRowanSpeechOpen] = useState<boolean>(false);
  const [disabledAiSkills, setDisabledAiSkills] = useState<string[]>([]);

  useEffect(() => {
    setDisabledAiSkills(loadDisabledAiSkills());
  }, []);

  // Pausar animaciones CSS cuando el mapa está fuera de pantalla (rendimiento móvil/desktop)
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || !containerRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries[0]) setIsSceneVisible(entries[0].isIntersecting);
      },
      { threshold: 0.05 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [containerRef]);

  const activeBuildingIds = React.useMemo(() => buildings.map((b) => b.id), [buildings]);

  const nearbyBuilding = React.useMemo(
    () => findNearestBuilding(explorerPos, buildings, customPositions, 155),
    [explorerPos, buildings, customPositions]
  );

  const handleStepExplorer = useCallback(
    (dir: ExplorerPosition["facing"]) => {
      setExplorerPos((prev) => {
        const next = stepExplorerPosition(prev, dir, 48);
        centerOn(next.x, next.y);
        return next;
      });
      triggerHaptic("light");
    },
    [centerOn]
  );

  const handleSceneKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (walkMode && !isEditMode) {
        if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
          e.preventDefault();
          handleStepExplorer("left");
          return;
        }
        if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
          e.preventDefault();
          handleStepExplorer("right");
          return;
        }
        if (e.key === "ArrowUp" || e.key === "w" || e.key === "W") {
          e.preventDefault();
          handleStepExplorer("up");
          return;
        }
        if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
          e.preventDefault();
          handleStepExplorer("down");
          return;
        }
        if (e.key === "Enter" && nearbyBuilding) {
          e.preventDefault();
          triggerHaptic("medium");
          onEnterBuilding(nearbyBuilding.building.id, nearbyBuilding.building.domain);
          return;
        }
      }
      cameraHandlers.onKeyDown(e);
    },
    [walkMode, isEditMode, handleStepExplorer, nearbyBuilding, onEnterBuilding, cameraHandlers]
  );

  const handleTerrainDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (isEditMode || !containerRef.current) return;
      const target = e.target as HTMLElement;
      if (target.closest("button, [data-prevent-camera-drag]")) return;
      const rect = containerRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - camera.x) / camera.zoom;
      const worldY = (e.clientY - rect.top - camera.y) / camera.zoom;
      const clamped = clampExplorerPosition(worldX, worldY);
      setExplorerPos((prev) => ({
        ...clamped,
        facing: clamped.x < prev.x ? "left" : clamped.x > prev.x ? "right" : prev.facing,
      }));
      triggerHaptic("light");
    },
    [isEditMode, containerRef, camera.x, camera.y, camera.zoom]
  );

  // Centrar en Plaza Central al montar si no hay cámara previa
  useEffect(() => {
    // Si la cámara está en 0,0, centrar suavemente en la plaza central
    if (camera.x === 0 && camera.y === 0) {
      centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, 1.0);
    }
  }, [centerOn, camera.x, camera.y]);

  // Manejo de inicio de arrastre de un edificio (Modo Edición)
  const handleBuildingPointerDown = (
    e: React.PointerEvent,
    buildingId: string
  ) => {
    if (!isEditMode) return;
    e.stopPropagation(); // Evitar que la cámara comience a panear

    const buildingCoords = getEffectiveCoordinates(buildingId, customPositions);
    setDraggingBuildingId(buildingId);
    setDragCurrentCoords({ x: buildingCoords.x, y: buildingCoords.y });
    setIsPlacementValid(true);
    setCollisionWarning(null);
    triggerHaptic("medium");
  };

  // Manejo de movimiento mientras se arrastra un edificio
  const handleScenePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isEditMode || !draggingBuildingId || !containerRef.current) {
        if (!draggingBuildingId) {
          cameraHandlers.onPointerMove(e);
        }
        return;
      }

      // Convertir coordenadas del puntero en pantalla a coordenadas porcentuales del mundo virtual
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      // Deshacer la transformación de la cámara
      // screenX = camera.x + worldX * camera.zoom
      // worldX = (screenX - camera.x) / camera.zoom
      const worldPixelX = (screenX - camera.x) / camera.zoom;
      const worldPixelY = (screenY - camera.y) / camera.zoom;

      // Convertir a porcentajes [0..100]
      const rawPercentX = Math.round((worldPixelX / WORLD_WIDTH) * 100);
      const rawPercentY = Math.round((worldPixelY / WORLD_HEIGHT) * 100);

      const clampedX = Math.min(92, Math.max(8, rawPercentX));
      const clampedY = Math.min(88, Math.max(12, rawPercentY));

      const validation = validateBuildingPlacement(
        draggingBuildingId,
        clampedX,
        clampedY,
        activeBuildingIds,
        customPositions
      );

      setDragCurrentCoords({ x: clampedX, y: clampedY });
      setIsPlacementValid(validation.isValid);

      if (!validation.isValid && validation.collidingWith) {
        const otherBuilding = buildings.find((b) => b.id === validation.collidingWith);
        setCollisionWarning(
          otherBuilding
            ? `Demasiado cerca de: ${otherBuilding.name}`
            : "Demasiado cerca de otro edificio"
        );
      } else {
        setCollisionWarning(null);
      }
    },
    [
      isEditMode,
      draggingBuildingId,
      containerRef,
      camera.x,
      camera.y,
      camera.zoom,
      activeBuildingIds,
      customPositions,
      buildings,
      cameraHandlers,
    ]
  );

  // Manejo de soltar edificio
  const handleScenePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingBuildingId && dragCurrentCoords) {
        if (isPlacementValid) {
          const nextPositions: CustomPositionsMap = {
            ...customPositions,
            [draggingBuildingId]: {
              x: dragCurrentCoords.x,
              y: dragCurrentCoords.y,
            },
          };
          setCustomPositions(nextPositions);
          saveCustomVillageCoordinates(nextPositions);
          triggerHaptic("success");
        } else {
          // Revertir
          triggerHaptic("warning");
        }
        setDraggingBuildingId(null);
        setDragCurrentCoords(null);
        setCollisionWarning(null);
        return;
      }

      cameraHandlers.onPointerUp(e);
    },
    [
      draggingBuildingId,
      dragCurrentCoords,
      isPlacementValid,
      customPositions,
      cameraHandlers,
    ]
  );

  // Restablecer todas las posiciones personalizadas a las canónicas optimizadas
  const handleResetPositions = () => {
    resetCustomVillageCoordinates();
    setCustomPositions({});
    triggerHaptic("medium");
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="region"
      data-ambient-paused={!ambientAnimEnabled || !isSceneVisible ? "true" : "false"}
      aria-label="Escena interactiva 2D de OakHaven. Usa ratón o dedo para arrastrar, pellizca o usa rueda para zoom. En teclado: WASD o flechas para moverte, + y - para zoom."
      onPointerDown={cameraHandlers.onPointerDown}
      onPointerMove={handleScenePointerMove}
      onPointerUp={handleScenePointerUp}
      onPointerCancel={handleScenePointerUp}
      onTouchStart={cameraHandlers.onTouchStart}
      onTouchMove={cameraHandlers.onTouchMove}
      onTouchEnd={cameraHandlers.onTouchEnd}
      onWheel={cameraHandlers.onWheel}
      onKeyDown={handleSceneKeyDown}
      onDoubleClick={handleTerrainDoubleClick}
      className={`relative w-full h-[540px] sm:h-[680px] overflow-hidden rounded-3xl border-4 border-[#3A2E2B] shadow-[0_12px_0_#3A2E2B] select-none outline-none touch-none transition-colors duration-700 ${
        weather === "sunny"
          ? "bg-[#C4DC9C]"
          : weather === "rain"
          ? "bg-[#9FB2A8]"
          : weather === "autumn"
          ? "bg-[#D8B48A]"
          : "bg-[#18212D]"
      } ${
        isEditMode
          ? "cursor-default"
          : camera.isDragging
          ? "cursor-grabbing"
          : "cursor-grab"
      }`}
    >
      {/* =========================================================================
          1. CAPA DEL MUNDO VIRTUAL 2D TRANSFORMADO POR LA CÁMARA (GPU ACELERADO)
         ========================================================================= */}
      <div
        style={{
          ...worldTransformStyle,
          width: `${WORLD_WIDTH}px`,
          height: `${WORLD_HEIGHT}px`,
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {/* ===================================================================
            CANVAS SVG VECTORIAL DE TERRENO: RÍO, CAMINOS, PLAZA, VEGETACIÓN
           =================================================================== */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
          aria-hidden="true"
        >
          <defs>
            <pattern id="v4_cobblestone" width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="16" height="16" fill="#D8B48A" opacity="0.9" />
              <path
                d="M 0 8 L 16 8 M 8 0 L 8 8 M 0 16 L 16 16 M 16 8 L 16 16"
                stroke="#8C6239"
                strokeWidth="1"
                opacity="0.3"
              />
            </pattern>
            <filter id="v4_pixelDrop" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="4" stdDeviation="0" floodColor="#3A2E2B" floodOpacity="0.8" />
            </filter>
            {/* Gradiente de agua para el río de OakHaven */}
            <linearGradient id="v4_riverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={weather === "night" ? "#1B3B4B" : "#7BA7BC"} />
              <stop offset="100%" stopColor={weather === "night" ? "#132833" : "#5F8D9E"} />
            </linearGradient>
          </defs>

          {/* Colinas del Norte (Distrito del Saber / Observatorio) */}
          <path
            d={`M 0 0 L ${WORLD_WIDTH} 0 L ${WORLD_WIDTH} 260 C 1050 320, 700 240, 350 320 L 0 260 Z`}
            fill={weather === "night" ? "#121924" : weather === "autumn" ? "#C69C72" : "#9FB882"}
            opacity="0.85"
          />

          {/* Río Serpenteante de OakHaven */}
          <g>
            <path
              d="M 1280 0 C 1220 250, 1080 340, 950 480 C 840 600, 780 740, 730 900 L 830 900 C 880 750, 950 630, 1050 510 C 1170 370, 1330 250, 1380 0 Z"
              fill="url(#v4_riverGrad)"
              stroke="#3A2E2B"
              strokeWidth="4"
            />
            {/* Ondas en el agua animadas */}
            {ambientAnimEnabled && (
              <g className="oakhaven-ripple">
                <path d="M 1010 390 Q 1025 383, 1040 390" stroke="#FFFDF8" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" fill="none" />
                <path d="M 890 560 Q 905 553, 920 560" stroke="#FFFDF8" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" fill="none" />
                <path d="M 780 780 Q 795 773, 810 780" stroke="#FFFDF8" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" fill="none" />
              </g>
            )}
          </g>

          {/* Caminos Empedrados Principales (Borde marrón y relleno claro) */}
          <g stroke="#3A2E2B" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" fill="none">
            {/* Eje Vertical Central: Observatorio -> Plaza -> Invernadero */}
            <path d="M 700 170 L 700 730" />
            {/* Eje Horizontal Norte: Librería -> Plaza -> Biblioteca */}
            <path d="M 370 290 Q 530 330, 700 315 Q 860 330, 1030 290" />
            {/* Eje Horizontal Centro: Atelier -> Banco/Plaza -> Club de Puzzles */}
            <path d="M 280 500 L 700 315 L 990 450" />
            <path d="M 1050 470 L 1120 510" />
            {/* Eje Sur: Plaza -> Cocina & Talleres */}
            <path d="M 700 315 Q 560 620, 420 720" />
            {/* Ramal Senderismo cruzando el río hacia el Sureste */}
            <path d="M 700 315 Q 820 620, 960 650" />
            <path d="M 1040 680 L 1090 710" />
          </g>

          <g stroke="#D8B48A" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M 700 170 L 700 730" />
            <path d="M 370 290 Q 530 330, 700 315 Q 860 330, 1030 290" />
            <path d="M 280 500 L 700 315 L 990 450" />
            <path d="M 1050 470 L 1120 510" />
            <path d="M 700 315 Q 560 620, 420 720" />
            <path d="M 700 315 Q 820 620, 960 650" />
            <path d="M 1040 680 L 1090 710" />
          </g>

          {/* Puentes de Madera sobre el Río */}
          {/* Puente Norte (hacia Club de Puzzles) */}
          <g filter="url(#v4_pixelDrop)">
            <rect x="985" y="440" width="65" height="38" rx="5" fill="#A06A42" stroke="#3A2E2B" strokeWidth="3" />
            <line x1="998" y1="440" x2="998" y2="478" stroke="#5C381E" strokeWidth="2.5" />
            <line x1="1017" y1="440" x2="1017" y2="478" stroke="#5C381E" strokeWidth="2.5" />
            <line x1="1036" y1="440" x2="1036" y2="478" stroke="#5C381E" strokeWidth="2.5" />
          </g>

          {/* Puente Sur (hacia Refugio de Senderismo) */}
          <g filter="url(#v4_pixelDrop)">
            <rect x="955" y="640" width="75" height="42" rx="5" fill="#A06A42" stroke="#3A2E2B" strokeWidth="3" />
            <line x1="970" y1="640" x2="970" y2="682" stroke="#5C381E" strokeWidth="2.5" />
            <line x1="992" y1="640" x2="992" y2="682" stroke="#5C381E" strokeWidth="2.5" />
            <line x1="1014" y1="640" x2="1014" y2="682" stroke="#5C381E" strokeWidth="2.5" />
          </g>

          {/* Plaza Central: Glorieta de Adoquines y Fuente de Piedra */}
          <g filter="url(#v4_pixelDrop)">
            <circle cx="700" cy="315" r="62" fill="#E7D69C" stroke="#3A2E2B" strokeWidth="3.5" />
            <circle cx="700" cy="315" r="32" fill="#7BA7BC" stroke="#3A2E2B" strokeWidth="3" />
            <circle cx="700" cy="315" r="14" fill="#FFFDF8" stroke="#3A2E2B" strokeWidth="2" />
          </g>

          {/* Arboledas Decorativas de Pino y Roble Cozy */}
          {/* Bosque Noroeste */}
          <g fill={weather === "night" ? "#1B2A1E" : "#314C3C"} stroke="#3A2E2B" strokeWidth="2.5">
            <polygon points="140,140 170,80 200,140" />
            <polygon points="145,110 170,60 195,110" />
            <polygon points="80,190 110,130 140,190" />
            <polygon points="190,200 220,140 250,200" />
          </g>

          {/* Bosque Noreste */}
          <g fill={weather === "night" ? "#1B2A1E" : "#314C3C"} stroke="#3A2E2B" strokeWidth="2.5">
            <polygon points="1200,160 1230,100 1260,160" />
            <polygon points="1250,210 1280,150 1310,210" />
            <polygon points="1170,220 1200,160 1230,220" />
          </g>

          {/* Bosque Suroeste */}
          <g fill={weather === "night" ? "#1B2A1E" : "#43664F"} stroke="#3A2E2B" strokeWidth="2.5">
            <polygon points="110,720 140,650 170,720" />
            <polygon points="160,760 190,690 220,760" />
            <polygon points="70,790 100,720 130,790" />
          </g>

          {/* Halos de Faroles Nocturnos */}
          {weather === "night" && (
            <g>
              <circle cx="630" cy="270" r="42" fill="#FDDA24" opacity="0.25" />
              <circle cx="770" cy="270" r="42" fill="#FDDA24" opacity="0.25" />
              <circle cx="630" cy="360" r="42" fill="#FDDA24" opacity="0.25" />
              <circle cx="770" cy="360" r="42" fill="#FDDA24" opacity="0.25" />
            </g>
          )}
        </svg>

        {/* ===================================================================
            EFECTOS DE CLIMA, ILUMINACIÓN Y PARTÍCULAS GPU (CSS PURO)
           =================================================================== */}
        <div
          className={`pointer-events-none absolute inset-0 transition-opacity duration-700 ${
            weather === "sunny"
              ? "bg-gradient-to-br from-amber-200/15 via-transparent to-emerald-200/10"
              : weather === "rain"
              ? "bg-gradient-to-b from-slate-700/20 via-cyan-900/10 to-slate-800/15"
              : weather === "autumn"
              ? "bg-gradient-to-br from-amber-500/15 via-orange-300/10 to-transparent"
              : "bg-gradient-to-b from-indigo-950/35 via-slate-900/20 to-amber-950/15"
          }`}
          aria-hidden="true"
        />

        {ambientAnimEnabled && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden="true">
            {weather === "sunny" && (
              <div className="opacity-45">
                <div className="absolute top-12 left-24 text-3xl oakhaven-drift">☁️</div>
                <div className="absolute top-20 right-44 text-4xl oakhaven-drift">☁️</div>
                <div className="absolute bottom-28 left-1/3 text-xl oakhaven-float">✨</div>
                <div className="absolute bottom-40 right-1/4 text-xl oakhaven-float">🦋</div>
              </div>
            )}
            {weather === "rain" && (
              <div className="opacity-55">
                <div className="absolute top-14 left-36 h-8 w-0.5 rounded-full bg-cyan-100 oakhaven-rain" />
                <div className="absolute top-24 left-1/3 h-9 w-0.5 rounded-full bg-cyan-100 oakhaven-rain" style={{ animationDelay: "0.3s" }} />
                <div className="absolute top-16 left-2/3 h-8 w-0.5 rounded-full bg-cyan-100 oakhaven-rain" style={{ animationDelay: "0.7s" }} />
                <div className="absolute top-40 right-48 h-9 w-0.5 rounded-full bg-cyan-100 oakhaven-rain" style={{ animationDelay: "0.5s" }} />
                <div className="absolute bottom-32 left-1/2 h-8 w-0.5 rounded-full bg-cyan-100 oakhaven-rain" style={{ animationDelay: "0.9s" }} />
              </div>
            )}
            {weather === "autumn" && (
              <div className="opacity-55">
                <div className="absolute top-14 left-28 text-2xl oakhaven-drift">🍂</div>
                <div className="absolute top-28 right-36 text-2xl oakhaven-drift" style={{ animationDelay: "1.4s" }}>🍁</div>
                <div className="absolute bottom-24 left-1/2 text-xl oakhaven-drift" style={{ animationDelay: "2.2s" }}>🍂</div>
              </div>
            )}
            {weather === "night" && (
              <div className="opacity-75">
                <div className="absolute top-8 right-32 text-3xl oakhaven-float">🌙</div>
                <div className="absolute top-44 left-[44%] h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_#FDDA24] oakhaven-firefly" />
                <div className="absolute top-64 left-[56%] h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_10px_#FDDA24] oakhaven-firefly" style={{ animationDelay: "1.2s" }} />
                <div className="absolute bottom-40 right-[34%] h-2.5 w-2.5 rounded-full bg-amber-300 shadow-[0_0_10px_#FDDA24] oakhaven-firefly" style={{ animationDelay: "2.1s" }} />
              </div>
            )}
          </div>
        )}

        {/* ===================================================================
            PRESIDENTE ROWAN EN PLAZA CENTRAL (0 LLAMADAS GEMINI EN IDLE)
           =================================================================== */}
        <div
          data-prevent-camera-drag
          style={{
            position: "absolute",
            left: "700px",
            top: "312px",
            transform: "translate(-50%, -50%)",
            zIndex: 28,
          }}
          className="flex flex-col items-center select-none"
        >
          {rowanSpeechOpen && (
            <div className="mb-2 w-56 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-2.5 text-left shadow-[0_5px_0_#3A2E2B] animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-black text-[#314C3C]">🦉 Presidente Rowan</span>
                <button
                  type="button"
                  onClick={() => setRowanSpeechOpen(false)}
                  className="text-[10px] font-black text-[#795548] hover:text-[#3A2E2B] cursor-pointer"
                  aria-label="Cerrar saludo de Rowan"
                >
                  ✕
                </button>
              </div>
              <p className="mt-1 text-[10px] font-medium text-[#5C4033]">
                {recentSessions.length > 0
                  ? `${recentSessions.length} registros confirmados en el pueblo. ¿Revisamos tu panorama real?`
                  : "Plaza en calma. Cuando registres una actividad, la verás reflejada aquí."}
              </p>
              {onOpenMayorRowan && (
                <button
                  type="button"
                  onClick={() => {
                    setRowanSpeechOpen(false);
                    onOpenMayorRowan();
                  }}
                  className="mt-1.5 w-full rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] px-2 py-1 text-[10px] font-black text-[#3A2E2B] hover:bg-[#F2E3B3] cursor-pointer"
                >
                  Abrir Centro de Mando ➜
                </button>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setRowanSpeechOpen((prev) => !prev);
            }}
            aria-label="Hablar con el Presidente Rowan en la Plaza Central"
            className={`flex h-11 w-11 items-center justify-center rounded-full border-3 border-[#3A2E2B] bg-[#E7D69C] text-xl shadow-[0_3px_0_#3A2E2B] hover:scale-110 active:scale-95 transition-transform cursor-pointer ${
              ambientAnimEnabled ? "oakhaven-float" : ""
            }`}
            title="Presidente Rowan — Centro de Mando de OakHaven"
          >
            🦉
          </button>
          <span className="mt-0.5 rounded-md border border-[#3A2E2B]/30 bg-[#FFFDF8]/90 px-1.5 py-0.2 text-[9px] font-black text-[#3A2E2B]">
            Rowan
          </span>
        </div>

        {/* ===================================================================
            AVATAR EXPLORADOR CAMINABLE (OPCIONAL — NUNCA BLOQUEA ACCESO DIRECTO)
           =================================================================== */}
        <div
          data-prevent-camera-drag
          style={{
            position: "absolute",
            left: `${explorerPos.x}px`,
            top: `${explorerPos.y}px`,
            transform: "translate(-50%, -50%)",
            zIndex: 35,
            transition: ambientAnimEnabled ? "left 160ms ease-out, top 160ms ease-out" : "none",
          }}
          className="flex flex-col items-center pointer-events-auto select-none"
        >
          {nearbyBuilding && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic("medium");
                onEnterBuilding(nearbyBuilding.building.id, nearbyBuilding.building.domain);
              }}
              className="mb-1 rounded-full border-2 border-[#3A2E2B] bg-[#FDDA24] px-2.5 py-0.5 text-[10px] font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#FDE24F] whitespace-nowrap cursor-pointer"
            >
              {nearbyBuilding.building.icon} Entrar a {nearbyBuilding.building.name} {walkMode ? "(Enter)" : "➜"}
            </button>
          )}
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-full border-3 border-[#3A2E2B] bg-[#314C3C] text-base text-[#FFFDF8] shadow-[0_3px_0_#1A2B20] ${
              ambientAnimEnabled ? "oakhaven-float" : ""
            }`}
            title="Tu avatar explorador (doble clic en el terreno o activa modo Explorar)"
            aria-label="Avatar explorador del jugador"
          >
            🧭
          </div>
          <span className="mt-0.5 rounded bg-[#3A2E2B]/80 px-1.5 text-[8px] font-black text-[#FFFDF8]">
            Tú
          </span>
        </div>

        {/* ===================================================================
            CAPA DE EDIFICIOS PIXEL ART (EXPLORABLES O ARRASTRABLES)
           =================================================================== */}
        {buildings.map((building) => {
          const isBeingDragged = draggingBuildingId === building.id;
          const coords = isBeingDragged && dragCurrentCoords
            ? dragCurrentCoords
            : getEffectiveCoordinates(building.id, customPositions);

          // Convertir porcentaje a píxeles virtuales del mundo
          const pixelX = (coords.x / 100) * WORLD_WIDTH;
          const pixelY = (coords.y / 100) * WORLD_HEIGHT;

          const skillSum = skillSummaries.find((s) => s.domain === building.domain);
          const resident = building.residentId
            ? COZY_VILLAGE_RESIDENTS.find((r) => r.id === building.residentId)
            : undefined;
          const buildingSessions = recentSessions.filter((s) => s.domain === building.domain);

          // Pueblo Reactivo: Comprueba si hay una sesión activa vinculada a este edificio
          const isBuildingSessionActive = Boolean(
            isSessionRunning &&
              activeUniversalSession &&
              (activeUniversalSession.buildingId === building.id ||
                activeUniversalSession.domain === building.domain)
          );

          const tierInfo = calculateBuildingTier({
            level: skillSum?.level || 1,
            sessionsCount: skillSum?.sessions_count || buildingSessions.length,
            completedProjectsCount:
              building.domain === "knitting"
                ? activeKnittingProjectsCount
                : building.domain === "reading"
                ? activeBooksCount
                : 0,
          });

          const pending = building.getPendingActivity({
            skillSummary: skillSum,
            buildingSessions,
            activeBooksCount,
            activeKnittingProjectsCount,
            rubikSolvesCount,
          });

          const isHovered = hoveredBuildingId === building.id;
          const isSelected = selectedBuildingDetail?.id === building.id;

          return (
            <div
              key={building.id}
              data-prevent-camera-drag
              style={{
                position: "absolute",
                left: `${pixelX}px`,
                top: `${pixelY}px`,
                transform: "translate(-50%, -50%)",
                zIndex: isBeingDragged ? 40 : isSelected ? 30 : Math.round(coords.y),
              }}
              className="flex flex-col items-center select-none"
              onMouseEnter={() => !isBeingDragged && setHoveredBuildingId(building.id)}
              onMouseLeave={() => !isBeingDragged && setHoveredBuildingId(null)}
            >
              {/* Indicador de Modo Edición / Arrastre */}
              {isEditMode && (
                <div
                  onPointerDown={(e) => handleBuildingPointerDown(e, building.id)}
                  className={`mb-1 flex items-center gap-1 rounded-xl border-2 px-2 py-0.5 text-[10px] font-black shadow-sm cursor-move transition-transform active:scale-95 ${
                    isBeingDragged
                      ? isPlacementValid
                        ? "border-[#314C3C] bg-[#C4DC9C] text-[#1A2B20] ring-4 ring-emerald-400/40"
                        : "border-red-600 bg-red-100 text-red-900 ring-4 ring-red-500/40 animate-pulse"
                      : "border-[#3A2E2B] bg-[#FDDA24] text-[#3A2E2B] hover:scale-105"
                  }`}
                  title="Arrastra para mover este edificio a otra ubicación libre"
                >
                  <Move className="h-3 w-3" />
                  <span>{isBeingDragged ? "Ubicando..." : "Mover"}</span>
                </div>
              )}

              {/* Halo de validación de anti-colisión durante arrastre */}
              {isBeingDragged && (
                <div
                  className={`pointer-events-none absolute -inset-4 rounded-3xl border-3 border-dashed animate-pulse ${
                    isPlacementValid
                      ? "border-emerald-600 bg-emerald-500/15"
                      : "border-red-600 bg-red-500/25"
                  }`}
                />
              )}

              {/* Componente Gráfico del Edificio Pixel Art */}
              <div
                onDoubleClick={() => !isEditMode && onEnterBuilding(building.id, building.domain)}
                className={isEditMode ? "pointer-events-none" : ""}
              >
                <VillagePixelBuilding
                  building={building}
                  tierInfo={tierInfo}
                  pending={pending}
                  resident={resident}
                  isHovered={isHovered && !isEditMode}
                  isSelected={isSelected}
                  isSessionActive={isBuildingSessionActive}
                  ambientAnimEnabled={ambientAnimEnabled}
                  isAiMuted={Boolean(
                    getSkillByBuildingId(building.id) &&
                      disabledAiSkills.includes(getSkillByBuildingId(building.id)!.skillId)
                  )}
                  onInspect={() => !isEditMode && onSelectBuildingDetail(building)}
                  onEnter={() => !isEditMode && onEnterBuilding(building.id, building.domain)}
                  onSelectResident={onSelectResident}
                />
              </div>

              {/* Tooltip Rápido en Modo Exploración */}
              {!isEditMode && isHovered && (
                <div className="absolute bottom-full mb-3 z-50 w-52 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8] p-3 shadow-[0_6px_0_#3A2E2B] animate-in fade-in zoom-in-95 text-left space-y-1.5 pointer-events-none">
                  <div className="flex items-center justify-between border-b border-[#3A2E2B]/20 pb-1">
                    <span className="text-[10px] font-black text-[#314C3C] uppercase">
                      {building.district}
                    </span>
                    <span className="text-[9px] font-bold text-[#795548]">
                      Nivel {skillSum?.level || 1}
                    </span>
                  </div>
                  <h4 className="text-xs font-black text-[#3A2E2B] leading-tight">
                    {building.name}
                  </h4>
                  <p className="text-[10px] text-[#795548] line-clamp-2">
                    {building.tagline}
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[9px] font-black text-[#314C3C]">
                    <span>+{skillSum?.total_gp_earned?.toLocaleString("es-CO") || 0} GP</span>
                    <span className="text-amber-800">Doble clic para entrar ➜</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* =========================================================================
          2. HUD DE CONTROL DE CÁMARA & MODO EDICIÓN (FIJO SOBRE EL VIEWPORT)
         ========================================================================= */}
      <div
        data-prevent-camera-drag
        className="pointer-events-auto absolute bottom-4 right-4 z-40 flex flex-col items-end gap-2"
      >
        {/* Banner de colisión durante arrastre */}
        {isEditMode && collisionWarning && (
          <div className="flex items-center gap-1.5 rounded-2xl border-2 border-red-600 bg-red-100 px-3 py-1.5 text-xs font-black text-red-800 shadow-md animate-bounce">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span>{collisionWarning}</span>
          </div>
        )}

        {/* Barra flotante de controles */}
        <div className="flex flex-wrap items-center justify-end gap-1.5 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8]/95 p-1.5 shadow-[0_4px_0_#3A2E2B] backdrop-blur-xs">
          {/* Modo Caminar / Explorar (opcional) */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setWalkMode((prev) => !prev);
            }}
            aria-pressed={walkMode}
            className={`flex h-9 items-center gap-1 rounded-xl border-2 px-2.5 text-xs font-black transition cursor-pointer ${
              walkMode
                ? "border-[#1A2B20] bg-[#314C3C] text-[#FFFDF8]"
                : "border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C]"
            }`}
            title="Activar navegación con avatar (WASD/Flechas o D-pad táctil)"
          >
            <span>🧭</span>
            <span className="hidden sm:inline">{walkMode ? "Caminando" : "Caminar"}</span>
          </button>

          <div className="h-5 w-[2px] bg-[#3A2E2B]/20 mx-0.5" />

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              zoomIn();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C] transition cursor-pointer"
            title="Acercar cámara (+)"
            aria-label="Acercar cámara"
          >
            <Plus className="h-4 w-4" />
          </button>

          {/* Nivel de Zoom */}
          <span className="px-1 text-[11px] font-black text-[#795548] min-w-[38px] text-center">
            {Math.round(camera.zoom * 100)}%
          </span>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              zoomOut();
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C] transition cursor-pointer"
            title="Alejar cámara (-)"
            aria-label="Alejar cámara"
          >
            <Minus className="h-4 w-4" />
          </button>

          <div className="h-5 w-[2px] bg-[#3A2E2B]/20 mx-0.5" />

          {/* Centrar en Plaza Central */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              centerOn(WORLD_WIDTH / 2, WORLD_HEIGHT / 2 - 40, 1.0);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C] transition cursor-pointer"
            title="Centrar en Plaza Central (Espacio)"
            aria-label="Centrar en Plaza Central"
          >
            <Crosshair className="h-4 w-4" />
          </button>

          <div className="h-5 w-[2px] bg-[#3A2E2B]/20 mx-0.5" />

          {/* Alternar Modo Edición */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("medium");
              setIsEditMode(!isEditMode);
            }}
            className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-1 text-xs font-black transition cursor-pointer ${
              isEditMode
                ? "border-[#1A2B20] bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                : "border-[#3A2E2B] bg-[#FDDA24] text-[#3A2E2B] hover:bg-[#FDE24F]"
            }`}
            title={
              isEditMode
                ? "Guardar distribución y volver a modo exploración"
                : "Activar modo edición para mover edificios"
            }
          >
            {isEditMode ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>Guardar Aldea</span>
              </>
            ) : (
              <>
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar Aldea</span>
              </>
            )}
          </button>

          {/* Botón de Restablecer si hay posiciones personalizadas */}
          {isEditMode && Object.keys(customPositions).length > 0 && (
            <button
              type="button"
              onClick={handleResetPositions}
              className="flex items-center gap-1 rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] px-2.5 py-1 text-xs font-bold text-[#795548] hover:bg-[#F4EEDC] transition cursor-pointer"
              title="Restablecer posiciones a la distribución canónica anti-colisión"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Restablecer</span>
            </button>
          )}
        </div>
      </div>

      {/* D-Pad Táctil Accesible cuando Walk Mode está activo */}
      {walkMode && !isEditMode && (
        <div
          data-prevent-camera-drag
          className="pointer-events-auto absolute bottom-4 left-4 z-40 grid grid-cols-3 gap-1 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8]/95 p-1.5 shadow-[0_4px_0_#3A2E2B]"
          aria-label="Controles direccionales del avatar"
        >
          <span />
          <button
            type="button"
            onClick={() => handleStepExplorer("up")}
            aria-label="Caminar hacia arriba"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-xs font-black text-[#3A2E2B] active:scale-95 cursor-pointer"
          >
            ▲
          </button>
          <span />
          <button
            type="button"
            onClick={() => handleStepExplorer("left")}
            aria-label="Caminar hacia la izquierda"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-xs font-black text-[#3A2E2B] active:scale-95 cursor-pointer"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={() => {
              setExplorerPos(DEFAULT_EXPLORER_POS);
              centerOn(DEFAULT_EXPLORER_POS.x, DEFAULT_EXPLORER_POS.y);
            }}
            aria-label="Volver a la plaza central"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-xs font-black text-[#3A2E2B] active:scale-95 cursor-pointer"
            title="Volver a Plaza Central"
          >
            🧭
          </button>
          <button
            type="button"
            onClick={() => handleStepExplorer("right")}
            aria-label="Caminar hacia la derecha"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-xs font-black text-[#3A2E2B] active:scale-95 cursor-pointer"
          >
            ▶
          </button>
          <span />
          <button
            type="button"
            onClick={() => handleStepExplorer("down")}
            aria-label="Caminar hacia abajo"
            className="flex h-9 w-9 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-xs font-black text-[#3A2E2B] active:scale-95 cursor-pointer"
          >
            ▼
          </button>
          <span />
        </div>
      )}

      {/* Guía visual en modo edición */}
      {isEditMode && (
        <div className="pointer-events-none absolute top-4 left-4 z-40 flex items-center gap-2 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8]/95 px-3 py-2 text-xs font-black text-[#3A2E2B] shadow-[0_4px_0_#3A2E2B] backdrop-blur-xs animate-in fade-in">
          <Pencil className="h-4 w-4 text-[#314C3C]" />
          <span>Modo Edición: Arrastra los edificios para colocarlos donde desees.</span>
        </div>
      )}
    </div>
  );
}
