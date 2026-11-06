import Link from "next/link";
import { signIn } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { Button, Card, Field, inputStyles } from "@/components/ui";
import { safeNext } from "@/lib/url";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold">Log in to GroupOrder</h1>
      <p className="mt-1 mb-6 text-muted">Pick lunch together, without the group chat.</p>
      <Card className="p-5">
        <ActionForm action={signIn} hidden={{ next }} className="space-y-4">
          <Field label="Email"><input name="email" type="email" autoComplete="email" required className={inputStyles} /></Field>
          <Field label="Password"><input name="password" type="password" autoComplete="current-password" required className={inputStyles} /></Field>
          <Button className="w-full">Log in</Button>
        </ActionForm>
      </Card>
      {process.env.NEXT_PUBLIC_LOCAL_BACKEND === "1" && (
        <p className="mt-4 rounded-lg bg-accent-soft p-3 text-sm">
          <strong>Local demo.</strong> Log in as temur@demo.test (leader), minji@demo.test, jisoo@demo.test or dana@demo.test. Password: demo1234
        </p>
      )}
      <p className="mt-4 text-sm text-muted">
        New here? <Link className="font-semibold text-accent underline" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </main>
  );
}
