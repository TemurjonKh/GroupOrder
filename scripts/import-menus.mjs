// npm run menus:import: fetches the BBQ, Burger King and Subway menus from their public
// Korean sites into supabase/menus/*.json. npm run menus:seed then builds supabase/seed.sql.
//
// BHC is deliberately absent: its robots.txt disallows AI agents. To add it, write
// supabase/menus/bhc.json by hand in the same format.
//
// Photos are stored as the brand's own URLs, so nothing is copied into this repo. Prices
// are null where a brand does not publish them; never fill them in with guesses.
//
// Allergens come only from each brand's own published data: contains and may_contain hold
// keys from src/lib/diet.ts, and null means the brand publishes nothing for that dish.
// Null must never be read as "free from". An unrecognised allergen word stops the import.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const USER_AGENT = "GroupOrder-menu-import/0.1 (student project; menu data for a local demo)";
const DELAY_MS = 800;
const pause = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

async function get(url, init = {}) {
  await pause();
  const response = await fetch(url, { ...init, headers: { "user-agent": USER_AGENT, ...init.headers } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response;
}

const clean = (text) => text?.replace(/\s+/g, " ").trim() || null;
const decode = (text) =>
  text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

const ALLERGEN_WORDS = {
  난류: "egg", 알류: "egg", 계란: "egg", 달걀: "egg", 우유: "milk", 메밀: "buckwheat", 땅콩: "peanut",
  대두: "soy", 밀: "wheat", 고등어: "mackerel", 게: "crab", 새우: "shrimp", 돼지고기: "pork",
  복숭아: "peach", 토마토: "tomato", 아황산류: "sulfites", 아황산: "sulfites", 호두: "walnut",
  닭고기: "chicken", 쇠고기: "beef", 소고기: "beef", 오징어: "squid", 조개류: "shellfish",
  굴: "shellfish", 전복: "shellfish", 홍합: "shellfish", 잣: "pine_nut",
};

/** "알류, 우유" becomes ["egg", "milk"]. Throws on a word it does not know, so nothing is silently dropped. */
function parseAllergens(text, where) {
  const words = (text ?? "").replace(/\([^)]*\)/g, ",").split(/[,，./·ㆍ]/).map((w) => w.trim()).filter(Boolean);
  const keys = words.filter((w) => w !== "없음").map((word) => {
    const key = ALLERGEN_WORDS[word];
    if (!key) throw new Error(`Unknown allergen "${word}" in ${where}: ${text}`);
    return key;
  });
  return [...new Set(keys)];
}

async function bbq() {
  const base = "https://bbq.co.kr/api/delivery/menu";
  const categories = await (await get(`${base}/category`)).json();
  // "추천" and "필릭스 PICK" only repeat dishes from the real categories, so they go last.
  const repeats = ["추천", "필릭스 PICK"];
  const ordered = [
    ...categories.filter((c) => !repeats.includes(c.categoryName)),
    ...categories.filter((c) => repeats.includes(c.categoryName)),
  ];
  const seen = new Set();
  const dishes = [];
  let adultOnly = 0;
  for (const category of ordered) {
    for (const item of await (await get(`${base}/${category.id}`)).json()) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      // The app has no age check, so drinks the site sells to adults only stay out.
      if (item.isAdultOnly) { adultOnly++; continue; }
      const name = clean(item.menuName);
      const description = clean(item.description);
      const contains = clean(item.allergy) ? parseAllergens(item.allergy, name) : null;
      // Some dishes carry the warning only in their description.
      const warnsPeanut = /땅콩\s*알[러레]/.test(description ?? "") && !contains?.includes("peanut");
      dishes.push({
        name,
        category: repeats.includes(category.categoryName) ? "추천" : category.categoryName,
        description,
        photo: item.menuImageUrl,
        price: item.menuPrice,
        contains,
        may_contain: contains ? (warnsPeanut ? ["peanut"] : []) : null,
        ingredients: (item.origin ?? []).map((o) => o.name).filter(Boolean),
        allergen_source: contains ? "BBQ menu data (bbq.co.kr)" : null,
      });
    }
  }
  console.log(`bbq: left out ${adultOnly} adult-only items`);
  return {
    slug: "bbq", name: "BBQ", cuisine: "Chicken",
    logo: "https://bbq.co.kr/images/symbols/logo-red.svg", logo_bg: "#ffffff",
    delivery_link: "https://bbq.co.kr", source: "https://bbq.co.kr/categories/17", dishes,
  };
}

