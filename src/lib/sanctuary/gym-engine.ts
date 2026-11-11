/**
 * Motor de Gimnasio & Vitalidad Física — OAKHAVEN 3.7
 * Gestiona el catálogo de rutinas, ejercicios, cálculo de volumen (tonelaje) y escala RPE.
 */

export interface GymSetRecord {
  id: string;
  exerciseName: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  rpe: number; // 1-10 escala Borg modificada
  completed: boolean;
}

export type GymRoutineKey = "fuerza" | "cardio" | "movilidad" | "hipertrofia";

export interface GymRoutineDefinition {
  id: GymRoutineKey;
  name: string;
  icon: string;
  tagline: string;
  defaultRestSecs: number;
  exercises: {
    name: string;
    description: string;
    defaultReps: number;
    defaultWeightKg: number;
    targetMuscle: string;
  }[];
}

export const GYM_ROUTINES_CATALOG: Record<GymRoutineKey, GymRoutineDefinition> = {
  fuerza: {
    id: "fuerza",
    name: "Fuerza Funcional & Estabilidad",
    icon: "🏋️",
    tagline: "Movimientos multiarticulares para fuerza base y control postural",
    defaultRestSecs: 90,
    exercises: [
      {
        name: "Sentadilla Goblet",
        description: "Mantén el torso erguido y las rodillas alineadas con la punta de los pies.",
        defaultReps: 10,
        defaultWeightKg: 16,
        targetMuscle: "Cuádriceps, Glúteos y Core",
      },
      {
        name: "Press de Banca con Mancuernas",
        description: "Retrae escápulas y empuja con trayectoria suave sin bloquear codos.",
        defaultReps: 8,
        defaultWeightKg: 14,
        targetMuscle: "Pectoral, Tríceps y Deltoides anterior",
      },
      {
        name: "Peso Muerto Rumano",
        description: "Bisagra de cadera con espalda neutra, sintiendo tensión en isquiotibiales.",
        defaultReps: 10,
        defaultWeightKg: 20,
        targetMuscle: "Cadena posterior, Isquiotibiales y Glúteos",
      },
      {
        name: "Remo con Mancuerna / Barra",
        description: "Tracción controlada llevando el codo hacia la cadera.",
        defaultReps: 10,
        defaultWeightKg: 16,
        targetMuscle: "Dorsal ancho, Romboides y Bíceps",
      },
      {
        name: "Press Militar con Mancuernas",
        description: "Empuje vertical con abdomen compacto y glúteos activos.",
        defaultReps: 8,
        defaultWeightKg: 10,
        targetMuscle: "Hombros y Core",
      },
    ],
  },
  cardio: {
    id: "cardio",
    name: "Cardio & Resistencia Aeróbica",
    icon: "🏃",
    tagline: "Activación circulatoria, ritmo respiratorio y resistencia general",
    defaultRestSecs: 60,
    exercises: [
      {
        name: "Salto con Cuerda Rítmico",
        description: "Saltos cortos sobre la bola del pie con rotación suave de muñecas.",
        defaultReps: 50,
        defaultWeightKg: 0,
        targetMuscle: "Gemelos, Cardiovascular y Coordinación",
      },
      {
        name: "Burpees Controlados",
        description: "Transición fluida sin impacto articular excesivo, priorizando ritmo parejo.",
        defaultReps: 12,
        defaultWeightKg: 0,
        targetMuscle: "Cuerpo completo y Capacidad pulmonar",
      },
      {
        name: "Remo Ergómetro / Trote Ligero",
        description: "Cadencia constante de palada/paso manteniendo zona aeróbica cómoda.",
        defaultReps: 30,
        defaultWeightKg: 0,
        targetMuscle: "Resistencia aeróbica y Oxigenación",
      },
      {
        name: "Mountain Climbers",
        description: "Posición de plancha con rodillas alternas hacia el pecho sin arquear la espalda.",
        defaultReps: 20,
        defaultWeightKg: 0,
        targetMuscle: "Core, Flexores de cadera y Hombros",
      },
    ],
  },
  movilidad: {
    id: "movilidad",
    name: "Movilidad Articular & Calistenia",
    icon: "🧘",
    tagline: "Descompresión fascial, elasticidad y salud articular consciente",
    defaultRestSecs: 60,
    exercises: [
      {
        name: "Gato-Vaca Espinal (Cat-Cow)",
        description: "Flexión y extensión suave de columna coordinada con la respiración.",
        defaultReps: 12,
        defaultWeightKg: 0,
        targetMuscle: "Columna vertebral, Cuello y Pelvis",
      },
      {
        name: "Apertura de Cadera 90/90",
        description: "Rotación interna y externa de cadera en suelo con torso erguido.",
        defaultReps: 8,
        defaultWeightKg: 0,
        targetMuscle: "Cápsula de cadera y Glúteo medio",
      },
      {
        name: "Dislocación de Hombros con Banda",
        description: "Circunducción amplia y suave con banda elástica o pica de madera.",
        defaultReps: 12,
        defaultWeightKg: 0,
        targetMuscle: "Manguito rotador y Cintura escapular",
      },
      {
        name: "Estiramiento Isquiotibial Dinámico",
        description: "Patadas suaves con balanceo controlado sin forzar el rango de movimiento.",
        defaultReps: 10,
        defaultWeightKg: 0,
        targetMuscle: "Isquiotibiales y Fascia plantar",
      },
    ],
  },
  hipertrofia: {
    id: "hipertrofia",
    name: "Hipertrofia & Densidad Muscular",
    icon: "💪",
    tagline: "Tiempo bajo tensión, bombeo consciente y sobrecarga progresiva",
    defaultRestSecs: 120,
    exercises: [
      {
        name: "Dominadas / Jalón al Pecho",
        description: "Tracción vertical completa iniciando con depresión escapular.",
        defaultReps: 8,
        defaultWeightKg: 0,
        targetMuscle: "Dorsales, Bíceps y Antebrazo",
      },
      {
        name: "Fondos en Paralelas / Banco",
        description: "Descenso hasta 90 grados de codo empujando con firmeza el tríceps.",
        defaultReps: 10,
        defaultWeightKg: 0,
        targetMuscle: "Tríceps, Pectoral inferior y Core",
      },
      {
        name: "Zancadas Búlgaras",
        description: "Pie trasero elevado en banco, descendiendo con el fémur paralelo al suelo.",
        defaultReps: 10,
        defaultWeightKg: 10,
        targetMuscle: "Glúteos, Cuádriceps y Estabilizadores",
      },
      {
        name: "Elevaciones Laterales Estrictas",
        description: "Abducción de hombros sin balanceo del tronco, pausando 1 segundo arriba.",
        defaultReps: 12,
        defaultWeightKg: 6,
        targetMuscle: "Deltoides lateral",
      },
    ],
  },
};

