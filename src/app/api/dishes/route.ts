import { NextResponse, type NextRequest } from "next/server";
import { getFavourites, getGroupContext, getRestaurants } from "@/lib/data";
import { restaurantKinds, type RestaurantKind } from "@/lib/restaurant-kind";
import { restaurantsForRound } from "@/lib/round";

const LIMIT = 24;

export type DishHit = {
  id: string;
  name: string;
  name_en: string | null;
  photo: string | null;
  price: number | null;
  favourite: boolean;
  restaurant: { id: string; name: string; name_en: string | null; name_ko: string | null; logo: string | null; logo_bg: string | null };
};

/** Dishes from this round's restaurants whose name has every word typed, favourites first. */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const kind = request.nextUrl.searchParams.get("kind") as RestaurantKind | null;
  const words = (request.nextUrl.searchParams.get("q") ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const context = await getGroupContext(code);
  if (!context || words.length === 0) return NextResponse.json([]);

  const [restaurants, favourites] = await Promise.all([getRestaurants(), getFavourites()]);
  const hearted = new Set(favourites.map((d) => d.id));
  const hits: DishHit[] = restaurantsForRound(context.group, restaurants, context.round?.allowed_restaurant_ids ?? [])
    .filter((r) => !kind || restaurantKinds(r).includes(kind))
    .flatMap((r) => [...r.menu_items].sort((a, b) => a.sort_order - b.sort_order)
      .filter((d) => { const text = `${d.name} ${d.name_en ?? ""}`.toLowerCase(); return words.every((w) => text.includes(w)); })
      .map((d) => ({
        id: d.id, name: d.name, name_en: d.name_en, photo: d.photo, price: d.price, favourite: hearted.has(d.id),
        restaurant: { id: r.id, name: r.name, name_en: r.name_en, name_ko: r.name_ko, logo: r.logo, logo_bg: r.logo_bg },
      })));
  hits.sort((a, b) => Number(b.favourite) - Number(a.favourite));
  return NextResponse.json(hits.slice(0, LIMIT), { headers: { "cache-control": "no-store" } });
}
