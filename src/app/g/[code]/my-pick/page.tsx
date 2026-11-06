import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { setAnswer } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { PickForm } from "@/components/pick-form";
import { Button, Card, DishPhoto, buttonStyles, textLink } from "@/components/ui";
import { getGroupContext } from "@/lib/data";
import { formatKrw } from "@/lib/round";

export default async function MyPickPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { round, myPick, canAnswer } = context;
  const back = <Link href={`/g/${code}`} className={textLink}><ArrowLeft aria-hidden size={16} /> Back to the round</Link>;
  const dish = myPick?.status === "draft" || myPick?.status === "confirmed" ? myPick.menu_item : null;

  if (!round || !myPick || !dish) {
    return <div>{back}<p className="mt-2 text-muted">You have no pick in this round.</p></div>;
  }
  const hidden = { code, round: round.id };
  return (
    <div className="mx-auto max-w-lg space-y-4">
      {back}
      <Card className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <DishPhoto src={dish.photo} alt={dish.name} size={96} />
          <div className="min-w-0">
            <h2 className="font-display text-2xl leading-tight font-extrabold tracking-tight">{dish.name}</h2>
            <p className="mt-1 text-sm text-muted">{dish.restaurant.name}, {formatKrw(myPick.price_at_pick)}</p>
          </div>
        </div>
        {canAnswer ? (
          <PickForm code={code} roundId={round.id} item={dish} current={myPick} submitLabel="Save changes" />
        ) : (
          <p className="text-sm text-muted">This round is finalized, so your pick can no longer change.</p>
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
