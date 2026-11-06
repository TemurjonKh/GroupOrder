import Link from "next/link";
import { saveFoodNeeds } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Field, PageTitle, buttonStyles, inputStyles } from "@/components/ui";
import { getFoodNeeds } from "@/lib/data";
import { DIETS, LABELLED, NAMED_ONLY } from "@/lib/diet";
import { safeNext } from "@/lib/url";

export const metadata = { title: "My food needs" };

function Choices({ title, hint, items, chosen }: {
  title: string;
  hint: string;
  items: { key: string; label: string; korean: string }[];
  chosen: string[];
}) {
  return (
    <fieldset>
      <legend className="font-display text-2xl font-extrabold tracking-tight">{title}</legend>
      <p className="mt-1 mb-3 max-w-[65ch] text-sm text-muted">{hint}</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <label key={item.key} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2 transition-colors hover:border-ink has-checked:border-accent has-checked:bg-accent-soft">
            <input type="checkbox" name="avoid" value={item.key} defaultChecked={chosen.includes(item.key)} className="size-5 shrink-0 accent-(--accent)" />
            <span className="min-w-0 text-sm leading-tight font-semibold">
              {item.label} <span className="font-normal text-muted">{item.korean}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default async function FoodNeedsPage({ searchParams }: { searchParams: Promise<{ welcome?: string; next?: string }> }) {
  const params = await searchParams;
  const welcome = params.welcome === "1";
  const next = safeNext(params.next);
  const needs = await getFoodNeeds();
  const chosen = needs?.avoid ?? [];

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <PageTitle>{welcome ? "What can't you eat?" : "My food needs"}</PageTitle>
        <p className="mt-3 max-w-[65ch] text-muted">
          Tick everything you avoid. Menus and the food map then mark each dish for you. Only you can see this list:
          your group and its leader cannot.
        </p>
        <ActionForm action={saveFoodNeeds} hidden={welcome ? { next } : {}} className="mt-8 space-y-9">
          <Choices title="Diets" hint="Each one covers the foods it rules out." items={DIETS} chosen={chosen} />
          <Choices title="Allergies and foods brands must label" hint="Korean restaurants label these 19, so the brand's list can show them." items={LABELLED} chosen={chosen} />
          <Choices title="Other foods" hint="Brands do not have to declare these. We can only warn when a dish names them, so a dish with no warning may still contain them." items={NAMED_ONLY} chosen={chosen} />
          <Field label="Anything else?" hint="Separate with commas, for example: cilantro, kiwi. We look for these words in dish names and ingredients.">
            <textarea name="note" rows={2} maxLength={300} defaultValue={needs?.note ?? ""} className={`${inputStyles} py-2.5`} />
          </Field>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Save my food needs</Button>
            {welcome && <Link href={next} className={buttonStyles.secondary}>Skip for now</Link>}
          </div>
        </ActionForm>
        <p className="mt-6 max-w-[65ch] text-xs leading-relaxed text-muted">
          This is a guide built from what brands publish, not medical advice. Recipes change and kitchens share
          equipment, so with a serious allergy always confirm with the store.
        </p>
      </main>
    </>
  );
}
