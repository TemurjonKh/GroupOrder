import Link from "next/link";
import { signUp } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { getT } from "@/lib/i18n";
import { safeNext } from "@/lib/url";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const { t } = await getT();
  return (
    <AuthShell>
      <PageTitle>{t("Create your account", "계정 만들기")}</PageTitle>
      <p className="mt-3 mb-8 text-muted">{t("It takes a minute. Then join your group with its invite link.", "1분이면 됩니다. 그다음 초대 링크로 그룹에 참여하세요.")}</p>
      <ActionForm action={signUp} hidden={{ next }} className="space-y-4">
        <Field label={t("Your name", "이름")} hint={t("Your group sees this next to your pick.", "그룹 멤버들이 내 메뉴 옆에서 이 이름을 봅니다.")}>
          <input name="name" autoComplete="name" required maxLength={80} className={inputStyles} />
        </Field>
        <Field label={t("Email", "이메일")}><input name="email" type="email" autoComplete="email" required className={inputStyles} /></Field>
        <Field label={t("Password", "비밀번호")} hint={t("At least 6 characters.", "6자 이상.")}>
          <input name="password" type="password" autoComplete="new-password" required minLength={6} className={inputStyles} />
        </Field>
        <Button className="w-full">{t("Create account", "계정 만들기")}</Button>
      </ActionForm>
      <p className="mt-4 text-sm text-muted">
        {t("Already have an account?", "이미 계정이 있나요?")} <Link className={textLink} href={`/login?next=${encodeURIComponent(next)}`}>{t("Log in", "로그인")}</Link>
      </p>
    </AuthShell>
  );
}
