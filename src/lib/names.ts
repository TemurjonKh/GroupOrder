// Names in the chosen language. Menus were imported in Korean (chains in English); the other
// language comes from supabase/menus/translations/en.json, and a missing one shows the original.
export type Lang = "en" | "ko";
export const LANG_COOKIE = "lang";

export const dishName = (dish: { name: string; name_en?: string | null }, lang: Lang) =>
  (lang === "en" && dish.name_en) || dish.name;

export const sectionName = (dish: { category: string; category_en?: string | null }, lang: Lang) =>
  (lang === "en" && dish.category_en) || dish.category;

export const restaurantName = (restaurant: { name: string; name_en?: string | null; name_ko?: string | null }, lang: Lang) =>
  (lang === "en" ? restaurant.name_en : restaurant.name_ko) || restaurant.name;

/** Picks the English or Korean text: t("Food map", "푸드맵"). */
export const translator = (lang: Lang) => (en: string, ko: string) => (lang === "ko" ? ko : en);
export type T = ReturnType<typeof translator>;
