import Link from "next/link";
import { Heart, X } from "@phosphor-icons/react/ssr";
import { FavouriteButton } from "./favourite-button";
import { Sheet } from "./client-bits";
import { PickForm } from "./pick-form";
import { MenuSource } from "@/components/menu-source";
import { DishFacts, FoodBadge } from "./dish-facts";
import { BrandLogo, DishPhoto, textLink } from "./ui";
import { getFavourites, getFoodNeeds } from "@/lib/data";
import { canEatFirst, checkDish } from "@/lib/diet";
import { getT } from "@/lib/i18n";
import { dishName, restaurantName, sectionName } from "@/lib/names";
import { cuisineLabel } from "@/lib/restaurant-kind";
import { formatKrw } from "@/lib/round";
import type { MenuItem, OrderPick, Restaurant } from "@/lib/types";

const GRID = "grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6";

/** A restaurant's full menu by category. Choosing a dish opens a sheet with the pick form. */
export async function MenuBrowser({ restaurant, basePath, selectedId, code, roundId, canPick, current, forUser, submitLabel }: {
  restaurant: Restaurant & { menu_items: MenuItem[] };
  /** This page's URL without the dish; may already carry a query string. */
  basePath: string;
  selectedId?: string;
  code: string;
  roundId?: string;
  canPick: boolean;
  /** The dishes already picked, by the caller or by the leader for this person. */
  current?: OrderPick[];
  forUser?: string;
  submitLabel: string;
}) {
  const dishes = restaurant.menu_items;
  const categories = [...new Set(dishes.map((d) => d.category))];
  const selected = selectedId ? dishes.find((d) => d.id === selectedId) : undefined;
  const already = selected ? current?.find((p) => p.menu_item?.id === selected.id) ?? null : null;
  const hrefFor = (dish: MenuItem) => `${basePath}${basePath.includes("?") ? "&" : "?"}dish=${dish.id}`;
  // A leader picking for someone else sees the dish's facts, not their own list. Members' lists stay private.
  const needs = forUser ? null : await getFoodNeeds();
  const check = (dish: MenuItem) => (needs ? checkDish(dish, needs.avoid, needs.note) : null);
  const { lang, t } = await getT();
  const section = (category: string) => sectionName(dishes.find((d) => d.category === category)!, lang);
  // Descriptions are only in Korean; in English they would be the one Korean line on the card.
  const description = (text: string | null) => (text && (lang === "ko" || !/[\uac00-\ud7a3]/.test(text)) ? text : null);

  // A leader picking for someone else does not see or change their own hearts here.
  const hearted = new Set(forUser ? [] : (await getFavourites()).map((d) => d.id));
  const favourites = dishes.filter((d) => hearted.has(d.id));

  function card(dish: MenuItem) {
    const result = check(dish);
    const inner = (
      <>
        <DishPhoto src={dish.photo} alt="" className={`aspect-square w-full transition-transform duration-300 group-hover:scale-[1.03] ${result?.level === "avoid" ? "opacity-50" : ""}`} />
        <span className="mt-2.5 line-clamp-2 text-base leading-snug font-bold sm:text-lg">{dishName(dish, lang)}</span>
        <span className={`mt-1 block text-sm sm:text-base ${dish.price === null ? "text-muted" : "font-bold"}`}>{formatKrw(dish.price, lang)}</span>
        {result && <span className="mt-1.5 block"><FoodBadge check={result} lang={lang} /></span>}
      </>
    );
    return (
      <li key={dish.id} className="relative">
        {canPick
          ? <Link href={hrefFor(dish)} scroll={false} className="group block h-full rounded-[20px] border border-line bg-surface p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift">{inner}</Link>
          : <div className="group h-full rounded-[20px] border border-line bg-surface p-2.5">{inner}</div>}
        {!forUser && <span className="absolute top-4 right-4"><FavouriteButton code={code} dishId={dish.id} dishLabel={dishName(dish, lang)} on={hearted.has(dish.id)} /></span>}
      </li>
    );
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <BrandLogo restaurant={restaurant} size={64} />
        <div className="min-w-0">
          <h2 className="font-display text-4xl leading-none font-extrabold tracking-tight">{restaurantName(restaurant, lang)}</h2>
          <p className="mt-1.5 text-sm text-muted">
            {cuisineLabel(restaurant, lang)}, {t(`${dishes.length} items`, `메뉴 ${dishes.length}개`)}
            {restaurant.menu_source_name && <>. <MenuSource restaurant={restaurant} /></>}
          </p>
        </div>
      </div>
      {!forUser && (
        <p className="mt-3 text-sm text-muted">
          {needs && (needs.avoid.length > 0 || needs.note)
            ? t("Dishes you can eat come first in each section; ones with what you avoid are at the end. ", "섹션마다 먹을 수 있는 메뉴가 먼저, 피하는 재료가 든 메뉴는 맨 뒤에 나옵니다. ")
            : t("Have allergies or a diet? ", "알레르기나 식단이 있나요? ")}
          <Link href="/account/food" className={textLink}>{needs ? t("Edit my food needs", "내 식단 정보 수정") : t("Set my food needs", "내 식단 정보 설정")}</Link>
        </p>
      )}

      <nav aria-label={t("Menu categories", "메뉴 카테고리")} className="no-scrollbar sticky top-16 z-10 -mx-4 mt-4 flex gap-2 overflow-x-auto bg-page/90 px-4 py-3 backdrop-blur-md">
        {categories.map((category) => (
          <a key={category} href={`#${encodeURIComponent(category)}`} className="flex min-h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold whitespace-nowrap transition-colors hover:border-ink">
            {section(category)}
          </a>
        ))}
      </nav>

      {favourites.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 flex items-center gap-2 font-display text-2xl font-extrabold tracking-tight">
            <Heart aria-hidden size={24} weight="fill" className="text-accent" />{t("Your favourites", "내 즐겨찾기")}
          </h3>
          <ul className={GRID}>{favourites.map(card)}</ul>
        </section>
      )}

      {categories.map((category) => (
        <section key={category} id={encodeURIComponent(category)} className="mt-6">
          <h3 className="mb-3 font-display text-2xl font-extrabold tracking-tight">{section(category)}</h3>
          <ul className={GRID}>{canEatFirst(dishes.filter((d) => d.category === category), check).map(card)}</ul>
        </section>
      ))}

      {selected && canPick && roundId && (
        <Sheet key={selected.id} closeHref={basePath} label={dishName(selected, lang)}>
          <div className="relative p-5">
            <form method="dialog" className="absolute top-3 right-3">
              <button aria-label={t("Close", "닫기")} className="flex size-11 cursor-pointer items-center justify-center rounded-full bg-soft text-ink transition-colors hover:bg-line"><X aria-hidden size={18} /></button>
            </form>
            <DishPhoto src={selected.photo} alt={dishName(selected, lang)} sizes="208px" className="mx-auto aspect-square w-52" />
            <h3 className="mt-4 font-display text-2xl leading-tight font-extrabold tracking-tight">{dishName(selected, lang)}</h3>
            <p className={`mt-1 ${selected.price === null ? "text-sm text-muted" : "text-lg font-bold"}`}>{formatKrw(selected.price, lang)}</p>
            {description(selected.description) && <p className="mt-2 text-sm leading-relaxed text-muted">{description(selected.description)}</p>}
            <div className="mt-4"><DishFacts dish={selected} check={check(selected)} local={Boolean(restaurant.menu_source_name)} lang={lang} /></div>
            <div className="mt-5">
              {already && <p className="mb-3 text-sm font-semibold text-on-accent-soft">{forUser ? t("Already in their picks. Saving changes it.", "이미 이 사람의 메뉴에 있습니다. 저장하면 변경됩니다.") : t("Already in your picks. Saving changes it.", "이미 내 메뉴에 있습니다. 저장하면 변경됩니다.")}</p>}
              <PickForm code={code} roundId={roundId} item={selected} forUser={forUser}
                submitLabel={already ? t("Save changes", "변경 저장") : submitLabel} current={already}
                elsewhere={already || forUser ? [] : (current ?? [])
                  .filter((p) => p.menu_item && p.menu_item.restaurant_id !== selected.restaurant_id)
                  .map((p) => ({ name: dishName(p.menu_item!, lang), restaurant: restaurantName(p.menu_item!.restaurant, lang) }))} />
            </div>
          </div>
        </Sheet>
      )}
    </>
  );
}
