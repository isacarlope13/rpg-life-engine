import type { Metadata } from "next";
import { GamePlayground } from "@/components/game/game-playground";

export const metadata: Metadata = {
  title: "OakHaven · Un paseo por el pueblo",
  description: "Explora la primera plaza de OakHaven y visita el Atelier. Prototipo independiente de tu partida.",
  robots: { index: false, follow: false },
};

export default function PlayPage() {
  return <GamePlayground />;
}
