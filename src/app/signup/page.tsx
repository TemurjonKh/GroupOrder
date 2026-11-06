import Link from "next/link";
import { signUp } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AuthShell } from "@/components/auth-shell";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { safeNext } from "@/lib/url";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <AuthShell>
      <PageTitle>Create your account</PageTitle>
      <p className="mt-3 mb-8 text-muted">It takes a minute. Then join your group with its invite link.</p>
      <ActionForm action={signUp} hidden={{ next }} className="space-y-4">
        <Field label="Your name" hint="Your group sees this next to your pick.">
          <input name="name" autoComplete="name" required maxLength={80} className={inputStyles} />
        </Field>
        <Field label="Email"><input name="email" type="email" autoComplete="email" required className={inputStyles} /></Field>
        <Field label="Password" hint="At least 6 characters.">
          <input name="password" type="password" autoComplete="new-password" required minLength={6} className={inputStyles} />
        </Field>
        <Button className="w-full">Create account</Button>
      </ActionForm>
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link className={textLink} href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
      </p>
    </AuthShell>
  );
}
