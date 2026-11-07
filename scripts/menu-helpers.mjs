// Shared by the menu importers: polite fetching, text clean-up and allergen parsing.
const USER_AGENT = "GroupOrder-menu-import/0.1 (student project; menu data for a local demo)";
const DELAY_MS = 800;
const pause = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

// IMPORT_CACHE=<folder> keeps fetched pages, so a rerun after a parser fix does not ask the site again.
const CACHE = process.env.IMPORT_CACHE;

export async function get(url, init = {}) {
  if (CACHE && !init.method) {
    const { createHash } = await import("node:crypto");
    const { existsSync, mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
    const file = `${CACHE}/${createHash("sha1").update(url).digest("hex")}`;
    if (existsSync(file)) return new Response(readFileSync(file));
    await pause();
    const response = await fetch(url, { ...init, headers: { "user-agent": USER_AGENT, ...init.headers } });
    if (!response.ok) throw new Error(`${url} answered ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(file, body);
    return new Response(body);
  }
  await pause();
  const response = await fetch(url, { ...init, headers: { "user-agent": USER_AGENT, ...init.headers } });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response;
}

export const clean = (text) => text?.replace(/\s+/g, " ").trim() || null;
export const decode = (text) =>
  text.replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
/** The visible text of a piece of HTML. */
export const textOf = (html) => clean(decode((html ?? "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, " ")));

const ALLERGEN_WORDS = {
  난류: "egg", 알류: "egg", 계란: "egg", 달걀: "egg", 우유: "milk", 메밀: "buckwheat", 땅콩: "peanut",
  대두: "soy", 밀: "wheat", 고등어: "mackerel", 게: "crab", 새우: "shrimp", 돼지고기: "pork",
  복숭아: "peach", 토마토: "tomato", 아황산류: "sulfites", 아황산: "sulfites", 이산화황: "sulfites", 호두: "walnut",
  닭고기: "chicken", 쇠고기: "beef", 소고기: "beef", 오징어: "squid", 조개류: "shellfish",
  조개: "shellfish", 굴: "shellfish", 전복: "shellfish", 홍합: "shellfish", 잣: "pine_nut",
  // Same foods, written another way.
  밀가루: "wheat", 유제품: "milk", 우유류: "milk", 계란류: "egg", 대두류: "soy", 땅콩류: "peanut", 메밀류: "buckwheat",
  돼지고기류: "pork", 쇠고기류: "beef", 닭고기류: "chicken", 새우류: "shrimp", 게류: "crab", 오징어류: "squid",
  고등어류: "mackerel", 복숭아류: "peach", 토마토류: "tomato", 호두류: "walnut", 잣류: "pine_nut", 아황산염: "sulfites",
  // Foods that are an allergen by definition: bird eggs count as egg, dairy as milk.
  메추리알: "egg", 오리알: "egg", 치즈: "milk", 버터: "milk", 생크림: "milk", 연유: "milk", 요거트: "milk", 요구르트: "milk",
  두부: "soy", 땅콩버터: "peanut",
  // Foods the app tracks beyond Korea's 19, when a brand names them.
  참깨: "sesame", 겨자: "mustard", 머스타드: "mustard", 꿀: "honey", 버섯: "mushroom", 옥수수: "corn", 마늘: "garlic",
  양파: "onion", 생선: "fish", 어류: "fish", 연어: "fish", 참치: "fish", 칠면조: "turkey", 오리고기: "duck", 양고기: "lamb",
  피칸: "tree_nuts", 브라질너트: "tree_nuts", 메카다미아: "tree_nuts",
  // A typo on Compose's site; reading it as soybean can only over-warn.
  대대두: "soy",
  // Not among Korea's labelled allergens, but some brands name them anyway.
  견과류: "tree_nuts", 아몬드: "tree_nuts", 캐슈넛: "tree_nuts", 피스타치오: "tree_nuts", 헤이즐넛: "tree_nuts", 마카다미아: "tree_nuts",
};

/** "알류, 우유" becomes ["egg", "milk"]. Throws on a word it does not know, so nothing is silently dropped. */
export function parseAllergens(text, where) {
  // "참깨 등 견과류" is "sesame and other nuts": both count.
  const words = (text ?? "").replace(/\([^)]*\)/g, ",").replace(/\s+등\s+/g, ",").split(/[,，./·ㆍ@]/).map((w) => w.trim()).filter(Boolean);
  const keys = words.filter((w) => w !== "없음").map((word) => {
    // Some sites slip a space into a word ("아황산 류").
    const key = ALLERGEN_WORDS[word] ?? ALLERGEN_WORDS[word.replace(/\s+/g, "")];
    if (!key) throw new Error(`Unknown allergen "${word}" in ${where}: ${text}`);
    return key;
  });
  return [...new Set(keys)];
}

/** Every allergen named in a sentence, for warnings written as prose rather than as a list. */
export function allergensIn(sentence) {
  return [...new Set(Object.entries(ALLERGEN_WORDS).filter(([word]) => word.length > 1 && sentence.includes(word)).map(([, key]) => key))];
}