async function trBurgerKing(trcode, body) {
  const message = {
    header: { result: true, error_code: "", error_text: "", info_text: "", message_version: "", login_session_id: "", trcode, cd_call_chnn: "01" },
    body,
  };
  const response = await get(`https://www.burgerking.co.kr/burgerking/${trcode}.json`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: `message=${encodeURIComponent(JSON.stringify(message))}`,
  });
  return response.json();
}

async function burgerKing() {
  const groups = (await trBurgerKing("BKR0632", { menuKeywordList: [] })).body.allMenuList;
  const facts = (await trBurgerKing("BKR0347", {})).body;
  writeFileSync("supabase/menus/sources/burgerking-origin.json", `${JSON.stringify(facts.originInfoList, null, 1)}\n`);
  const compact = (name) => name.replace(/\s+/g, "");
  // A blank entry means nothing was published (real burgers have blanks), never "free from".
  // Some items are listed twice, so their entries are added together.
  const allergens = new Map();
  for (const row of facts.allAllergyList) {
    if (!clean(row.allergyNm)) continue;
    const key = compact(row.menuNm);
    allergens.set(key, [...(allergens.get(key) ?? []), ...parseAllergens(row.allergyNm, row.menuNm)]);
  }
  // "추천메뉴" only repeats dishes from the real categories, so it goes last.
  groups.sort((a, b) => (a.menuCategoryNm === "추천메뉴") - (b.menuCategoryNm === "추천메뉴"));
  const seen = new Set();
  const dishes = [];
  for (const group of groups) {
    for (const item of group.menuInfo) {
      if (seen.has(item.menuCd)) continue;
      seen.add(item.menuCd);
      const name = clean(item.menuNm);
      const detail = (await trBurgerKing("BKR0634", { menuCd: item.menuCd })).body;
      const components = clean(item.menuComponents) === name ? null : clean(item.menuComponents);
      // A set is rarely listed itself, but its parts often are. What the parts declare is
      // certain; a part with no entry stays a named gap, so the set can never read as clear.
      const parts = components?.includes("+") ? components.split("+").map((part) => part.trim()) : [];
      const listedParts = parts.filter((part) => allergens.has(compact(part)));
      const listed = allergens.has(compact(name));
      const contains = listed
        ? [...new Set(allergens.get(compact(name)))]
        : listedParts.length ? [...new Set(listedParts.flatMap((part) => allergens.get(compact(part))))] : null;
      dishes.push({
        name,
        category: group.menuCategoryNm,
        // item_ingredient_list in this feed holds marketing tags, not ingredients, so it stays out.
        description: clean(detail?.menuDesc) ?? components,
        photo: item.menuImgThumPath || item.menuImgPath,
        price: Number(detail?.dineInprc) || null,
        contains,
        may_contain: contains ? [] : null,
        ingredients: parts,
        allergen_source: contains ? "Burger King Korea allergy list (burgerking.co.kr)" : null,
        allergen_gaps: contains && !listed ? parts.filter((part) => !allergens.has(compact(part))) : [],
      });
    }
  }
  return {
    slug: "burgerking", name: "Burger King", cuisine: "Burgers",
    logo: "https://www.burgerking.co.kr/img/bg_logo.svg", logo_bg: "#f5ebdc",
    delivery_link: "https://www.burgerking.co.kr", source: "https://www.burgerking.co.kr/menu/main", dishes,
  };
}

