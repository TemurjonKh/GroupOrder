// npm run menus:import: fetches the BBQ, Burger King and Subway menus from their public
// Korean sites into supabase/menus/*.json. npm run menus:seed then builds supabase/seed.sql.
//
// BHC is deliberately absent: its robots.txt disallows AI agents. To add it, write
// supabase/menus/bhc.json by hand in the same format.
//
// Photos are stored as the brand's own URLs, so nothing is copied into this repo. Prices
// are null where a brand does not publish them; never fill them in with guesses.
import { mkdirSync, writeFileSync } from "node:fs";

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
      dishes.push({
        name: clean(item.menuName),
        category: repeats.includes(category.categoryName) ? "추천" : category.categoryName,
        description: clean(item.description),
        photo: item.menuImageUrl,
        price: item.menuPrice,
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

async function burgerKing() {
  const message = {
    header: { result: true, error_code: "", error_text: "", info_text: "", message_version: "", login_session_id: "", trcode: "BKR0632", cd_call_chnn: "01" },
    body: { menuKeywordList: [] },
  };
  const response = await get("https://www.burgerking.co.kr/burgerking/BKR0632.json", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: `message=${encodeURIComponent(JSON.stringify(message))}`,
  });
  const groups = (await response.json()).body.allMenuList;
  // "추천메뉴" only repeats dishes from the real categories, so it goes last.
  groups.sort((a, b) => (a.menuCategoryNm === "추천메뉴") - (b.menuCategoryNm === "추천메뉴"));
  const seen = new Set();
  const dishes = [];
  for (const group of groups) {
    for (const item of group.menuInfo) {
      if (seen.has(item.menuCd)) continue;
      seen.add(item.menuCd);
      dishes.push({
        name: clean(item.menuNm),
        category: group.menuCategoryNm,
        description: clean(item.menuComponents) === clean(item.menuNm) ? null : clean(item.menuComponents),
        photo: item.menuImgThumPath || item.menuImgPath,
        price: null,
      });
    }
  }
  return {
    slug: "burgerking", name: "Burger King", cuisine: "Burgers",
    logo: "https://www.burgerking.co.kr/img/bg_logo.svg", logo_bg: "#f5ebdc",
    delivery_link: "https://www.burgerking.co.kr", source: "https://www.burgerking.co.kr/menu/main", dishes,
  };
}

async function subway() {
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
      dishes.push({
        name: latin && latin !== korean ? `${korean} ${latin}` : korean,
        category,
        description: summary ? clean(decode(summary.replace(/<[^>]+>/g, " "))) : null,
        photo: new URL(photo, site).href,
        price: null,
      });
    }
  }
  return {
    slug: "subway", name: "Subway", cuisine: "Sandwiches",
    logo: `${site}/images/common/logo_w.png`, logo_bg: "#ffffff",
    delivery_link: site, source: `${site}/menuList/sandwich`, dishes,
  };
}

mkdirSync("supabase/menus", { recursive: true });
for (const importer of [bbq, burgerKing, subway]) {
  const restaurant = await importer();
  const priced = restaurant.dishes.filter((d) => d.price !== null).length;
  const categories = new Set(restaurant.dishes.map((d) => d.category));
  console.log(`${restaurant.slug}: ${restaurant.dishes.length} dishes, ${priced} priced, ${categories.size} categories`);
  writeFileSync(`supabase/menus/${restaurant.slug}.json`, `${JSON.stringify(restaurant, null, 2)}\n`);
}
