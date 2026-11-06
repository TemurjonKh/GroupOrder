import Link from "next/link";
import { notFound } from "next/navigation";
import { PickForm } from "@/components/pick-form";
import { Card, Circle } from "@/components/ui";
import { getGroupContext, getUser } from "@/lib/data";
import { formatKrw } from "@/lib/round";
import type { MenuItem, Restaurant } from "@/lib/types";

export default async function MenuPage({ params }: { params: Promise<{ code: string; id: string }> }) {
  const { code, id } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { round, canAnswer, myPick } = context;

  const { supabase } = await getUser();
  const { data } = await supabase.from("restaurants").select("*, menu_items(*)").eq("id", id).maybeSingle();
  const restaurant = data as (Restaurant & { menu_items: MenuItem[] }) | null;
  if (!restaurant) notFound();

  const pinned = round?.allowed_restaurant_ids ?? [];
  const allowed = pinned.length === 0 || pinned.includes(id);
  const dishes = [...restaurant.menu_items].sort((a, b) => a.price - b.price);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/g/${code}`} className="inline-flex min-h-11 items-center text-sm font-medium text-accent underline">Back to restaurants</Link>
      <div className="flex items-center gap-3">
        <Circle src={restaurant.logo} label={restaurant.name} size={52} />
        <div>
          <h2 className="text-lg font-semibold">{restaurant.name}</h2>
          <p className="text-sm text-muted">{restaurant.cuisine}{restaurant.address && ` · ${restaurant.address}`}</p>
        </div>
      </div>
      {!allowed && <p role="alert" className="text-sm font-medium text-danger">The leader did not allow this restaurant for this round.</p>}
      {!canAnswer && <p className="text-sm text-muted">There is no open round, so this menu is view only.</p>}
      <ul className="space-y-2">
        {dishes.map((dish) => (
          <li key={dish.id}>
            <Card>
              {round && canAnswer && allowed ? (
                <details>
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
                    <DishHeader dish={dish} />
                    <span className="text-sm font-semibold text-accent">Choose</span>
                  </summary>
                  <div className="border-t border-line p-3">
                    <PickForm code={code} roundId={round.id} item={dish} submitLabel="Add to my pick"
                      current={myPick?.menu_item?.id === dish.id ? myPick : null} />
                  </div>
                </details>
              ) : (
                <div className="flex items-center gap-3 p-3"><DishHeader dish={dish} /></div>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DishHeader({ dish }: { dish: MenuItem }) {
  return (
    <>
      <Circle src={dish.photo} label={dish.name} size={48} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{dish.name}</span>
        <span className="block text-sm text-muted">{formatKrw(dish.price)}</span>
      </span>
    </>
  );
}
