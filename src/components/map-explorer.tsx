"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { DishFacts, FoodBadge } from "./dish-facts";
import { BrandLogo, DishPhoto, inputStyles, textLink } from "./ui";
import { DIETS, LABELLED, NAMED_ONLY, SEARCH_SHORTCUTS, checkDish, dietItemLabel, type DishCheck } from "@/lib/diet";
import { DISH_KINDS, dishKind, type DishKind } from "@/lib/dish-kind";
import { formatKrw } from "@/lib/round";
import { type CompactDish, fullDish } from "@/lib/map-dish";
import { dishName, restaurantName } from "@/lib/names";
import { useLang } from "./lang";
import { translator, type Lang } from "@/lib/names";
import type { FoodNeeds, MapDish, Place, Restaurant } from "@/lib/types";

const CAMPUS = { lat: 37.4494108, lng: 126.6534266 };
const RADIUS_M = 2000;
// A few dishes per restaurant at first, so the page stays light; each restaurant opens on request.
const PAGE_SIZE = 6;
// OpenStreetMap's tile policy asks for a configurable address.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ORDER = { clear: 0, caution: 1, unknown: 2, avoid: 3 };
const PRICE_CAPS = [5000, 10000, 15000, 20000];

type Dish = MapDish & { check: DishCheck | null };

/** Builds a line of popup text. Place details come from outside, so they are only ever set as text. */
function popupLine(parent: HTMLElement, value: string | null, bold = false) {
  if (!value) return;
  const line = document.createElement(bold ? "strong" : "div");
  line.textContent = value;
  if (bold) line.style.display = "block";
  parent.append(line);
}

function placePopup(place: Place, matching: string | null, lang: Lang) {
  const t = translator(lang);
  const box = document.createElement("div");
  popupLine(box, place.name, true);
  popupLine(box, place.name_en && place.name_en !== place.name ? place.name_en : null);
  popupLine(box, [place.kind, place.cuisine, t(`${place.distance_m} m away`, `${place.distance_m}m 거리`)].filter(Boolean).join(" · "));
  popupLine(box, place.address);
  popupLine(box, place.phone);
  popupLine(box, place.opening_hours);
  popupLine(box, matching ?? t("No menu yet", "아직 메뉴 없음"));
  // Built as an element with a fixed address, never from place text.
  const page = document.createElement("a");
  page.href = `/places/${encodeURIComponent(place.id)}`;
  page.textContent = place.restaurant_id ? t("Open menu", "메뉴 보기") : t("Place details", "장소 정보");
  page.style.display = "block";
  page.style.fontWeight = "600";
  box.append(page);
  if (place.website && /^https?:\/\//i.test(place.website)) {
    const link = document.createElement("a");
    link.href = place.website;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = t("Website", "웹사이트");
    box.append(link);
  }
  return box;
}

const chip = (on: boolean) =>
  `flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
    on ? "border-ink bg-ink text-page" : "border-line bg-surface hover:border-ink"
  }`;

