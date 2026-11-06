import { notFound } from "next/navigation";
import { joinGroup } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { GroupTabs } from "@/components/client-bits";
import { Button } from "@/components/ui";
import { getGroupContext, getUser } from "@/lib/data";

export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);

  if (!context) return <InvitePage code={code} />;

  const { group, isLeader } = context;
  const tabs = [
    { href: `/g/${code}`, label: "Lunch" },
    ...(isLeader ? [{ href: `/g/${code}/finalize`, label: "Finalize" }] : []),
    { href: `/g/${code}/history`, label: "History" },
    { href: `/g/${code}/settings`, label: "Settings" },
  ];
  return (
    <>
      <AppHeader />
      <div className="mx-auto max-w-6xl px-4 pt-5 print:hidden">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight">
          <span aria-hidden>{group.icon}</span><span className="truncate">{group.name}</span>
        </h1>
        <GroupTabs tabs={tabs} />
      </div>
      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
    </>
  );
}

async function InvitePage({ code }: { code: string }) {
  const { supabase } = await getUser();
  const { data } = await supabase.rpc("group_preview", { p_code: code });
  const preview = data?.[0] as { name: string; icon: string; member_count: number } | undefined;
  if (!preview) notFound();
  return (
    <>
      <AppHeader />
      <main className="rise mx-auto max-w-md px-4 py-14">
        <p aria-hidden className="text-6xl">{preview.icon}</p>
        <h1 className="mt-4 font-display text-5xl leading-none font-extrabold tracking-tight">{preview.name}</h1>
        <p className="mt-3 mb-8 text-muted">{preview.member_count} {preview.member_count === 1 ? "member" : "members"} pick lunch together here.</p>
        <ActionForm action={joinGroup} hidden={{ code }}>
          <Button className="w-full">Join this group</Button>
        </ActionForm>
      </main>
    </>
  );
}
