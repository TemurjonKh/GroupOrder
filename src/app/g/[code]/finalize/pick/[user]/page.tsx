import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { MenuBrowser } from "@/components/menu-browser";
import { BrandLogo, textLink } from "@/components/ui";
import { getGroupContext, getRestaurantMenu, getRestaurants } from "@/lib/data";
import { restaurantsForRound } from "@/lib/round";
import { getT } from "@/lib/i18n";
import { dishName, restaurantName } from "@/lib/names";

/** A leader changes a member's pick, or enters one for someone who answered in person. */
export default async function LeaderPickPage({ params, searchParams }: {
  params: Promise<{ code: string; user: string }>;
  searchParams: Promise<{ r?: string; dish?: string }>;
}) {
  const { code, user } = await params;
  const { r, dish } = await searchParams;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, answers, isLeader } = context;
  const answer = answers.find((a) => a.member.user_id === user);
  if (!isLeader || !answer) notFound();

  const path = `/g/${code}/finalize/pick/${user}`;
  const { lang, t } = await getT();
  const back = <Link href={r ? path : `/g/${code}/finalize`} className={textLink}><ArrowLeft aria-hidden size={16} /> {r ? t("All restaurants", "모든 식당") : t("Back to summary", "요약으로 돌아가기")}</Link>;
  if (!round || round.status !== "open") {
    return <div>{back}<p className="mt-2 text-muted">{t("This round is finalized, so picks can no longer change.", "라운드가 확정되어 메뉴를 더 바꿀 수 없습니다.")}</p></div>;
  }

  const current = answer.kind === "picked" ? answer.picks : [];
  const restaurants = restaurantsForRound(group, await getRestaurants(), round.allowed_restaurant_ids);
  const chosenId = r && restaurants.some((x) => x.id === r) ? r : undefined;
  const menu = chosenId ? await getRestaurantMenu(chosenId) : null;

  return (
    <div>
      {back}
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
        {current.length ? t(`Change ${answer.member.name}'s picks`, `${answer.member.name}님의 메뉴 변경`) : t(`Pick for ${answer.member.name}`, `${answer.member.name}님 대신 고르기`)}
      </h2>
      {current.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {(() => {
            const list = current.map((p) => `${dishName(p.menu_item!, lang)}${p.qty > 1 ? ` x${p.qty}` : ""}`).join(", ");
            return t(`Currently ${list}. Choosing a dish adds it, or changes it if they already have it; remove dishes from the summary. They will get a notice.`,
              `현재 메뉴: ${list}. 메뉴를 고르면 추가되고, 이미 있는 메뉴면 변경됩니다. 빼기는 요약 화면에서 하세요. 본인에게 알림이 갑니다.`);
          })()}
        </p>
      )}
      {menu ? (
        <div className="mt-5">
          <MenuBrowser
            restaurant={menu}
            basePath={`${path}?r=${menu.id}`}
            selectedId={dish}
            code={code}
            roundId={round.id}
            canPick
            current={current}
            forUser={user}
            submitLabel={t("Save pick", "메뉴 저장")}
          />
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <Link href={`${path}?r=${restaurant.id}`} className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift">
                <BrandLogo restaurant={restaurant} size={48} />
                <span className="font-display text-xl font-extrabold tracking-tight">{restaurantName(restaurant, lang)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
