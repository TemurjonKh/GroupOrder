import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { goToInvite } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";

export default function JoinGroupPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-8">
        <Link href="/" className={textLink}><ArrowLeft aria-hidden size={16} /> My groups</Link>
        <div className="rise mt-4">
          <PageTitle>Join a group</PageTitle>
          <p className="mt-3 mb-8 text-muted">Ask your group leader for the invite code or link. It is in their group settings.</p>
          <ActionForm action={goToInvite} className="space-y-6">
            <Field label="Invite code or link"><input name="invite" required autoFocus autoComplete="off" className={inputStyles} /></Field>
            <Button className="w-full">Continue</Button>
          </ActionForm>
        </div>
      </main>
    </>
  );
}
