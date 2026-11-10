import { notFound } from "next/navigation";
import { joinGroup } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { GroupTabs } from "@/components/client-bits";
import { Button } from "@/components/ui";
import { getGroupContext, getUser } from "@/lib/data";
import { getT } from "@/lib/i18n";

export default async function GroupLayout({ children, params }: { children: React.ReactNode; params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);

  if (!context) return <InvitePage code={code} />;

  const { group, isLeader } = context;
  const { t } = await getT();
  const tabs = [
    { href: `/g/${code}`, label: t("Lunch", "점심") },
    ...(isLeader ? [{ href: `/g/${code}/finalize`, label: t("Finalize", "주문 확정") }] : []),
    { href: `/g/${code}/history`, label: t("History", "기록") },
    { href: `/g/${code}/settings`, label: t("Settings", "설정") },
  ];
  return (
    <>
      <AppHeader />
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-5 print:hidden">
        <h1 className="flex items-center gap-2.5 font-display text-2xl font-extrabold tracking-tight">
          <span aria-hidden>{group.icon}</span><span className="truncate">{group.name}</span>
        </h1>
        <GroupTabs tabs={tabs} />
      </div>
      <main className="w-full px-4 sm:px-6 lg:px-8 py-5">{children}</main>
    </>
  );
}

async function InvitePage({ code }: { code: string }) {
  const { supabase } = await getUser();
  const { data } = await supabase.rpc("group_preview", { p_code: code });
  const preview = data?.[0] as { name: string; icon: string; member_count: number } | undefined;
  if (!preview) notFound();
  const { t } = await getT();
  return (
    <>
      <AppHeader />
      <main className="rise mx-auto max-w-md px-4 py-14">
        <p aria-hidden className="text-6xl">{preview.icon}</p>
        <h1 className="mt-4 font-display text-5xl leading-none font-extrabold tracking-tight">{preview.name}</h1>
        <p className="mt-3 mb-8 text-muted">{t(`${preview.member_count} ${preview.member_count === 1 ? "member" : "members"} pick lunch together here.`, `멤버 ${preview.member_count}명이 여기서 함께 점심을 고릅니다.`)}</p>
        <ActionForm action={joinGroup} hidden={{ code }}>
          <Button className="w-full">{t("Join this group", "이 그룹에 참여")}</Button>
        </ActionForm>
      </main>
    </>
  );
}