// Subway's chart covers a sandwich on wheat bread with vegetables, without cheese or sauce.
// Where the menu has one dish and the chart has variants of it, every variant counts.
const SUBWAY_ROWS = {
  "샌드위치": {
    "램 & 후무스": ["sandwich/램 & 후무스"], "램": ["sandwich/램"], "피자썹": ["sandwich/피자썹"],
    "안창 비프&머쉬룸": ["sandwich/안창 비프 & New 머쉬룸(F)", "sandwich/안창 비프 & New 머쉬룸(S)"],
    "스테이크 & 치즈": ["sandwich/스테이크&치즈"],
    "이탈리안 비엠티": ["sandwich/이탈리안 비엠티", "sandwich/이탈리안 비엠티(J)"],
    "로티세리 바비큐 치킨": ["sandwich/로티세리 바비큐 치킨"], "에그마요": null,
    "안창 비프": ["sandwich/안창 비프"], "잠봉 플러스": ["sandwich/잠봉 플러스"],
    "치킨 베이컨 아보카도": ["sandwich/치킨 베이컨 아보카도"], "스파이시 쉬림프": ["sandwich/스파이시 쉬림프"],
    "쉬림프": ["sandwich/쉬림프"], "로스트 치킨": ["sandwich/로스트 치킨"],
    "풀드포크 바비큐": ["sandwich/풀드포크 바비큐"],
    "써브웨이 클럽": ["sandwich/써브웨이 클럽(터키)", "sandwich/써브웨이 클럽(J)", "sandwich/써브웨이 클럽(JC)"],
    "치킨 데리야끼": ["sandwich/치킨 데리야끼"], "스파이시 이탈리안": ["sandwich/스파이시 이탈리안"],
    "잠봉": ["sandwich/잠봉"], "비엘티": ["sandwich/비엘티"], "치킨 슬라이스": ["sandwich/치킨 슬라이스"],
    "머쉬룸": null, "참치": ["sandwich/참치"], "베지": ["sandwich/베지"],
    "오믈렛": ["meat/오믈렛"], "아보카도": ["vegetable/아보카도"], "베이컨": ["meat/베이컨"], "페퍼로니": ["meat/페퍼로니"],
    "치즈 추가": ["cheese/아메리칸 치즈", "cheese/모차렐라 치즈", "cheese/슈레드 치즈"],
  },
};
const SUBWAY_EXTRAS = {
  "베이컨 비츠": ["meat/베이컨 비츠"], "그레인 믹스": ["salad/그레인 믹스"], "아보카도": ["vegetable/아보카도"],
  "오믈렛": ["meat/오믈렛"], "페퍼로니": ["meat/페퍼로니"], "베이컨": ["meat/베이컨"],
  "치즈 추가": ["cheese/아메리칸 치즈", "cheese/모차렐라 치즈", "cheese/슈레드 치즈"],
  "스테이크 & 치즈 아보카도 랩": ["wrap/스테이크&치즈 아보카도 랩"], "쉬림프 에그마요 랩": ["wrap/쉬림프 에그마요 랩"],
  "치킨 베이컨 미니 랩": ["wrap/치킨 베이컨 미니 랩"],
  "잠봉, 에그&치즈": ["breakfast_sandwich/잠봉, 에그 & 치즈"],
  "웨스턴, 에그 & 치즈": ["breakfast_sandwich/웨스턴, 에그 & 치즈", "breakfast_sandwich/웨스턴, 에그 & 치즈(J)"],
  "잠봉, 에그 & 치즈 랩": ["breakfast_wrap/잠봉, 에그 & 치즈 랩"],
  "웨스턴, 에그 & 치즈 랩": ["breakfast_wrap/웨스턴, 에그 & 치즈 랩", "breakfast_wrap/웨스턴, 에그 & 치즈 랩(J)"],
  "포테이토 베이컨 수프": ["side/포테이토 베이컨 수프"], "콘 수프": ["side/콘 수프"], "머쉬룸 수프": ["side/머쉬룸 수프"],
  "초코칩": ["side/초코칩 쿠키"], "더블 초코칩": ["side/더블 초코칩 쿠키"], "오트밀 레이즌": ["side/오트밀 레이즌 쿠키"],
  "라즈베리 치즈케익": ["side/라즈베리 치즈케이크 쿠키"], "화이트 초코 마카다미아": ["side/화이트 초코 마카다미아 쿠키"],
  "웨지 포테이토": ["side/웨지 포테이토"], "Cheesy 웨지 포테이토": ["side/Cheesy 웨지 포테이토"],
  "Bacon Cheesy 웨지 포테이토": ["side/Bacon Cheesy 웨지 포테이토"],
};

/** The chart rows for a Subway dish, or null when the chart does not cover it. */
function subwayRows(korean, category) {
  if (korean === "에그마요") return category === "샌드위치" ? ["sandwich/에그마요"] : ["meat/에그마요(미트)"];
  if (korean === "머쉬룸") return ["sandwich/New 머쉬룸(F)", "sandwich/New 머쉬룸(S)"];
  if (korean === "미니 로티세리 치킨 샐러드") return null; // newer than the chart
  const salad = korean.match(/^(.+?) (그레인 )?샐러드$/);
  if (salad) return [`salad/${salad[1]}${salad[2] ? "(G)" : ""}`];
  return SUBWAY_ROWS["샌드위치"][korean] ?? SUBWAY_EXTRAS[korean] ?? null;
}

