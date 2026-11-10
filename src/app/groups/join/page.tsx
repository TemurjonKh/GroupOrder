import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { goToInvite } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { getT } from "@/lib/i18n";

export default async function JoinGroupPage() {
  const { t } = await getT();
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-8">
        <Link href="/" className={textLink}><ArrowLeft aria-hidden size={16} /> {t("My groups", "내 그룹")}</Link>
        <div className="rise mt-4">
          <PageTitle>{t("Join a group", "그룹 참여")}</PageTitle>
          <p className="mt-3 mb-8 text-muted">{t("Ask your group leader for the invite code or link. It is in their group settings.", "그룹 리더에게 초대 코드나 링크를 받으세요. 리더의 그룹 설정에 있습니다.")}</p>
          <ActionForm action={goToInvite} className="space-y-6">
            <Field label={t("Invite code or link", "초대 코드 또는 링크")}><input name="invite" required autoFocus autoComplete="off" className={inputStyles} /></Field>
            <Button className="w-full">{t("Continue", "계속")}</Button>
          </ActionForm>
        </div>
      </main>
    </>
  );
}
