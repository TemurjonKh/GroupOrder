import type { Restaurant } from "@/lib/types";
import { textLink } from "@/components/ui";
import { getT } from "@/lib/i18n";
import { restaurantName, type Lang } from "@/lib/names";

const day = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Where a menu came from and how far to trust it, with a link to the page itself. */
/** The stored note (written in English by the importer) in the chosen language. */
function noteIn(note: string | null, site: string | null, lang: Lang) {
  if (lang === "en") return note ?? `From ${site}.`;
  const branch = /another branch \((.+?)\)/.exec(note ?? "")?.[1];
  if (branch) return `${site}에 다른 지점(${branch})이 올린 메뉴라 이 지점의 가격과 메뉴는 다를 수 있습니다.`;
  if (site === "Daangn") return "당근에 식당이 직접 올린 메뉴입니다. 모든 메뉴가 있지는 않을 수 있습니다.";
  if (site === "Polle") return "뽈레 사용자가 입력한 메뉴라 가격이 오래되었을 수 있습니다.";
  return note ?? "";
}

export async function MenuSource({ restaurant }: {
  restaurant: Pick<Restaurant, "name" | "name_en" | "name_ko" | "place_id" | "menu_source" | "menu_source_name" | "menu_note" | "menu_updated" | "menu_checked">;
}) {
  const { place_id, menu_source, menu_source_name, menu_note, menu_updated, menu_checked } = restaurant;
  const { lang, t } = await getT();
  const site = menu_source_name && lang === "ko" ? ({ Daangn: "당근", Polle: "뽈레" } as Record<string, string>)[menu_source_name] ?? menu_source_name : menu_source_name;
  const link = menu_source && /^https:\/\//.test(menu_source) && (
    <a href={menu_source} target="_blank" rel="noreferrer" className={textLink}>
      {menu_source_name ? t(`See it on ${menu_source_name}`, `${site}에서 보기`) : t("Brand site", "브랜드 사이트")}
    </a>
  );
  // A chain's menu from its own site. A franchise menu from another branch's listing says so in its note.
  if (!place_id && !menu_source_name) {
    const name = restaurantName(restaurant, lang);
    return <>{t(`From ${name}'s own site. A branch may not sell every dish.`, `${name} 공식 사이트의 메뉴입니다. 지점에 따라 없는 메뉴가 있을 수 있습니다.`)} {link}</>;
  }
  return (
    <>
      {noteIn(menu_note, site, lang)}
      {menu_updated && t(` Last changed there ${day(menu_updated)}.`, ` 마지막 수정 ${day(menu_updated)}.`)}
      {menu_checked && t(` Imported ${day(menu_checked)}.`, ` 가져온 날짜 ${day(menu_checked)}.`)}
      {" "}{t("No allergen data.", "알레르기 정보 없음.")} {link}
    </>
  );
}
