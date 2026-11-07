// npm run menus:local: menus of independent restaurants near Inha, into supabase/menus/local/*.json.
// npm run menus:seed then builds them into supabase/seed.sql.
//
// Small restaurants have no menu site of their own, so the menus come from two listing sites
// whose robots.txt allows this (checked 2026-11-07):
//   Daangn business profiles (/kr/local-profile/), where the owner types the price list. Its
//     robots.txt names AI user agents and allows them on exactly these pages.
//   Polle place pages (/place/), where the menu is typed in by Polle's users.
// Naver blogs, Naver Map, Kakao Map, Instagram, Brunch, Diningcode and Tripadvisor shut out bots
// like this one, so nothing comes from them.
//
// The pages to read are listed in supabase/menus/local-sources.json. Each one is kept only if it
// is within 2 km of Inha. It is matched to the OpenStreetMap place at the same spot with a
// similar name, or added as a new place when OpenStreetMap does not have it.
// Neither site lists allergens, so every dish stays "No data"; the dish name still counts in search.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { CHAINS } from "./chains.mjs";
import { clean, decode, get, textOf } from "./menu-helpers.mjs";

const CAMPUS = { lat: 37.4494108, lng: 126.6534266 };
const RADIUS_M = 2000;
// A menu with one or two dishes would make a place look covered when it is not.
const MIN_DISHES = 3;
const OUT = "supabase/menus/local";
const today = new Date().toISOString().slice(0, 10);

function distance(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

// No age check in the app, so drinks with alcohol stay out, as they do for the chains.
const ALCOHOL = /소주|맥주|막걸리|동동주|하이볼|와인|사케|칵테일|청하|참이슬|처음처럼|진로|카스|테라|켈리|하이네켄|아사히|칭따오|복분자|매화수|고량주|연태|이과두|위스키|beer|soju|wine|highball/i;
const money = (text) => {
  const m = /(\d{1,3}(?:,\d{3})+|\d{3,7})/.exec(text ?? "");
  return m ? Number(m[1].replaceAll(",", "")) : null;
};
const dish = (name, price, category = "Menu") => ({
  name, category, description: null, photo: null, price, ingredients: [],
  contains: null, may_contain: null, allergen_source: null, allergen_note: null,
});

function keep(dishes) {
  const seen = new Set();
  return dishes.filter((d) => {
    const key = d.name.replace(/\s+/g, "");
    if (!d.name || seen.has(key) || ALCOHOL.test(d.name)) return false;
    seen.add(key);
    return true;
  });
}

async function polle(url) {
  const html = await (await get(url)).text();
  const title = first(/<title>([^<]*)<\/title>/, html) ?? "";
  // "명동칼국수 인하대역점 - 용현동 칼국수 | 뽈레 Polle"
  const [label, area] = decode(title).replace(/\s*\|\s*뽈레 Polle\s*$/, "").split(/\s+-\s+/);
  const status = textOf(first(/<div class="status">([\s\S]*?)<\/div>\s*<div class="rating">/, html)?.replace(/<!--[\s\S]*?-->/g, ""));
  const lat = Number(first(/lat='\+([\d.]+)\+/, html));
  const lng = Number(first(/lng='\+([\d.]+)/, html));
  const metas = [...html.matchAll(/<span class="shop_meta_text">([\s\S]*?)<\/span>/g)].map((m) => textOf(m[1]));
  const phone = first(/href="tel:([^"]+)"/, html);
  const dishes = [...html.matchAll(/<span class="menu_text"[^>]*>([\s\S]*?)<\/span>\s*<span class="menu_price">([^<]*)/g)]
    .map((m) => dish(textOf(m[1]), money(m[2])));
  return {
    site: "Polle", id: url.split("/")[4], name: clean(label), area: clean(area), closed: /폐점|폐업/.test(status ?? ""),
    cuisine: metas[0] ?? null, address: metas.find((m) => /[시구]\s/.test(m ?? "")) ?? null, phone,
    lat, lng, updated: null, dishes,
    note: "Typed in by Polle users; prices may be out of date.",
  };
}

async function daangn(url) {
  const html = await (await get(url)).text();
  const business = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1])).find((d) => d["@type"] === "LocalBusiness");
  const category = JSON.parse(first(/"category":(\{"name":[^}]*\})/, html) ?? "null");
  const edited = first(/"editedAt":"([\d-]{10})/, html);
  const seen = new Set();
  const dishes = [...html.matchAll(/\{"name":"((?:[^"\\]|\\.)*)","description":"((?:[^"\\]|\\.)*)","isRepresentative":\w+,"orderNumber":(\d+),"price":(\d+|null)[^}]*"__typename":"BusinessPricing"\}/g)]
    .filter((m) => !seen.has(m[3]) && seen.add(m[3]))
    .sort((a, b) => Number(a[3]) - Number(b[3]))
    .map((m) => ({ ...dish(clean(JSON.parse(`"${m[1]}"`)), m[4] === "null" ? null : Number(m[4])), description: clean(JSON.parse(`"${m[2]}"`)) }));
  return {
    site: "Daangn", id: url.split("/")[5].split("-").pop(), name: clean(business.name), area: null, closed: false,
    cuisine: category?.name ?? null, food: ["음식점", "카페", "디저트", "간식"].some((w) => category?.levels?.[0]?.includes(w)),
    address: business.address?.streetAddress ?? null, phone: business.telephone ?? null,
    lat: business.geo?.latitude, lng: business.geo?.longitude, updated: edited, dishes,
    note: "Posted by the business on Daangn. It may not list every dish.",
  };
}

