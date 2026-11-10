import { CheckCircle, Question, Warning, WarningOctagon } from "@phosphor-icons/react/ssr";
import { allergenLabel, koreanLabel, type DishCheck, type DishLevel } from "@/lib/diet";
import { translator, type Lang } from "@/lib/names";
import type { MenuItem } from "@/lib/types";

const TONES: Record<DishLevel, string> = {
  avoid: "bg-danger-soft text-on-danger-soft",
  caution: "bg-warn-soft text-on-warn-soft",
  unknown: "bg-soft text-muted",
  clear: "bg-ok-soft text-on-ok-soft",
};
const ICONS = { avoid: WarningOctagon, caution: Warning, unknown: Question, clear: CheckCircle };
// Never "safe": the most the data can support is that nothing is listed.
const SHORT: Record<DishLevel, [string, string]> = {
  avoid: ["Contains", "포함"], caution: ["May contain", "포함 가능"], unknown: ["No data", "정보 없음"], clear: ["None listed", "해당 없음"],
};
const names = (labels: string[], lang: Lang) => labels.map((l) => (lang === "ko" ? koreanLabel(l) : l)).join(", ");

/** The short result on a dish tile. It carries an icon and words, so color is not the only signal. */
export function FoodBadge({ check, lang = "en" }: { check: DishCheck; lang?: Lang }) {
  const Icon = ICONS[check.level];
  const detail = check.level === "avoid" ? check.found : check.level === "caution" ? check.maybe : [];
  return (
    <span className={`inline-flex max-w-full items-start gap-1 rounded-lg px-2 py-1 text-xs leading-tight font-semibold ${TONES[check.level]}`}>
      <Icon aria-hidden size={14} weight="fill" className="shrink-0" />
      <span>{SHORT[check.level][lang === "ko" ? 1 : 0]}{detail.length > 0 && `: ${names(detail, lang)}`}</span>
    </span>
  );
}

// The parts of a set that have no allergen data, in English. All four are Burger King set parts.
const GAP_EN: Record<string, string> = {
  "코카콜라(L)": "Coca-Cola (L)", "코카콜라(R)": "Coca-Cola (R)", "프렌치프라이(L)": "French Fries (L)", "프렌치프라이(R)": "French Fries (R)",
};
const gapNames = (gaps: string[], lang: Lang) => gaps.map((g) => (lang === "en" ? GAP_EN[g] ?? g : g)).join(", ");

function headline(check: DishCheck, gaps: string[], lang: Lang) {
  const t = translator(lang);
  if (check.level === "avoid") return t(`Contains what you avoid: ${names(check.found, lang)}`, `피하는 재료 포함: ${names(check.found, lang)}`);
  if (check.level === "caution") return t(`May contain what you avoid: ${names(check.maybe, lang)}`, `피하는 재료가 들어 있을 수 있음: ${names(check.maybe, lang)}`);
  if (check.level === "unknown" && gaps.length) {
    return t(`None of your items are listed so far, but there is no data for: ${gapNames(gaps, lang)}. Ask the store.`, `지금까지는 해당 없음, 다만 정보가 없는 구성품: ${gapNames(gaps, lang)}. 매장에 확인하세요.`);
  }
  if (check.level === "unknown") return t("No allergen data for this dish. Ask the store before ordering.", "이 메뉴는 알레르기 정보가 없습니다. 주문 전에 매장에 확인하세요.");
  return t("None of your items are listed for this dish.", "이 메뉴에는 피하는 재료가 표시되어 있지 않습니다.");
}

/** Everything known about what is in a dish, and how far to trust it. */
export function DishFacts({ dish, check, local = false, lang = "en" }: {
  dish: Pick<MenuItem, "ingredients" | "contains" | "may_contain" | "allergen_source" | "allergen_note" | "allergen_gaps">;
  check: DishCheck | null;
  /** True for an independent restaurant's menu from a listing site, which has no allergen data. */
  local?: boolean;
  lang?: Lang;
}) {
  const Icon = check && ICONS[check.level];
  const t = translator(lang);
  const label = (key: string) => (lang === "ko" ? koreanLabel(allergenLabel(key)) : allergenLabel(key));
  return (
    <div className="space-y-3 text-sm">
      {check && Icon && (
        <div className={`rounded-xl p-3 ${TONES[check.level]}`}>
          <p className="flex items-start gap-2 font-semibold"><Icon aria-hidden size={18} weight="fill" className="mt-0.5 shrink-0" /> {headline(check, dish.allergen_gaps, lang)}</p>
          {(check.level === "clear" || check.level === "caution") && check.unconfirmed.length > 0 && (
            <p className="mt-1.5 text-xs">
              {local
                ? t(`The listing does not cover these, so they are not ruled out: ${check.unconfirmed.join(", ")}.`, `목록에 없는 항목이라 배제할 수 없습니다: ${names(check.unconfirmed, lang)}.`)
                : t(`Brands do not have to declare these, so they are not ruled out: ${check.unconfirmed.join(", ")}.`, `브랜드가 표시할 의무가 없는 항목이라 배제할 수 없습니다: ${names(check.unconfirmed, lang)}.`)}
            </p>
          )}
        </div>
      )}
      {dish.ingredients.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">{t("What's inside", "재료")}</h4>
          <ul className="flex flex-wrap gap-1.5">
            {dish.ingredients.map((name) => <li key={name} className="rounded-lg bg-soft px-2 py-0.5 text-xs font-medium">{name}</li>)}
          </ul>
        </div>
      )}
      {dish.ingredients.length === 0 && (
        <p className="text-muted">{local ? t("The listing gives no ingredients; the search goes by the dish name only.", "재료 정보가 없어 메뉴 이름으로만 확인합니다.") : t("The brand publishes no ingredient list for this item.", "브랜드가 이 메뉴의 재료를 공개하지 않습니다.")}</p>
      )}
      {dish.contains === null ? (
        <p className="text-muted">
          {local ? t("No allergen list: the restaurant does not publish one. Ask before ordering.", "알레르기 정보 없음: 식당이 공개하지 않습니다. 주문 전에 확인하세요.") : t("The brand publishes no allergen list for this item.", "브랜드가 이 메뉴의 알레르기 정보를 공개하지 않습니다.")}
        </p>
      ) : (
        <dl className="space-y-1.5">
          <div>
            <dt className="inline font-semibold">{t("Contains", "포함")}: </dt>
            <dd className="inline">{dish.contains.length ? dish.contains.map(label).join(", ") : t("none listed", "표시 없음")}</dd>
          </div>
          {(dish.may_contain?.length ?? 0) > 0 && (
            <div>
              <dt className="inline font-semibold">{t("May contain", "포함 가능")}: </dt>
              <dd className="inline">{dish.may_contain!.map(label).join(", ")}</dd>
            </div>
          )}
          {dish.allergen_gaps.length > 0 && (
            <div>
              <dt className="inline font-semibold">{t("No data for", "정보 없음")}: </dt>
              <dd className="inline">{gapNames(dish.allergen_gaps, lang)}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="text-xs leading-relaxed text-muted">
        {dish.allergen_note && <>{dish.allergen_note} </>}
        {dish.allergen_source && <>{t("Source", "출처")}: {dish.allergen_source}. </>}
        {t("Recipes change and kitchens share equipment. With a serious allergy, confirm with the store before you eat.", "레시피는 바뀔 수 있고 주방은 조리 기구를 함께 씁니다. 알레르기가 심하다면 드시기 전에 매장에 꼭 확인하세요.")}
      </p>
    </div>
  );
}
