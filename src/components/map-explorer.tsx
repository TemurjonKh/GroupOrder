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
import type { FoodNeeds, MenuItem, Place, Restaurant } from "@/lib/types";

const CAMPUS = { lat: 37.4494108, lng: 126.6534266 };
const RADIUS_M = 2000;
// A few dishes per restaurant at first, so the page stays light; each restaurant opens on request.
const PAGE_SIZE = 6;
// OpenStreetMap's tile policy asks for a configurable address.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ORDER = { clear: 0, caution: 1, unknown: 2, avoid: 3 };
const PRICE_CAPS = [5000, 10000, 15000, 20000];

type Dish = MenuItem & { check: DishCheck | null };

/** Builds a line of popup text. Place details come from outside, so they are only ever set as text. */
function popupLine(parent: HTMLElement, value: string | null, bold = false) {
  if (!value) return;
  const line = document.createElement(bold ? "strong" : "div");
  line.textContent = value;
  if (bold) line.style.display = "block";
  parent.append(line);
}

function placePopup(place: Place, matching: string | null) {
  const box = document.createElement("div");
  popupLine(box, place.name, true);
  popupLine(box, place.name_en && place.name_en !== place.name ? place.name_en : null);
  popupLine(box, [place.kind, place.cuisine, `${place.distance_m} m away`].filter(Boolean).join(" · "));
  popupLine(box, place.address);
  popupLine(box, place.phone);
  popupLine(box, place.opening_hours);
  popupLine(box, matching ?? "No menu yet");
  // Built as an element with a fixed address, never from place text.
  const page = document.createElement("a");
  page.href = `/places/${encodeURIComponent(place.id)}`;
  page.textContent = place.restaurant_id ? "Open menu" : "Add its menu";
  page.style.display = "block";
  page.style.fontWeight = "600";
  box.append(page);
  if (place.website && /^https?:\/\//i.test(place.website)) {
    const link = document.createElement("a");
    link.href = place.website;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = "Website";
    box.append(link);
  }
  return box;
}

const chip = (on: boolean) =>
  `flex min-h-10 cursor-pointer items-center rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${
    on ? "border-ink bg-ink text-page" : "border-line bg-surface hover:border-ink"
  }`;