export const RPE_DESCRIPTIONS: Record<number, string> = {
  1: "Sin esfuerzo (Reposo absoluto)",
  2: "Esfuerzo mínimo (Caminata suave)",
  3: "Muy ligero (Calentamiento)",
  4: "Ligero (Fácilmente sostenible)",
  5: "Moderado bajo (Se puede hablar fluido)",
  6: "Moderado (Sientes el músculo trabajando)",
  7: "Exigente (3 repeticiones en reserva)",
  8: "Duro (2 repeticiones en reserva)",
  9: "Muy duro (1 repetición en reserva)",
  10: "Máximo esfuerzo (0 repeticiones en reserva)",
};

/**
 * Calcula las métricas acumuladas de la sesión de fuerza:
 * - Cantidad de series completadas
 * - Tonelaje/volumen total: suma(reps * pesoKg) de las series completadas
 * - RPE promedio de las series completadas
 */
export function calculateWorkoutMetrics(sets: GymSetRecord[]) {
  const completedSets = sets.filter((s) => s.completed);
  const totalVolumeKg = completedSets.reduce(
    (acc, s) => acc + s.reps * (s.weightKg || 0),
    0
  );
  const avgRpe =
    completedSets.length > 0
      ? Math.round(
          (completedSets.reduce((acc, s) => acc + s.rpe, 0) /
            completedSets.length) *
            10
        ) / 10
      : 7;

  return {
    completedCount: completedSets.length,
    totalCount: sets.length,
    totalVolumeKg,
    avgRpe,
  };
}
