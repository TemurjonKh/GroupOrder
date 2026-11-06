import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { repeatLastPick, setAnswer } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LiveRefresh } from "@/components/client-bits";
import { MembersPanel } from "@/components/members-panel";
import { RoundBar } from "@/components/round-bar";
import { BrandLogo, Button, Card, DishPhoto, buttonStyles } from "@/components/ui";
import { PICK_COLUMNS, getGroupContext, getRestaurants, getUser } from "@/lib/data";
import { formatDistance, optionsLabel, restaurantsForRound, totalLabel } from "@/lib/round";
import type { Group, OrderPick, Round } from "@/lib/types";

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, answers, counts, myPick, canAnswer, isLeader } = context;

  if (!round) {
    return (
      <>
        <LiveRefresh groupId={group.id} />
        <Card className="p-8 text-center text-muted">The next lunch round will appear here.</Card>
      </>
    );
  }

  return (
    <div className="space-y-5">
      <LiveRefresh groupId={group.id} roundId={round.id} />
      <RoundBar round={round} counts={counts} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {round.status === "finalized" && (
            <Card className="p-5">
              <p className="font-display text-xl font-extrabold tracking-tight">This round is finalized.</p>
              <p className="mt-1 text-sm text-muted">
                {isLeader ? "Place the order, then mark it as ordered to open the next round." : "Your leader is placing the order."}
              </p>
            </Card>
          )}
          <MyAnswer code={code} group={group} round={round} myPick={myPick} canAnswer={canAnswer} />
          {canAnswer && <RestaurantList code={code} group={group} round={round} />}
        </div>
        <MembersPanel answers={answers}>
          {isLeader && (
            <Link href={`/g/${code}/finalize`} className={`${buttonStyles.primary} mt-4 w-full`}>
              {round.status === "open" ? "Review and finalize" : "Open summary"}
            </Link>
          )}
        </MembersPanel>
      </div>
    </div>
  );
}

async function MyAnswer({ code, group, round, myPick, canAnswer }: {
  code: string; group: Group; round: Round; myPick: OrderPick | null; canAnswer: boolean;
}) {
  const hidden = { code, round: round.id };
  const hasDish = myPick?.menu_item && (myPick.status === "draft" || myPick.status === "confirmed");
  const skipped = myPick?.status === "skipped";

  if (!canAnswer && !hasDish && !skipped) return null;

  const last = canAnswer && !hasDish ? await lastPick(group.id, round.id) : null;
  return (
    <section aria-label="Your answer">
      {myPick?.status === "removed" && (
        <p role="alert" className="mb-3 rounded-xl bg-accent-soft p-3 text-sm font-semibold text-on-accent-soft">Your leader removed your dish. Please pick again.</p>
      )}
      {hasDish ? (
        <Card className="flex items-center gap-4 p-4">
          <DishPhoto src={myPick.menu_item!.photo} size={76} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-muted">Your pick</p>
            <p className="font-display text-lg leading-snug font-bold tracking-tight">{myPick.menu_item!.name}{myPick.qty > 1 && ` x${myPick.qty}`}</p>
            <p className="text-sm text-muted">
              {[optionsLabel(myPick.options), myPick.note, totalLabel((myPick.price_at_pick ?? 0) * myPick.qty, myPick.price_at_pick === null ? myPick.qty : 0)].filter(Boolean).join(", ")}
            </p>
          </div>
          {canAnswer && <Link href={`/g/${code}/my-pick`} className={buttonStyles.secondary}>Edit</Link>}
        </Card>
      ) : (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="w-full text-sm text-muted sm:w-auto sm:flex-1">
            {skipped ? "You are not joining today. Pick a dish if that changes." : "Choose a restaurant below, or tell the group you are out."}
          </p>
          {canAnswer && !skipped && (
            <ActionForm action={setAnswer} hidden={{ ...hidden, status: "skipped" }}>
              <Button look="secondary">Not joining today</Button>
            </ActionForm>
          )}
          {last && (
            <ActionForm action={repeatLastPick} hidden={{ ...hidden, pick: last.id }}>
              <Button look="secondary" className="py-2 text-left whitespace-normal">Same as last time: {last.name}</Button>
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
  return pick?.menu_item ? { id: pick.id, name: pick.menu_item.name } : null;
}

async function RestaurantList({ code, group, round }: { code: string; group: Group; round: Round }) {
  const pinned = round.allowed_restaurant_ids;
  const restaurants = restaurantsForRound(group, await getRestaurants(), pinned);
  if (restaurants.length === 0) {
    return <Card className="p-5 text-sm text-muted">We have no restaurants listed near {group.location_label} yet.</Card>;
  }
  return (
    <section>
      <h2 className="mb-3 font-display text-2xl font-extrabold tracking-tight">{pinned.length ? "Restaurants for this round" : "Where to order from"}</h2>
      <ul className="space-y-3">
        {restaurants.map((r, i) => {
          const dishes = [...r.menu_items].sort((a, b) => a.sort_order - b.sort_order);
          const photos = dishes.filter((d) => d.photo).filter((_, n) => n % 7 === 0).slice(0, 5);
          const priced = dishes.some((d) => d.price !== null);
          return (
            <li key={r.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
              <Link href={`/g/${code}/r/${r.id}`} className="group block rounded-[20px] border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift">
                <span className="flex items-center gap-3">
                  <BrandLogo restaurant={r} size={52} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-2xl leading-tight font-extrabold tracking-tight">{r.name}</span>
                    <span className="block text-sm text-muted">
                      {r.cuisine}, {dishes.length} items
                      {!priced && ", prices not published"}
                      {r.distance !== null && `, ${formatDistance(r.distance)}`}
                    </span>
                  </span>
                  <ArrowRight aria-hidden size={20} className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
                </span>
                <span aria-hidden className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {photos.map((d, n) => <DishPhoto key={d.name} src={d.photo} sizes="(max-width: 640px) 25vw, 140px" className={`aspect-square w-full ${n === 4 ? "hidden sm:block" : ""}`} />)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
