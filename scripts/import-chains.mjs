// npm run menus:chains [slug ...]: fetches the menus of chains with a branch near Inha from
// their own public sites into supabase/menus/*.json. npm run menus:seed then builds seed.sql.
//
// Each site's robots.txt was read first, and this script stays inside it. Left out on purpose:
//   BHC, Yupdduk: robots.txt shuts out bots like this one.
//   Ediya: the full list loads through /inc/, which robots.txt disallows; a fragment would look complete.
// Isaac Toast and Gong Cha have no photos here because robots.txt disallows the folders that hold them.
// Mom's Touch publishes allergens only as a chart image, so its dishes stay "No data".
//
// Same rules as import-menus.mjs: blank means unknown, never "free from"; prices are null when
// a brand does not publish them; an unrecognised allergen word stops that brand's import.
import { writeFileSync } from "node:fs";
import { allergensIn, clean, get, parseAllergens, textOf } from "./menu-helpers.mjs";

const page = async (url, init) => (await get(url, init)).text();
const money = (text) => { const m = /(\d{1,3}(?:,\d{3})+|\d{4,6})/.exec(text ?? ""); return m ? Number(m[1].replaceAll(",", "")) : null; };
const compact = (name) => name.replace(/\s+/g, "");
const first = (re, html) => re.exec(html)?.[1] ?? null;
const absolute = (src, base) => (src ? encodeURI(decodeURI(new URL(src, base).href)) : null);

/** The allergen fields of a dish, from a brand's list. No list at all stays unknown. */
function facts(text, where, source, note = null) {
  // Some sites write a dash in an empty cell. That is a blank, so it means unknown.
  const list = clean(text)?.replace(/(^|,\s*)[-–—](?=\s*(,|$))/g, "").replace(/^[\s,]+|[\s,]+$/g, "");
  if (!list) return { contains: null, may_contain: null, allergen_source: null, allergen_note: null };
  // Cross-contact warnings are written as sentences after the list.
  const at = list.search(/[^,.]*(?:혼입|제조시설|같은 시설|동일.{0,6}시설)/);
  const warning = at >= 0 ? list.slice(at) : null;
  const declared = (at >= 0 ? list.slice(0, at) : list).replace(/함유|※|\s+등$/g, " ");
  const contains = parseAllergens(declared, where);
  return {
    contains,
    may_contain: warning ? allergensIn(warning).filter((key) => !contains.includes(key)) : [],
    allergen_source: source,
    allergen_note: [note, warning].filter(Boolean).join(" ") || null,
  };
}

const dish = (fields) => ({
  description: null, photo: null, price: null, ingredients: [],
  contains: null, may_contain: null, allergen_source: null, allergen_note: null, ...fields,
});

function merged(dishes) {
  const seen = new Set();
  return dishes.filter((d) => d.name && !seen.has(compact(d.name)) && seen.add(compact(d.name)));
}

// The app has no age check, so alcohol stays out (rice wine labelled "12도", sets with draft beer).
// Drinks a brand labels non-alcoholic stay in. Merchandise such as tumblers is not food.
const ADULT = /\d+(\.\d+)?\s*도\s*\(|생맥주|치맥/;
const NOT_FOOD = /텀블러|머그컵/;
const isFood = (d) => !(ADULT.test(`${d.name} ${d.description ?? ""}`) && !/비알코올|non-alcohol/i.test(d.description ?? "")) && !NOT_FOOD.test(d.name);

function brand(slug, name, cuisine, site, source, dishes) {
  const kept = merged(dishes).filter(isFood);
  const left = merged(dishes).length - kept.length;
  if (left) console.log(`${slug}: left out ${left} alcoholic or non-food items`);
  return { slug, name, cuisine, logo: null, logo_bg: null, delivery_link: site, source, dishes: kept };
}

async function starbucks() {
  const site = "https://www.starbucks.co.kr";
  const categories = {
    W0000171: "콜드 브루", W0000060: "브루드 커피", W0000003: "에스프레소", W0000004: "프라푸치노", W0000005: "블렌디드",
    W0000422: "리프레셔", W0000061: "피지오", W0000075: "티", W0000053: "기타", W0000062: "올가니카",
    W0000013: "베이커리", W0000032: "케이크", W0000033: "샌드위치", W0000055: "요거트", W0000056: "초콜릿",
  };
  const dishes = [];
  for (const [code, category] of Object.entries(categories)) {
    const { list } = await (await get(`${site}/upload/json/menu/${code}.js`)).json();
    for (const item of list) {
      const { view } = await (await get(`${site}/menu/productViewAjax.do`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `product_cd=${item.product_CD}`,
      })).json();
      const name = clean(item.product_NM);
      dishes.push(dish({
        name, category, description: clean(item.content),
        photo: absolute(item.file_PATH, "https://image.istarbucks.co.kr"),
        // A few products have no detail record, so they stay unknown.
        ...facts(view?.allergy, name, "Starbucks Korea menu (starbucks.co.kr)"),
      }));
    }
  }
  return brand("starbucks", "Starbucks", "Coffee", site, `${site}/menu/drink_list.do`, dishes);
}

