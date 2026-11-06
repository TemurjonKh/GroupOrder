import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { MenuBrowser } from "@/components/menu-browser";
import { BrandLogo, textLink } from "@/components/ui";
import { getGroupContext, getRestaurantMenu, getRestaurants } from "@/lib/data";
import { restaurantsForRound } from "@/lib/round";

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
  const back = <Link href={r ? path : `/g/${code}/finalize`} className={textLink}><ArrowLeft aria-hidden size={16} /> {r ? "All restaurants" : "Back to summary"}</Link>;
  if (!round || round.status !== "open") {
    return <div>{back}<p className="mt-2 text-muted">This round is finalized, so picks can no longer change.</p></div>;
  }

  const current = answer.kind === "picked" ? answer.pick : null;
  const restaurants = restaurantsForRound(group, await getRestaurants(), round.allowed_restaurant_ids);
  const chosenId = r && restaurants.some((x) => x.id === r) ? r : undefined;
  const menu = chosenId ? await getRestaurantMenu(chosenId) : null;

  return (
    <div>
      {back}
      <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight">
        {current ? `Change ${answer.member.name}'s pick` : `Pick for ${answer.member.name}`}
      </h2>
      {current && <p className="mt-1 text-sm text-muted">Currently {current.menu_item!.name}. They will get a notice about the change.</p>}
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
            submitLabel="Save pick"
          />
        </div>
      ) : (
        <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <li key={restaurant.id}>
              <Link href={`${path}?r=${restaurant.id}`} className="flex items-center gap-3 rounded-[20px] border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift">
                <BrandLogo restaurant={restaurant} size={48} />
                <span className="font-display text-xl font-extrabold tracking-tight">{restaurant.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
