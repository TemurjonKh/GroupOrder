import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { removeMyPick, setAnswer } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { PickForm } from "@/components/pick-form";
import { Button, Card, DishPhoto, buttonStyles, textLink } from "@/components/ui";
import { getGroupContext } from "@/lib/data";
import { formatKrw, isDish } from "@/lib/round";
import { getT } from "@/lib/i18n";
import { dishName, restaurantName } from "@/lib/names";

/** Changes one of the caller's dishes: quantity, options or note. */
export default async function MyPickPage({ params, searchParams }: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ line?: string }>;
}) {
  const { code } = await params;
  const { line } = await searchParams;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { round, mine, canAnswer } = context;
  const { lang, t } = await getT();
  const back = <Link href={`/g/${code}`} className={textLink}><ArrowLeft aria-hidden size={16} /> {t("Back to the round", "라운드로 돌아가기")}</Link>;
  const dishes = mine.filter(isDish);
  const myPick = dishes.find((p) => p.id === line) ?? dishes[0];
  const dish = myPick?.menu_item ?? null;

  if (!round || !myPick || !dish) {
    return <div>{back}<p className="mt-2 text-muted">{t("You have no pick in this round.", "이번 라운드에 고른 메뉴가 없습니다.")}</p></div>;
  }
  const hidden = { code, round: round.id };
  return (
    <div className="mx-auto max-w-lg space-y-4">
      {back}
      <Card className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <DishPhoto src={dish.photo} alt={dishName(dish, lang)} size={96} />
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight">{dishName(dish, lang)}</h2>
            <p className="mt-1 text-sm text-muted">{restaurantName(dish.restaurant, lang)}, {formatKrw(myPick.price_at_pick, lang)}</p>
          </div>
        </div>
        {canAnswer ? (
          <PickForm code={code} roundId={round.id} item={dish} current={myPick} submitLabel={t("Save changes", "변경 저장")} />
        ) : (
          <p className="text-sm text-muted">{t("This round is finalized, so your pick can no longer change.", "라운드가 확정되어 더 이상 바꿀 수 없습니다.")}</p>
        )}
      </Card>
      {canAnswer && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/g/${code}`} className={buttonStyles.secondary}>{t("Add another dish", "메뉴 더 추가")}</Link>
          <ActionForm action={removeMyPick} hidden={{ ...hidden, line: myPick.id }}>
            <Button look="secondary">{t("Remove this dish", "이 메뉴 빼기")}</Button>
          </ActionForm>
          <ActionForm action={setAnswer} hidden={{ ...hidden, status: "skipped" }}>
            <Button look="secondary">{t("Not joining today", "오늘은 불참")}</Button>
          </ActionForm>
          <ActionForm action={setAnswer} hidden={{ ...hidden, status: "cancelled" }}>
            <Button look="danger">{t("Cancel all my picks", "내 메뉴 모두 취소")}</Button>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