async function mega() {
  const site = "https://www.mega-mgccoffee.com";
  const dishes = [];
  // Category 3 is merchandise, so it stays out.
  for (const [code, category] of [[1, "음료"], [2, "푸드"]]) {
    let last = 1;
    for (let number = 1; number <= last; number++) {
      const html = await page(`${site}/menu/menu.php?menu_category1=${code}&menu_category2=${code}&category=&list_checkbox_all=all&page=${number}`);
      last = Math.max(last, ...[...html.matchAll(/data-page='(\d+)'/g)].map((m) => Number(m[1])));
      for (const block of html.split('<a class="inner_modal_open">').slice(1)) {
        const name = textOf(first(/<b>([\s\S]*?)<\/b>/, block));
        const description = textOf(first(/<div class="text text2">([\s\S]*?)<\/div>/, block));
        dishes.push(dish({
          name, category, description,
          photo: first(/<img src="([^"]+)"/, block),
          ...facts(first(/알레르기 성분\s*:\s*([^<]*)/, block), name, "Mega MGC Coffee menu (mega-mgccoffee.com)"),
        }));
      }
    }
  }
  return brand("mega", "Mega MGC Coffee", "Coffee", site, `${site}/menu/`, dishes);
}

async function paik() {
  const site = "https://paikdabang.com";
  const dishes = [];
  for (const [path, category] of [["menu_coffee", "커피"], ["menu_drink", "음료"], ["menu_ccino", "빽스치노"], ["menu_dessert", "디저트"], ["menu_new", "신메뉴"]]) {
    const html = await page(`${site}/menu/${path}/`);
    // One block per dish, so a dish with no allergen line can never pick up the next dish's.
    for (const block of html.split(/<div class="swiper-slide">|<div class="thumb">/).slice(1)) {
      const name = textOf(first(/<h3[^>]*>([\s\S]*?)<\/h3>/, block));
      dishes.push(dish({
        name, category,
        description: textOf(first(/<p class="txt">([\s\S]*?)<\/p>/, block)),
        photo: absolute(first(/<img src="([^"]+)"/, block), site),
        ...facts(first(/알레르기 유발 성분\s*:\s*([^<]*)/, block), name ?? path, "Paik's Coffee menu (paikdabang.com)"),
      }));
    }
  }
  return brand("paik", "Paik's Coffee", "Coffee", site, `${site}/menu/menu_coffee/`, dishes);
}

