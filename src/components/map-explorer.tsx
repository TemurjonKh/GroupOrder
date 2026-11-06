"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CircleMarker, Map as LeafletMap } from "leaflet";
import { MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { DishFacts, FoodBadge } from "./dish-facts";
import { BrandLogo, DishPhoto, inputStyles, textLink } from "./ui";
import { DIETS, LABELLED, NAMED_ONLY, SEARCH_SHORTCUTS, checkDish, dietItemLabel, type DishCheck } from "@/lib/diet";
import { formatKrw } from "@/lib/round";
import type { FoodNeeds, MenuItem, Place, Restaurant } from "@/lib/types";

const CAMPUS = { lat: 37.4494108, lng: 126.6534266 };
const RADIUS_M = 2000;
const PAGE_SIZE = 40;
// OpenStreetMap's tile policy asks for a configurable address.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ORDER = { clear: 0, caution: 1, unknown: 2, avoid: 3 };

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
  popupLine(box, matching ?? "No menu in the database yet");
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
  const [tab, setTab] = useState<"meals" | "places">("meals");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<string | null>(null);
  const [mapFailed, setMapFailed] = useState(false);
  const [markersReady, setMarkersReady] = useState(false);

  const mapBox = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, CircleMarker>());

  const note = useNote ? needs?.note : null;
  const words = query.trim().toLowerCase();
  const filtering = avoid.length > 0 || Boolean(note);

  // One restaurant's matching dishes, best first.
  const matches = useMemo(() => {
    const byRestaurant = new Map<string, Dish[]>();
    for (const restaurant of restaurants) {
      const dishes = restaurant.menu_items
        .map((dish) => ({ ...dish, check: checkDish(dish, avoid, note) }))
        .filter((dish) => {
          const text = [restaurant.name, dish.name, dish.category, dish.description, ...dish.ingredients].join(" ").toLowerCase();
          if (words && !text.includes(words)) return false;
          if (!dish.check) return true;
          return strict ? dish.check.level === "clear" : dish.check.level !== "avoid";
        })
        .sort((a, b) => (a.check ? ORDER[a.check.level] : 0) - (b.check ? ORDER[b.check.level] : 0));
      byRestaurant.set(restaurant.id, dishes);
    }
    return byRestaurant;
  }, [restaurants, avoid, note, words, strict]);

  const mealCount = [...matches.values()].reduce((sum, dishes) => sum + dishes.length, 0);
  const shownPlaces = useMemo(() => places.filter((place) => !words
    || [place.name, place.name_en, place.kind, place.cuisine].join(" ").toLowerCase().includes(words)), [places, words]);

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
    setLimit(PAGE_SIZE);
    setAvoid((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]));
  }

  return (
    <main className="grid md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      <div className="order-2 min-w-0 px-4 py-6 md:order-1">
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight">Find a meal near Inha</h1>
        <p className="mt-2 text-sm text-muted">{places.length} places within 2 km of campus, and {restaurants.reduce((sum, r) => sum + r.menu_items.length, 0)} dishes with what&apos;s inside.</p>

        <label className="relative mt-4 block">
          <span className="sr-only">Search meals and places</span>
          <MagnifyingGlass aria-hidden size={18} className="absolute top-3.5 left-3.5 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setLimit(PAGE_SIZE); }}
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
            {mealCount === 0 && (
              <p className="rounded-[20px] border border-dashed border-line p-6 text-center text-muted">
                {filtering && strict
                  ? "No meal has everything ruled out. Try showing “may contain” and “no data”, and ask the store."
                  : "No meal matches. Try another word."}
              </p>
            )}
            {restaurants.map((restaurant) => {
              const dishes = matches.get(restaurant.id) ?? [];
              if (dishes.length === 0) return null;
              const branches = places.filter((p) => p.restaurant_id === restaurant.id);
              return (
                <section key={restaurant.id}>
                  <div className="flex items-center gap-3">
                    <BrandLogo restaurant={restaurant} size={44} />
                    <div className="min-w-0">
                      <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight">{restaurant.name}</h2>
                      <p className="text-sm text-muted">{dishes.length} {dishes.length === 1 ? "meal" : "meals"}</p>
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
                  </div>
                  <ul className="mt-3 space-y-2">
                    {dishes.slice(0, limit).map((dish) => (
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
                            <DishFacts dish={dish} check={dish.check} />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                  {dishes.length > limit && (
                    <button type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)} className={`${textLink} cursor-pointer`}>
                      Show more from {restaurant.name}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
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
                      {matchingText(place) ?? "No menu in the database yet"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted">{place.distance_m} m</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs leading-relaxed text-muted">
          Places: © OpenStreetMap contributors and Burger King Korea&apos;s store finder. OpenStreetMap is mapped by
          volunteers and misses some places. Menus and allergens are only available for chains that publish them.
        </p>
      </div>

      <div className="relative order-1 isolate h-[42dvh] md:sticky md:top-16 md:order-2 md:h-[calc(100dvh-4rem)]">
        <div ref={mapBox} role="region" aria-label="Map of places to eat around Inha University. The Places list has the same information." className="size-full" />
        {mapFailed && <p role="alert" className="absolute top-4 right-4 left-16 z-[1000] rounded-xl bg-surface p-3 text-sm">The map could not load. The lists still work.</p>}
      </div>
    </main>
  );
}
