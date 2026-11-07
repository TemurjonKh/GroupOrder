import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin, PencilSimple } from "@phosphor-icons/react/ssr";
import { deleteMemberDish, saveMemberDish, saveMemberDishes } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { DishFacts, FoodBadge } from "@/components/dish-facts";
import { Button, DishPhoto, Field, PageTitle, buttonStyles, inputStyles, textLink } from "@/components/ui";
import { getFoodNeeds, getPlace } from "@/lib/data";
import { LABELLED, NAMED_ONLY, checkDish } from "@/lib/diet";
import { formatKrw } from "@/lib/round";
import type { MenuItem } from "@/lib/types";

export const metadata = { title: "Place" };

const SECTIONS = ["Main", "Side", "Drink", "Dessert", "Set"];

function AllergenBoxes({ name, chosen, legend }: { name: string; chosen: string[]; legend: string }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {[...LABELLED, ...NAMED_ONLY].map((item) => (
          <label key={item.key} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm transition-colors hover:border-ink has-checked:border-accent has-checked:bg-accent-soft">
            <input type="checkbox" name={name} value={item.key} defaultChecked={chosen.includes(item.key)} className="size-4 shrink-0 accent-(--accent)" />
            <span>{item.label} <span className="text-muted">{item.korean}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The form for a new dish, or for changing one. Allergens only count when the member checked. */
function DishForm({ placeId, dish }: { placeId: string; dish: MenuItem | null }) {
  const checked = Boolean(dish && dish.contains !== null);
  return (
    <ActionForm action={saveMemberDish} hidden={{ place: placeId, dish: dish?.id ?? "" }} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Field label="Dish name">
          <input name="name" required maxLength={80} defaultValue={dish?.name ?? ""} placeholder="순대국" className={inputStyles} />
        </Field>
        <Field label="Price in won" hint="Leave empty if you are not sure.">
          <input name="price" inputMode="numeric" defaultValue={dish?.price ?? ""} placeholder="9000" className={inputStyles} />
        </Field>
      </div>
      <Field label="Section" hint="For example Main, Side or Drink.">
        <input name="category" maxLength={40} list="dish-sections" defaultValue={dish?.category ?? "Main"} className={inputStyles} />
        <datalist id="dish-sections">{SECTIONS.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Description">
        <textarea name="description" rows={2} maxLength={300} defaultValue={dish?.description ?? ""} className={`${inputStyles} py-2.5`} />
      </Field>
      <Field label="What's inside" hint="Separate with commas, for example: 순대, 돼지 머리고기, 들깨. The search finds pork, sesame and more by these words.">
        <textarea name="ingredients" rows={2} defaultValue={dish?.ingredients.join(", ") ?? ""} className={`${inputStyles} py-2.5`} />
      </Field>
      <details open={checked} className="rounded-[20px] border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold">Allergens</summary>
        <p className="mt-2 max-w-[65ch] text-sm text-muted">
          Only fill this in if you asked the restaurant. Without that, the dish shows &quot;No data&quot;, which is
          safer than a guess. People with allergies rely on this.
        </p>
        <label className="mt-3 flex min-h-11 items-center gap-2.5 text-sm font-semibold">
          <input type="checkbox" name="checked" defaultChecked={checked} className="size-5 accent-(--accent)" />
          I checked these with the restaurant
        </label>
        <div className="mt-3 space-y-4">
          <AllergenBoxes name="contains" legend="Contains" chosen={dish?.contains ?? []} />
          <AllergenBoxes name="may_contain" legend="May contain (shared kitchen)" chosen={dish?.may_contain ?? []} />
        </div>
      </details>
      <div className="flex flex-wrap items-center gap-3">
        <Button>{dish ? "Save changes" : "Add dish"}</Button>
        {dish && <Link href={`/places/${placeId}#dish-${dish.id}`} className={buttonStyles.secondary}>Cancel</Link>}
      </div>
    </ActionForm>
  );
}

export default async function PlacePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const [found, needs] = await Promise.all([getPlace(id), getFoodNeeds()]);
  if (!found) notFound();
  const { place, menu } = found;
  const byMember = Boolean(menu?.place_id);
  const editable = !menu || byMember;
  const editing = edit && menu ? menu.menu_items.find((dish) => dish.id === edit) ?? null : null;

  const sections = new Map<string, MenuItem[]>();
  for (const dish of menu?.menu_items ?? []) sections.set(dish.category, [...(sections.get(dish.category) ?? []), dish]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/map" className={`${textLink} mb-2`}><ArrowLeft aria-hidden size={16} /> Food map</Link>
        <PageTitle>{place.name}</PageTitle>
        {place.name_en && place.name_en !== place.name && <p className="mt-1 text-muted">{place.name_en}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1"><MapPin aria-hidden size={16} weight="fill" /> {place.distance_m} m from Inha</span>
          {[place.kind, place.cuisine, place.address, place.phone, place.opening_hours].filter(Boolean).map((part) => <span key={part}>{part}</span>)}
          {place.website && /^https?:\/\//i.test(place.website) && <a href={place.website} target="_blank" rel="noreferrer" className={textLink}>Website</a>}
        </p>

        <section className="mt-8" aria-labelledby="menu-title">
          <h2 id="menu-title" className="font-display text-2xl font-extrabold tracking-tight">Menu</h2>
          {!menu && (
            <p className="mt-2 max-w-[65ch] text-muted">
              No menu yet. If you have eaten here or have the menu in front of you, add the dishes below. Everyone
              using GroupOrder can then search them and pick them in a group round.
            </p>
          )}
          {menu && !byMember && (
            <p className="mt-2 max-w-[65ch] text-sm text-muted">
              This branch serves {menu.name}&apos;s menu, from the brand&apos;s own site. A branch may not sell every dish.
              It cannot be changed here.
            </p>
          )}
          {byMember && (
            <p className="mt-2 max-w-[65ch] text-sm text-muted">
              Typed in by GroupOrder members, not by the restaurant, so prices and dishes may be out of date. Anyone
              can fix a mistake.
            </p>
          )}

          {[...sections].map(([section, dishes]) => (
            <div key={section} className="mt-5">
              <h3 className="text-sm font-semibold text-muted">{section}</h3>
              <ul className="mt-2 space-y-2">
                {dishes.map((dish) => {
                  const check = checkDish(dish, needs?.avoid ?? [], needs?.note);
                  return (
                    <li key={dish.id} id={`dish-${dish.id}`}>
                      <details className="rounded-[20px] border border-line bg-surface transition-colors open:border-ink">
                        <summary className="flex cursor-pointer list-none items-center gap-3 p-2.5 [&::-webkit-details-marker]:hidden">
                          {dish.photo && <DishPhoto src={dish.photo} size={64} />}
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm leading-snug font-semibold">{dish.name}</span>
                            <span className={`mt-0.5 block text-sm ${dish.price === null ? "text-muted" : "font-bold"}`}>{formatKrw(dish.price)}</span>
                            {check && <span className="mt-1 block"><FoodBadge check={check} /></span>}
                          </span>
                        </summary>
                        <div className="px-3.5 pb-3.5">
                          {dish.description && <p className="mb-2 text-sm text-muted">{dish.description}</p>}
                          <DishFacts dish={dish} check={check} byMember={byMember} />
                          {byMember && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Link href={`/places/${place.id}?edit=${dish.id}#dish-form`} className={buttonStyles.secondary}>
                                <PencilSimple aria-hidden size={16} /> Change
                              </Link>
                              <ActionForm action={deleteMemberDish} hidden={{ place: place.id, dish: dish.id }}>
                                <Button look="danger">Remove</Button>
                              </ActionForm>
                            </div>
                          )}
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        {editable && (
          <section id="dish-form" className="mt-10 scroll-mt-20" aria-labelledby="form-title">
            <h2 id="form-title" className="font-display text-2xl font-extrabold tracking-tight">
              {editing ? `Change ${editing.name}` : "Add a dish"}
            </h2>
            <div className="mt-4">
              <DishForm key={editing?.id ?? "new"} placeId={place.id} dish={editing} />
            </div>
            {!editing && (
              <details className="mt-6 rounded-[20px] border border-line p-4">
                <summary className="cursor-pointer text-sm font-semibold">Add several at once, from a paper menu</summary>
                <ActionForm action={saveMemberDishes} hidden={{ place: place.id }} className="mt-3 space-y-4">
                  <Field label="Dishes, one per line" hint="A name, then the price if you know it: 순대국 9000. They are added with no allergen data; open each one to add its ingredients.">
                    <textarea name="lines" rows={6} required className={`${inputStyles} py-2.5`} placeholder={"순대국 9,000\n순대 한 접시 12000\n공기밥 1000"} />
                  </Field>
                  <Field label="Section">
                    <input name="category" maxLength={40} list="dish-sections" defaultValue="Main" className={inputStyles} />
                  </Field>
                  <Button>Add these dishes</Button>
                </ActionForm>
              </details>
            )}
          </section>
        )}

        <p className="mt-10 text-xs leading-relaxed text-muted">
          Place details: © OpenStreetMap contributors. With a serious allergy, always confirm with the restaurant.
        </p>
      </main>
    </>
  );
}
