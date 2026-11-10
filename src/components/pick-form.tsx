import { leaderSetPick, setPick } from "@/app/actions";
import { ActionForm } from "./action-form";
import { Button, Field, inputStyles } from "./ui";
import type { MenuItem, OrderPick } from "@/lib/types";

/** Choices for one dish. Used for a new pick, for editing, and by a leader for someone else. */
export function PickForm({ code, roundId, item, current, submitLabel, forUser, elsewhere = [] }: {
  code: string;
  roundId: string;
  item: MenuItem;
  current?: OrderPick | null;
  submitLabel: string;
  /** Set when a leader is picking on someone's behalf. */
  forUser?: string;
  /** The person's dishes from other restaurants: they are asked whether to add this one or replace them. */
  elsewhere?: { name: string; restaurant: string }[];
}) {
  return (
    <ActionForm
      action={forUser ? leaderSetPick : setPick}
      hidden={{ code, round: roundId, item: item.id, ...(forUser ? { user: forUser } : {}) }}
      className="space-y-4"
    >
      {item.options.map((option) => (
        <Field key={option.name} label={option.name}>
          <select name={`option:${option.name}`} defaultValue={current?.options[option.name]} className={inputStyles}>
            {option.choices.map((choice) => <option key={choice}>{choice}</option>)}
          </select>
        </Field>
      ))}
      <Field label="Quantity">
        <input name="qty" type="number" min={1} max={20} defaultValue={current?.qty ?? 1} className={inputStyles} />
      </Field>
      <Field label="Note (optional)">
        <input name="note" maxLength={200} defaultValue={current?.note ?? ""} placeholder="No pickles" className={inputStyles} />
      </Field>
      {elsewhere.length > 0 ? (
        <div role="group" aria-label="Add or replace" className="space-y-3 rounded-xl bg-accent-soft p-3.5 text-sm text-on-accent-soft">
          <p>
            You already picked <strong>{elsewhere.map((d) => `${d.name} (${d.restaurant})`).join(", ")}</strong>.
            Add this as well, or replace {elsewhere.length === 1 ? "it" : "them"}?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button name="mode" value="add" className="w-full">Add it too</Button>
            <Button name="mode" value="replace" look="secondary" className="w-full">Replace my {elsewhere.length === 1 ? "pick" : "picks"}</Button>
          </div>
        </div>
      ) : (
        <Button className="w-full">{submitLabel}</Button>
      )}
    </ActionForm>
  );
}
