import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { updateName } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Card, Field, PageTitle, inputStyles, textLink } from "@/components/ui";
import { getUser } from "@/lib/data";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const { supabase, user } = await getUser();
  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle<{ name: string }>();
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <PageTitle>My account</PageTitle>
        <Card className="p-5">
          <ActionForm action={updateName} className="space-y-4">
            <Field label="Your name" hint="Your groups see this next to your picks.">
              <input name="name" required maxLength={80} defaultValue={profile?.name ?? ""} autoComplete="name" className={inputStyles} />
            </Field>
            <Button>Save name</Button>
          </ActionForm>
        </Card>
        <Card className="p-5 text-sm">
          <p className="text-muted">Logged in as</p>
          <p className="font-semibold">{user.email}</p>
        </Card>
        <Link href="/account/food" className={textLink}>My food needs <ArrowRight aria-hidden size={16} /></Link>
      </main>
    </>
  );
}