const first = (re, text) => re.exec(text)?.[1] ?? null;
// "두손메밀 인하대점" and "두손메밀" are the same place; so are "차오팡" and "챠오팡".
const bare = (name) => (name ?? "").replace(/\s+/g, "").replace(/\(.*?\)/g, "").replace(/(인천)?(인하대(역|학교)?|용현|학익|숭의)?\d*호?점$/, "")
  .replace(/챠/g, "차").replace(/쭈/g, "주").toLowerCase();
// One name holds the other, or they start the same way ("고씨네오리" and "고씨네"). A shared food
// word alone ("떡볶이") is not enough: 우리할매떡볶이 is not 33떡볶이.
const alike = (a, b) => {
  const x = bare(a), y = bare(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x) || (x.length >= 3 && y.length >= 3 && x.slice(0, 3) === y.slice(0, 3));
};

const { places } = JSON.parse(readFileSync("supabase/places/inha.json", "utf8"));
// pages: one place each, as a link or as { url, place } to name the OpenStreetMap place by hand
// when the names differ ("소블링" is "SoBling" there). branches: franchises whose branch near
// Inha has no page; another branch's price list stands in, and says so.
const sources = JSON.parse(readFileSync("supabase/menus/local-sources.json", "utf8"));
const read = async (url) => {
  try {
    return url.includes("daangn.com") ? await daangn(url) : await polle(url);
  } catch (error) {
    console.log(`skip ${url}: ${error.message}`);
    return null;
  }
};

