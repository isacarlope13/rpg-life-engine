/**
 * MOTOR DE DISTRIBUCIÓN ESPACIAL ANTI-COLISIÓN — OAKHAVEN 4.0 (HITO 4.0.2)
 *
 * Resuelve la saturación y superposición geométrica del mapa mediante:
 * 1. Separación horizontal en Plaza Central (Banco en X=42%, Oficina en X=58%).
 * 2. Cuadrantes despejados por distritos con distancias mínimas garantizadas:
 *    |Delta X| >= 14% en misma fila, o |Delta Y| >= 18% en misma columna.
 * 3. Verificador matemático determinista de no-colisión.
 */

export interface MapCoordinates {
  x: number; // Porcentaje 0-100% horizontal
  y: number; // Porcentaje 0-100% vertical
  row: number;
  col: number;
}

// Coordenadas canónicas optimizadas para cero colisión visual (14 edificios)
export const OPTIMIZED_VILLAGE_COORDINATES: Record<string, MapCoordinates> = {
  // 1. PLAZA CENTRAL (Separación bilateral sin superposición vertical)
  banco_oakhaven: { x: 42, y: 35, row: 1, col: 2 }, // Banco a la izquierda de la plaza
  banco: { x: 42, y: 35, row: 1, col: 2 },
  oficina: { x: 58, y: 35, row: 1, col: 3 },       // Torre de Gestión a la derecha de la plaza

  // 2. DISTRITO DEL SABER (Norte y Colinas)
  observatorio: { x: 50, y: 13, row: 0, col: 2 },   // Cúpula en lo alto de la colina norte
  cabana_diario: { x: 14, y: 28, row: 1, col: 0 },  // Cabaña junto al bosque noroeste
  libreria: { x: 28, y: 28, row: 1, col: 1 },       // Librería sobre el camino norte
  biblioteca: { x: 73, y: 28, row: 1, col: 4 },     // Gran Biblioteca en la colina noreste
  club_puzzles: { x: 88, y: 38, row: 1, col: 5 },   // Club Puzzles tras el puente del río

  // 3. DISTRITO DE ARTES & OFICIOS (Oeste y Suroeste)
  atelier: { x: 16, y: 55, row: 2, col: 0 },        // Atelier textil en el prado oeste
  estudio_arte: { x: 32, y: 55, row: 2, col: 1 },   // Estudio de dibujo junto al camino
  ludoteca: { x: 74, y: 55, row: 2, col: 4 },       // Ludoteca estratégica en el este
  taller_ceramica: { x: 16, y: 78, row: 3, col: 0 },// Alfarería en el rincón suroeste
  cocina: { x: 34, y: 78, row: 3, col: 1 },         // Cocina comunitaria con fogón

  // 4. DISTRITO DE NATURALEZA & VITALIDAD (Sur y Sureste)
  invernadero: { x: 52, y: 78, row: 3, col: 2 },   // Invernadero botánico acristalado
  pabellon_gardening: { x: 52, y: 78, row: 3, col: 2 },
  pabellon_hiking: { x: 70, y: 78, row: 3, col: 3 },// Refugio de senderismo
  gimnasio: { x: 87, y: 78, row: 3, col: 4 },       // Gimnasio de fuerza al aire libre
};

/**
 * Obtiene las coordenadas calibradas anti-colisión para un edificio.
 */
export function getOptimizedCoordinates(buildingId: string): MapCoordinates {
  const coords = OPTIMIZED_VILLAGE_COORDINATES[buildingId];
  if (coords) return coords;

  // Fallback seguro a plaza
  return { x: 50, y: 50, row: 2, col: 2 };
}

/**
 * Verifica formalmente que ningún par de edificios activos colisione en el plano 2D.
 * Criterio matemático:
 * Para cualquier par (A, B), debe cumplirse:
 * |A.x - B.x| >= minDeltaX O |A.y - B.y| >= minDeltaY.
 */
export function validateNoCollisions(
  buildingIds: string[],
  minDeltaX = 13.5, // 13.5% horizontal minimum separation
  minDeltaY = 17.0  // 17.0% vertical minimum separation
): {
  hasCollisions: boolean;
  collisionPairs: Array<{ buildingA: string; buildingB: string; dx: number; dy: number }>;
} {
  const collisionPairs: Array<{ buildingA: string; buildingB: string; dx: number; dy: number }> = [];

  for (let i = 0; i < buildingIds.length; i++) {
    for (let j = i + 1; j < buildingIds.length; j++) {
      const idA = buildingIds[i];
      const idB = buildingIds[j];

      // Ignorar alias del mismo edificio
      if (
        (idA === "banco" && idB === "banco_oakhaven") ||
        (idA === "banco_oakhaven" && idB === "banco") ||
        (idA === "invernadero" && idB === "pabellon_gardening")
      ) {
        continue;
      }

      const coordA = getOptimizedCoordinates(idA);
      const coordB = getOptimizedCoordinates(idB);

      const dx = Math.abs(coordA.x - coordB.x);
      const dy = Math.abs(coordA.y - coordB.y);

      if (dx < minDeltaX && dy < minDeltaY) {
        collisionPairs.push({
          buildingA: idA,
          buildingB: idB,
          dx,
          dy,
        });
      }
    }
  }

  return {
    hasCollisions: collisionPairs.length > 0,
    collisionPairs,
  };
}
