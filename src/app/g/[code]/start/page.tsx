import { notFound } from "next/navigation";
import { startRound } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, inputStyles } from "@/components/ui";
import { getGroupContext, getRestaurants } from "@/lib/data";
import { distanceMeters, formatDistance } from "@/lib/round";

export default async function StartRoundPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, isLeader } = context;
  if (!isLeader) return <p className="text-muted">Only a group leader can start a round.</p>;

  const restaurants = (await getRestaurants())
    .map((r) => ({ ...r, distance: distanceMeters(group, r) }))
    .sort((a, b) => a.distance - b.distance);

  return (
    <Card className="mx-auto max-w-lg p-5">
      <h2 className="mb-4 text-lg font-semibold">Start a round</h2>
      <ActionForm action={startRound} hidden={{ code, group: group.id }} className="space-y-4">
        <Field label="Title"><input name="title" required maxLength={80} defaultValue="Team lunch" className={inputStyles} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Closes at (today)">
            <input name="time" type="time" required defaultValue={group.default_deadline.slice(0, 5)} className={inputStyles} />
          </Field>
          <Field label="How">
            <select name="mode" defaultValue="delivery" className={inputStyles}>
              <option value="delivery">Delivery</option>
              <option value="pickup">Pickup</option>
              <option value="dine-in">Dine-in</option>
            </select>
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Restaurants</legend>
          <p className="mb-2 text-sm text-muted">Pin up to 3, or leave all empty to allow any nearby.</p>
          <div className="space-y-1">
            {restaurants.map((r) => (
              <label key={r.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="restaurants" value={r.id} defaultChecked={group.default_restaurant_ids.includes(r.id)} className="size-5" />
                <span>{r.name} <span className="text-muted">· {formatDistance(r.distance)}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button>Start round</Button>
      </ActionForm>
    </Card>
  );
}
