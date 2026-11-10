import { NOTE_TEXT } from "@/lib/notifications";
import Link from "next/link";
import { ArrowRight, Carrot, MapTrifold, X } from "@phosphor-icons/react/ssr";
import { dismissNotification } from "./actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { DishPhoto, Tag, buttonStyles } from "@/components/ui";
import { getFoodNeeds, getShowcase, getUser } from "@/lib/data";

type GroupRow = {
  id: string; name: string; icon: string; invite_code: string;
  group_members: { count: number }[];
  order_rounds: {
    title: string;
    order_items: { status: string; menu_item: { name: string; photo: string | null } | null }[];
  }[];
};
type Note = {
  id: string; type: string;
  round: { title: string; group: { name: string; invite_code: string } | null } | null;
};

const TURNS = ["-8deg", "5deg", "-4deg", "7deg", "-6deg"];
const MAX_THUMBS = 5;

export default async function HomePage() {
  const { supabase, user } = await getUser();
  const [{ data: groups }, { data: notes }, { data: profile }, dishes, needs] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, icon, invite_code, group_members(count), order_rounds(title, order_items(status, menu_item:menu_items(name, photo)))")
      .eq("order_rounds.status", "open")
      .order("created_at"),
    supabase
      .from("notifications")
      .select("id, type, round:order_rounds(title, group:groups(name, invite_code))")
      .is("read_at", null)
      .order("sent_at", { ascending: false })
      .limit(10),
    supabase.from("profiles").select("name").eq("id", user.id).maybeSingle(),
    getShowcase(5),
    getFoodNeeds(),
  ]);
  const notifications = ((notes ?? []) as unknown as Note[]).filter((n) => n.round?.group);
  const rows = (groups ?? []) as unknown as GroupRow[];

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
        <section className="relative overflow-hidden rounded-[28px] bg-accent px-6 py-9 text-on-accent md:px-12 md:py-14">
          <div className="relative z-10 md:max-w-[50%]">
            <p className="font-semibold">Hi {profile?.name}</p>
            <h1 className="mt-1 font-display text-5xl leading-[0.95] font-extrabold tracking-tight md:text-7xl">What&apos;s for lunch?</h1>
          </div>
          <div aria-hidden className="mt-7 flex gap-3 md:absolute md:top-1/2 md:right-8 md:mt-0 md:-translate-y-1/2">
            {dishes.map((dish, i) => (
              <span key={dish.name} className={`settle ${i > 2 ? "hidden xl:block" : ""}`} style={{ "--i": i, "--turn": TURNS[i] } as React.CSSProperties}>
                <DishPhoto src={dish.photo} sizes="128px" className="size-24 rounded-[20px] shadow-lift lg:size-32" />
              </span>
            ))}
          </div>
        </section>

        {notifications.length > 0 && (
          <section aria-label="Notifications" className="space-y-2">
            {notifications.map((note) => (
              <div key={note.id} className="rise flex items-center justify-between gap-3 rounded-[20px] bg-accent-soft py-2 pr-2 pl-5 text-sm text-on-accent-soft">
                <Link href={`/g/${note.round!.group!.invite_code}`} className="underline-offset-4 hover:underline">
                  <strong>{note.round!.group!.name}: {note.round!.title}</strong> {NOTE_TEXT[note.type]}
                </Link>
                <ActionForm action={dismissNotification} hidden={{ id: note.id }}>
                  <button aria-label="Dismiss" className="flex size-11 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-surface"><X aria-hidden size={18} /></button>
                </ActionForm>
              </div>
            ))}
          </section>
        )}

        <section aria-label="Food" className="grid gap-3 md:grid-cols-2">
          <ShortcutCard href="/map" icon={<MapTrifold aria-hidden size={26} weight="bold" />} title="Find a meal near Inha"
            text="Every place within 2 km on a map. Search meals with no pork, vegan, or no allergens." />
          <ShortcutCard href="/account/food" icon={<Carrot aria-hidden size={26} weight="bold" />}
            title={needs === null ? "Tell us what you can't eat" : "My food needs"}
            text={needs === null
              ? "Tick allergies and diets once, and every menu checks against them."
              : needs.avoid.length || needs.note ? `Checking menus against ${needs.avoid.length + (needs.note ? 1 : 0)} ${needs.avoid.length + (needs.note ? 1 : 0) === 1 ? "item" : "items"}. Only you can see this.` : "You have nothing to avoid. Change it any time."}
            highlight={needs === null} />
        </section>

        <section>
          <h2 className="mb-4 font-display text-3xl font-extrabold tracking-tight">My groups</h2>
          {rows.length ? (
            <ul className="space-y-3">
              {rows.map((group, i) => <GroupRowItem key={group.id} group={group} index={i} />)}
            </ul>
          ) : (
            <div className="rounded-[20px] border border-dashed border-line px-6 py-12 text-center">
              <p className="font-display text-2xl font-extrabold tracking-tight">No groups yet</p>
              <p className="mt-2 mb-5 text-muted">Create one for your team, or join with an invite code.</p>
              <Link href="/groups/new" className={buttonStyles.primary}>Create group</Link>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function ShortcutCard({ href, icon, title, text, highlight = false }: { href: string; icon: React.ReactNode; title: string; text: string; highlight?: boolean }) {
  return (
    <Link href={href} className={`group flex items-center gap-4 rounded-[20px] border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-lift md:p-5 ${highlight ? "border-accent bg-accent-soft text-on-accent-soft" : "border-line bg-surface hover:border-ink"}`}>
      <span className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${highlight ? "bg-surface" : "bg-soft"}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-bold tracking-tight">{title}</span>
        <span className={`mt-0.5 block text-sm ${highlight ? "" : "text-muted"}`}>{text}</span>
      </span>
      <ArrowRight aria-hidden size={20} className="shrink-0 transition-transform duration-200 group-hover:translate-x-1" />
    </Link>
  );
}

function GroupRowItem({ group, index }: { group: GroupRow; index: number }) {
  const round = group.order_rounds[0];
  const members = group.group_members[0]?.count ?? 0;
  const picks = (round?.order_items ?? []).filter((p) => p.menu_item && p.status === "draft");
  return (
    <li className="rise" style={{ "--i": index } as React.CSSProperties}>
      <Link href={`/g/${group.invite_code}`} className="group flex items-center gap-4 rounded-[20px] border border-line bg-surface p-4 transition duration-200 hover:-translate-y-0.5 hover:border-ink hover:shadow-lift md:p-5">
        <span aria-hidden className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-soft text-3xl">{group.icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-xl font-bold tracking-tight">{group.name}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {members} {members === 1 ? "member" : "members"}
            {round
              ? <Tag tone="accent">{round.title} open: {picks.length} of {members} picked</Tag>
              : <Tag tone="ink">Waiting for the order</Tag>}
          </span>
        </span>
        <span aria-hidden className="hidden -space-x-3 sm:flex">
          {picks.slice(0, MAX_THUMBS).map((pick, i) => (
            <DishPhoto key={i} src={pick.menu_item!.photo} size={52} className="border-2 border-surface" />
          ))}
        </span>
        <ArrowRight aria-hidden size={20} className="shrink-0 text-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
      </Link>
    </li>
  );
}
