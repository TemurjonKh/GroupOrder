import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { removeMyPick, repeatLastPick, setAnswer } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LiveRefresh } from "@/components/client-bits";
import { MembersPanel } from "@/components/members-panel";
import { RestaurantFinder } from "@/components/restaurant-finder";
import { RoundBar } from "@/components/round-bar";
import { Avatar, BrandLogo, Button, Card, DishPhoto, buttonStyles } from "@/components/ui";
import { PICK_COLUMNS, getGroupContext, getRestaurants, getUser } from "@/lib/data";
import { formatDistance, isDish, optionsLabel, restaurantsForRound, totalLabel } from "@/lib/round";
import { cuisineLabel, restaurantKinds } from "@/lib/restaurant-kind";
import { getT } from "@/lib/i18n";
import { dishName, restaurantName } from "@/lib/names";
import type { Group, Member, OrderPick, Round, Suggestion } from "@/lib/types";

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, answers, counts, mine, suggestions, members, canAnswer, isLeader } = context;
  const { t } = await getT();

  if (!round) {
    return (
      <>
        <LiveRefresh groupId={group.id} />
        <Card className="p-8 text-center text-muted">{t("The next lunch round will appear here.", "다음 점심 라운드가 여기에 표시됩니다.")}</Card>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <LiveRefresh groupId={group.id} roundId={round.id} />
      <RoundBar round={round} counts={counts} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_460px] 2xl:grid-cols-[minmax(0,1fr)_540px]">
        <div className="space-y-5">
          {round.status === "finalized" && (
            <Card className="p-5">
              <p className="font-display text-xl font-extrabold tracking-tight">{t("This round is finalized.", "이번 라운드는 확정되었습니다.")}</p>
              <p className="mt-1 text-sm text-muted">
                {isLeader ? t("Place the order, then mark it as ordered to open the next round.", "주문한 뒤 '주문 완료'를 누르면 다음 라운드가 열립니다.") : t("Your leader is placing the order.", "리더가 주문하고 있습니다.")}
              </p>
            </Card>
          )}
          <MyAnswer code={code} group={group} round={round} mine={mine} canAnswer={canAnswer} />
          {canAnswer && <RestaurantList code={code} group={group} round={round} suggestions={suggestions} members={members} />}
        </div>
        <MembersPanel answers={answers}>
          {isLeader && (
            <Link href={`/g/${code}/finalize`} className={`${buttonStyles.primary} mt-4 w-full`}>
              {round.status === "open" ? t("Review and finalize", "확인하고 확정하기") : t("Open summary", "주문 요약 보기")}
            </Link>
          )}
        </MembersPanel>
      </div>
    </div>
  );
}