export function MapExplorer({ places, restaurants: sent, needs }: {
  places: Place[];
  restaurants: (Restaurant & { menu_items: CompactDish[] })[];
  needs: FoodNeeds | null;
}) {
  const restaurants = useMemo(() => sent.map((r) => ({ ...r, menu_items: r.menu_items.map(fullDish) })), [sent]);
  const lang = useLang();
  const t = translator(lang);
  const [query, setQuery] = useState("");
  const [avoid, setAvoid] = useState<string[]>(needs?.avoid ?? []);
  const [useNote, setUseNote] = useState(Boolean(needs?.note));
  const [strict, setStrict] = useState(true);
  const [kinds, setKinds] = useState<DishKind[]>(["meal"]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<"near" | "cheap">("near");
  const [tab, setTab] = useState<"meals" | "places">("meals");
  const [opened, setOpened] = useState<Set<string>>(new Set());
  // A dish's facts are only built once it is opened, which keeps the page light.
  const [unfolded, setUnfolded] = useState<Set<string>>(new Set());
  // A new search starts with every restaurant folded again.
  const collapse = () => setOpened(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);

  const mapBox = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, CircleMarker>());

  const note = useNote ? needs?.note : null;
  const words = query.trim().toLowerCase();
  const filtering = avoid.length > 0 || Boolean(note);

  // The kind of each dish never changes, so it is worked out once.
  const kindOf = useMemo(() => new Map(restaurants.flatMap((r) => r.menu_items.map((dish) => [dish.id, dishKind(dish)] as const))), [restaurants]);
  // The nearest branch of each restaurant, for sorting.
  const nearest = useMemo(() => {
    const best = new Map<string, number>();
    for (const place of places) {
      if (place.restaurant_id && place.distance_m < (best.get(place.restaurant_id) ?? Infinity)) best.set(place.restaurant_id, place.distance_m);
    }
    return best;
  }, [places]);

  // One restaurant's matching dishes, best first, and how many more the kind switches hide.
  const { matches, hiddenByKind } = useMemo(() => {
    const byRestaurant = new Map<string, Dish[]>();
    let hidden = 0;
    const shownKind = (dish: MapDish) => kinds.length === 0 || kinds.includes(kindOf.get(dish.id) ?? "meal");
    for (const restaurant of restaurants) {
      const passing = restaurant.menu_items
        // A dish with no price is hidden by a price cap: its price is unknown, not zero.
        .filter((dish) => maxPrice === null || (dish.price !== null && dish.price <= maxPrice))
        .map((dish) => ({ ...dish, check: checkDish(dish, avoid, note) }))
        .filter((dish) => {
          const text = [restaurant.name, restaurant.name_en, dish.name, dish.name_en, dish.category, dish.category_en, dish.description, ...dish.ingredients].filter(Boolean).join(" ").toLowerCase();
          if (words && !text.includes(words)) return false;
          if (!dish.check) return true;
          return strict ? dish.check.level === "clear" : dish.check.level !== "avoid";
        })
        .sort((a, b) => ((a.check ? ORDER[a.check.level] : 0) - (b.check ? ORDER[b.check.level] : 0))
          || (sort === "cheap" ? (a.price ?? Infinity) - (b.price ?? Infinity) : 0));
      const dishes = passing.filter(shownKind);
      hidden += passing.length - dishes.length;
      byRestaurant.set(restaurant.id, dishes);
    }
    return { matches: byRestaurant, hiddenByKind: hidden };
  }, [restaurants, avoid, note, words, strict, kinds, kindOf, maxPrice, sort]);

  const ordered = useMemo(() => {
    const cheapest = (id: string) => Math.min(...(matches.get(id) ?? []).map((dish) => dish.price ?? Infinity));
    return [...restaurants].sort((a, b) => sort === "cheap"
      ? cheapest(a.id) - cheapest(b.id)
      : (nearest.get(a.id) ?? Infinity) - (nearest.get(b.id) ?? Infinity));
  }, [restaurants, matches, nearest, sort]);

  const mealCount = [...matches.values()].reduce((sum, dishes) => sum + dishes.length, 0);
  const [menuFilter, setMenuFilter] = useState<"all" | "with" | "without">("all");
  const shownPlaces = useMemo(() => places
    .filter((place) => menuFilter === "all" || (menuFilter === "with") === Boolean(place.restaurant_id))
    .filter((place) => !words || [place.name, place.name_en, place.kind, place.cuisine].join(" ").toLowerCase().includes(words)), [places, words, menuFilter]);

  const matchingText = (place: Place) => {
    if (!place.restaurant_id) return null;
    const count = matches.get(place.restaurant_id)?.length ?? 0;
    return t(`${count} ${count === 1 ? "meal matches" : "meals match"} your search`, `검색과 맞는 메뉴 ${count}개`);
  };
  const latest = useRef(matchingText);
  const latestLang = useRef(lang);
  useEffect(() => { latest.current = matchingText; latestLang.current = lang; });

  // The map is built once; the effect below only restyles its markers.
  useEffect(() => {
    let cancelled = false;
    const built = markers.current;
    import("leaflet").then((L) => {
      if (cancelled || !mapBox.current) return;
      const m = L.map(mapBox.current, { center: [CAMPUS.lat, CAMPUS.lng], zoom: 14 });
      map.current = m;
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(m);
      const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
      const area = L.circle([CAMPUS.lat, CAMPUS.lng], { radius: RADIUS_M, color: accent, weight: 2, fillOpacity: 0.04, interactive: false }).addTo(m);
      m.fitBounds(area.getBounds());
      L.marker([CAMPUS.lat, CAMPUS.lng], {
        title: latestLang.current === "ko" ? "인하대학교" : "Inha University",
        icon: L.divIcon({ className: "", html: `<span style="display:block;width:16px;height:16px;border-radius:5px;background:${accent};border:3px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .4)"></span>`, iconSize: [16, 16] }),
      }).addTo(m).bindPopup(latestLang.current === "ko" ? "인하대학교" : "Inha University");
      for (const place of places) {
        const marker = L.circleMarker([place.lat, place.lng], { radius: 5, weight: 1, color: "#fff", fillColor: "#7b7c70", fillOpacity: 0.9 }).addTo(m);
        marker.bindPopup(() => placePopup(place, latest.current(place), latestLang.current));
        marker.on("click", () => setSelected(place.id));
        built.set(place.id, marker);
      }
      setMarkersReady(true);
    }).catch((error) => {
      console.error(error);
      setMapFailed(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      built.clear();
    };
  }, [places]);

  useEffect(() => {
    if (!markersReady) return;
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    for (const place of places) {
      const marker = markers.current.get(place.id);
      if (!marker) continue;
      const hasMenu = Boolean(place.restaurant_id);
      const count = place.restaurant_id ? matches.get(place.restaurant_id)?.length ?? 0 : 0;
      const nameMatches = !words || [place.name, place.name_en, place.kind, place.cuisine].join(" ").toLowerCase().includes(words);
      const lit = hasMenu && count > 0;
      marker.setStyle({
        fillColor: lit ? accent : "#7b7c70",
        fillOpacity: lit ? 1 : nameMatches && tab === "places" ? 0.9 : 0.35,
        radius: lit ? 10 : 5,
        weight: lit ? 2 : 1,
      });
      if (lit) marker.bringToFront();
    }
  }, [markersReady, places, matches, words, tab]);

  function focusPlace(place: Place) {
    setSelected(place.id);
    map.current?.setView([place.lat, place.lng], 17);
    markers.current.get(place.id)?.openPopup();
    mapBox.current?.scrollIntoView({ block: "nearest" });
  }

  function toggle(key: string) {
    collapse();
    setAvoid((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  return (
    <main className="grid md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <div className="order-2 min-w-0 px-4 py-6 md:order-1">
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight">{t("Find a meal near Inha", "인하대 근처 맛집 찾기")}</h1>
        <p className="mt-2 text-sm text-muted">
          {(() => {
            const dishCount = restaurants.reduce((sum, r) => sum + r.menu_items.length, 0);
            return t(`${places.length} places within 2 km of campus, and ${dishCount} dishes from ${restaurants.length} restaurants to search. Chain menus come from the brands; local ones from the owner's Daangn profile or from Polle.`,
              `캠퍼스 2km 이내 장소 ${places.length}곳, 식당 ${restaurants.length}곳의 메뉴 ${dishCount}개를 검색할 수 있습니다. 프랜차이즈 메뉴는 브랜드에서, 동네 식당 메뉴는 사장님의 당근 프로필이나 뽈레에서 가져왔습니다.`);
          })()}
        </p>

        <label className="relative mt-4 block">
          <span className="sr-only">{t("Search meals and places", "메뉴와 장소 검색")}</span>
          <MagnifyingGlass aria-hidden size={18} className="absolute top-3.5 left-3.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); collapse(); }}
            placeholder={t("Chicken, salad, pizza…", "치킨, 샐러드, 피자…")}
            className={`${inputStyles} pl-10`}
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("What to avoid", "피할 음식")}>
          {SEARCH_SHORTCUTS.map((key) => (
            <button key={key} type="button" aria-pressed={avoid.includes(key)} onClick={() => toggle(key)} className={chip(avoid.includes(key))}>
              {dietItemLabel(key, lang)}
            </button>
          ))}
        </div>

        <details className="mt-2">
          <summary className={`${textLink} cursor-pointer`}>{t("All allergies and foods", "모든 알레르기와 음식")}</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...DIETS, ...LABELLED, ...NAMED_ONLY].filter((item) => !SEARCH_SHORTCUTS.includes(item.key)).map((item) => (
              <button key={item.key} type="button" aria-pressed={avoid.includes(item.key)} onClick={() => toggle(item.key)} className={chip(avoid.includes(item.key))}>
                {dietItemLabel(item.key, lang)}
              </button>
            ))}
          </div>
        </details>

        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label={t("Kind of dish", "메뉴 종류")}>
          {DISH_KINDS.map((kind) => {
            const on = kinds.includes(kind.key);
            return (
              <button key={kind.key} type="button" aria-pressed={on} className={chip(on)}
                onClick={() => { collapse(); setKinds((current) => (on ? current.filter((k) => k !== kind.key) : [...current, kind.key])); }}>
                {lang === "ko" ? kind.korean : kind.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Price", "가격")}</span>
            <select value={maxPrice ?? ""} onChange={(event) => { collapse(); setMaxPrice(event.target.value ? Number(event.target.value) : null); }} className={inputStyles}>
              <option value="">{t("Any price", "가격 무관")}</option>
              {PRICE_CAPS.map((cap) => <option key={cap} value={cap}>{t(`Up to ${formatKrw(cap)}`, `${formatKrw(cap)} 이하`)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t("Sort", "정렬")}</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as "near" | "cheap")} className={inputStyles}>
              <option value="near">{t("Nearest first", "가까운 순")}</option>
              <option value="cheap">{t("Cheapest first", "저렴한 순")}</option>
            </select>
          </label>
        </div>
        {maxPrice !== null && <p className="mt-1 text-xs text-muted">{t("Dishes with no listed price are hidden while a price limit is set.", "가격 제한을 걸면 가격이 없는 메뉴는 숨겨집니다.")}</p>}

        {needs?.note && (
          <label className="mt-2 flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={useNote} onChange={(event) => setUseNote(event.target.checked)} className="size-4 accent-(--accent)" />
            {t("Also avoid", "추가로 피하기")}: {needs.note}
          </label>
        )}

        {filtering && (
          <fieldset className="mt-3">
            <legend className="sr-only">{t("How strict", "기준")}</legend>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex min-h-9 items-center gap-2">
                <input type="radio" name="strict" checked={strict} onChange={() => setStrict(true)} className="size-4 accent-(--accent)" />
                {t("Only meals with nothing of yours listed", "피하는 재료가 표시되지 않은 메뉴만")}
              </label>
              <label className="flex min-h-9 items-center gap-2">
                <input type="radio" name="strict" checked={!strict} onChange={() => setStrict(false)} className="size-4 accent-(--accent)" />
                {t("Also show “may contain” and “no data”", "“포함 가능”과 “정보 없음”도 보기")}
              </label>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4">
              <button type="button" onClick={() => { setAvoid([]); setUseNote(false); }} className={`${textLink} cursor-pointer`}>{t("Clear filters", "필터 초기화")}</button>
            </div>
          </fieldset>
        )}

        {!needs && (
          <p className="mt-3 text-sm text-muted">
            <Link href="/account/food" className={textLink}>{t("Save your food needs", "내 식단 정보를 저장")}</Link>{t(" and this page starts with them ticked.", "하면 이 페이지에 미리 체크됩니다.")}
          </p>
        )}

        <div role="tablist" aria-label={t("Results", "결과")} className="mt-4 flex gap-1 border-b border-line">
          {([["meals", t(`Meals (${mealCount})`, `메뉴 (${mealCount})`)], ["places", t(`Places (${shownPlaces.length})`, `장소 (${shownPlaces.length})`)]] as const).map(([value, label]) => (
            <button key={value} role="tab" type="button" aria-selected={tab === value} onClick={() => setTab(value)}
              className={`-mb-px min-h-11 cursor-pointer border-b-2 px-3 text-sm font-semibold ${tab === value ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "meals" ? (
          <div className="mt-4 space-y-7">
            {hiddenByKind > 0 && kinds.length < DISH_KINDS.length && (words || mealCount === 0) && (
              <button type="button" onClick={() => { collapse(); setKinds(DISH_KINDS.map((kind) => kind.key)); }} className={`${textLink} cursor-pointer`}>
                {(() => {
                  const rest = DISH_KINDS.filter((kind) => !kinds.includes(kind.key));
                  return t(`Show ${hiddenByKind} more from ${rest.map((kind) => kind.label.toLowerCase()).join(" and ")}`, `${rest.map((kind) => kind.korean).join("·")} ${hiddenByKind}개 더 보기`);
                })()}
              </button>
            )}
            {mealCount === 0 && (
              <p className="rounded-[20px] border border-dashed border-line p-6 text-center text-muted">
                {filtering && strict
                  ? t("No meal has everything ruled out. Try showing “may contain” and “no data”, and ask the store.", "모든 조건을 만족하는 메뉴가 없습니다. “포함 가능”과 “정보 없음”도 보고 매장에 확인해 보세요.")
                  : kinds.length === 1 && kinds[0] === "meal"
                    ? t("No meal matches. Try another word, or include drinks and sides.", "맞는 메뉴가 없습니다. 다른 단어로 찾거나 음료와 사이드도 포함해 보세요.")
                    : t("No meal matches. Try another word.", "맞는 메뉴가 없습니다. 다른 단어로 찾아보세요.")}
              </p>
            )}
            {ordered.map((restaurant) => {
              const dishes = matches.get(restaurant.id) ?? [];
              if (dishes.length === 0) return null;
              const branches = places.filter((p) => p.restaurant_id === restaurant.id);
              return (
                <section key={restaurant.id}>
                  <div className="flex items-center gap-3">
                    <BrandLogo restaurant={restaurant} size={44} />
                    <div className="min-w-0">
                      <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight">{restaurantName(restaurant, lang)}</h2>
                      <p className="text-sm text-muted">
                        {t(`${dishes.length} ${dishes.length === 1 ? "match" : "matches"}`, `맞는 메뉴 ${dishes.length}개`)}
                        {restaurant.menu_source_name && t(` · menu from ${restaurant.menu_source_name}`, ` · ${({ Daangn: "당근", Polle: "뽈레" } as Record<string, string>)[restaurant.menu_source_name] ?? restaurant.menu_source_name} 메뉴`)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {branches.length === 0 && <span className="text-sm text-muted">{t("No branch on the map within 2 km", "2km 이내 지점 없음")}</span>}
                    {branches.map((branch) => (
                      <button key={branch.id} type="button" onClick={() => focusPlace(branch)}
                        className="flex min-h-9 cursor-pointer items-center gap-1 rounded-full bg-soft px-3 text-xs font-semibold transition-colors hover:bg-line">
                        <MapPin aria-hidden size={14} weight="fill" /> {branch.name} · {branch.distance_m} m
                      </button>
                    ))}
                    {branches.slice(0, 1).map((branch) => (
                      <Link key="page" href={`/places/${branch.id}`} className={`${textLink} min-h-9! text-xs`}>{t("Full menu", "전체 메뉴")}</Link>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {dishes.slice(0, opened.has(restaurant.id) ? undefined : PAGE_SIZE).map((dish) => (
                      <li key={dish.id}>
                        <details className="rounded-[20px] border border-line bg-surface transition-colors open:border-ink"
                          onToggle={(event) => event.currentTarget.open && setUnfolded((current) => new Set(current).add(dish.id))}>
                          <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 [&::-webkit-details-marker]:hidden">
                            <DishPhoto src={dish.photo} size={72} />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-sm leading-snug font-semibold">{dishName(dish, lang)}</span>
                              <span className={`mt-0.5 block text-sm ${dish.price === null ? "text-muted" : "font-bold"}`}>{formatKrw(dish.price, lang)}</span>
                              {dish.check && <span className="mt-1 block"><FoodBadge check={dish.check} lang={lang} /></span>}
                            </span>
                          </summary>
                          {unfolded.has(dish.id) && (
                            <div className="px-3.5 pb-3.5">
                              {dish.description && (lang === "ko" || !/[\uac00-\ud7a3]/.test(dish.description)) && <p className="mb-2 text-sm text-muted">{dish.description}</p>}
                              <DishFacts dish={dish} check={dish.check} local={Boolean(restaurant.menu_source_name)} lang={lang} />
                            </div>
                          )}
                        </details>
                      </li>
                    ))}
                  </ul>
                  {dishes.length > PAGE_SIZE && !opened.has(restaurant.id) && (
                    <button type="button" onClick={() => setOpened((current) => new Set(current).add(restaurant.id))} className={`${textLink} cursor-pointer`}>
                      {t(`Show all ${dishes.length} from ${restaurantName(restaurant, lang)}`, `${restaurantName(restaurant, lang)} 메뉴 ${dishes.length}개 모두 보기`)}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label={t("Which places", "장소 종류")}>
            {([["all", t("All places", "모든 장소")], ["with", t("With a menu", "메뉴 있음")], ["without", t("No menu yet", "아직 메뉴 없음")]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={menuFilter === value} onClick={() => setMenuFilter(value)} className={chip(menuFilter === value)}>
                {label}
              </button>
            ))}
          </div>
          <ul className="mt-2 divide-y divide-line">
            {shownPlaces.map((place) => (
              <li key={place.id}>
                <button type="button" onClick={() => focusPlace(place)} aria-current={selected === place.id ? "true" : undefined}
                  className={`flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-2 py-2 text-left transition-colors hover:bg-soft ${selected === place.id ? "bg-soft" : ""}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{place.name}{place.name_en && place.name_en !== place.name ? ` · ${place.name_en}` : ""}</span>
                    <span className="block truncate text-xs text-muted">
                      {[place.kind, place.cuisine, ...place.diet_tags.map((tag) => t(`${tag} (map volunteers' tag)`, `${tag} (지도 자원봉사자 태그)`))].filter(Boolean).join(" · ")}
                    </span>
                    <span className={`block text-xs ${place.restaurant_id ? "font-semibold text-on-accent-soft" : "text-muted"}`}>
                      {matchingText(place) ?? t("No menu yet", "아직 메뉴 없음")}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted">{place.distance_m} m</span>
                </button>
                <Link href={`/places/${place.id}`} className={`${textLink} min-h-9! px-2 text-xs`}>
                  {place.restaurant_id ? t("Open menu", "메뉴 보기") : t("Details", "정보")}
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          {t("Places: © OpenStreetMap contributors, Burger King Korea's store finder, Daangn and Polle. OpenStreetMap is mapped by volunteers and misses some places. Local menus have no allergen data and may be out of date.",
            "장소: © OpenStreetMap 기여자, 버거킹 코리아 매장 찾기, 당근, 뽈레. OpenStreetMap은 자원봉사자가 만들어 빠진 장소가 있을 수 있습니다. 동네 식당 메뉴에는 알레르기 정보가 없고 오래되었을 수 있습니다.")}
        </p>
      </div>

      <div className="relative order-1 isolate h-[42dvh] md:sticky md:top-16 md:order-2 md:h-[calc(100dvh-4rem)]">
        <div ref={mapBox} role="region" aria-label={t("Map of places to eat around Inha University. The Places list has the same information.", "인하대 주변 식당 지도. 장소 목록에도 같은 정보가 있습니다.")} className="size-full" />
        {mapFailed && <p role="alert" className="absolute top-4 right-4 left-16 z-[1000] rounded-xl bg-surface p-3 text-sm">{t("The map could not load. The lists still work.", "지도를 불러오지 못했습니다. 목록은 계속 쓸 수 있습니다.")}</p>}
      </div>
    </main>
  );
}
