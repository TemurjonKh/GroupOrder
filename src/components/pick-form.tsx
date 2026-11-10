import { leaderSetPick, setPick } from "@/app/actions";
import { ActionForm } from "./action-form";
import { getT } from "@/lib/i18n";
import { Button, Field, inputStyles } from "./ui";
import type { MenuItem, OrderPick } from "@/lib/types";

/** Choices for one dish. Used for a new pick, for editing, and by a leader for someone else. */
export async function PickForm({ code, roundId, item, current, submitLabel, forUser, elsewhere = [] }: {
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
  const { t } = await getT();
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
      <Field label={t("Quantity", "수량")}>
        <input name="qty" type="number" min={1} max={20} defaultValue={current?.qty ?? 1} className={inputStyles} />
      </Field>
      <Field label={t("Note (optional)", "요청 사항 (선택)")}>
        <input name="note" maxLength={200} defaultValue={current?.note ?? ""} placeholder={t("No pickles", "피클 빼 주세요")} className={inputStyles} />
      </Field>
      {elsewhere.length > 0 ? (
        <div role="group" aria-label={t("Add or replace", "추가 또는 교체")} className="space-y-3 rounded-xl bg-accent-soft p-3.5 text-sm text-on-accent-soft">
          <p>
            {t("You already picked", "이미 고른 메뉴:")} <strong>{elsewhere.map((d) => `${d.name} (${d.restaurant})`).join(", ")}</strong>.{" "}
            {t(`Add this as well, or replace ${elsewhere.length === 1 ? "it" : "them"}?`, "이 메뉴를 추가할까요, 아니면 교체할까요?")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button name="mode" value="add" className="w-full">{t("Add it too", "함께 추가")}</Button>
            <Button name="mode" value="replace" look="secondary" className="w-full">{t(`Replace my ${elsewhere.length === 1 ? "pick" : "picks"}`, "기존 메뉴 교체")}</Button>
          </div>
        </div>
      ) : (
        <Button className="w-full">{submitLabel}</Button>
      )}
    </ActionForm>
  );
}