async function subway() {
  const chart = JSON.parse(readFileSync("supabase/menus/sources/subway-allergy-chart.json", "utf8"));
  const site = "https://www.subway.co.kr";
  const categories = { sandwich: "샌드위치", grain_salad: "그레인 샐러드", salad: "샐러드", unit: "랩ㆍ기타", morning: "아침메뉴", sidedrink: "스마일 썹", catering: "단체메뉴" };
  const seen = new Set();
  const dishes = [];
  for (const [path, category] of Object.entries(categories)) {
    const html = await (await get(`${site}/menuList/${path}`)).text();
    const blocks = html.split('<div class="img">').slice(1);
    for (const block of blocks) {
      const rawPhoto = block.match(/src="([^"]+)"/)?.[1];
      const photo = rawPhoto && decode(rawPhoto);
      const name = block.match(/<strong class="tit">([\s\S]*?)<\/strong>/)?.[1];
      const english = block.match(/<span class="eng">([\s\S]*?)<\/span>/)?.[1];
      const summary = block.match(/<div class="summary">\s*<p>([\s\S]*?)<\/p>/)?.[1];
      const id = block.match(/data-menuitemidx="(\d+)"/)?.[1];
      if (!name || !photo || seen.has(id)) continue;
      seen.add(id);
      const korean = clean(decode(name.replace(/<[^>]+>/g, " ")));
      const latin = english ? clean(decode(english.replace(/<[^>]+>/g, " "))) : null;
      const rows = subwayRows(korean, category);
      for (const row of rows ?? []) if (!chart[row]) throw new Error(`No chart row ${row} for ${korean}`);
      // A few add-ons have no detail page; the site answers those with an error.
      const page = await get(`${site}/menuView/${path}?menuItemIdx=${id}`).then((r) => r.text()).catch(() => "");
      // The recipe sits in a script as escaped HTML: every <img alt="..."> is one ingredient.
      const script = page.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/\\"/g, '"');
      const recipe = script.slice(script.indexOf('class="recipe"'));
      const ingredients = script.includes('class="recipe"')
        ? [...new Set([...recipe.matchAll(/<img src="[^"]*" alt="([^"]+)"/g)].map((m) => clean(decode(m[1]))))]
        : [];
      const marks = rows?.map((row) => chart[row]);
      const contains = marks ? [...new Set(marks.flatMap((m) => m.contains))] : null;
      dishes.push({
        name: latin && latin !== korean ? `${korean} ${latin}` : korean,
        category,
        description: summary ? clean(decode(summary.replace(/<[^>]+>/g, " "))) : null,
        photo: new URL(photo, site).href,
        price: null,
        contains,
        may_contain: marks ? [...new Set(marks.flatMap((m) => m.may_contain))].filter((key) => !contains.includes(key)) : null,
        ingredients,
        allergen_source: marks ? "Subway Korea allergy chart (subway.co.kr/sandwichAllergy)" : null,
        allergen_note: marks && /^(sandwich|salad)\//.test(rows[0]) ? "Chart covers the base dish. Your bread, cheese and sauce can add more." : null,
      });
    }
  }
  return {
    slug: "subway", name: "Subway", cuisine: "Sandwiches",
    logo: `${site}/images/common/logo_w.png`, logo_bg: "#ffffff",
    delivery_link: site, source: `${site}/menuList/sandwich`, dishes,
  };
}

mkdirSync("supabase/menus/sources", { recursive: true });
// node scripts/import-menus.mjs subway refreshes just the brands named.
const IMPORTERS = { bbq, burgerking: burgerKing, subway };
const chosen = process.argv.slice(2);
for (const [slug, importer] of Object.entries(IMPORTERS)) {
  if (chosen.length && !chosen.includes(slug)) continue;
  const restaurant = await importer();
  const priced = restaurant.dishes.filter((d) => d.price !== null).length;
  const categories = new Set(restaurant.dishes.map((d) => d.category));
  const labelled = restaurant.dishes.filter((d) => d.contains !== null).length;
  console.log(`${restaurant.slug}: ${restaurant.dishes.length} dishes, ${priced} priced, ${labelled} with allergen data, ${categories.size} categories`);
  writeFileSync(`supabase/menus/${restaurant.slug}.json`, `${JSON.stringify(restaurant, null, 2)}\n`);
}
