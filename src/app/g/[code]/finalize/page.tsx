import Link from "next/link";
import { notFound } from "next/navigation";
import { finalizeRound, markOrdered, remindNoAnswer, removePick } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LiveRefresh } from "@/components/client-bits";
import { OrderSummary } from "@/components/order-summary";
import { RoundBar } from "@/components/round-bar";
import { Button, Card, buttonStyles } from "@/components/ui";
import { getGroupContext } from "@/lib/data";
import { buildSummary, formatKrw } from "@/lib/round";

export default async function FinalizePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, state, answers, counts, isLeader } = context;

  if (!isLeader) return <p className="text-muted">Only a group leader can finalize a round.</p>;
  if (!round || !state) {
    return (
      <Card className="p-8 text-center">
        <p className="mb-4 text-muted">There is no round to finalize.</p>
        <Link href={`/g/${code}/start`} className={buttonStyles.primary}>Start a round</Link>
      </Card>
    );
  }

  const hidden = { code, round: round.id };
  const summaries = buildSummary(answers);
  const open = round.status === "open";
  const missing = answers.filter((a) => a.kind === "no_answer");
  const skipped = answers.filter((a) => a.kind === "skipped");
  const grandTotal = summaries.reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="space-y-4">
      <LiveRefresh groupId={group.id} roundId={round.id} />
      <RoundBar round={round} state={state} counts={counts} />

      <Card className="flex flex-wrap items-start gap-2 p-4">
        {open && missing.length > 0 && (
          <ActionForm action={remindNoAnswer} hidden={hidden}>
            <Button look="secondary">Remind {missing.length} with no answer</Button>
          </ActionForm>
        )}
        {open && (
          <ActionForm action={finalizeRound} hidden={hidden}>
            <Button>Finalize{missing.length > 0 && ` without ${missing.length}`}</Button>
          </ActionForm>
        )}
        {round.status === "finalized" && (
          <ActionForm action={markOrdered} hidden={hidden}>
            <Button>Mark as ordered</Button>
          </ActionForm>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <section aria-label="Order per restaurant" className="space-y-3">
          {summaries.length === 0 && <Card className="p-6 text-center text-muted">No picks yet.</Card>}
          {summaries.map((summary) => (
            <OrderSummary
              key={summary.restaurant.id}
              summary={summary}
              roundTitle={round.title}
              personAction={open ? (userId) => (
                <ActionForm action={removePick} hidden={{ ...hidden, user: userId }}>
                  <button className="min-h-11 cursor-pointer px-2 font-medium text-danger underline">Remove</button>
                </ActionForm>
              ) : undefined}
            />
          ))}
          {summaries.length > 1 && <p className="text-right font-semibold">All restaurants: {formatKrw(grandTotal)}</p>}
        </section>
        <aside className="space-y-3">
          <NameList title="No answer" names={missing.map((a) => a.member.name)} />
          <NameList title="Not joining" names={skipped.map((a) => a.member.name)} />
        </aside>
      </div>
    </div>
  );
}

function NameList({ title, names }: { title: string; names: string[] }) {
  return (
    <Card className="p-4">
      <h3 className="font-semibold">{title} ({names.length})</h3>
      {names.length > 0 && <ul className="mt-1 text-sm text-muted">{names.map((n, i) => <li key={`${n}${i}`}>{n}</li>)}</ul>}
    </Card>
  );
}
