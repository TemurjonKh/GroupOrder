import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { MenuBrowser } from "@/components/menu-browser";
import { textLink } from "@/components/ui";
import { getGroupContext, getRestaurantMenu } from "@/lib/data";
import { isDish } from "@/lib/round";

export default async function MenuPage({ params, searchParams }: {
  params: Promise<{ code: string; id: string }>;
  searchParams: Promise<{ dish?: string }>;
}) {
  const { code, id } = await params;
  const { dish } = await searchParams;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { round, canAnswer, mine } = context;

  const restaurant = await getRestaurantMenu(id);
  if (!restaurant) notFound();

  const pinned = round?.allowed_restaurant_ids ?? [];
  const allowed = pinned.length === 0 || pinned.includes(id);

  return (
    <div>
      <Link href={`/g/${code}`} className={`${textLink} mb-3`}><ArrowLeft aria-hidden size={16} /> Back to the round</Link>
      {!allowed && <p role="alert" className="mb-3 rounded-xl bg-accent-soft p-3 text-sm font-semibold text-on-accent-soft">The leader did not allow this restaurant for this round.</p>}
      {!canAnswer && <p className="mb-3 rounded-xl bg-soft p-3 text-sm text-muted">This round is finalized, so this menu is view only.</p>}
      <MenuBrowser
        restaurant={restaurant}
        basePath={`/g/${code}/r/${id}`}
        selectedId={dish}
        code={code}
        roundId={round?.id}
        canPick={canAnswer && allowed}
        current={mine.filter(isDish)}
        submitLabel="Add to my picks"
      />
    </div>
  );
}
