// What a person avoids, and how a dish measures up against it.
//
// The rule that matters: missing data is never good news. A dish only counts as "none listed"
// when its brand published allergens for it, and even then the wording stays "none listed",
// never "safe": recipes change and kitchens share equipment.

export type DietItem = {
  key: string;
  label: string;
  korean: string;
  /** Finds the item by name in a dish's name, description or ingredients. */
  words?: RegExp;
};

/** The 19 foods Korean restaurants label, so a brand's list can actually rule these out. */
export const LABELLED: DietItem[] = [
  { key: "egg", label: "Egg", korean: "난류", words: /에그|계란|달걀|오믈렛|마요|\begg|omelet|mayo/i },
  { key: "milk", label: "Milk and dairy", korean: "우유", words: /우유|치즈|크림|밀크|라떼|버터|요거트|cheese|milk|latte|cream|butter|yogurt/i },
  { key: "peanut", label: "Peanut and peanut butter", korean: "땅콩", words: /땅콩|피넛|peanut/i },
  { key: "walnut", label: "Walnut", korean: "호두", words: /호두|walnut/i },
  { key: "pine_nut", label: "Pine nut", korean: "잣", words: /잣|pine nut/i },
  { key: "soy", label: "Soybean", korean: "대두", words: /대두|두부|간장|\bsoy|tofu/i },
  { key: "wheat", label: "Wheat", korean: "밀", words: /통밀|밀가루|wheat|flour/i },
  { key: "buckwheat", label: "Buckwheat", korean: "메밀", words: /메밀|buckwheat/i },
  { key: "pork", label: "Pork", korean: "돼지고기", words: /돼지|돈까스|돈가스|베이컨|햄(?!버)|잠봉|페퍼로니|살라미|삼겹|소시지|비엘티|비엠티|\bBLT\b|pork|bacon|\bham\b|jambon|pepperoni|salami|sausage/i },
  { key: "beef", label: "Beef", korean: "쇠고기", words: /비프|쇠고기|소고기|스테이크|불고기|갈비|곱창|beef|steak|bulgogi/i },
  { key: "chicken", label: "Chicken", korean: "닭고기", words: /치킨|닭|chicken/i },
  { key: "shrimp", label: "Shrimp", korean: "새우", words: /새우|쉬림프|슈림프|shrimp|prawn/i },
  { key: "crab", label: "Crab", korean: "게", words: /크랩|게살|대게|꽃게|crab/i },
  { key: "squid", label: "Squid", korean: "오징어", words: /오징어|squid|calamari/i },
  { key: "shellfish", label: "Shellfish (oyster, abalone, mussel)", korean: "조개류", words: /조개|전복|홍합|굴소스|clam|oyster|mussel|abalone/i },
  { key: "mackerel", label: "Mackerel", korean: "고등어", words: /고등어|mackerel/i },
  { key: "peach", label: "Peach", korean: "복숭아", words: /복숭아|peach/i },
  { key: "tomato", label: "Tomato", korean: "토마토", words: /토마토|tomato/i },
  { key: "sulfites", label: "Sulfites", korean: "아황산류" },
];

/** Not on Korea's labelling list, so a brand's silence proves nothing. They can only be found by name. */
export const NAMED_ONLY: DietItem[] = [
  { key: "lamb", label: "Lamb", korean: "양고기", words: /(?<!그)램(?!프)|양고기|lamb/i },
  { key: "turkey", label: "Turkey", korean: "칠면조", words: /터키|칠면조|turkey/i },
  { key: "duck", label: "Duck", korean: "오리고기", words: /오리고기|훈제오리|duck/i },
  { key: "fish", label: "Fish", korean: "생선", words: /참치|연어|생선|명태|멸치|어묵|피쉬|tuna|salmon|fish|anchovy/i },
  { key: "tree_nuts", label: "Other tree nuts", korean: "견과류", words: /아몬드|캐슈|피스타치오|헤이즐넛|마카다미아|코코넛|견과|almond|cashew|pistachio|hazelnut|macadamia|coconut/i },
  { key: "sesame", label: "Sesame", korean: "참깨", words: /참깨|들깨|참기름|sesame/i },
  { key: "mustard", label: "Mustard", korean: "겨자", words: /머스타드|머스터드|겨자|mustard/i },
  { key: "honey", label: "Honey", korean: "꿀", words: /허니|꿀|honey/i },
  { key: "mushroom", label: "Mushroom", korean: "버섯", words: /머쉬룸|버섯|트러플|mushroom|truffle/i },
  { key: "corn", label: "Corn", korean: "옥수수", words: /옥수수|콘 ?샐러드|콘 ?수프|\bcorn\b/i },
  { key: "garlic", label: "Garlic", korean: "마늘", words: /갈릭|마늘|garlic/i },
  { key: "onion", label: "Onion", korean: "양파", words: /어니언|양파|onion/i },
  { key: "alcohol", label: "Alcohol", korean: "주류", words: /맥주|와인|버드와이저|소주|막걸리|사케|하이볼|위스키|칵테일|beer|wine|whisk|cocktail/i },
];

