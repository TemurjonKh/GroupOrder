import { setPick } from "@/app/actions";
import { ActionForm } from "./action-form";
import { Button, Field, inputStyles } from "./ui";
import type { MenuItem, OrderPick } from "@/lib/types";

/** Choices for one dish. Used on the menu (new pick) and on My pick (editing). */
export function PickForm({ code, roundId, item, current, submitLabel }: {
  code: string;
  roundId: string;
  item: MenuItem;
  current?: OrderPick | null;
  submitLabel: string;
}) {
  return (
    <ActionForm action={setPick} hidden={{ code, round: roundId, item: item.id }} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
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
      </div>
      <Field label="Note (optional)">
        <input name="note" maxLength={200} defaultValue={current?.note ?? ""} placeholder="No onions" className={inputStyles} />
      </Field>
      <Button>{submitLabel}</Button>
    </ActionForm>
  );
}
