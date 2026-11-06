import { CheckCircle, Question, Warning, WarningOctagon } from "@phosphor-icons/react/ssr";
import { allergenLabel, type DishCheck, type DishLevel } from "@/lib/diet";
import type { MenuItem } from "@/lib/types";

const TONES: Record<DishLevel, string> = {
  avoid: "bg-danger-soft text-on-danger-soft",
  caution: "bg-warn-soft text-on-warn-soft",
  unknown: "bg-soft text-muted",
  clear: "bg-ok-soft text-on-ok-soft",
};
const ICONS = { avoid: WarningOctagon, caution: Warning, unknown: Question, clear: CheckCircle };
// Never "safe": the most the data can support is that nothing is listed.
const SHORT: Record<DishLevel, string> = { avoid: "Contains", caution: "May contain", unknown: "No data", clear: "None listed" };

/** The short result on a dish tile. It carries an icon and words, so color is not the only signal. */
export function FoodBadge({ check }: { check: DishCheck }) {
  const Icon = ICONS[check.level];
  const detail = check.level === "avoid" ? check.found : check.level === "caution" ? check.maybe : [];
  return (
    <span className={`inline-flex max-w-full items-start gap-1 rounded-lg px-2 py-1 text-xs leading-tight font-semibold ${TONES[check.level]}`}>
      <Icon aria-hidden size={14} weight="fill" className="shrink-0" />
      <span>{SHORT[check.level]}{detail.length > 0 && `: ${detail.join(", ")}`}</span>
    </span>
  );
}

function headline(check: DishCheck, gaps: string[]) {
  if (check.level === "avoid") return `Contains what you avoid: ${check.found.join(", ")}`;
  if (check.level === "caution") return `May contain what you avoid: ${check.maybe.join(", ")}`;
  if (check.level === "unknown" && gaps.length) return `None of your items are listed so far, but there is no data for: ${gaps.join(", ")}. Ask the store.`;
  if (check.level === "unknown") return "No allergen data for this dish. Ask the store before ordering.";
  return "None of your items are listed for this dish.";
}

/** Everything known about what is in a dish, and how far to trust it. */
export function DishFacts({ dish, check }: {
  dish: Pick<MenuItem, "ingredients" | "contains" | "may_contain" | "allergen_source" | "allergen_note" | "allergen_gaps">;
  check: DishCheck | null;
}) {
  const Icon = check && ICONS[check.level];
  return (
    <div className="space-y-3 text-sm">
      {check && Icon && (
        <div className={`rounded-xl p-3 ${TONES[check.level]}`}>
          <p className="flex items-start gap-2 font-semibold"><Icon aria-hidden size={18} weight="fill" className="mt-0.5 shrink-0" /> {headline(check, dish.allergen_gaps)}</p>
          {check.level !== "avoid" && check.unconfirmed.length > 0 && (
            <p className="mt-1.5 text-xs">Brands do not have to declare these, so they are not ruled out: {check.unconfirmed.join(", ")}.</p>
          )}
        </div>
      )}
      {dish.ingredients.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">What&apos;s inside</h4>
          <ul className="flex flex-wrap gap-1.5">
            {dish.ingredients.map((name) => <li key={name} className="rounded-lg bg-soft px-2 py-0.5 text-xs font-medium">{name}</li>)}
          </ul>
        </div>
      )}
      {dish.ingredients.length === 0 && <p className="text-muted">The brand publishes no ingredient list for this item.</p>}
      {dish.contains === null ? (
        <p className="text-muted">The brand publishes no allergen list for this item.</p>
      ) : (
        <dl className="space-y-1.5">
          <div>
            <dt className="inline font-semibold">Contains: </dt>
            <dd className="inline">{dish.contains.length ? dish.contains.map(allergenLabel).join(", ") : "none listed"}</dd>
          </div>
          {(dish.may_contain?.length ?? 0) > 0 && (
            <div>
              <dt className="inline font-semibold">May contain: </dt>
              <dd className="inline">{dish.may_contain!.map(allergenLabel).join(", ")}</dd>
            </div>
          )}
          {dish.allergen_gaps.length > 0 && (
            <div>
              <dt className="inline font-semibold">No data for: </dt>
              <dd className="inline">{dish.allergen_gaps.join(", ")}</dd>
            </div>
          )}
        </dl>
      )}
      <p className="text-xs leading-relaxed text-muted">
        {dish.allergen_note && <>{dish.allergen_note} </>}
        {dish.allergen_source && <>Source: {dish.allergen_source}. </>}
        Recipes change and kitchens share equipment. With a serious allergy, confirm with the store before you eat.
      </p>
    </div>
  );
}