export function MapExplorer({ places, restaurants, needs }: {
  places: Place[];
  restaurants: (Restaurant & { menu_items: MenuItem[] })[];
  needs: FoodNeeds | null;
}) {
  const [query, setQuery] = useState("");
  const [avoid, setAvoid] = useState<string[]>(needs?.avoid ?? []);
  const [useNote, setUseNote] = useState(Boolean(needs?.note));
  const [strict, setStrict] = useState(true);
  const [kinds, setKinds] = useState<DishKind[]>(["meal"]);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [sort, setSort] = useState<"near" | "cheap">("near");
  const [tab, setTab] = useState<"meals" | "places">("meals");
  const [opened, setOpened] = useState<Set<string>>(new Set());
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
    const shownKind = (dish: MenuItem) => kinds.length === 0 || kinds.includes(kindOf.get(dish.id) ?? "meal");
    for (const restaurant of restaurants) {
      const passing = restaurant.menu_items
        // A dish with no price is hidden by a price cap: its price is unknown, not zero.
        .filter((dish) => maxPrice === null || (dish.price !== null && dish.price <= maxPrice))
        .map((dish) => ({ ...dish, check: checkDish(dish, avoid, note) }))
        .filter((dish) => {
          const text = [restaurant.name, dish.name, dish.category, dish.description, ...dish.ingredients].join(" ").toLowerCase();
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
    return `${count} ${count === 1 ? "meal matches" : "meals match"} your search`;
  };
  const latest = useRef(matchingText);
  useEffect(() => { latest.current = matchingText; });

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
        title: "Inha University",
        icon: L.divIcon({ className: "", html: `<span style="display:block;width:16px;height:16px;border-radius:5px;background:${accent};border:3px solid #fff;box-shadow:0 1px 4px rgb(0 0 0 / .4)"></span>`, iconSize: [16, 16] }),
      }).addTo(m).bindPopup("Inha University");
      for (const place of places) {
        const marker = L.circleMarker([place.lat, place.lng], { radius: 5, weight: 1, color: "#fff", fillColor: "#7b7c70", fillOpacity: 0.9 }).addTo(m);
        marker.bindPopup(() => placePopup(place, latest.current(place)));
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
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight">Find a meal near Inha</h1>
        <p className="mt-2 text-sm text-muted">
          {places.length} places within 2 km of campus, and {restaurants.reduce((sum, r) => sum + r.menu_items.length, 0)} dishes
          from {restaurants.length} restaurants to search. Local restaurants publish no menus, so members add them:
          open a place and add what it serves.
        </p>

        <label className="relative mt-4 block">
          <span className="sr-only">Search meals and places</span>
          <MagnifyingGlass aria-hidden size={18} className="absolute top-3.5 left-3.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); collapse(); }}
            placeholder="Chicken, 샐러드, pizza…"
            className={`${inputStyles} pl-10`}
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="What to avoid">
          {SEARCH_SHORTCUTS.map((key) => (
            <button key={key} type="button" aria-pressed={avoid.includes(key)} onClick={() => toggle(key)} className={chip(avoid.includes(key))}>
              {dietItemLabel(key)}
            </button>
          ))}
        </div>

        <details className="mt-2">
          <summary className={`${textLink} cursor-pointer`}>All allergies and foods</summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...DIETS, ...LABELLED, ...NAMED_ONLY].filter((item) => !SEARCH_SHORTCUTS.includes(item.key)).map((item) => (
              <button key={item.key} type="button" aria-pressed={avoid.includes(item.key)} onClick={() => toggle(item.key)} className={chip(avoid.includes(item.key))}>
                {item.label}
              </button>
            ))}
          </div>
        </details>

        <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Kind of dish">
          {DISH_KINDS.map((kind) => {
            const on = kinds.includes(kind.key);
            return (
              <button key={kind.key} type="button" aria-pressed={on} className={chip(on)}
                onClick={() => { collapse(); setKinds((current) => (on ? current.filter((k) => k !== kind.key) : [...current, kind.key])); }}>
                {kind.label}
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Price</span>
            <select value={maxPrice ?? ""} onChange={(event) => { collapse(); setMaxPrice(event.target.value ? Number(event.target.value) : null); }} className={inputStyles}>
              <option value="">Any price</option>
              {PRICE_CAPS.map((cap) => <option key={cap} value={cap}>Up to {formatKrw(cap)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Sort</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as "near" | "cheap")} className={inputStyles}>
              <option value="near">Nearest first</option>
              <option value="cheap">Cheapest first</option>
            </select>
          </label>
        </div>
        {maxPrice !== null && <p className="mt-1 text-xs text-muted">Dishes with no listed price are hidden while a price limit is set.</p>}

        {needs?.note && (
          <label className="mt-2 flex min-h-10 items-center gap-2 text-sm">
            <input type="checkbox" checked={useNote} onChange={(event) => setUseNote(event.target.checked)} className="size-4 accent-(--accent)" />
            Also avoid: {needs.note}
          </label>
        )}

        {filtering && (
          <fieldset className="mt-3">
            <legend className="sr-only">How strict</legend>
            <div className="flex flex-col gap-1 text-sm">
              <label className="flex min-h-9 items-center gap-2">
                <input type="radio" name="strict" checked={strict} onChange={() => setStrict(true)} className="size-4 accent-(--accent)" />
                Only meals with nothing of yours listed
              </label>
              <label className="flex min-h-9 items-center gap-2">
                <input type="radio" name="strict" checked={!strict} onChange={() => setStrict(false)} className="size-4 accent-(--accent)" />
                Also show &quot;may contain&quot; and &quot;no data&quot;
              </label>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4">
              <button type="button" onClick={() => { setAvoid([]); setUseNote(false); }} className={`${textLink} cursor-pointer`}>Clear filters</button>
            </div>
          </fieldset>
        )}

        {!needs && (
          <p className="mt-3 text-sm text-muted">
            <Link href="/account/food" className={textLink}>Save your food needs</Link> and this page starts with them ticked.
          </p>
        )}

        <div role="tablist" aria-label="Results" className="mt-4 flex gap-1 border-b border-line">
          {([["meals", `Meals (${mealCount})`], ["places", `Places (${shownPlaces.length})`]] as const).map(([value, label]) => (
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
                Show {hiddenByKind} more from {DISH_KINDS.filter((kind) => !kinds.includes(kind.key)).map((kind) => kind.label.toLowerCase()).join(" and ")}
              </button>
            )}
            {mealCount === 0 && (
              <p className="rounded-[20px] border border-dashed border-line p-6 text-center text-muted">
                {filtering && strict
                  ? "No meal has everything ruled out. Try showing “may contain” and “no data”, and ask the store."
                  : kinds.length === 1 && kinds[0] === "meal" ? "No meal matches. Try another word, or include drinks and sides." : "No meal matches. Try another word."}
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
                      <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight">{restaurant.name}</h2>
                      <p className="text-sm text-muted">
                        {dishes.length} {dishes.length === 1 ? "match" : "matches"}
                        {restaurant.place_id && " · menu typed in by members"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {branches.length === 0 && <span className="text-sm text-muted">No branch on the map within 2 km</span>}
                    {branches.map((branch) => (
                      <button key={branch.id} type="button" onClick={() => focusPlace(branch)}
                        className="flex min-h-9 cursor-pointer items-center gap-1 rounded-full bg-soft px-3 text-xs font-semibold transition-colors hover:bg-line">
                        <MapPin aria-hidden size={14} weight="fill" /> {branch.name} · {branch.distance_m} m
                      </button>
                    ))}
                    {branches.slice(0, 1).map((branch) => (
                      <Link key="page" href={`/places/${branch.id}`} className={`${textLink} min-h-9! text-xs`}>Full menu</Link>
                    ))}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {dishes.slice(0, opened.has(restaurant.id) ? undefined : PAGE_SIZE).map((dish) => (
                      <li key={dish.id}>
                        <details className="rounded-[20px] border border-line bg-surface transition-colors open:border-ink">
                          <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 [&::-webkit-details-marker]:hidden">
                            <DishPhoto src={dish.photo} size={72} />
                            <span className="min-w-0 flex-1">
                              <span className="line-clamp-2 text-sm leading-snug font-semibold">{dish.name}</span>
                              <span className={`mt-0.5 block text-sm ${dish.price === null ? "text-muted" : "font-bold"}`}>{formatKrw(dish.price)}</span>
                              {dish.check && <span className="mt-1 block"><FoodBadge check={dish.check} /></span>}
                            </span>
                          </summary>
                          <div className="px-3.5 pb-3.5">
                            {dish.description && <p className="mb-2 text-sm text-muted">{dish.description}</p>}
                            <DishFacts dish={dish} check={dish.check} byMember={Boolean(restaurant.place_id)} />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                  {dishes.length > PAGE_SIZE && !opened.has(restaurant.id) && (
                    <button type="button" onClick={() => setOpened((current) => new Set(current).add(restaurant.id))} className={`${textLink} cursor-pointer`}>
                      Show all {dishes.length} from {restaurant.name}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Which places">
            {([["all", "All places"], ["with", "With a menu"], ["without", "Needs a menu"]] as const).map(([value, label]) => (
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
                      {[place.kind, place.cuisine, ...place.diet_tags.map((tag) => `${tag} (map volunteers' tag)`)].filter(Boolean).join(" · ")}
                    </span>
                    <span className={`block text-xs ${place.restaurant_id ? "font-semibold text-on-accent-soft" : "text-muted"}`}>
                      {matchingText(place) ?? "No menu yet"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted">{place.distance_m} m</span>
                </button>
                <Link href={`/places/${place.id}`} className={`${textLink} min-h-9! px-2 text-xs`}>
                  {place.restaurant_id ? "Open menu" : "Add its menu"}
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Places: © OpenStreetMap contributors and Burger King Korea&apos;s store finder. OpenStreetMap is mapped by
          volunteers and misses some places. Chain menus come from the brands; local menus are typed in by members.
        </p>
      </div>

      <div className="relative order-1 isolate h-[42dvh] md:sticky md:top-16 md:order-2 md:h-[calc(100dvh-4rem)]">
        <div ref={mapBox} role="region" aria-label="Map of places to eat around Inha University. The Places list has the same information." className="size-full" />
        {mapFailed && <p role="alert" className="absolute top-4 right-4 left-16 z-[1000] rounded-xl bg-surface p-3 text-sm">The map could not load. The lists still work.</p>}
      </div>
    </main>
  );
}