async function baskin() {
  const site = "https://www.baskinrobbins.co.kr";
  const html = await page(`${site}/menu/list.php?top=A`);
  const dishes = [];
  for (const [, kind, seq, src, rawName] of html.matchAll(/menu-list__item\s+menu-list__item--(\w+)"[\s\S]*?view\.php\?seq=(\d+)"[\s\S]*?<img src="([^"]+)" alt="([^"]*)"/g)) {
    const view = await page(`${site}/menu/view.php?seq=${seq}`);
    // The Korean name, because name matching finds what the allergen list leaves out, like almond.
    const name = textOf(rawName);
    dishes.push(dish({
      name, category: kind === "icecream" ? "아이스크림" : "케이크 및 기타",
      description: textOf(first(/menu-view[^"]*__(?:desc|text)[^"]*"[^>]*>([\s\S]*?)<\//, view)),
      photo: absolute(src, site),
      ...facts(first(/알레르기 성분<\/dt>\s*<dd[^>]*>([^<]*)/, view), name, "Baskin-Robbins Korea menu (baskinrobbins.co.kr)"),
    }));
  }
  return brand("baskin", "Baskin-Robbins", "Ice cream", site, `${site}/menu/list.php?top=A`, dishes);
}

async function sulbing() {
  const site = "https://sulbing.com";
  const dishes = [];
  for (const category of ["설빙", "사이드", "음료"]) {
    const html = await page(`${site}/menu/?type=${encodeURIComponent(category)}`);
    for (const [, id, src] of html.matchAll(/menu_view\.php\?menu=(\d+)"[^>]*>[\s\S]*?<img src="(\/new\/data\/product\/[^"]+)"/g)) {
      const view = await page(`${site}/menu/menu_view.php?menu=${id}`);
      const name = textOf(first(/<div class="productTitle">([\s\S]*?)<\/div>/, view));
      const thumbs = first(/<ul class="thumb">([\s\S]*?)<\/ul>/, view) ?? "";
      const listed = clean(first(/알레르기 정보<\/div>\s*<div class="con">([^<]*)/, view));
      // A few lists end in a cut-off word. Reading it as shellfish can only over-warn, and the dish says so.
      const cutOff = /·\s*조$/.test(listed ?? "");
      dishes.push(dish({
        name, category, photo: absolute(src, site),
        ingredients: [...thumbs.matchAll(/<div class="txt">([^<]+)<\/div>/g)].map((m) => textOf(m[1])),
        ...facts(cutOff ? `${listed}개류` : listed, name, "Sulbing menu (sulbing.com)",
          cutOff ? "Sulbing's list ends in a cut-off word, read here as shellfish. Check with the store." : null),
      }));
    }
  }
  return brand("sulbing", "Sulbing", "Dessert", site, `${site}/menu/`, dishes);
}

// The table says 교촌허니순살[R] where the menu says 허니순살. Only the brand word and size tag are dropped;
// any other difference stays unmatched, and so unknown.
const kyochonKey = (name) => compact(name).replace(/^교촌/, "").replace(/\[[A-Z]\]$/, "");

async function kyochon() {
  const site = "https://www.kyochon.com";
  const table = new Map();
  let viewed = false;
  const dishes = [];
  for (const [path, category] of [["chicken", "치킨"], ["side", "사이드"], ["drink", "음료"], ["burger", "버거"]]) {
    const html = await page(`${site}/menu/${path}.asp`);
    const items = [...html.matchAll(/<a href="view\.asp\?id=(\d+)[^"]*">\s*<p class="img"><img src="([^"]+)"[\s\S]*?<dt>([\s\S]*?)<\/dt>\s*<dd>([\s\S]*?)<\/d[dl]>[\s\S]*?<strong>([\d,]+)<\/strong>/g)];
    if (!viewed && items.length) {
      // Every dish page carries the same allergen table.
      const view = await page(`${site}/menu/view.asp?id=${items[0][1]}`);
      for (const [, row] of view.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
        const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => textOf(m[1]));
        if (cells.length >= 2 && cells.at(-1)) table.set(kyochonKey(cells.at(-2)), cells.at(-1));
      }
      viewed = true;
    }
    for (const [, , src, rawName, description, price] of items) {
      const name = textOf(rawName);
      const list = table.get(kyochonKey(name));
      dishes.push(dish({
        name, category, description: textOf(description), price: money(price), photo: absolute(src, site),
        ...facts(list, name, "Kyochon allergen table (kyochon.com)", "Kyochon's table names older products and leaves out allergens from shared kitchen equipment."),
      }));
    }
  }
  return brand("kyochon", "Kyochon Chicken", "Chicken", site, `${site}/menu/chicken.asp`, dishes);
}

async function venti() {
  const site = "https://www.theventi.co.kr";
  const dishes = [];
  // Tab 1 only repeats new dishes, so it goes last.
  for (const [mode, category] of [[2, "커피"], [3, "디카페인"], [4, "아이스 블렌디드"], [5, "주스/에이드"], [6, "버블티/티"], [7, "베버리지"], [8, "사이드메뉴"], [1, "신메뉴"]]) {
  const html = await page(`${site}/new2022/menu/all.html?mode=${mode}`);
  for (const [, uid, src, rawName] of html.matchAll(/all-view\.new\.html\?uid=(\d+)"[\s\S]*?<img src="([^"]+)"[\s\S]*?<p class="tit">([\s\S]*?)<\/p>/g)) {
    const view = await page(`${site}/new2022/menu/all-view.new.html?uid=${uid}`);
    const name = textOf(rawName);
    // One row per cup size, with the allergens in the last column.
    const body = first(/<tbody>([\s\S]*?)<\/tbody>/, view) ?? "";
    const lists = [...body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((row) => textOf([...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].at(-1)?.[1])).filter(Boolean);
    dishes.push(dish({
      name, category,
      description: textOf(first(/<div class="txt[^"]*">([\s\S]*?)<\/div>/, view)),
      photo: absolute(src.replace(/^http:/, "https:"), site),
      // Some cells split by cup size ("미디엄 우유 / 라지 우유"). All sizes are combined, which can only over-warn.
      ...facts(lists.join(", ").replace(/(미디엄|라지|레귤러|스몰|점보)\s*:?/g, ""), name, "The Venti menu (theventi.co.kr)"),
    }));
  }
  }
  return brand("venti", "The Venti", "Coffee", site, `${site}/new2022/menu/all.html`, dishes);
}

async function mammoth() {
  const site = "https://mmthcoffee.com";
  const html = await page(`${site}/sub/menu/list_coffee.php`);
  const dishes = [];
  for (const [, label, list] of html.matchAll(/<strong class="animation"><i><\/i>([^<]+)<\/strong>[\s\S]*?<ul class="clear">([\s\S]*?)<\/ul>/g)) {
    // MD is merchandise.
    if (textOf(label) === "MD") continue;
    for (const [, src, name] of list.matchAll(/<img src='([^']+)'[\s\S]*?<strong>([^<]+)<\/strong>/g)) {
      dishes.push(dish({ name: textOf(name), category: textOf(label), photo: absolute(src, site) }));
    }
  }
  return brand("mammoth", "Mammoth Coffee", "Coffee", site, `${site}/sub/menu/list_coffee.php`, dishes);
}

async function puradak() {
  const site = "https://www.puradakchicken.com";
  const dishes = [];
  let last = 1;
  for (let number = 1; number <= last; number++) {
    const html = await page(`${site}/menu/product.asp?page=${number}`);
    last = Math.max(last, ...[...html.matchAll(/product\.asp\?page=(\d+)/g)].map((m) => Number(m[1])));
    // The list names each cut (순살, 윙콤보); the detail page gives them all the same title.
    for (const [, id, rawName, src] of html.matchAll(/view\.asp\?idx=(\d+)[^"]*">\s*<span class="bg">\s*<p[^>]*>([^<]*)<\/p>\s*<\/span>\s*<div class="thumb"><img src="([^"]+)"/g)) {
      const view = await page(`${site}/menu/view.asp?idx=${id}`);
      dishes.push(dish({
        name: textOf(rawName),
        category: "치킨",
        price: money(first(/<p class="price">([\s\S]*?)<\/p>/, view)),
        photo: absolute(src, site),
      }));
    }
  }
  return brand("puradak", "Puradak Chicken", "Chicken", site, `${site}/menu/product.asp`, dishes);
}

async function popeyes() {
  const site = "https://popeyes.co.kr";
  const dishes = [];
  // "베스트메뉴" only repeats dishes from the real categories, so it goes last.
  for (const category of ["치킨", "단품", "음료", "소스", "베스트메뉴"]) {
    const html = await page(`${site}/menu?sca=${encodeURIComponent(category)}`);
    for (const [, src, name, description] of html.matchAll(/<img src="(https:\/\/storage\.googleapis\.com\/popeyes[^"]+)" alt="[^"]*"\/><\/div><div class="info"><p class="subject">([^<]+)<\/p><p class="sum">([^<]*)<\/p>/g)) {
      dishes.push(dish({ name: textOf(name), category, description: textOf(description), photo: src }));
    }
  }
  return brand("popeyes", "Popeyes", "Chicken", site, `${site}/menu`, dishes);
}

async function isaac() {
  const site = "https://www.isaac-toast.co.kr";
  const dishes = [];
  for (const [code, category] of [["10101000", "토스트"], ["10101100", "세트메뉴"], ["10101200", "사이드"], ["10101300", "음료"]]) {
    let added = 1;
    for (let number = 1; added > 0 && number < 20; number++) {
      const html = await page(`${site}/menu/menu.php?ptype=list&catcode=${code}&page=${number}`);
      const before = merged(dishes).length;
      for (const [, name] of html.matchAll(/<h4>([^<]+)<\/h4>\s*<small>/g)) dishes.push(dish({ name: textOf(name), category }));
      added = merged(dishes).length - before;
    }
  }
  return brand("isaac", "Isaac Toast", "Sandwich", site, `${site}/menu/menu.php`, dishes);
}

async function pizzaSchool() {
  const site = "http://pizzaschool.net";
  const html = await page(`${site}/menu/`);
  const dishes = [];
  const pages = new Set([...html.matchAll(/href="((?:http:\/\/(?:www\.)?pizzaschool\.net)?\/menu\/[^"/]+\/)"/g)].map((m) => m[1]));
  for (const link of pages) {
    const view = await page(new URL(link, site).href);
    const name = textOf(first(/property="og:title" content='([^']+)'/, view));
    const about = first(/property="og:description" content='([^']*)'/, view) ?? "";
    // The table has a summary row and a row per component. All are combined, in case the summary misses one.
    const panel = view.slice(view.indexOf("알레르기 유발 물질"));
    const rows = [...(first(/<table[^>]*>([\s\S]*?)<\/table>/, panel) ?? "").matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
      .map((row) => [...row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((cell) => textOf(cell[1]) ?? ""))
      .filter((cells) => !cells[1]?.includes("유발"));
    const declared = rows.map((cells) => cells[1]).filter(Boolean).join(", ");
    // Sweetener labelling, not a food the app has a tick box for. As an ingredient, a person's own note can still match it.
    const phenylalanine = declared.includes("페닐알라닌") ? ["페닐알라닌"] : [];
    // A side can break its list down: "밀, 우유 – 꽈배기: 밀 – 크림치즈 : 우유".
    const lists = [declared.replace(/[/,]?\s*페닐알라닌/g, "").replace(/\s*[–-]\s*[^,–:-]*:\s*/g, ", ")];
    const toppings = textOf(first(/주요토핑[\s\S]*?<\/(?:h\d|header)>([\s\S]*?)<section/, view))?.split("원산지")[0].trim();
    dishes.push(dish({
      name, category: "메뉴",
      description: clean(about.replace(/[\d,]{4,}원.*$/s, "")),
      price: money(first(/([\d,]{4,})원/, about)),
      photo: first(/og:image" content="([^"]+)"/, view),
      ingredients: [...new Set([...(toppings?.split(/,\s*/) ?? []), ...rows.map((cells) => cells[0]).filter((part) => part && !part.includes("유발")), ...phenylalanine])],
      ...facts(lists.join(", "), name ?? link, "Pizza School menu (pizzaschool.net)"),
    }));
  }
  return brand("pizzaschool", "Pizza School", "Pizza", site, `${site}/menu/`, dishes);
}

async function gongcha() {
  const site = "https://www.gong-cha.co.kr";
  const dishes = [];
  // 001xxx are drinks and 002xxx food; 003xxx is merchandise. Photos sit under /upload/, which robots.txt disallows.
  for (const [code, category] of [["001001", "음료"], ["001002", "음료"], ["001003", "음료"], ["002001", "푸드"], ["002002", "푸드"], ["002003", "푸드"], ["002004", "푸드"]]) {
    const html = await page(`${site}/brand/menu/product?category=${code}`);
    const ids = [...new Set([...html.matchAll(new RegExp(`product_detail\\?category=${code}&no=(\\d+)`, "g"))].map((m) => m[1]))];
    for (const id of ids) {
      const view = await page(`${site}/brand/menu/product_detail?category=${code}&no=${id}`);
      // A banner above the dish uses the same classes, so read only the dish's own block.
      const own = view.slice(view.indexOf('<div class="infor">'));
      const name = textOf(first(/<p class="t1[^"]*">([\s\S]*?)<\/p>/, own));
      dishes.push(dish({
        name, category,
        description: textOf(first(/<p class="t2[^"]*">([\s\S]*?)<\/p>/, own)),
        ...facts(first(/알레르기 유발물질\s*:\s*([^<]*)/, own), name, "Gong Cha Korea menu (gong-cha.co.kr)"),
      }));
    }
  }
  return brand("gongcha", "Gong Cha", "Bubble tea", site, `${site}/brand/menu/product?category=001001`, dishes);
}

async function compose() {
  const site = "https://composecoffee.com";
  const dishes = [];
  const categories = [["303364", "커피ㆍ콜드브루"], ["303365", "베버리지"], ["303366", "프라페ㆍ스무디"], ["303367", "밀크쉐이크"],
    ["303368", "에이드ㆍ주스"], ["303369", "티"], ["308857", "푸드ㆍ디저트"], ["303371", "아이스크림"], ["301298", "추천메뉴"]];
  for (const [code, category] of categories) {
    let last = 1;
    for (let number = 1; number <= last; number++) {
      const html = await page(`${site}/index.php?mid=compose&act=dispCafemenuGalleryList&category_srl=${code}&page=${number}`);
      last = Math.max(last, ...[...html.matchAll(/[?&]amp;page=(\d+)|[?&]page=(\d+)/g)].map((m) => Number(m[1] ?? m[2])).filter((n) => n < 30));
      for (const [, item, src, rawName] of html.matchAll(/item_srl=(\d+)" class="cafemenu-menu-item">[\s\S]*?<img src="([^"]+)" alt="([^"]*)"/g)) {
        const view = await page(`${site}/index.php?mid=compose&act=dispCafemenuGalleryItem&category_srl=${code}&item_srl=${item}`);
        const body = textOf(view.slice(view.indexOf("알레르기 정보"))) ?? "";
        const declared = first(/알레르기 성분\s*:\s*(.*?)(?=제조시설|$)/, body);
        const shared = first(/제조시설 내 알레르기 유발 가능식품\s*:\s*([^가-힣]*[가-힣,\s()]*?)(?=\s{2}|[A-Z©]|창업|$)/, body);
        const name = textOf(rawName);
        // Compose lists coffee beside the allergens. It is not one, so it becomes an ingredient,
        // where a person's own note ("coffee") can still match it.
        const notAllergen = (list) => list?.replace(/(^|,)\s*커피\s*(?=,|$)/g, "$1").replace(/,\s*,/g, ",").replace(/^\s*,|,\s*$/g, "");
        const hasCoffee = /(^|,)\s*커피\s*(,|$)/.test(`${declared ?? ""},${shared ?? ""}`);
        const known = facts(notAllergen(declared), name, "Compose Coffee menu (composecoffee.com)");
        dishes.push(dish({
          name, category, photo: absolute(src, site),
          ingredients: hasCoffee ? ["커피"] : [],
          ...known,
          ...(known.contains && shared ? { may_contain: parseAllergens(notAllergen(shared), name).filter((key) => !known.contains.includes(key)) } : {}),
        }));
      }
    }
  }
  return brand("compose", "Compose Coffee", "Coffee", site, `${site}/index.php?mid=compose&act=dispCafemenuGalleryList`, dishes);
}

async function momstouch() {
  const site = "https://momstouch.co.kr";
  const dishes = [];
  // Allergens are published only as a chart image, so every dish stays "No data" here.
  for (const [code, category] of [["CG0005", "버거"], ["CG0004", "치킨"], ["CG0003", "맘스세트"], ["CG0046", "피자"], ["CG0002", "사이드"], ["CG0001", "음료"], ["CG0045", "또잇 치킨"]]) {
    let last = 1;
    for (let number = 1; number <= last; number++) {
    const html = await page(`${site}/menu/new.php?s_sect1=${code}&pageNo=${number}`);
    last = Math.max(last, ...[...html.matchAll(/pageNo=(\d+)/g)].map((m) => Number(m[1])).filter((n) => n < 30));
    for (const [, src, rawName, about] of html.matchAll(/go_view\('\d+'\);">\s*<figure><span style="background-image: url\('([^']+)'\)"><\/span><\/figure>[\s\S]*?<h3>(?:<span>[^<]*<\/span>)?([^<]+)<\/h3>\s*(?:<p>([\s\S]*?)<\/p>)?/g)) {
      dishes.push(dish({ name: textOf(rawName), category, description: textOf(about), photo: absolute(src, site) }));
    }
    }
  }
  return brand("momstouch", "Mom's Touch", "Burger", site, `${site}/menu/new.php?s_sect1=CG0005`, dishes);
}

const ALL = { gongcha, compose, momstouch, starbucks, mega, paik, baskin, sulbing, kyochon, venti, mammoth, puradak, popeyes, isaac, pizzaschool: pizzaSchool };

const chosen = process.argv.slice(2);
for (const [slug, importer] of Object.entries(ALL)) {
  if (chosen.length && !chosen.includes(slug)) continue;
  try {
    const menu = await importer();
    if (!menu.dishes.length) throw new Error("found no dishes");
    writeFileSync(`supabase/menus/${slug}.json`, `${JSON.stringify(menu, null, 2)}\n`);
    const withData = menu.dishes.filter((d) => d.contains).length;
    console.log(`${slug}: ${menu.dishes.length} dishes, ${withData} with allergen data, ${menu.dishes.filter((d) => d.price).length} with prices, ${menu.dishes.filter((d) => d.photo).length} with photos`);
  } catch (error) {
    console.log(`${slug}: FAILED, nothing written: ${error.message}`);
  }
}
