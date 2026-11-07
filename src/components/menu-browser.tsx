import Link from "next/link";
import { X } from "@phosphor-icons/react/ssr";
import { Sheet } from "./client-bits";
import { PickForm } from "./pick-form";
import { DishFacts, FoodBadge } from "./dish-facts";
import { BrandLogo, DishPhoto, textLink } from "./ui";
import { getFoodNeeds } from "@/lib/data";
import { checkDish } from "@/lib/diet";
import { formatKrw } from "@/lib/round";
import type { MenuItem, OrderPick, Restaurant } from "@/lib/types";

/** A restaurant's full menu by category. Choosing a dish opens a sheet with the pick form. */
export async function MenuBrowser({ restaurant, basePath, selectedId, code, roundId, canPick, current, forUser, submitLabel }: {
  restaurant: Restaurant & { menu_items: MenuItem[] };
  /** This page's URL without the dish; may already carry a query string. */
  basePath: string;
  selectedId?: string;
  code: string;
  roundId?: string;
  canPick: boolean;
  current?: OrderPick | null;
  forUser?: string;
  submitLabel: string;
}) {
  const dishes = restaurant.menu_items;
  const categories = [...new Set(dishes.map((d) => d.category))];
  const selected = selectedId ? dishes.find((d) => d.id === selectedId) : undefined;
  const hrefFor = (dish: MenuItem) => `${basePath}${basePath.includes("?") ? "&" : "?"}dish=${dish.id}`;
  // A leader picking for someone else sees the dish's facts, not their own list. Members' lists stay private.
  const needs = forUser ? null : await getFoodNeeds();
  const check = (dish: MenuItem) => (needs ? checkDish(dish, needs.avoid, needs.note) : null);

  return (
    <>
      <div className="flex items-center gap-4">
        <BrandLogo restaurant={restaurant} size={64} />
        <div className="min-w-0">
          <h2 className="font-display text-4xl leading-none font-extrabold tracking-tight">{restaurant.name}</h2>
          <p className="mt-1.5 text-sm text-muted">
            {restaurant.cuisine}, {dishes.length} items
            {restaurant.place_id && <>. Typed in by members, not the restaurant. <Link href={`/places/${restaurant.place_id}`} className={textLink}>Fix or add dishes</Link></>}
          </p>
        </div>
      </div>
      {!forUser && (
        <p className="mt-3 text-sm text-muted">
          {needs && (needs.avoid.length > 0 || needs.note)
            ? "Dishes are checked against your food needs. "
            : "Have allergies or a diet? "}
          <Link href="/account/food" className={textLink}>{needs ? "Edit my food needs" : "Set my food needs"}</Link>
        </p>
      )}

      <nav aria-label="Menu categories" className="no-scrollbar sticky top-16 z-10 -mx-4 mt-4 flex gap-2 overflow-x-auto bg-page/90 px-4 py-3 backdrop-blur-md">
        {categories.map((category) => (
          <a key={category} href={`#${encodeURIComponent(category)}`} className="flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold whitespace-nowrap transition-colors hover:border-ink">
            {category}
          </a>
        ))}
      </nav>

      {categories.map((category) => (
        <section key={category} id={encodeURIComponent(category)} className="mt-6">
          <h3 className="mb-3 font-display text-2xl font-extrabold tracking-tight">{category}</h3>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {dishes.filter((d) => d.category === category).map((dish) => {
              const result = check(dish);
              const inner = (
                <>
                  <DishPhoto src={dish.photo} alt="" className={`aspect-square w-full transition-transform duration-300 group-hover:scale-[1.03] ${result?.level === "avoid" ? "opacity-50" : ""}`} />
                  <span className="mt-2.5 line-clamp-2 text-sm leading-snug font-semibold">{dish.name}</span>
                  <span className={`mt-1 block text-sm ${dish.price === null ? "text-muted" : "font-bold"}`}>{formatKrw(dish.price)}</span>
                  {result && <span className="mt-1.5 block"><FoodBadge check={result} /></span>}
                </>
              );
              return (
                <li key={dish.id}>
                  {canPick
                    ? <Link href={hrefFor(dish)} scroll={false} className="group block rounded-[20px] border border-line bg-surface p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift">{inner}</Link>
                    : <div className="group rounded-[20px] border border-line bg-surface p-2.5">{inner}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {selected && canPick && roundId && (
        <Sheet key={selected.id} closeHref={basePath} label={selected.name}>
          <div className="relative p-5">
            <form method="dialog" className="absolute top-3 right-3">
              <button aria-label="Close" className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-soft text-ink transition-colors hover:bg-line"><X aria-hidden size={18} /></button>
            </form>
            <DishPhoto src={selected.photo} alt={selected.name} sizes="208px" className="mx-auto aspect-square w-52" />
            <h3 className="mt-4 font-display text-2xl leading-tight font-extrabold tracking-tight">{selected.name}</h3>
            <p className={`mt-1 ${selected.price === null ? "text-sm text-muted" : "text-lg font-bold"}`}>{formatKrw(selected.price)}</p>
            {selected.description && <p className="mt-2 text-sm leading-relaxed text-muted">{selected.description}</p>}
            <div className="mt-4"><DishFacts dish={selected} check={check(selected)} byMember={Boolean(restaurant.place_id)} /></div>
            <div className="mt-5">
              <PickForm code={code} roundId={roundId} item={selected} forUser={forUser} submitLabel={submitLabel}
                current={current?.menu_item?.id === selected.id ? current : null} />
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
