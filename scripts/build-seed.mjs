// npm run menus:seed: turns supabase/menus/*.json (chains), supabase/menus/local/*.json (independent
// restaurants), data/restaurants/*/menu.json (branch menus) and supabase/places/inha.json into supabase/seed.sql.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { leftOut } from "./menu-helpers.mjs";

const text = (value) => (value === null || value === undefined ? "null::text" : `'${String(value).replaceAll("'", "''")}'`);
const int = (value) => (value === null || value === undefined ? "null::integer" : `${Number(value)}::integer`);
const num = (value) => `${Number(value)}::double precision`;
const date = (value) => (value ? `'${value}'::date` : "null::date");
// Null stays null: it means the brand published nothing, which is different from an empty list.
const list = (value) => (value === null || value === undefined ? "null::text[]" : `array[${value.map(text).join(", ")}]::text[]`);

const read = (dir) => readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "local-sources.json").sort()
  .map((f) => JSON.parse(readFileSync(`${dir}/${f}`, "utf8")));

// Menus of one branch, kept exactly as given in data/restaurants/<slug>/menu.json (from its Naver order
// page), with photos in public/restaurants/<slug>/ (npm run menus:photos). Unlike the menus below
// they load on every run, keyed by their own ids, so a newer menu.json updates the rows in place.
// `replaces` names the chain or local menu (by slug) the branch stands in for: it no longer loads,
// and gives its cuisine, logo and, where the dish names match, its allergen data.
// `places` are the places it serves: its own first, then others of the same brand near Inha.
const BRANCHES = [
  { slug: "burger-king-inha", name_en: "Burger King Inha Univ. Station", replaces: "burgerking",
    places: [["brand", "burgerking/00000481"], ["brand", "burgerking/00000643"], ["brand", "burgerking/00000615"]] },
  { slug: "starbucks-inha", name_en: "Starbucks Inha Univ. Station", replaces: "starbucks",
    places: [["openstreetmap", "node/13986183516"], ["openstreetmap", "node/13986242549"]] },
  { slug: "popeyes-inha", name_en: "Popeyes Inha Univ. Station", replaces: "popeyes",
    places: [["openstreetmap", "node/13986242551"]] },
  { slug: "cheese-wave-inha", name_en: "Cheese Wave Inha Univ. Station", replaces: "daangn-4o5mrtw5hox4",
    places: [["openstreetmap", "node/13986242547"]] },
  { slug: "imotteok-inha", name_en: "Imotteok Tteokbokki", replaces: "polle-3yP27x",
    places: [["openstreetmap", "node/9731905057"]] },
  { slug: "hoe-pocha-inha", name_en: "Hoe-tteuneun Pocha", cuisine: "횟집, 해산물",
    places: [["openstreetmap", "node/13986183530"]] },
];
// English names for the language switch; a missing one shows the original name.
const tr = JSON.parse(readFileSync("supabase/menus/translations/en.json", "utf8"));
const { centre, places } = JSON.parse(readFileSync("supabase/places/inha.json", "utf8"));

