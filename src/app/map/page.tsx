import { AppHeader } from "@/components/app-header";
import { MapExplorer } from "@/components/map-explorer";
import { getFoodNeeds, getMapData } from "@/lib/data";

export const metadata = { title: "Food map" };

export default async function MapPage() {
  const [{ places, restaurants }, needs] = await Promise.all([getMapData(), getFoodNeeds()]);
  return (
    <>
      <AppHeader />
      <MapExplorer places={places} restaurants={restaurants} needs={needs} />
    </>
  );
}
