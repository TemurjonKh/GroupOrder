import Link from "next/link";
import { signIn } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { getT } from "@/lib/i18n";
import { safeNext } from "@/lib/url";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const { t } = await getT();
  return (
    <AuthShell>
      <PageTitle>{t("Log in to GroupOrder", "GroupOrder 로그인")}</PageTitle>
      <p className="mt-3 mb-8 text-muted">{t("See what your group is having for lunch.", "그룹이 점심으로 뭘 먹는지 확인하세요.")}</p>
      <ActionForm action={signIn} hidden={{ next }} className="space-y-4">
        <Field label={t("Email", "이메일")}><input name="email" type="email" autoComplete="email" required className={inputStyles} /></Field>
        <Field label={t("Password", "비밀번호")}><input name="password" type="password" autoComplete="current-password" required className={inputStyles} /></Field>
        <Button className="w-full">{t("Log in", "로그인")}</Button>
      </ActionForm>
      {process.env.NEXT_PUBLIC_LOCAL_BACKEND === "1" && process.env.NEXT_PUBLIC_SHARED !== "1" && (
        <p className="mt-6 rounded-xl bg-accent-soft p-3.5 text-sm text-on-accent-soft">
          <strong>{t("Local demo.", "로컬 데모.")}</strong> {t("Log in as temur@demo.test (leader), minji@demo.test, jisoo@demo.test or dana@demo.test. Password: demo1234", "temur@demo.test(리더), minji@demo.test, jisoo@demo.test, dana@demo.test로 로그인하세요. 비밀번호: demo1234")}
        </p>
      )}
      <p className="mt-4 text-sm text-muted">
        {t("New here?", "처음이신가요?")} <Link className={textLink} href={`/signup?next=${encodeURIComponent(next)}`}>{t("Create an account", "계정 만들기")}</Link>
      </p>
    </AuthShell>
  );
}
