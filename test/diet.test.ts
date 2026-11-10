import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DIETS, LABELLED, NAMED_ONLY, allDietKeys, checkDish, distanceMetres, expandAvoid, noteWords } from "../src/lib/diet";
import { dishKind } from "../src/lib/dish-kind";

const dish = (fields: Partial<Parameters<typeof checkDish>[0]> = {}) => ({
  name: "Plain dish", description: null, ingredients: [], contains: [], may_contain: [], allergen_gaps: [], ...fields,
});

describe("checkDish: missing data is never good news", () => {
  it("is unknown when the brand publishes nothing", () => {
    expect(checkDish(dish({ contains: null, may_contain: null }), ["peanut"])?.level).toBe("unknown");
  });
  it("is unknown when a part of a set has no data, even if nothing else is listed", () => {
    const set = dish({ contains: ["wheat"], allergen_gaps: ["프렌치프라이(R)"] });
    expect(checkDish(set, ["peanut"])?.level).toBe("unknown");
  });
  it("still reports what the known parts of a set contain", () => {
    const set = dish({ contains: ["beef", "wheat"], allergen_gaps: ["프렌치프라이(R)"] });
    expect(checkDish(set, ["beef"])).toMatchObject({ level: "avoid", found: ["Beef"] });
  });
  it("is clear only with data, and only for what that data covers", () => {
    expect(checkDish(dish({ contains: ["wheat"] }), ["peanut"])).toMatchObject({ level: "clear", unconfirmed: [] });
    expect(checkDish(dish({ contains: ["wheat"] }), ["sesame"])).toMatchObject({ level: "clear", unconfirmed: ["Sesame"] });
  });
  it("gives nothing to show when a person avoids nothing", () => {
    expect(checkDish(dish(), [])).toBeNull();
    expect(checkDish(dish(), [], "  ")).toBeNull();
  });
});

describe("checkDish: finding what a person avoids", () => {
  it("separates contains from may contain, and contains wins", () => {
    expect(checkDish(dish({ contains: ["milk"], may_contain: ["egg"] }), ["milk", "egg"]))
      .toMatchObject({ level: "avoid", found: ["Milk and dairy"], maybe: ["Egg"] });
    expect(checkDish(dish({ may_contain: ["egg"] }), ["egg"])?.level).toBe("caution");
  });
  it("catches peanut butter by name when the brand lists nothing", () => {
    expect(checkDish(dish({ name: "피넛버터 쿠키", contains: null, may_contain: null }), ["peanut"])?.level).toBe("avoid");
  });
  it("catches meat that Korea's allergen list leaves out", () => {
    // Subway's turkey sandwich has no meat mark in the chart, because turkey is not a labelled allergen.
    const turkey = dish({ name: "터키 Turkey", contains: ["soy", "wheat", "tomato"] });
    expect(checkDish(turkey, ["no_meat"])).toMatchObject({ level: "avoid", found: ["Turkey"] });
    expect(checkDish(turkey, ["vegan"])?.level).toBe("avoid");
    expect(checkDish(dish({ name: "램 Lamb" }), ["vegetarian"])?.level).toBe("avoid");
    expect(checkDish(dish({ name: "참치 Tuna" }), ["vegetarian"])?.level).toBe("avoid");
    expect(checkDish(dish({ name: "미트 추가 Meat", contains: null, may_contain: null }), ["vegan"])?.level).toBe("avoid");
  });
  it("catches pork by name, but not in the word for hamburger", () => {
    for (const name of ["베이컨치즈와퍼", "잠봉 Jambon", "Italian B.M.T. 비엠티", "치킨킹BLT"]) {
      expect(checkDish(dish({ name, contains: null, may_contain: null }), ["pork"])?.level, name).toBe("avoid");
    }
    expect(checkDish(dish({ name: "햄버거" }), ["pork"])?.level).toBe("clear");
  });
  it("does not see duck in oriental, or lamb in grams", () => {
    expect(checkDish(dish({ name: "오리엔탈 샐러드" }), ["duck"])?.found).toEqual([]);
    expect(checkDish(dish({ name: "100그램" }), ["lamb"])?.found).toEqual([]);
  });
  it("looks in descriptions and ingredients too", () => {
    expect(checkDish(dish({ description: "with honey glaze" }), ["honey"])?.level).toBe("avoid");
    expect(checkDish(dish({ ingredients: ["허니 머스터드"] }), ["mustard"])?.level).toBe("avoid");
  });
  it("vegan rules out egg, milk and seafood; vegetarian allows egg and milk", () => {
    const cake = dish({ contains: ["egg", "milk"] });
    expect(checkDish(cake, ["vegan"])?.level).toBe("avoid");
    expect(checkDish(cake, ["vegetarian"])?.level).toBe("clear");
    expect(checkDish(dish({ contains: ["shrimp"] }), ["vegetarian"])?.level).toBe("avoid");
    expect(checkDish(dish({ contains: ["shrimp"] }), ["no_meat"])?.level).toBe("clear");
    expect(expandAvoid(["vegan", "egg"]).filter((k) => k === "egg")).toHaveLength(1);
  });
  it("has diets for seafood, nuts, and pork with alcohol", () => {
    expect(checkDish(dish({ name: "통새우와퍼", contains: ["shrimp", "wheat"] }), ["no_seafood"])?.level).toBe("avoid");
    expect(checkDish(dish({ name: "아몬드 쿠키", contains: ["wheat"] }), ["no_nuts"])?.level).toBe("avoid");
    expect(checkDish(dish({ contains: ["peanut"] }), ["no_nuts"])?.level).toBe("avoid");
    expect(checkDish(dish({ name: "1인 치맥세트 생맥주", contains: ["chicken"] }), ["no_pork_alcohol"])?.level).toBe("avoid");
    expect(checkDish(dish({ name: "막걸리", contains: [] }), ["no_pork_alcohol"])?.level).toBe("avoid");
    // Alcohol is never labelled, so a dish with data still says it is not ruled out.
    expect(checkDish(dish({ contains: ["wheat"] }), ["no_pork_alcohol"])).toMatchObject({ level: "clear", unconfirmed: ["Alcohol"] });
  });
  it("uses the person's own words", () => {
    expect(noteWords("cilantro, kiwi\n x")).toEqual(["cilantro", "kiwi"]);
    expect(checkDish(dish({ name: "Kiwi juice" }), [], "kiwi")).toMatchObject({ level: "avoid", found: ["kiwi"] });
    expect(checkDish(dish({ name: "Cola" }), [], "kiwi")).toMatchObject({ level: "clear", unconfirmed: ["kiwi"] });
  });
});

