import Link from "next/link";
import { notFound } from "next/navigation";
import { finalizeRound, markOrdered, remindNoAnswer, removePick } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LiveRefresh } from "@/components/client-bits";
import { OrderSummary } from "@/components/order-summary";
import { RoundBar } from "@/components/round-bar";
import { Button, Card } from "@/components/ui";
import { getGroupContext } from "@/lib/data";
import { buildSummary, totalLabel } from "@/lib/round";

export default async function FinalizePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, answers, counts, isLeader } = context;

  if (!isLeader) return <p className="text-muted">Only a group leader can finalize a round.</p>;
  if (!round) return <Card className="p-8 text-center text-muted">There is no round to finalize.</Card>;

  const hidden = { code, round: round.id };
  const summaries = buildSummary(answers);
  const open = round.status === "open";
  const missing = answers.filter((a) => a.kind === "no_answer");
  const skipped = answers.filter((a) => a.kind === "skipped");
  const grandTotal = summaries.reduce((sum, s) => sum + s.total, 0);
  const grandUnpriced = summaries.reduce((sum, s) => sum + s.unpriced, 0);

  return (
    <div className="space-y-5">
      <LiveRefresh groupId={group.id} roundId={round.id} />
      <RoundBar round={round} counts={counts} />

      <div className="flex flex-wrap items-start gap-2">
        {open && (
          <ActionForm action={finalizeRound} hidden={hidden}>
            <Button>Finalize{missing.length > 0 && ` without ${missing.length}`}</Button>
          </ActionForm>
        )}
        {open && missing.length > 0 && (
          <ActionForm action={remindNoAnswer} hidden={hidden}>
            <Button look="secondary">Remind {missing.length} with no answer</Button>
          </ActionForm>
        )}
        {round.status === "finalized" && (
          <ActionForm action={markOrdered} hidden={hidden}>
            <Button>Mark as ordered</Button>
          </ActionForm>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Order per restaurant" className="space-y-3">
          {summaries.length === 0 && <Card className="p-8 text-center text-muted">No picks yet.</Card>}
          {summaries.map((summary) => (
            <OrderSummary
              key={summary.restaurant.id}
              summary={summary}
              roundTitle={round.title}
              personAction={open ? (userId) => (
                <>
                  <Link href={`/g/${code}/finalize/pick/${userId}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-on-accent-soft underline-offset-4 hover:underline">Edit</Link>
                  <ActionForm action={removePick} hidden={{ ...hidden, user: userId }}>
                    <button className="min-h-11 cursor-pointer px-2 font-semibold text-danger underline-offset-4 hover:underline">Remove</button>
                  </ActionForm>
                </>
              ) : undefined}
            />
          ))}
          {summaries.length > 1 && (
            <p className="px-1 text-right font-display text-xl font-extrabold tracking-tight">All restaurants: {totalLabel(grandTotal, grandUnpriced)}</p>
          )}
        </section>
        <aside className="space-y-3">
          <NameList
            title="No answer"
            names={missing.map((a) => a.member.name)}
            hint={open && missing.length > 0 ? "Tap a name to pick for them." : undefined}
            hrefs={open ? missing.map((a) => `/g/${code}/finalize/pick/${a.member.user_id}`) : undefined}
          />
          <NameList title="Not joining" names={skipped.map((a) => a.member.name)} />
        </aside>
      </div>
    </div>
  );
}

function NameList({ title, names, hrefs, hint }: { title: string; names: string[]; hrefs?: string[]; hint?: string }) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg font-extrabold tracking-tight">{title} ({names.length})</h3>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {names.length > 0 && (
        <ul className="mt-1 text-sm text-muted">
          {names.map((name, i) => (
            <li key={`${name}${i}`}>
              {hrefs ? <Link href={hrefs[i]} className="inline-flex min-h-11 items-center font-semibold text-on-accent-soft underline underline-offset-4">{name}</Link> : name}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
