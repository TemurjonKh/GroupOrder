// npm run places:import: everywhere to eat within 2 km of Inha University, into
// supabase/places/inha.json. npm run menus:seed then builds it into supabase/seed.sql.
//
// Sources: OpenStreetMap (ODbL, so "© OpenStreetMap contributors" must stay on the map) and
// Burger King's own store finder, because OpenStreetMap has none of its branches here.
// OpenStreetMap is volunteer-mapped and incomplete, and it has no menus.
//
// The public Overpass servers are often busy. Pass a saved response to skip the download:
//   node scripts/import-places.mjs path/to/overpass.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { CHAINS } from "./chains.mjs";

const USER_AGENT = "GroupOrder-map-import/0.1 (student project; local demo)";
// The centre of the campus outline in OpenStreetMap (way 472447787).
const CAMPUS = { lat: 37.4494108, lng: 126.6534266 };
const RADIUS_M = 2000;
const OVERPASS = "https://overpass-api.de/api/interpreter";
const KINDS = "restaurant|fast_food|cafe|food_court|pub|bar|ice_cream";
// Comfortably larger than the circle; distances below do the exact cut.
const BOX = "37.4300,126.6300,37.4700,126.6770";
const QUERY = `[out:json][timeout:120][bbox:${BOX}];nwr["amenity"~"^(${KINDS})$"];out center tags;`;
const RETRY_MS = 45_000;
const RETRIES = 8;

const KIND_LABEL = { restaurant: "Restaurant", fast_food: "Fast food", cafe: "Cafe", food_court: "Food court", pub: "Pub", bar: "Bar", ice_cream: "Ice cream" };

function distance(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

async function downloadOverpass() {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    const response = await fetch(OVERPASS, {
      method: "POST",
      headers: { "user-agent": USER_AGENT, "content-type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(QUERY)}`,
    }).catch(() => null);
    if (response?.ok) {
      const body = await response.json().catch(() => null);
      if (body && !body.remark) return body;
    }
    console.log(`Overpass is busy (try ${attempt} of ${RETRIES}), waiting`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
  }
  throw new Error("Overpass did not answer. Try again later.");
}

function fromOpenStreetMap(element) {
  const tags = element.tags;
  const position = { lat: element.lat ?? element.center.lat, lng: element.lon ?? element.center.lon };
  const kind = KIND_LABEL[tags.amenity];
  const label = [tags.name, tags["name:en"], tags.brand, tags["brand:en"]].filter(Boolean).join(" ");
  const address = [tags["addr:city"], tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ") || null;
  return {
    source: "openstreetmap",
    source_id: `${element.type}/${element.id}`,
    name: tags.name ?? tags.brand ?? `Unnamed ${kind.toLowerCase()}`,
    name_en: tags["name:en"] ?? tags["brand:en"] ?? null,
    kind,
    cuisine: tags.cuisine?.replaceAll(";", ", ").replaceAll("_", " ") ?? null,
    ...position,
    distance_m: distance(CAMPUS, position),
    address,
    phone: tags.phone ?? tags["contact:phone"] ?? null,
    opening_hours: tags.opening_hours ?? null,
    website: tags.website ?? tags["contact:website"] ?? null,
    // Tags such as diet:vegan=yes are added by map volunteers, so the page says so.
    diet_tags: Object.entries(tags)
      .filter(([key, value]) => key.startsWith("diet:") && ["yes", "only"].includes(value))
      .map(([key]) => key.slice(5)),
    restaurant: CHAINS.find((chain) => chain.match.test(label))?.restaurant ?? null,
  };
}

async function burgerKingBranches() {
  const trcode = "BKR0343";
  const message = {
    header: { result: true, error_code: "", error_text: "", info_text: "", message_version: "", login_session_id: "", trcode, cd_call_chnn: "01" },
    body: { dataCount: "30", membershipYn: "", orderType: "01", page: "1", searchKeyword: "", serviceCode: [], sort: "01", xCoordinates: String(CAMPUS.lng), yCoordinates: String(CAMPUS.lat), isAllYn: "N" },
  };
  const response = await fetch(`https://www.burgerking.co.kr/burgerking/${trcode}.json`, {
    method: "POST",
    headers: { "user-agent": "GroupOrder-menu-import/0.1 (student project; menu data for a local demo)", "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: `message=${encodeURIComponent(JSON.stringify(message))}`,
  });
  if (!response.ok) throw new Error(`Burger King store finder answered ${response.status}`);
  return (await response.json()).body.storInfo.map((store) => {
    const position = { lat: Number(store.storCoordY ?? store.yCoordinates), lng: Number(store.storCoordX ?? store.xCoordinates) };
    if (!position.lat || !position.lng) throw new Error(`No position for ${store.storNm}: ${Object.keys(store)}`);
    return {
      source: "brand",
      source_id: `burgerking/${store.storCd}`,
      name: `버거킹 ${store.storNm}`,
      name_en: "Burger King",
      kind: "Fast food",
      cuisine: "burger",
      ...position,
      distance_m: distance(CAMPUS, position),
      address: store.storAddr?.trim() || null,
      phone: store.storTelNo || null,
      opening_hours: null,
      website: "https://www.burgerking.co.kr",
      diet_tags: [],
      restaurant: "Burger King",
    };
  });
}

// --relink matches the saved places to the chains again, without asking Overpass.
if (process.argv[2] === "--relink") {
  const file = JSON.parse(readFileSync("supabase/places/inha.json", "utf8"));
  for (const place of file.places) {
    if (place.source === "brand") continue;
    place.restaurant = CHAINS.find((chain) => chain.match.test([place.name, place.name_en].filter(Boolean).join(" ")))?.restaurant ?? null;
  }
  writeFileSync("supabase/places/inha.json", `${JSON.stringify(file, null, 1)}\n`);
  console.log(`supabase/places/inha.json: ${file.places.filter((p) => p.restaurant).length} of ${file.places.length} places have menus`);
  process.exit(0);
}

const saved = process.argv[2];
const overpass = saved ? JSON.parse(readFileSync(saved, "utf8")) : await downloadOverpass();
const places = [...overpass.elements.map(fromOpenStreetMap), ...await burgerKingBranches()]
  .filter((place) => place.distance_m <= RADIUS_M)
  .sort((a, b) => a.distance_m - b.distance_m || a.source_id.localeCompare(b.source_id));

mkdirSync("supabase/places", { recursive: true });
writeFileSync("supabase/places/inha.json", `${JSON.stringify({
  centre: { name: "Inha University", ...CAMPUS },
  radius_m: RADIUS_M,
  attribution: "© OpenStreetMap contributors (ODbL); Burger King Korea store finder",
  osm_data_from: overpass.osm3s?.timestamp_osm_base ?? null,
  places,
}, null, 1)}\n`);
const linked = places.filter((p) => p.restaurant).map((p) => `${p.name} (${p.distance_m} m)`);
console.log(`supabase/places/inha.json: ${places.length} places, with menus: ${linked.join(", ")}`);
