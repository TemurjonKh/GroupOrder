import Link from "next/link";
import { ArrowRight, SignOut } from "@phosphor-icons/react/ssr";
import { signOut, updateName } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { AvatarPicker } from "@/components/avatar-picker";
import { Button, Card, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { getUser } from "@/lib/data";
import { getT } from "@/lib/i18n";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const { supabase, user } = await getUser();
  const { t } = await getT();
  const { data: profile } = await supabase.from("profiles").select("name, avatar").eq("id", user.id).maybeSingle<{ name: string; avatar: string | null }>();
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <PageTitle>{t("My account", "내 계정")}</PageTitle>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold">{t("Profile photo", "프로필 사진")}</h2>
          <AvatarPicker name={profile?.name ?? ""} current={profile?.avatar ?? null} />
        </Card>
        <Card className="p-5">
          <ActionForm action={updateName} className="space-y-4">
            <Field label={t("Your name", "이름")} hint={t("Your groups see this next to your picks.", "그룹 멤버에게 내 메뉴 옆에 표시됩니다.")}>
              <input name="name" required maxLength={80} defaultValue={profile?.name ?? ""} autoComplete="name" className={inputStyles} />
            </Field>
            <Button>{t("Save name", "이름 저장")}</Button>
          </ActionForm>
        </Card>
        <Card className="p-5 text-sm">
          <p className="text-muted">{t("Logged in as", "로그인 계정")}</p>
          <p className="font-semibold">{user.email}</p>
        </Card>
        <form action={signOut}>
          <Button look="secondary"><SignOut aria-hidden size={18} /> {t("Log out", "로그아웃")}</Button>
        </form>
        <Link href="/account/food" className={textLink}>{t("My food needs", "내 식단 정보")} <ArrowRight aria-hidden size={16} /></Link>
      </main>
    </>
  );
}
