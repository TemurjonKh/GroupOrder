import Link from "next/link";
import { notFound } from "next/navigation";
import { PickForm } from "@/components/pick-form";
import { Card, Circle } from "@/components/ui";
import { getGroupContext, getUser } from "@/lib/data";
import { formatKrw, restaurantsForRound } from "@/lib/round";
import type { MenuItem, Restaurant } from "@/lib/types";

/** A leader changes a member's pick, or enters one for someone who answered in person. */
export default async function LeaderPickPage({ params }: { params: Promise<{ code: string; user: string }> }) {
  const { code, user } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, answers, isLeader } = context;
  const answer = answers.find((a) => a.member.user_id === user);
  if (!isLeader || !answer) notFound();

  const back = <Link href={`/g/${code}/finalize`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline">Back to summary</Link>;
  if (!round || round.status !== "open") {
    return <div>{back}<p className="text-muted">This round is finalized, so picks can no longer change.</p></div>;
  }

  const { supabase } = await getUser();
  const { data } = await supabase.from("restaurants").select("*, menu_items(*)");
  const restaurants = restaurantsForRound(
    group,
    (data ?? []) as (Restaurant & { menu_items: MenuItem[] })[],
    round.allowed_restaurant_ids,
  );
  const current = answer.kind === "picked" ? answer.pick : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {back}
      <h2 className="text-lg font-semibold">
        {current ? `Change ${answer.member.name}'s pick` : `Pick for ${answer.member.name}`}
      </h2>
      {current && <p className="text-sm text-muted">Currently: {current.menu_item!.name}. They will get a notice about the change.</p>}
      {restaurants.map((restaurant) => (
        <section key={restaurant.id}>
          <h3 className="mb-2 flex items-center gap-2 font-medium">
            <Circle src={restaurant.logo} label={restaurant.name} size={28} /> {restaurant.name}
          </h3>
          <ul className="space-y-2">
            {[...restaurant.menu_items].sort((a, b) => a.price - b.price).map((dish) => (
              <li key={dish.id}>
                <Card>
                  <details open={current?.menu_item?.id === dish.id}>
                    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                      <Circle src={dish.photo} label={dish.name} size={40} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{dish.name}</span>
                        <span className="block text-sm text-muted">{formatKrw(dish.price)}</span>
                      </span>
                      <span className="text-sm font-semibold text-accent">Choose</span>
                    </summary>
                    <div className="border-t border-line p-3">
                      <PickForm code={code} roundId={round.id} item={dish} forUser={user} submitLabel="Save pick"
                        current={current?.menu_item?.id === dish.id ? current : null} />
                    </div>
                  </details>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
