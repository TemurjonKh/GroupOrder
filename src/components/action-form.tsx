"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import type { ActionState } from "@/app/actions";

/** A form for a server action: disables itself while saving and shows the result next to the controls. */
export function ActionForm({ action, hidden = {}, className, children }: {
  action: (state: ActionState, form: FormData) => Promise<ActionState>;
  hidden?: Record<string, string>;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      // React clears a form after its action runs. Submitting by hand keeps what the
      // person typed, so a wrong password does not also wipe the email.
      onSubmit={(event) => {
        event.preventDefault();
        // Passing the clicked button keeps its name and value, such as "Add it too" or "Replace".
        const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter);
        startTransition(() => formAction(data));
      }}
      aria-busy={pending}
    >
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <fieldset disabled={pending} className={`min-w-0 ${className ?? ""}`}>{children}</fieldset>
      {state?.error && <p role="alert" className="mt-2 text-sm font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 text-sm font-medium text-on-accent-soft">{state.ok}</p>}
    </form>
  );
}
