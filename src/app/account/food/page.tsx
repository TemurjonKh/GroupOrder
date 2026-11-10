import Link from "next/link";
import { saveFoodNeeds } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Field, PageTitle, buttonStyles, inputStyles } from "@/components/ui";
import { getFoodNeeds } from "@/lib/data";
import { DIETS, LABELLED, NAMED_ONLY } from "@/lib/diet";
import { safeNext } from "@/lib/url";
import { getT } from "@/lib/i18n";
import type { Lang } from "@/lib/names";

export const metadata = { title: "My food needs" };

function Choices({ title, hint, items, chosen, lang }: {
  title: string;
  hint: string;
  items: { key: string; label: string; korean: string; hint?: string }[];
  chosen: string[];
  lang: Lang;
}) {
  return (
    <fieldset>
      <legend className="font-display text-2xl font-extrabold tracking-tight">{title}</legend>
      <p className="mt-1 mb-3 max-w-[65ch] text-sm text-muted">{hint}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <label key={item.key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 transition-colors hover:border-ink has-checked:border-accent has-checked:bg-accent-soft">
            <input type="checkbox" name="avoid" value={item.key} defaultChecked={chosen.includes(item.key)} className="size-5 shrink-0 accent-(--accent)" />
            <span className="min-w-0 text-sm leading-tight font-semibold">
              {lang === "ko" ? item.korean : item.label} <span className="font-normal text-muted">{lang === "ko" ? item.label : item.korean}</span>
              {item.hint && lang === "en" && <span className="mt-0.5 block text-xs font-normal text-muted">{item.hint}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function FoodNeedsPage({ searchParams }: { searchParams: Promise<{ welcome?: string; next?: string }> }) {
  const params = await searchParams;
  const welcome = params.welcome === "1";
  const next = safeNext(params.next);
  const needs = await getFoodNeeds();
  const chosen = needs?.avoid ?? [];
  const { lang, t } = await getT();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageTitle>{welcome ? t("What can't you eat?", "못 먹는 음식이 있나요?") : t("My food needs", "내 식단 정보")}</PageTitle>
        <p className="mt-3 max-w-[65ch] text-muted">
          {t("Tick everything you avoid. Menus and the food map then mark each dish for you. Only you can see this list: your group and its leader cannot.",
            "피하는 것을 모두 체크하세요. 메뉴와 푸드맵에서 메뉴마다 표시해 드려요. 이 목록은 나만 볼 수 있고, 그룹과 리더는 볼 수 없어요.")}
        </p>
        <ActionForm action={saveFoodNeeds} hidden={welcome ? { next } : {}} className="mt-8 space-y-9">
          <Choices lang={lang} title={t("Diets", "식단")} hint={t("Each one covers the foods it rules out.", "각 식단은 제외하는 음식을 모두 포함합니다.")} items={DIETS} chosen={chosen} />
          <Choices lang={lang} title={t("Allergies and foods brands must label", "표시 의무 알레르기 유발 식품")} hint={t("Korean restaurants label these 19, so the brand's list can show them.", "한국 식당은 이 19가지를 표시해야 해서 브랜드 목록에서 확인할 수 있어요.")} items={LABELLED} chosen={chosen} />
          <Choices lang={lang} title={t("Other foods", "기타 식품")} hint={t("Brands do not have to declare these. We can only warn when a dish names them, so a dish with no warning may still contain them.", "표시 의무가 없는 식품이에요. 메뉴 이름에 있을 때만 알려 드릴 수 있어서, 경고가 없어도 들어 있을 수 있어요.")} items={NAMED_ONLY} chosen={chosen} />
          <Field label={t("Anything else?", "그 밖에 피하는 것")} hint={t("Separate with commas, for example: cilantro, kiwi. We look for these words in dish names and ingredients.", "쉼표로 구분하세요. 예: 고수, 키위. 메뉴 이름과 재료에서 찾아 드려요.")}>
            <textarea name="note" rows={2} maxLength={300} defaultValue={needs?.note ?? ""} className={`${inputStyles} py-2.5`} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button>{t("Save my food needs", "식단 정보 저장")}</Button>
            {welcome && <Link href={next} className={buttonStyles.secondary}>{t("Skip for now", "나중에 하기")}</Link>}
          </div>
        </ActionForm>
        <p className="mt-6 max-w-[65ch] text-xs leading-relaxed text-muted">
          {t("This is a guide built from what brands publish, not medical advice. Recipes change and kitchens share equipment, so with a serious allergy always confirm with the store.",
            "브랜드가 공개한 정보로 만든 안내이며 의학적 조언이 아닙니다. 레시피는 바뀔 수 있고 주방은 조리 기구를 함께 쓰므로, 알레르기가 심하다면 꼭 매장에 확인하세요.")}
        </p>
      </main>
    </>
  );
}
