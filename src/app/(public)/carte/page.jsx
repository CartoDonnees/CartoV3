import { MapExperience } from "@/components/map/MapExperience";

export const metadata = {
  title: "ARTCI - CARTODONNEES",
  description:
    "Carte interactive de la couverture des réseaux de télécommunications en Côte d'Ivoire.",
};

export default function CartePage() {
  return <MapExperience />;
}
