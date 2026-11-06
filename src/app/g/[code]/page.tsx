import Link from "next/link";
import { notFound } from "next/navigation";
import { repeatLastPick, setAnswer } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LiveRefresh } from "@/components/client-bits";
import { MembersPanel } from "@/components/members-panel";
import { RoundBar } from "@/components/round-bar";
import { Button, Card, Circle, buttonStyles } from "@/components/ui";
import { PICK_COLUMNS, getGroupContext, getRestaurants, getUser } from "@/lib/data";
import { formatDistance, formatKrw, optionsLabel, restaurantsForRound } from "@/lib/round";
import type { Group, OrderPick, Round } from "@/lib/types";

export default async function GroupPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, state, answers, counts, myPick, canAnswer, isLeader } = context;

  if (!round || !state) {
    return (
      <>
        <LiveRefresh groupId={group.id} />
        <Card className="p-8 text-center">
          <h2 className="text-lg font-semibold">No open round</h2>
          {isLeader ? (
            <>
              <p className="mt-1 mb-4 text-muted">Start one and everyone can pick their lunch.</p>
              <Link href={`/g/${code}/start`} className={buttonStyles.primary}>Start a round</Link>
            </>
          ) : (
            <p className="mt-1 text-muted">You will see it here when your leader starts one.</p>
          )}
        </Card>
      </>
    );
  }

  return (
    <div className="space-y-4">
      <LiveRefresh groupId={group.id} roundId={round.id} />
      <RoundBar round={round} state={state} counts={counts} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {round.status === "finalized" && (
            <Card className="p-4">
              <p className="font-semibold">This round is finalized.</p>
              <p className="text-sm text-muted">
                {isLeader ? "Place the order, then mark it as ordered." : "Your leader is placing the order."}
              </p>
            </Card>
          )}
          {state === "closed" && !canAnswer && (
            <Card className="p-4">
              <p className="font-semibold">Picks are closed.</p>
              <p className="text-sm text-muted">{isLeader ? "Review the picks and finalize." : "Waiting for your leader to finalize."}</p>
            </Card>
          )}
          <MyAnswer code={code} group={group} round={round} myPick={myPick} canAnswer={canAnswer} />
          {canAnswer && <RestaurantList code={code} group={group} round={round} />}
        </div>
        <MembersPanel answers={answers}>
          {isLeader && round.status !== "ordered" && (
            <Link href={`/g/${code}/finalize`} className={`${buttonStyles.primary} mt-3 w-full`}>
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
    <Card className="p-4">
      <h2 className="mb-2 font-semibold">Your answer</h2>
      {myPick?.status === "removed" && (
        <p role="alert" className="mb-2 text-sm font-medium text-danger">Your leader removed your dish. Please pick again.</p>
      )}
      {hasDish ? (
        <div className="flex items-center gap-3">
          <Circle src={myPick.menu_item!.photo} label={myPick.menu_item!.name} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{myPick.menu_item!.name}{myPick.qty > 1 && ` x${myPick.qty}`}</p>
            <p className="truncate text-sm text-muted">
              {[optionsLabel(myPick.options), myPick.note, formatKrw(myPick.price_at_pick * myPick.qty)].filter(Boolean).join(" · ")}
            </p>
          </div>
          {canAnswer && <Link href={`/g/${code}/my-pick`} className={buttonStyles.secondary}>Edit</Link>}
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted">
          {skipped ? "You are not joining today. Pick a dish below if that changes." : "Choose a restaurant below, or tell the group you are out."}
        </p>
      )}
      {canAnswer && !hasDish && (
        <div className="flex flex-wrap gap-2">
          {!skipped && (
            <ActionForm action={setAnswer} hidden={{ ...hidden, status: "skipped" }}>
              <Button look="secondary">Not joining today</Button>
            </ActionForm>
          )}
          {last && (
            <ActionForm action={repeatLastPick} hidden={{ ...hidden, pick: last.id }}>
              <Button look="secondary">Same as last time: {last.name}</Button>
            </ActionForm>
          )}
        </div>
      )}
    </Card>
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
  const restaurants = restaurantsForRound(group, await getRestaurants(), pinned)
    .map((r) => ({ ...r, from: Math.min(...r.menu_items.map((m) => m.price)) }));
  if (restaurants.length === 0) {
    return <Card className="p-4 text-sm text-muted">We have no restaurants listed near {group.location_label} yet.</Card>;
  }
  return (
    <section>
      <h2 className="mb-2 font-semibold">{pinned.length ? "Restaurants for this round" : "Nearby restaurants"}</h2>
      <ul className="space-y-2">
        {restaurants.map((r) => (
          <li key={r.id}>
            <Link href={`/g/${code}/r/${r.id}`} className="flex min-h-11 items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-colors hover:border-accent">
              <Circle src={r.logo} label={r.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-sm text-muted">{r.cuisine} · {formatDistance(r.distance)} · from {formatKrw(r.from)}</p>
              </div>
              <span className="hidden text-sm text-muted sm:inline">View menu</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
