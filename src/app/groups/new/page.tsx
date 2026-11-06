import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { createGroup } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AppHeader } from "@/components/app-header";
import { Button, Field, PageTitle, inputStyles, textLink } from "@/components/ui";

const ICONS = ["🍱", "🏢", "🥋", "🏋️", "🎓", "🍗", "🍔", "☕"];

export default function NewGroupPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-md px-4 py-8">
        <Link href="/" className={textLink}><ArrowLeft aria-hidden size={16} /> My groups</Link>
        <div className="rise mt-4">
          <PageTitle>Create a group</PageTitle>
          <p className="mt-3 mb-8 text-muted">A work team, a club, the gym crew. You become its leader, and lunch picks open right away.</p>
          <ActionForm action={createGroup} className="space-y-6">
            <Field label="Group name"><input name="name" required maxLength={80} autoFocus className={inputStyles} /></Field>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Icon</legend>
              <div className="grid grid-cols-4 gap-2">
                {ICONS.map((icon, i) => (
                  <label key={icon} className="relative block cursor-pointer">
                    <input type="radio" name="icon" value={icon} defaultChecked={i === 0} className="peer absolute opacity-0" />
                    <span className="flex h-14 items-center justify-center rounded-xl border border-line bg-surface text-2xl transition-colors peer-checked:border-2 peer-checked:border-accent peer-checked:bg-accent-soft peer-focus-visible:outline-2 peer-focus-visible:outline-accent">{icon}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button className="w-full">Create group</Button>
          </ActionForm>
        </div>
      </main>
    </>
  );
}
