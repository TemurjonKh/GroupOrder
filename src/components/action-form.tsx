"use client";

import { useActionState, type ReactNode } from "react";
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
    <form action={formAction} className={className} aria-busy={pending}>
      {Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <fieldset disabled={pending} className="contents">{children}</fieldset>
      {state?.error && <p role="alert" className="mt-2 basis-full text-sm font-medium text-danger">{state.error}</p>}
      {state?.ok && <p role="status" className="mt-2 basis-full text-sm font-medium text-accent-dark">{state.ok}</p>}
    </form>
  );
}
