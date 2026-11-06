import Link from "next/link";
import { signIn } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { safeNext } from "@/lib/url";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell>
      <PageTitle>Log in to GroupOrder</PageTitle>
      <p className="mt-3 mb-8 text-muted">See what your group is having for lunch.</p>
      <ActionForm action={signIn} hidden={{ next }} className="space-y-4">
        <Field label="Email"><input name="email" type="email" autoComplete="email" required className={inputStyles} /></Field>
        <Field label="Password"><input name="password" type="password" autoComplete="current-password" required className={inputStyles} /></Field>
        <Button className="w-full">Log in</Button>
      </ActionForm>
      {process.env.NEXT_PUBLIC_LOCAL_BACKEND === "1" && (
        <p className="mt-6 rounded-xl bg-accent-soft p-3.5 text-sm text-on-accent-soft">
          <strong>Local demo.</strong> Log in as temur@demo.test (leader), minji@demo.test, jisoo@demo.test or dana@demo.test. Password: demo1234
        </p>
      )}
      <p className="mt-4 text-sm text-muted">
        New here? <Link className={textLink} href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </AuthShell>
  );
}
