import { AppHeader } from "@/components/app-header";
import { MapExplorer } from "@/components/map-explorer";
import { getFoodNeeds, getMapData } from "@/lib/data";
import { getT } from "@/lib/i18n";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t("Food map", "푸드맵") };
}

export default async function MapPage() {
  const [{ places, restaurants }, needs] = await Promise.all([getMapData(), getFoodNeeds()]);
  return (
    <>
      <AppHeader />
      <MapExplorer places={places} restaurants={restaurants} needs={needs} />
    </>
  );
}
