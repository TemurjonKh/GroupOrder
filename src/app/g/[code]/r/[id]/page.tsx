import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ThumbsUp } from "@phosphor-icons/react/ssr";
import { suggestRestaurant } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { MenuBrowser } from "@/components/menu-browser";
import { Avatar, Button, textLink } from "@/components/ui";
import { getGroupContext, getRestaurantMenu } from "@/lib/data";
import { getT } from "@/lib/i18n";
import { isDish } from "@/lib/round";

export default async function MenuPage({ params, searchParams }: {
  params: Promise<{ code: string; id: string }>;
  searchParams: Promise<{ dish?: string }>;
}) {
  const { code, id } = await params;
  const { dish } = await searchParams;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { round, canAnswer, mine, suggestions, members, userId } = context;

  const restaurant = await getRestaurantMenu(id);
  if (!restaurant) notFound();

  const pinned = round?.allowed_restaurant_ids ?? [];
  const allowed = pinned.length === 0 || pinned.includes(id);
  const { t } = await getT();

  return (
    <div>
      <Link href={`/g/${code}`} className={`${textLink} mb-3`}><ArrowLeft aria-hidden size={16} /> {t("Back to the round", "라운드로 돌아가기")}</Link>
      {!allowed && <p role="alert" className="mb-3 rounded-xl bg-accent-soft p-3 text-sm font-semibold text-on-accent-soft">{t("The leader did not allow this restaurant for this round.", "리더가 이번 라운드에 이 식당을 허용하지 않았습니다.")}</p>}
      {!canAnswer && <p className="mb-3 rounded-xl bg-soft p-3 text-sm text-muted">{t("This round is finalized, so this menu is view only.", "라운드가 확정되어 메뉴를 볼 수만 있습니다.")}</p>}
      {round && canAnswer && allowed && (() => {
        const by = suggestions.filter((x) => x.restaurant_id === id).map((x) => members.find((m) => m.user_id === x.user_id)!).filter(Boolean);
        const mineToo = by.some((m) => m.user_id === userId);
        const others = by.filter((m) => m.user_id !== userId);
        return (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[20px] border border-line bg-surface p-3">
            {by.length > 0 && (
              <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-on-accent-soft">
                <span className="flex -space-x-2">
                  {by.slice(0, 4).map((m) => <span key={m.user_id} className="rounded-xl ring-2 ring-surface"><Avatar src={m.avatar} name={m.name} size={30} /></span>)}
                </span>
                {t(`${[...(mineToo ? ["You"] : []), ...others.map((m) => m.name)].join(", ")} ${by.length === 1 && !mineToo ? "suggests" : "suggest"} this to the group`,
                  `${[...(mineToo ? ["나"] : []), ...others.map((m) => m.name)].join(", ")}님이 그룹에 추천했습니다`)}
              </span>
            )}
            {by.length === 0 && <span className="min-w-0 flex-1 text-sm text-muted">{t("Like this place? Suggest it, and it moves to the top of everyone's list with your name.", "이 식당이 좋나요? 추천하면 내 이름과 함께 모두의 목록 맨 위에 올라갑니다.")}</span>}
            <ActionForm action={suggestRestaurant} hidden={{ code, round: round.id, restaurant: id, ...(mineToo ? { undo: "1" } : {}) }}>
              <Button look={mineToo ? "secondary" : "primary"}>
                <ThumbsUp aria-hidden size={18} weight={mineToo ? "regular" : "fill"} /> {mineToo ? t("Take back my suggestion", "추천 취소") : t("Suggest to the group", "그룹에 추천하기")}
              </Button>
            </ActionForm>
          </div>
        );
      })()}
      <MenuBrowser
        restaurant={restaurant}
        basePath={`/g/${code}/r/${id}`}
        selectedId={dish}
        code={code}
        roundId={round?.id}
        canPick={canAnswer && allowed}
        current={mine.filter(isDish)}
        submitLabel={t("Add to my picks", "내 메뉴에 추가")}
      />
    </div>
  );
}
