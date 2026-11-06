// Shared by the menu importers: polite fetching, text clean-up and allergen parsing.
const USER_AGENT = "GroupOrder-menu-import/0.1 (student project; menu data for a local demo)";
const DELAY_MS = 800;
const pause = () => new Promise((resolve) => setTimeout(resolve, DELAY_MS));

export async function get(url, init = {}) {
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
  굴: "shellfish", 전복: "shellfish", 홍합: "shellfish", 잣: "pine_nut",
  // Not among Korea's labelled allergens, but some brands name them anyway.
  견과류: "tree_nuts", 아몬드: "tree_nuts", 캐슈넛: "tree_nuts", 피스타치오: "tree_nuts", 헤이즐넛: "tree_nuts", 마카다미아: "tree_nuts",
};

/** "알류, 우유" becomes ["egg", "milk"]. Throws on a word it does not know, so nothing is silently dropped. */
export function parseAllergens(text, where) {
  const words = (text ?? "").replace(/\([^)]*\)/g, ",").split(/[,，./·ㆍ@]/).map((w) => w.trim()).filter(Boolean);
  const keys = words.filter((w) => w !== "없음").map((word) => {
    const key = ALLERGEN_WORDS[word];
    if (!key) throw new Error(`Unknown allergen "${word}" in ${where}: ${text}`);
    return key;
  });
  return [...new Set(keys)];
}

/** Every allergen named in a sentence, for warnings written as prose rather than as a list. */
export function allergensIn(sentence) {
  return [...new Set(Object.entries(ALLERGEN_WORDS).filter(([word]) => word.length > 1 && sentence.includes(word)).map(([, key]) => key))];
}
