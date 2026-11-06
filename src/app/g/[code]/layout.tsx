import Link from "next/link";
import { notFound } from "next/navigation";
import { joinGroup } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Card } from "@/components/ui";
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
      <div className="mx-auto max-w-5xl px-4 pt-4 print:hidden">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <span aria-hidden>{group.icon}</span><span className="truncate">{group.name}</span>
        </h1>
        <nav aria-label="Group" className="mt-2 flex gap-1 overflow-x-auto border-b border-line">
          {tabs.map((tab) => (
            <Link key={tab.href} href={tab.href} className="flex min-h-11 items-center whitespace-nowrap px-3 text-sm font-medium text-muted hover:text-ink">
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>
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
      <main className="mx-auto max-w-sm px-4 py-12">
        <Card className="p-6 text-center">
          <p aria-hidden className="text-4xl">{preview.icon}</p>
          <h1 className="mt-2 text-xl font-bold">{preview.name}</h1>
          <p className="mb-4 text-muted">{preview.member_count} members</p>
          <ActionForm action={joinGroup} hidden={{ code }}>
            <Button className="w-full">Join this group</Button>
          </ActionForm>
        </Card>
      </main>
    </>
  );
}