async function MyAnswer({ code, group, round, mine, canAnswer }: {
  code: string; group: Group; round: Round; mine: OrderPick[]; canAnswer: boolean;
}) {
  const hidden = { code, round: round.id };
  const { lang, t } = await getT();
  const dishes = mine.filter(isDish);
  const skipped = mine.some((p) => p.status === "skipped");
  const removed = dishes.length === 0 && mine.some((p) => p.status === "removed");

  if (!canAnswer && dishes.length === 0 && !skipped) return null;

  const last = canAnswer && dishes.length === 0 ? await lastPick(group.id, round.id) : null;
  return (
    <section aria-label={t("Your answer", "내 응답")}>
      {removed && (
        <p role="alert" className="mb-3 rounded-xl bg-accent-soft p-3 text-sm font-semibold text-on-accent-soft">{t("Your leader removed your dish. Please pick again.", "리더가 메뉴를 뺐어요. 다시 골라 주세요.")}</p>
      )}
      {dishes.length > 0 ? (
        <Card className="p-4">
          <p className="text-xs font-semibold text-muted">{dishes.length === 1 ? t("Your pick", "내 메뉴") : t(`Your picks (${dishes.length})`, `내 메뉴 (${dishes.length})`)}</p>
          <ul className="mt-2 divide-y divide-line">
            {dishes.map((pick) => (
              <li key={pick.id} className="flex items-center gap-4 py-2.5 first:pt-0 last:pb-0">
                <DishPhoto src={pick.menu_item!.photo} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg leading-snug font-bold tracking-tight">{dishName(pick.menu_item!, lang)}{pick.qty > 1 && ` x${pick.qty}`}</p>
                  <p className="text-sm text-muted">
                    {[restaurantName(pick.menu_item!.restaurant, lang), optionsLabel(pick.options), pick.note, totalLabel((pick.price_at_pick ?? 0) * pick.qty, pick.price_at_pick === null ? pick.qty : 0)].filter(Boolean).join(", ")}
                  </p>
                </div>
                {canAnswer && (
                  <div className="flex shrink-0 flex-col items-end sm:flex-row sm:items-center">
                    <Link href={`/g/${code}/my-pick?line=${pick.id}`} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-on-accent-soft underline-offset-4 hover:underline">{t("Change", "변경")}</Link>
                    <ActionForm action={removeMyPick} hidden={{ ...hidden, line: pick.id }}>
                      <button aria-label={t(`Remove ${pick.menu_item!.name}`, `${dishName(pick.menu_item!, lang)} 빼기`)} className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-danger underline-offset-4 hover:underline">{t("Remove", "빼기")}</button>
                    </ActionForm>
                  </div>
                )}
              </li>
            ))}
          </ul>
          {canAnswer && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
              {t("Want something else too? Add more dishes from any restaurant below.", "더 드시고 싶나요? 아래 어느 식당에서든 메뉴를 추가하세요.")}
              {dishes.length > 1 && (() => {
                const total = dishes.reduce((sum, p) => sum + (p.price_at_pick ?? 0) * p.qty, 0);
                const unpriced = dishes.reduce((sum, p) => sum + (p.price_at_pick === null ? p.qty : 0), 0);
                return <span className="block font-semibold text-ink">{t("Your total", "내 합계")}: {totalLabel(total, unpriced)}</span>;
              })()}
            </p>
          )}
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="w-full text-sm text-muted sm:w-auto sm:flex-1">
            {skipped ? t("You are not joining today. Pick a dish if that changes.", "오늘은 불참입니다. 마음이 바뀌면 메뉴를 고르세요.") : t("Choose a restaurant below, or tell the group you are out.", "아래에서 식당을 고르거나, 불참이라고 알려 주세요.")}
          </p>
          {canAnswer && !skipped && (
            <ActionForm action={setAnswer} hidden={{ ...hidden, status: "skipped" }}>
              <Button look="secondary">{t("Not joining today", "오늘은 불참")}</Button>
            </ActionForm>
          )}
          {last && (
            <ActionForm action={repeatLastPick} hidden={{ ...hidden, pick: last.id }}>
              <Button look="secondary" className="py-2 text-left whitespace-normal">{t("Same as last time", "지난번과 같이")}: {lang === "en" ? last.name_en ?? last.name : last.name}</Button>
            </ActionForm>
          )}
        </div>
      )}
    </section>
  );
}

