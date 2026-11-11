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

  const activeBuildingIds = React.useMemo(() => buildings.map((b) => b.id), [buildings]);

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
      aria-label="Escena interactiva 2D de OakHaven. Usa ratón para arrastrar y zoom con la rueda. En teclado: WASD o flechas para moverte, + y - para zoom."
      onPointerDown={cameraHandlers.onPointerDown}
      onPointerMove={handleScenePointerMove}
      onPointerUp={handleScenePointerUp}
      onPointerCancel={handleScenePointerUp}
      onWheel={cameraHandlers.onWheel}
      onKeyDown={cameraHandlers.onKeyDown}
      className={`relative w-full h-[620px] sm:h-[720px] overflow-hidden rounded-3xl border-4 border-[#3A2E2B] shadow-[0_12px_0_#3A2E2B] select-none outline-none transition-colors duration-700 ${
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
              <>
                <path d="M 1010 390 Q 1025 383, 1040 390" stroke="#FFFDF8" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" fill="none" />
                <path d="M 890 560 Q 905 553, 920 560" stroke="#FFFDF8" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" fill="none" />
                <path d="M 780 780 Q 795 773, 810 780" stroke="#FFFDF8" strokeWidth="2.5" strokeLinecap="round" opacity="0.75" fill="none" />
              </>
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
            EFECTOS DE CLIMA Y PARTÍCULAS DEL MUNDO
           =================================================================== */}
        {ambientAnimEnabled && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
            {weather === "sunny" && (
              <div className="opacity-30">
                <div className="absolute top-10 left-20 text-3xl animate-bounce">🍃</div>
                <div className="absolute top-20 right-40 text-4xl animate-pulse">☀️</div>
                <div className="absolute bottom-28 left-1/3 text-2xl animate-bounce">✨</div>
                <div className="absolute bottom-40 right-1/4 text-2xl">🌿</div>
              </div>
            )}
            {weather === "rain" && (
              <div className="opacity-45">
                <div className="absolute top-10 left-32 text-3xl animate-pulse">🌧️</div>
                <div className="absolute top-32 right-64 text-3xl animate-pulse">🌧️</div>
                <div className="absolute bottom-24 left-1/2 text-2xl">💧</div>
              </div>
            )}
            {weather === "autumn" && (
              <div className="opacity-35">
                <div className="absolute top-12 left-24 text-3xl animate-bounce">🍂</div>
                <div className="absolute top-24 right-32 text-3xl">🍁</div>
                <div className="absolute bottom-16 left-1/2 text-2xl animate-bounce">🍂</div>
              </div>
            )}
            {weather === "night" && (
              <div className="opacity-55">
                <div className="absolute top-8 right-32 text-4xl animate-pulse">🌙</div>
                <div className="absolute top-16 left-32 text-2xl animate-ping duration-1000">✨</div>
                <div className="absolute top-36 left-1/2 text-xl">⭐</div>
                <div className="absolute bottom-24 right-1/3 text-2xl">✨</div>
              </div>
            )}
          </div>
        )}

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
        <div className="flex items-center gap-1.5 rounded-2xl border-3 border-[#3A2E2B] bg-[#FFFDF8]/95 p-1.5 shadow-[0_4px_0_#3A2E2B] backdrop-blur-xs">
          {/* Zoom In */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              zoomIn();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C] transition cursor-pointer"
            title="Acercar cámara (+)"
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
            className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C] transition cursor-pointer"
            title="Alejar cámara (-)"
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
            className="flex h-8 w-8 items-center justify-center rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] text-[#3A2E2B] hover:bg-[#E7D69C] transition cursor-pointer"
            title="Centrar en Plaza Central (Espacio)"
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
