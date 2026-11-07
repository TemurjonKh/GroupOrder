import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "@phosphor-icons/react/ssr";
import { AppHeader } from "@/components/app-header";
import { DishFacts, FoodBadge } from "@/components/dish-facts";
import { MenuSource } from "@/components/menu-source";
import { DishPhoto, PageTitle, textLink } from "@/components/ui";
import { getFoodNeeds, getPlace } from "@/lib/data";
import { checkDish } from "@/lib/diet";
import { DISH_KINDS, dishKind } from "@/lib/dish-kind";
import { formatKrw } from "@/lib/round";
import type { MenuItem } from "@/lib/types";

export const metadata = { title: "Place" };

const PLACE_SOURCE = {
  openstreetmap: "© OpenStreetMap contributors",
  brand: "the brand's store finder",
  daangn: "the business's Daangn profile",
  polle: "Polle",
} as const;

export default async function PlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [found, needs] = await Promise.all([getPlace(id), getFoodNeeds()]);
  if (!found) notFound();
  const { place, menu } = found;
  const local = Boolean(menu?.menu_source_name);

  const sections = new Map<string, MenuItem[]>();
  // A listing with no sections of its own is split into meals, drinks, and desserts and sides.
  const label = (dish: MenuItem) => (dish.category === "Menu" ? DISH_KINDS.find((k) => k.key === dishKind(dish))!.label : dish.category);
  const dishes = [...(menu?.menu_items ?? [])].sort((a, b) => a.sort_order - b.sort_order);
  for (const kind of dishes.every((d) => d.category === "Menu") ? DISH_KINDS : []) sections.set(kind.label, []);
  for (const dish of dishes) sections.set(label(dish), [...(sections.get(label(dish)) ?? []), dish]);
  for (const [name, list] of sections) if (list.length === 0) sections.delete(name);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/map" className={`${textLink} mb-2`}><ArrowLeft aria-hidden size={16} /> Food map</Link>
        <PageTitle>{place.name}</PageTitle>
        {place.name_en && place.name_en !== place.name && <p className="mt-1 text-muted">{place.name_en}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1"><MapPin aria-hidden size={16} weight="fill" /> {place.distance_m} m from Inha</span>
          {[place.kind, place.cuisine, place.address, place.phone, place.opening_hours].filter(Boolean).map((part) => <span key={part}>{part}</span>)}
          {place.website && /^https?:\/\//i.test(place.website) && <a href={place.website} target="_blank" rel="noreferrer" className={textLink}>Website</a>}
        </p>

        <section className="mt-8" aria-labelledby="menu-title">
          <h2 id="menu-title" className="font-display text-2xl font-extrabold tracking-tight">Menu</h2>
          {menu ? (
            <p className="mt-2 max-w-[65ch] text-sm text-muted"><MenuSource restaurant={menu} /></p>
          ) : (
            <p className="mt-2 max-w-[65ch] text-muted">
              No menu yet. Neither the restaurant nor a listing site that allows GroupOrder to read it publishes one.
            </p>
          )}

          {[...sections].map(([section, dishes]) => (
            <div key={section} className="mt-5">
              <h3 className="text-sm font-semibold text-muted">{section}</h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2 sm:items-start">
                {dishes.map((dish) => {
                  const check = checkDish(dish, needs?.avoid ?? [], needs?.note);
                  return (
                    <li key={dish.id} id={`dish-${dish.id}`}>
                      <details className="rounded-[20px] border border-line bg-surface transition-colors open:border-ink">
                        <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 [&::-webkit-details-marker]:hidden">
                          {dish.photo && <DishPhoto src={dish.photo} size={64} />}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm leading-snug font-semibold">{dish.name}</span>
                            <span className={`mt-0.5 block text-sm ${dish.price === null ? "text-muted" : "font-bold"}`}>{formatKrw(dish.price)}</span>
                            {check && <span className="mt-1 block"><FoodBadge check={check} /></span>}
                          </span>
                        </summary>
                        <div className="px-3.5 pb-3.5">
                          {dish.description && <p className="mb-2 text-sm text-muted">{dish.description}</p>}
                          <DishFacts dish={dish} check={check} local={local} />
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <p className="mt-10 text-xs leading-relaxed text-muted">
          Place details: {PLACE_SOURCE[place.source]}. With a serious allergy, always confirm with the restaurant.
        </p>
      </main>
    </>
  );
}
