import { Avatar, BrandLogo, DishPhoto } from "./ui";
import type { Answer } from "@/lib/round";
import { optionsLabel } from "@/lib/round";

/** People without a pick show text instead of a photo, so gaps stand out at a glance. */
export function MembersPanel({ answers, children }: { answers: Answer[]; children?: React.ReactNode }) {
  return (
    <section aria-label="Members" className="rounded-[20px] border border-line bg-surface p-5 lg:sticky lg:top-20">
      <h2 className="mb-2 font-display text-xl font-extrabold tracking-tight">Who&apos;s eating what</h2>
      <ul>
        {answers.map((answer) => (
          <li key={answer.member.user_id} className="flex items-center gap-3 py-2.5">
            <Avatar src={answer.member.avatar} name={answer.member.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {answer.member.name}
                {answer.member.role === "leader" && <span className="font-normal text-muted"> (leader)</span>}
              </p>
              <p className="text-sm break-words text-muted">
                {answer.kind === "picked" && (
                  <>
                    {answer.pick.menu_item!.name}
                    {answer.pick.qty > 1 && ` x${answer.pick.qty}`}
                    {Object.keys(answer.pick.options).length > 0 && ` (${optionsLabel(answer.pick.options)})`}
                    <span className="block text-xs">{answer.pick.menu_item!.restaurant.name}</span>
                  </>
                )}
                {answer.kind === "skipped" && "Not joining today"}
                {answer.kind === "no_answer" && (answer.removed ? "Removed, needs to repick" : "No answer yet")}
              </p>
            </div>
            {answer.kind === "picked" && (
              <span className="relative shrink-0">
                <DishPhoto src={answer.pick.menu_item!.photo} size={52} />
                <span className="absolute -right-1.5 -bottom-1.5"><BrandLogo restaurant={answer.pick.menu_item!.restaurant} size={24} /></span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