describe("the data behind it", () => {
  const menu = (slug: string) => JSON.parse(readFileSync(`supabase/menus/${slug}.json`, "utf8")).dishes as {
    name: string; contains: string[] | null; may_contain: string[] | null; allergen_gaps?: string[]; price: number | null; ingredients: string[];
  }[];
  const known = new Set(allDietKeys());
  const find = (slug: string, name: string) => {
    const found = menu(slug).find((d) => d.name === name);
    if (!found) throw new Error(`${name} is not on the ${slug} menu`);
    return found;
  };

  it("only uses allergen keys the app understands", () => {
    for (const slug of readdirSync("supabase/menus").filter((f) => f.endsWith(".json") && f !== "local-sources.json").map((f) => f.replace(".json", ""))) {
      for (const d of menu(slug)) {
        for (const key of [...(d.contains ?? []), ...(d.may_contain ?? [])]) expect(known.has(key), `${slug}: ${d.name}: ${key}`).toBe(true);
      }
    }
  });
  it("matches what the brands publish for dishes checked by hand", () => {
    expect(find("burgerking", "와퍼").contains).toEqual(expect.arrayContaining(["beef", "tomato", "soy", "wheat", "egg"]));
    expect(find("burgerking", "와퍼 세트").allergen_gaps).toEqual(expect.arrayContaining(["프렌치프라이(R)"]));
    expect(find("burgerking", "와퍼").price).toBe(7400);
    const veggie = find("subway", "베지 Veggie Delite");
    expect(veggie.contains?.sort()).toEqual(["soy", "tomato", "wheat"]);
    expect(veggie.may_contain?.sort()).toEqual(["egg", "milk"]);
    const pizza = find("subway", "피자썹 Pizza Sub");
    expect(pizza.contains).toEqual(expect.arrayContaining(["egg", "milk", "soy", "wheat", "pork", "tomato"]));
    expect(pizza.may_contain).toEqual(expect.arrayContaining(["peanut", "shrimp", "beef"]));
    expect(find("bbq", "BBQ 황올 미니 콤보 세트").contains).toEqual(expect.arrayContaining(["peanut", "chicken", "milk"]));
  });
  it("reads the other chains' lists the way their pages show them", () => {
    expect(find("starbucks", "카페 라떼").contains).toEqual(["milk"]);
    expect(find("starbucks", "콜드 브루 몰트").contains?.sort()).toEqual(["milk", "soy"]);
    expect(find("mega", "딥 초코 체리 프라페").contains?.sort()).toEqual(["milk", "soy"]);
    expect(find("paik", "원조커피(ICED)").contains).toEqual(["milk"]);
    expect(find("paik", "아이스티샷추가(아샷추)").contains).toEqual(["peach"]);
    expect(find("pizzaschool", "콘치즈피자").contains?.sort()).toEqual(["egg", "milk", "soy", "tomato", "wheat"]);
    expect(find("pizzaschool", "콘치즈피자").price).toBe(10900);
    expect(find("sulbing", "변신 메타몽 치즈베리설빙").ingredients).toContain("믹스베리");
    expect(find("kyochon", "허니콤보").contains?.sort()).toEqual(["chicken", "soy", "wheat"]);
    expect(find("puradak", "순(다리)살 홍고추마요").price).toBe(26900);
  });
  it("keeps a blank in a brand's list unknown, never free from", () => {
    expect(find("starbucks", "카페 아메리카노").contains).toBeNull();
    expect(find("paik", "아메리카노(ICED)").contains).toBeNull();
    for (const slug of ["mammoth", "puradak", "popeyes", "isaac", "momstouch"]) {
      expect(menu(slug).every((d) => d.contains === null && d.may_contain === null), slug).toBe(true);
    }
  });
  it("lets the Subway add-on with no fixed meat stay unknown", () => {
    expect(find("subway", "미트 추가 Meat").contains).toBeNull();
  });
});

