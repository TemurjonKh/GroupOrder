import { Avatar, BrandLogo, DishPhoto } from "./ui";
import type { Answer } from "@/lib/round";
import { optionsLabel } from "@/lib/round";

/** Each dish gets its own photo, large enough to recognise; people without a pick show text, so gaps stand out. */
export function MembersPanel({ answers, children }: { answers: Answer[]; children?: React.ReactNode }) {
  return (
    <section aria-label="Members" className="rounded-[20px] border border-line bg-surface p-5 lg:sticky lg:top-20">
      <h2 className="mb-1 font-display text-xl font-extrabold tracking-tight">Who&apos;s eating what</h2>
      <ul className="divide-y divide-line">
        {answers.map((answer) => (
          <li key={answer.member.user_id} className="py-3">
            <div className="flex items-center gap-3">
              <Avatar src={answer.member.avatar} name={answer.member.name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {answer.member.name}
                  {answer.member.role === "leader" && <span className="font-normal text-muted"> (leader)</span>}
                </p>
                {answer.kind !== "picked" && (
                  <p className="text-sm text-muted">
                    {answer.kind === "skipped" && "Not joining today"}
                    {answer.kind === "no_answer" && (answer.removed ? "Removed, needs to repick" : "No answer yet")}
                  </p>
                )}
              </div>
            </div>
            {answer.kind === "picked" && (
              <ul className="mt-2.5 space-y-2.5">
                {answer.picks.map((pick) => (
                  <li key={pick.id} className="flex items-center gap-3">
                    <DishPhoto src={pick.menu_item!.photo} alt={pick.menu_item!.name} size={88} sizes="88px" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-semibold break-words">
                        {pick.menu_item!.name}
                        {pick.qty > 1 && <span className="text-muted"> x{pick.qty}</span>}
                      </p>
                      {Object.keys(pick.options).length > 0 && <p className="text-xs text-muted">{optionsLabel(pick.options)}</p>}
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <BrandLogo restaurant={pick.menu_item!.restaurant} size={28} />
                        <span className="truncate">{pick.menu_item!.restaurant.name}</span>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
