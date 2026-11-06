import Link from "next/link";
import { signUp } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, inputStyles } from "@/components/ui";
import { safeNext } from "@/lib/url";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Create your account</h1>
      <Card className="p-5">
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
      </Card>
      <p className="mt-4 text-sm text-muted">
        Already have an account? <Link className="font-semibold text-accent underline" href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
      </p>
    </main>
  );
}
