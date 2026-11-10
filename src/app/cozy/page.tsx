import type { Metadata } from "next";
import { CozyRpgDashboard } from "@/components/cozy-rpg-dashboard";

export const metadata: Metadata = {
  title: "Cozy RPG Dashboard · Valle de Oakhaven",
  description:
    "Tablero interactivo de fantasía cálida con estética Animal Crossing / Dungeon Master, misiones, mapa y coleccionables.",
};

export default function CozyPage() {
  return <CozyRpgDashboard />;
}