const found = new Map();
for (const page of sources.pages) {
  const { url, place: chosen } = typeof page === "string" ? { url: page, place: null } : page;
  const r = await read(url);
  if (!r) continue;
  const away = distance(CAMPUS, r);
  const why = !Number.isFinite(away) ? "no location" : away > RADIUS_M ? `${away} m away` : r.closed ? "closed"
    : r.food === false ? `not food (${r.cuisine})` : keep(r.dishes).length < MIN_DISHES ? `only ${keep(r.dishes).length} dishes` : null;
  if (why) { console.log(`skip ${r.name} (${r.site}): ${why}`); continue; }
  // The nearest OpenStreetMap place with a similar name, if there is one.
  const match = chosen ? places.find((p) => p.source_id === chosen)
    : places.filter((p) => alike(p.name, r.name) && distance(p, r) <= 250).sort((a, b) => distance(a, r) - distance(b, r))[0];
  const chain = CHAINS.find((c) => c.match.test(r.name))?.restaurant ?? (match?.restaurant || null);
  if (chain) { console.log(`skip ${r.name}: a branch of ${chain}, which has the brand's menu`); continue; }
  const dishes = keep(r.dishes);
  // The same place on both sites, or twice on one, is one menu.
  const twin = [...found.entries()].find(([, m]) => alike(m.place.name ?? m.name, r.name)
    && distance(m.place.lat ? m.place : places.find((p) => p.source_id === m.place.source_id), r) <= 150);
  const key = match ? `osm:${match.source_id}` : twin?.[0] ?? `${r.site}:${r.id}`;
  const before = found.get(key);
  // Two pages for one place: the longer list wins, and the owner's own list counts for more.
  const weight = (site, n) => n * (site === "Daangn" ? 1.5 : 1);
  if (before && weight(before.source_site, before.dishes.length) >= weight(r.site, dishes.length)) continue;
  found.set(key, {
    slug: `${r.site.toLowerCase()}-${r.id}`,
    name: match?.name ?? r.name, cuisine: r.cuisine ?? match?.cuisine ?? "Restaurant",
    logo: null, logo_bg: null, delivery_link: null,
    source: url, source_site: r.site, source_note: r.note, source_updated: r.updated, checked: today,
    place: match
      ? { source: match.source, source_id: match.source_id }
      : { source: r.site.toLowerCase(), source_id: r.id, name: r.name, kind: /카페|커피|디저트|베이커리|빵/.test(r.cuisine ?? "") ? "Cafe" : "Restaurant",
          cuisine: r.cuisine, lat: r.lat, lng: r.lng, distance_m: away, address: r.address, phone: r.phone },
    dishes,
  });
  console.log(`${r.name} (${r.site}): ${dishes.length} dishes, ${match ? `matched ${match.name}` : "new place"}, ${away} m`);
}

const covered = new Set([...found.values()].map((m) => m.place.source_id));
const branchMenus = [];
for (const [brand, urls] of Object.entries(sources.branches)) {
  const near = places.filter((p) => bare(p.name).startsWith(bare(brand)) && !p.restaurant && !covered.has(p.source_id));
  if (near.length === 0) { console.log(`skip ${brand}: no branch on the map without a menu`); continue; }
  // The fullest price list any branch has posted.
  let best = null;
  for (const url of urls) {
    const r = await read(url);
    if (r && !r.closed && keep(r.dishes).length >= MIN_DISHES && keep(r.dishes).length > (best ? keep(best.r.dishes).length : 0)) best = { r, url };
  }
  if (!best) { console.log(`skip ${brand}: no branch posts a price list`); continue; }
  const { r, url } = best;
  branchMenus.push({
    slug: `branch-${r.site.toLowerCase()}-${r.id}`,
    name: brand, cuisine: r.cuisine ?? near[0].cuisine ?? "Restaurant",
    logo: null, logo_bg: null, delivery_link: null,
    source: url, source_site: r.site,
    source_note: `Posted on ${r.site} by another branch (${r.name}), not the one near Inha, so prices and dishes here may differ.`,
    source_updated: r.updated, checked: today,
    place: null, branches: near.map((p) => p.source_id),
    dishes: keep(r.dishes),
  });
  console.log(`${brand}: ${keep(r.dishes).length} dishes from ${r.name}, for ${near.length} ${near.length === 1 ? "place" : "places"}`);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const menu of [...found.values(), ...branchMenus]) writeFileSync(`${OUT}/${menu.slug}.json`, `${JSON.stringify(menu, null, 1)}\n`);
const linked = [...found.values()].filter((m) => m.place.source === "openstreetmap").length;
console.log(`${found.size} local menus (${linked} on OpenStreetMap places, ${found.size - linked} new places), ${branchMenus.length} franchise menus from another branch`);