/** A generic mention such as Subway's "extra meat", only used through the diets below. */
const ANY_MEAT: DietItem = { key: "meat", label: "Meat", korean: "고기", words: /미트|고기|\bmeat\b/i };

const MEATS = ["chicken", "beef", "pork", "lamb", "turkey", "duck", "meat"];
const SEA = ["fish", "mackerel", "crab", "shrimp", "squid", "shellfish"];

const NUTS = ["peanut", "walnut", "pine_nut", "tree_nuts"];

export const DIETS: { key: string; label: string; korean: string; avoids: string[]; hint?: string }[] = [
  { key: "vegan", label: "Vegan", korean: "비건", avoids: [...MEATS, ...SEA, "egg", "milk", "honey"] },
  { key: "vegetarian", label: "Vegetarian", korean: "채식", avoids: [...MEATS, ...SEA] },
  { key: "no_meat", label: "No meat", korean: "육류 제외", avoids: MEATS },
  { key: "no_seafood", label: "No seafood", korean: "해산물 제외", avoids: SEA },
  { key: "no_nuts", label: "No nuts", korean: "견과류 제외", avoids: NUTS },
  // Not halal: that needs certified meat, which no brand here states.
  { key: "no_pork_alcohol", label: "No pork or alcohol", korean: "돼지고기·주류 제외", avoids: ["pork", "alcohol"], hint: "Not the same as halal: no brand here says how its meat is prepared." },
];

export const SEARCH_SHORTCUTS = ["vegan", "vegetarian", "no_meat", "no_pork_alcohol", "pork", "chicken", "beef", "no_seafood", "peanut", "no_nuts", "milk", "egg", "wheat"];

const ITEMS = new Map([...LABELLED, ...NAMED_ONLY, ANY_MEAT].map((item) => [item.key, item]));
const LABELLED_KEYS = new Set(LABELLED.map((item) => item.key));
const DIET_KEYS = new Map(DIETS.map((diet) => [diet.key, diet]));

export const allDietKeys = () => [...DIETS.map((d) => d.key), ...LABELLED.map((i) => i.key), ...NAMED_ONLY.map((i) => i.key)];
export const allergenLabel = (key: string) => ITEMS.get(key)?.label ?? key;
const SHORTCUT_LABELS: Record<string, string> = {
  pork: "No pork", chicken: "No chicken", beef: "No beef", peanut: "No peanut", milk: "No dairy", egg: "No egg", wheat: "No wheat",
};
export const dietItemLabel = (key: string) => DIET_KEYS.get(key)?.label ?? SHORTCUT_LABELS[key] ?? allergenLabel(key);

/** Diets become the foods they rule out. */
export function expandAvoid(avoid: string[]) {
  return [...new Set(avoid.flatMap((key) => DIET_KEYS.get(key)?.avoids ?? [key]))];
}

export const noteWords = (note: string | null | undefined) =>
  (note ?? "").split(/[,\n]/).map((w) => w.trim()).filter((w) => w.length >= 2);

export type DishFacts = {
  name: string;
  description?: string | null;
  ingredients?: string[] | null;
  contains?: string[] | null;
  may_contain?: string[] | null;
  allergen_gaps?: string[] | null;
};

export type DishLevel = "avoid" | "caution" | "unknown" | "clear";
export type DishCheck = {
  level: DishLevel;
  /** Foods the brand lists, or that the dish's own wording names. */
  found: string[];
  /** Foods the brand says may be present. */
  maybe: string[];
  /** Foods this data cannot rule out, even though none are listed. */
  unconfirmed: string[];
};

/** Checks one dish against what a person avoids. Null when they avoid nothing. */
export function checkDish(dish: DishFacts, avoid: string[], note?: string | null): DishCheck | null {
  const keys = expandAvoid(avoid);
  const words = noteWords(note);
  if (keys.length === 0 && words.length === 0) return null;

  const text = [dish.name, dish.description, ...(dish.ingredients ?? [])].filter(Boolean).join(" ");
  const hasData = Array.isArray(dish.contains);
  const found: string[] = [];
  const maybe: string[] = [];
  const unconfirmed: string[] = [];

  for (const key of keys) {
    const item = ITEMS.get(key);
    if (dish.contains?.includes(key) || item?.words?.test(text)) found.push(item?.label ?? key);
    else if (dish.may_contain?.includes(key)) maybe.push(item?.label ?? key);
    else if (hasData && !LABELLED_KEYS.has(key)) unconfirmed.push(item?.label ?? key);
  }
  for (const word of words) {
    if (text.toLowerCase().includes(word.toLowerCase())) found.push(word);
    else unconfirmed.push(word);
  }

  const known = hasData && !dish.allergen_gaps?.length;
  const level: DishLevel = found.length ? "avoid" : maybe.length ? "caution" : known ? "clear" : "unknown";
  return { level, found, maybe, unconfirmed };
}

/** Straight-line distance in metres. */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}