async function lastPick(groupId: string, roundId: string) {
  const { supabase, user } = await getUser();
  const { data } = await supabase
    .from("order_items")
    .select(`${PICK_COLUMNS}, round:order_rounds!inner(group_id, created_at)`)
    .eq("user_id", user.id)
    .eq("status", "confirmed")
    .eq("round.group_id", groupId)
    .neq("round_id", roundId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const pick = data as unknown as OrderPick | null;
  return pick?.menu_item ? { id: pick.id, name: pick.menu_item.name, name_en: pick.menu_item.name_en } : null;
}

// 4 photos on a phone, 5 up to a laptop, 7 on a wide screen. More would mean hundreds of brand
// photos per page, which slows the brands' servers and Vercel's monthly image allowance.
const SHOW_FROM: Record<number, string> = { 4: "hidden sm:block", 5: "hidden 2xl:block", 6: "hidden 2xl:block" };

async function RestaurantList({ code, group, round, suggestions, members }: {
  code: string; group: Group; round: Round; suggestions: Suggestion[]; members: Member[];
}) {
  const pinned = round.allowed_restaurant_ids;
  const { lang, t } = await getT();
  const suggesters = (id: string) => suggestions.filter((s) => s.restaurant_id === id)
    .map((s) => members.find((m) => m.user_id === s.user_id)!).filter(Boolean);
  // Suggested restaurants come first, the most suggested at the top; the rest stay nearest first.
  const restaurants = restaurantsForRound(group, await getRestaurants(), pinned)
    .map((r, i) => ({ ...r, by: suggesters(r.id), i }))
    .sort((a, b) => b.by.length - a.by.length || a.i - b.i);
  if (restaurants.length === 0) {
    return <Card className="p-5 text-sm text-muted">{t(`We have no restaurants listed near ${group.location_label} yet.`, `${group.location_label} 근처에 등록된 식당이 아직 없습니다.`)}</Card>;
  }
  return (
    <section aria-label={t("Restaurants", "식당")}>
      <h2 className="mb-3 font-display text-2xl font-extrabold tracking-tight">{pinned.length ? t("Restaurants for this round", "이번 라운드 식당") : t("Where to order from", "어디서 주문할까요")}</h2>
      <RestaurantFinder items={restaurants.map((r, i) => {
          const dishes = [...r.menu_items].sort((a, b) => a.sort_order - b.sort_order);
          const photos = dishes.filter((d) => d.photo).filter((_, n) => n % 5 === 0).slice(0, 7);
          const priced = dishes.some((d) => d.price !== null);
          return {
            id: r.id,
            text: [r.name, r.name_en, r.name_ko, r.cuisine, ...dishes.flatMap((d) => [d.name, d.name_en])].filter(Boolean).join(" ").toLowerCase(),
            kinds: restaurantKinds(r),
            card: (
            <div className="rise" style={{ "--i": Math.min(i, 8) } as React.CSSProperties}>
              <Link href={`/g/${code}/r/${r.id}`} className={`group block rounded-[20px] border bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift ${r.by.length ? "border-accent" : "border-line"}`}>
                {r.by.length > 0 && (
                  <span className="mb-3 flex items-center gap-2 text-sm font-semibold text-on-accent-soft">
                    <span className="flex -space-x-2">
                      {r.by.slice(0, 4).map((m) => <span key={m.user_id} className="rounded-xl ring-2 ring-surface"><Avatar src={m.avatar} name={m.name} size={30} /></span>)}
                    </span>
                    <span>
                      {r.by.length === 1
                        ? t(`${r.by[0].name} suggests this`, `${r.by[0].name}님의 추천`)
                        : t(`${r.by.slice(0, -1).map((m) => m.name).join(", ")} and ${r.by.at(-1)!.name} suggest this`, `${r.by.map((m) => m.name).join(", ")}님의 추천`)}
                    </span>
                  </span>
                )}
                <span className="flex items-center gap-3">
                  <BrandLogo restaurant={r} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-2xl leading-tight font-extrabold tracking-tight">{restaurantName(r, lang)}</span>
                    <span className="block text-sm text-muted">
                      {cuisineLabel(r, lang)}, {t(`${dishes.length} items`, `메뉴 ${dishes.length}개`)}
                      {!priced && t(", prices not published", ", 가격 미공개")}
                      {r.distance !== null && `, ${formatDistance(r.distance)}`}
                    </span>
                  </span>
                  <ArrowRight aria-hidden size={20} className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
                </span>
                <span aria-hidden className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5 2xl:grid-cols-7">
                  {photos.map((d, n) => (
                    <DishPhoto key={d.name} src={d.photo} sizes="(max-width: 640px) 25vw, 160px"
                      className={`aspect-square w-full ${SHOW_FROM[n] ?? ""}`} />
                  ))}
                </span>
              </Link>
            </div>
            ),
          };
        })} />
    </section>
  );
}
