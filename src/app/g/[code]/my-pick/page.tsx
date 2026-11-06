import Link from "next/link";
import { notFound } from "next/navigation";
import { setAnswer } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { PickForm } from "@/components/pick-form";
import { Button, Card, Circle, buttonStyles } from "@/components/ui";
import { getGroupContext } from "@/lib/data";
import { formatKrw } from "@/lib/round";

export default async function MyPickPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { round, myPick, canAnswer } = context;
  const back = <Link href={`/g/${code}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline">Back to the round</Link>;
  const dish = myPick?.status === "draft" || myPick?.status === "confirmed" ? myPick.menu_item : null;

  if (!round || !myPick || !dish) {
    return <div>{back}<p className="text-muted">You have no pick in this round.</p></div>;
  }
  const hidden = { code, round: round.id };
  return (
    <div className="mx-auto max-w-lg space-y-4">
      {back}
      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <Circle src={dish.photo} label={dish.name} size={56} />
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{dish.name}</h2>
            <p className="truncate text-sm text-muted">{dish.restaurant.name} · {formatKrw(myPick.price_at_pick)}</p>
          </div>
        </div>
        {canAnswer ? (
          <PickForm code={code} roundId={round.id} item={dish} current={myPick} submitLabel="Save changes" />
        ) : (
          <p className="text-sm text-muted">This round is closed, so your pick can no longer change.</p>
        )}
      </Card>
      {canAnswer && (
        <div className="flex flex-wrap gap-2">
          <Link href={`/g/${code}`} className={buttonStyles.secondary}>Choose another dish</Link>
          <ActionForm action={setAnswer} hidden={{ ...hidden, status: "skipped" }}>
            <Button look="secondary">Not joining today</Button>
          </ActionForm>
          <ActionForm action={setAnswer} hidden={{ ...hidden, status: "cancelled" }}>
            <Button look="danger">Cancel my pick</Button>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
