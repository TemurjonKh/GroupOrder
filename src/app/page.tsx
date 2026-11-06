import Link from "next/link";
import { createGroup, dismissNotification, goToInvite } from "./actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Card, Field, Pill, inputStyles } from "@/components/ui";
import { getUser } from "@/lib/data";
import { formatTime, roundState } from "@/lib/round";

type GroupCard = {
  id: string; name: string; icon: string; invite_code: string;
  group_members: { count: number }[];
  order_rounds: { title: string; deadline: string; status: "open" }[];
};
type Note = {
  id: string; type: string;
  round: { title: string; group: { name: string; invite_code: string } | null } | null;
};

const NOTE_TEXT: Record<string, string> = {
  reminder_30: "closes in 30 minutes and you have not answered.",
  reminder_10: "closes in 10 minutes and you have not answered.",
  reminder_manual: "needs your answer. The leader sent a reminder.",
  repick: "needs a new pick from you: the leader removed your dish.",
  ordered: "has been ordered. Food is on the way.",
  pick_edited: "had your pick changed by the leader.",
};

export default async function HomePage() {
  const { supabase } = await getUser();
  const [{ data: groups }, { data: notes }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, icon, invite_code, group_members(count), order_rounds(title, deadline, status)")
      .eq("order_rounds.status", "open")
      .order("created_at"),
    supabase
      .from("notifications")
      .select("id, type, round:order_rounds(title, group:groups(name, invite_code))")
      .is("read_at", null)
      .order("sent_at", { ascending: false })
      .limit(10),
  ]);
  const notifications = ((notes ?? []) as unknown as Note[]).filter((n) => n.round?.group);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-8 px-4 py-6">
        {notifications.length > 0 && (
          <section aria-label="Notifications" className="space-y-2">
            {notifications.map((note) => (
              <Card key={note.id} className="flex items-center justify-between gap-3 border-accent bg-accent-soft p-3 text-sm">
                <Link href={`/g/${note.round!.group!.invite_code}`} className="underline-offset-2 hover:underline">
                  <strong>{note.round!.group!.name}: {note.round!.title}</strong> {NOTE_TEXT[note.type]}
                </Link>
                <ActionForm action={dismissNotification} hidden={{ id: note.id }}>
                  <Button look="secondary">Dismiss</Button>
                </ActionForm>
              </Card>
            ))}
          </section>
        )}

        <section>
          <h1 className="mb-4 text-2xl font-bold">My groups</h1>
          {groups?.length ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(groups as unknown as GroupCard[]).map((group) => {
                const round = group.order_rounds[0];
                const closed = round && roundState(round) === "closed";
                return (
                  <li key={group.id}>
                    <Link href={`/g/${group.invite_code}`} className="block rounded-xl border border-line bg-surface p-4 transition-colors hover:border-accent">
                      <div className="flex items-center gap-3">
                        <span aria-hidden className="text-2xl">{group.icon}</span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{group.name}</p>
                          <p className="text-sm text-muted">{group.group_members[0]?.count ?? 0} members</p>
                        </div>
                      </div>
                      <div className="mt-3 min-h-6">
                        {round && (closed
                          ? <Pill tone="amber">{round.title} closed, waiting for leader</Pill>
                          : <Pill tone="accent">{round.title} open, closes {formatTime(round.deadline)}</Pill>)}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted">You are not in a group yet. Create one below, or join with an invite code.</p>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Create a group</h2>
            <ActionForm action={createGroup} className="space-y-3">
              <Field label="Group name"><input name="name" required maxLength={80} placeholder="Krafton work team" className={inputStyles} /></Field>
              <Field label="Icon" hint="One emoji.">
                <input name="icon" defaultValue="🍱" maxLength={8} className={`${inputStyles} w-20`} />
              </Field>
              <Button>Create group</Button>
            </ActionForm>
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-semibold">Join a group</h2>
            <ActionForm action={goToInvite} className="space-y-3">
              <Field label="Invite code or link"><input name="invite" required className={inputStyles} /></Field>
              <Button look="secondary">Continue</Button>
            </ActionForm>
          </Card>
        </section>
      </main>
    </>
  );
}