// Restaurants near Inha with the menu they post on their own Naver Place page, in
// data/restaurants/naver-place-<Naver place id>/ (see README). Unlike the branches above they carry
// their location, like the local menus, so they show for groups near Inha. Each one is pinned at the
// OpenStreetMap place with the same name close by, or else where Naver has it, and stands in for a
// Daangn or Polle menu of that place. A branch of a chain we have replaces the chain's menu only when
// it lists a good share of the chain's dishes; a short branch menu would lose the rest.
const metres = (a, b) => {
  const rad = (deg) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
};
// "한신우동 인하대역점" and "한신우동" are the same restaurant.
const plain = (name) => name.replace(/\s+\S*점$/, "").replace(/[\s().,·&'-]/g, "").toLowerCase();
const chainMenus = read("supabase/menus");
const localMenus = read("supabase/menus/local");
const taken = new Set(BRANCHES.map((b) => b.replaces));
const NEARBY = readdirSync("data/restaurants").filter((slug) => slug.startsWith("naver-place-")).sort().flatMap((slug) => {
  const { restaurant: r, menu: dishes } = JSON.parse(readFileSync(`data/restaurants/${slug}/menu.json`, "utf8"));
  const kept = dishes.filter((d) => !leftOut(d));
  if (!kept.length) return [];
  const same = (p) => p?.lat && plain(p.name) === plain(r.name) && metres(p, r) <= 150;
  const osm = places.filter(same).sort((a, b) => metres(a, r) - metres(b, r))[0];
  const chain = chainMenus.find((c) => plain(r.name).startsWith(plain(tr.restaurants_ko[c.name] ?? c.name)));
  let replaces;
  if (chain) {
    if (kept.length < chain.dishes.length * 0.4 || !kept.some((d) => d.price)) return [];
    if (!taken.has(chain.slug)) replaces = chain.slug;
  } else {
    const local = localMenus.find((m) => !taken.has(m.slug) && (same(m.place)
      || (osm && (m.place?.source_id === osm.source_id || (m.branches?.length === 1 && m.branches[0] === osm.source_id)))));
    replaces = local?.slug;
  }
  if (replaces) taken.add(replaces);
  return [{
    slug, name_en: tr.restaurants[r.name] ?? null, cuisine: r.category, replaces, brand: chain?.slug, at: r,
    note: "The restaurant's own menu and prices, as posted on its Naver Place page.",
    places: [osm ? [osm.source, osm.source_id] : ["naver", r.naver_place_id]],
    place: osm ? null : { source: "naver", source_id: r.naver_place_id, name: r.name, kind: /카페|커피|디저트|베이커리|케이크|빙수|아이스크림/.test(r.category ?? "") ? "Cafe" : "Restaurant",
      cuisine: r.category, lat: r.lat, lng: r.lng, distance_m: metres(centre, r), address: r.road_address ? `인천 미추홀구 ${r.road_address}` : r.address, phone: r.phone },
  }];
});
// A branch that replaces a chain also serves the chain's other places near Inha, unless they have a
// Naver menu of their own.
const own = new Set(NEARBY.map((b) => b.places[0][1]));
for (const b of NEARBY.filter((b) => chainMenus.some((c) => c.slug === b.replaces))) {
  const name = chainMenus.find((c) => c.slug === b.replaces).name;
  b.places.push(...places.filter((p) => p.restaurant === name && !own.has(p.source_id)).map((p) => [p.source, p.source_id]));
}
const ALL_BRANCHES = [...BRANCHES, ...NEARBY];
const replaced = new Set(ALL_BRANCHES.map((b) => b.replaces).filter(Boolean));

const chains = chainMenus.filter((r) => !replaced.has(r.slug));
const locals = localMenus.filter((r) => !replaced.has(r.slug));

/** One restaurant and its dishes. A local menu also points at its place, which is inserted first. */
function menu(r) {
  const rows = r.dishes.map((d, i) =>
    `  (${[text(d.name), text(d.category), text(d.description), text(d.photo), int(d.price), int(i),
      list(d.contains), list(d.may_contain), list(d.ingredients ?? []), text(d.allergen_source), text(d.allergen_note), list(d.allergen_gaps ?? []),
      text(tr.dishes[d.name] ?? null), text(tr.categories[d.category] ?? null)].join(", ")})`);
  // A franchise menu from another branch has no place of its own, but sits where its branch near Inha is.
  const at = r.place ?? (r.branches ? { source: "openstreetmap", source_id: r.branches[0] } : null);
  const place = at ? `(select id from public.places where source = ${text(at.source)} and source_id = ${text(at.source_id)})` : "null::uuid";
  return `with r as (
  insert into public.restaurants (name, name_en, name_ko, cuisine, logo, logo_bg, delivery_link, place_id, address, lat, lng, phone,
                                  menu_source, menu_source_name, menu_note, menu_updated, menu_checked)
  select ${text(r.name)}, ${text(tr.restaurants[r.name] ?? null)}, ${text(tr.restaurants_ko[r.name] ?? null)}, ${text(r.cuisine)}, ${text(r.logo)}, ${text(r.logo_bg)}, ${text(r.delivery_link)}, ${r.place ? "p.id" : "null::uuid"}, p.address, p.lat, p.lng, p.phone,
         ${text(r.source)}, ${text(r.source_site)}, ${text(r.source_note)}, ${date(r.source_updated)}, ${date(r.checked)}
  from (select 1) as one left join public.places p on p.id = ${place}
  returning id
)
insert into public.menu_items (restaurant_id, name, category, description, photo, price, sort_order, contains, may_contain, ingredients, allergen_source, allergen_note, allergen_gaps, name_en, category_en)
select r.id, v.* from r, (values
${rows.join(",\n")}
) as v;`;
}

/** Adds or updates one branch and its dishes by their external ids; dishes gone from menu.json are removed. */
function branch(b) {
  const { restaurant: r, menu } = JSON.parse(readFileSync(`data/restaurants/${b.slug}/menu.json`, "utf8"));
  // The menu it replaces, or the chain it belongs to: either gives cuisine, logo and allergen data.
  const old = b.replaces || b.brand ? [...chainMenus, ...localMenus].find((m) => m.slug === (b.replaces ?? b.brand)) : null;
  if ((b.replaces || b.brand) && !old) throw new Error(`${b.slug} replaces ${b.replaces ?? b.brand}, which is not in supabase/menus/`);
  // Some names carry a badge on a second line ("핫페페로니피자\n매운맛2단계").
  const dishes = menu.filter((d) => !leftOut(d)).map((d) => ({ ...d, name: d.name.replace(/\s*\n\s*/g, " ") }));
  // The branch writes names a little differently from the brand ("리얼 어니언링R", "리얼 어니언링(R)").
  const key = (name) => name.replace(/[\s()]/g, "").replaceAll(",", "+");
  const facts = new Map((old?.dishes ?? []).map((d) => [key(d.name), d]));
  const english = new Map(Object.entries(tr.dishes).map(([name, en]) => [key(name), en]));
  // npm run menus:photos writes .webp for cut-outs and .jpg for photos with their own background.
  const photo = (file) => {
    const base = file && `/restaurants/${b.slug}/${file.split("/").pop().replace(/\.\w+$/, "")}`;
    return base ? [".webp", ".jpg"].map((ext) => base + ext).find((path) => existsSync(`public${path}`)) ?? null : null;
  };
  const rows = dishes.map((d, i) => {
    const f = facts.get(key(d.name)) ?? {};
    // Naver shows "주문 22" (times ordered) where a featured dish has no description, and 0 for market price.
    const description = /^주문 \d+$/.test(d.description ?? "") ? null : d.description;
    return `  (${[text(d.id), text(d.name), text(d.category), text(description), text(photo(d.image_file)), int(d.price || null), int(i),
      list(f.contains), list(f.may_contain), list(f.ingredients ?? []), text(f.allergen_source), text(f.allergen_note), list(f.allergen_gaps ?? []),
      text(tr.dishes[d.name] ?? english.get(key(d.name)) ?? null), text(tr.categories[d.category] ?? null)].join(", ")})`;
  });
  const set = (columns) => columns.map((c) => `${c} = excluded.${c}`).join(", ");
  const restaurantColumns = ["name", "name_en", "cuisine", "logo", "logo_bg", "address", "lat", "lng", "phone", "menu_source", "menu_source_name", "menu_note", "menu_checked"];
  const dishColumns = ["name", "category", "description", "photo", "price", "sort_order", "contains", "may_contain", "ingredients", "allergen_source", "allergen_note", "allergen_gaps", "name_en", "category_en"];
  const placeIs = (alias, [source, id]) => `${alias}.source = ${text(source)} and ${alias}.source_id = ${text(id)}`;
  // The menu this branch replaced, still in a database loaded before it: by where its menu came from.
  const isOld = (alias) => `${alias}.menu_source = ${text(old?.source)} and ${alias}.external_id is null`;
  // The branches above have no lat/lng, like the chains: groups default to an office in Seoul, and a
  // location would hide them there. The map still places them through their place.
  const q = b.place;
  return `do $branch$
declare
  rid uuid;
begin
${q ? `insert into public.places (source, source_id, name, kind, cuisine, lat, lng, distance_m, address, phone)
values (${[text(q.source), text(q.source_id), text(q.name), text(q.kind), text(q.cuisine), num(q.lat), num(q.lng), int(q.distance_m), text(q.address), text(q.phone)].join(", ")})
on conflict (source, source_id) do update set name = excluded.name, kind = excluded.kind, cuisine = excluded.cuisine, lat = excluded.lat,
  lng = excluded.lng, distance_m = excluded.distance_m, address = excluded.address, phone = excluded.phone;
` : ""}insert into public.restaurants (external_id, ${restaurantColumns.join(", ")})
select ${text(r.id)}, ${text(r.name)}, ${text(b.name_en)}, ${text(b.cuisine ?? old.cuisine)}, ${text(old?.logo)}, ${text(old?.logo_bg)}, p.address,
       ${b.at ? `${num(b.at.lat)}, ${num(b.at.lng)}` : "null::double precision, null::double precision"}, p.phone,
       ${text(r.source_url)}, 'Naver', ${text(b.note ?? "This branch's own menu and prices, from its Naver order page.")}, ${date(r.scraped_at?.slice(0, 10))}
from (select 1) as one left join public.places p on ${placeIs("p", b.places[0])}
on conflict (external_id) do update set ${set(restaurantColumns)}
returning id into rid;

insert into public.menu_items (restaurant_id, external_id, ${dishColumns.join(", ")})
select rid, v.* from (values
${rows.join(",\n")}
) as v
on conflict (restaurant_id, external_id) do update set ${set(dishColumns)};

-- Dishes no longer on the menu go, except ones someone picked: past rounds still show those.
delete from public.menu_items m
where m.restaurant_id = rid and (m.external_id is null or m.external_id not in (${dishes.map((d) => text(d.id)).join(", ")}))
  and not exists (select 1 from public.order_items o where o.menu_item_id = m.id);
${b.replaces ? `
-- The menu this branch replaced stays only while someone's pick points at one of its dishes. Picks
-- move to the same dish here (matched as above), then it goes.
update public.order_items o set menu_item_id = here.id
from public.menu_items gone
join public.restaurants before on before.id = gone.restaurant_id
join public.menu_items here on here.restaurant_id = rid
  and regexp_replace(replace(here.name, ',', '+'), '[\\s()]', '', 'g') = regexp_replace(replace(gone.name, ',', '+'), '[\\s()]', '', 'g')
where o.menu_item_id = gone.id and ${isOld("before")}
  and not exists (select 1 from public.order_items same where same.round_id = o.round_id and same.user_id = o.user_id and same.menu_item_id = here.id);
delete from public.menu_items gone using public.restaurants before
where before.id = gone.restaurant_id and ${isOld("before")}
  and not exists (select 1 from public.order_items o where o.menu_item_id = gone.id);
delete from public.restaurants before
where ${isOld("before")} and not exists (select 1 from public.menu_items m where m.restaurant_id = before.id);
` : ""}
-- Last, once the replaced menu has let go of it: a place belongs to one restaurant.
update public.restaurants set place_id = p.id from public.places p
where public.restaurants.id = rid and ${placeIs("p", b.places[0])}
  and not exists (select 1 from public.restaurants other where other.place_id = p.id and other.id <> rid);
update public.places p set restaurant_id = rid where ${b.places.map((at) => `(${placeIs("p", at)})`).join(" or ")};
end
$branch$;`;
}

// Places that OpenStreetMap does not have, from the page the menu came from.
const extra = locals.filter((r) => r.place && r.place.source !== "openstreetmap").map((r) => ({
  source: r.place.source, source_id: r.place.source_id, name: r.place.name, name_en: null, kind: r.place.kind,
  cuisine: r.place.cuisine, lat: r.place.lat, lng: r.place.lng, distance_m: r.place.distance_m, address: r.place.address,
  phone: r.place.phone, opening_hours: null, website: null, diet_tags: [], restaurant: null,
}));
const placeRows = [...places, ...extra].map((p) =>
  `  (${[text(p.source), text(p.source_id), text(p.name), text(p.name_en), text(p.kind), text(p.cuisine), num(p.lat), num(p.lng),
    int(p.distance_m), text(p.address), text(p.phone), text(p.opening_hours), text(p.website), list(p.diet_tags), text(p.restaurant)].join(", ")})`);

writeFileSync("supabase/seed.sql", `-- Generated by npm run menus:seed. Do not edit by hand.
-- Real menus and allergen data from each brand's public site; photos stay on the brand's servers,
-- except branch menus' photos, which the app serves from public/restaurants/.
-- A null price or null allergen list means the brand does not publish one.
-- Independent restaurants: menus from Daangn business profiles and Polle place pages, no allergen data.
-- Places: © OpenStreetMap contributors (ODbL), Burger King Korea's store finder, Daangn and Polle.
--
-- Safe to run again: the first block loads nothing when the database already has restaurants, so the
-- GitHub Action can run it on every push. To reload changed menus, empty the menus by hand first.
-- Branch menus (data/restaurants/, photos served from public/restaurants/) are the exception: the
-- blocks at the end add or update them by their own ids on every run.
do $seed$
begin
if exists (select 1 from public.restaurants) then
  raise notice 'Menus are already loaded; seed.sql changed nothing.';
  return;
end if;

${chains.map((r) => menu({ ...r, place: null, source_site: null, source_note: null, source_updated: null, checked: null })).join("\n\n")}

insert into public.places (source, source_id, name, name_en, kind, cuisine, lat, lng, distance_m, address, phone, opening_hours, website, diet_tags, restaurant_id)
select v.source, v.source_id, v.name, v.name_en, v.kind, v.cuisine, v.lat, v.lng, v.distance_m, v.address, v.phone, v.opening_hours, v.website, v.diet_tags, r.id
from (values
${placeRows.join(",\n")}
) as v(source, source_id, name, name_en, kind, cuisine, lat, lng, distance_m, address, phone, opening_hours, website, diet_tags, restaurant)
left join public.restaurants r on r.name = v.restaurant and r.place_id is null;

${locals.map(menu).join("\n\n")}

update public.places p set restaurant_id = r.id from public.restaurants r where r.place_id = p.id;
${locals.filter((r) => r.branches).map((r) => `update public.places set restaurant_id = (select id from public.restaurants where name = ${text(r.name)} and menu_source = ${text(r.source)})
  where source = 'openstreetmap' and source_id in (${r.branches.map(text).join(", ")});`).join("\n")}
end
$seed$;

-- Branch menus from data/restaurants/: these run every time and update their rows in place.
${ALL_BRANCHES.map(branch).join("\n\n")}
`);
console.log(`supabase/seed.sql: ${chains.length} chains, ${locals.length} local menus, ${BRANCHES.length} branch menus, ${NEARBY.length} Naver Place menus, ${places.length + extra.length} places`);