describe("dishKind", () => {
  it("tells meals from drinks and sides across the brands' own categories", () => {
    expect(dishKind({ category: "와퍼&주니어", name: "와퍼" })).toBe("meal");
    expect(dishKind({ category: "음료&디저트", name: "코카콜라(R)" })).toBe("drink");
    expect(dishKind({ category: "음료&디저트", name: "선데 아이스크림" })).toBe("snack");
    expect(dishKind({ category: "사이드메뉴", name: "로제 떡볶이" })).toBe("meal");
    expect(dishKind({ category: "사이드", name: "프렌치프라이(L)" })).toBe("snack");
    expect(dishKind({ category: "단품", name: "루이통 스파이시 버거" })).toBe("meal");
    expect(dishKind({ category: "푸드", name: "쇼콜라 아메르 케이크" })).toBe("snack");
    expect(dishKind({ category: "푸드", name: "햄치즈에그 샌드위치" })).toBe("meal");
    expect(dishKind({ category: "신메뉴", name: "공주 밤라떼" })).toBe("drink");
    expect(dishKind({ category: "치킨", name: "코울슬로" })).toBe("snack");
    expect(dishKind({ category: "Main", name: "순대국" })).toBe("meal");
  });
});

describe("distanceMetres", () => {
  it("agrees with the distance Burger King's store finder reports", () => {
    const campus = { lat: 37.4494108, lng: 126.6534266 };
    expect(distanceMetres(campus, campus)).toBe(0);
    expect(distanceMetres(campus, { lat: campus.lat + 0.018, lng: campus.lng })).toBeGreaterThan(1900);
    expect(distanceMetres(campus, { lat: campus.lat + 0.018, lng: campus.lng })).toBeLessThan(2100);
  });
});

describe("the database's lists of food keys", () => {
  it("are the same lists as the app's", () => {
    const sql = readFileSync("supabase/migrations/20261107000000_member_menus_and_diets.sql", "utf8");
    const list = (fn: string) => {
      const start = sql.indexOf(`function public.${fn}()`);
      const block = sql.slice(sql.indexOf("array[", start), sql.indexOf("]::text[]", start));
      return [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    };
    expect(list("diet_keys")).toEqual(DIETS.map((d) => d.key).sort());
    expect(list("allergen_keys")).toEqual([...LABELLED, ...NAMED_ONLY].map((i) => i.key).sort());
  });
});

describe("map dishes sent compact", () => {
  it("drop blank fields and restore them, keeping an empty allergen list apart from no data", async () => {
    const { compactDish, fullDish } = await import("../src/lib/map-dish");
    const dish = {
      id: "d", name: "김밥", category: "Menu", photo: null, price: null, description: null, contains: [] as string[],
      may_contain: null, ingredients: [] as string[], allergen_source: "brand", allergen_note: null, allergen_gaps: [] as string[],
    };
    const compact = compactDish(dish);
    expect(compact).toEqual({ id: "d", name: "김밥", category: "Menu", contains: [], allergen_source: "brand" });
    expect(fullDish(compact)).toEqual(dish);
    expect(fullDish(compactDish({ ...dish, contains: null, allergen_source: null })).contains).toBeNull();
  });
});

describe("canEatFirst", () => {
  it("puts dishes with nothing you avoid first and what you avoid last, keeping the menu order otherwise", async () => {
    const { canEatFirst } = await import("../src/lib/diet");
    const level = { 돈까스: "avoid", 우동: "clear", 김밥: "unknown", 라면: "caution", 덮밥: "clear" } as const;
    const sorted = canEatFirst(Object.keys(level), (name) => ({ level: level[name as keyof typeof level] }) as never);
    expect(sorted).toEqual(["우동", "덮밥", "김밥", "라면", "돈까스"]);
    expect(canEatFirst(["b", "a"], () => null)).toEqual(["b", "a"]);
  });
});

describe("restaurantKinds", () => {
  it("files brand and Korean cuisines under the filter's food types", async () => {
    const { restaurantKinds } = await import("../src/lib/restaurant-kind");
    expect(restaurantKinds({ name: "BBQ", cuisine: "Chicken" })).toEqual(["chicken"]);
    expect(restaurantKinds({ name: "신전떡볶이", cuisine: "일반 분식" })).toEqual(["snack"]);
    expect(restaurantKinds({ name: "삼일반점", cuisine: "중식당" })).toEqual(["asian"]);
    expect(restaurantKinds({ name: "유니버스데이", cuisine: "디저트카페" })).toEqual(["cafe", "dessert"]);
    // Names that only look like a type do not count.
    expect(restaurantKinds({ name: "멕시카나치킨", cuisine: "치킨/닭강정" })).toEqual(["chicken"]);
    expect(restaurantKinds({ name: "태양식당", cuisine: "한식" })).toEqual(["korean"]);
  });
});
