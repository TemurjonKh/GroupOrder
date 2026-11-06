import { Circle } from "./ui";
import type { Answer } from "@/lib/round";
import { optionsLabel } from "@/lib/round";

function restaurantShortName(name: string) {
  // Sample names are "한식 키친 Hansik Kitchen"; the English half is shorter to scan.
  return name.match(/[A-Za-z].*$/)?.[0] ?? name;
}

/** Big circle is the dish, small one the restaurant. People without a pick show text, so gaps stand out. */
export function MembersPanel({ answers, children }: { answers: Answer[]; children?: React.ReactNode }) {
  return (
    <section aria-label="Members" className="rounded-xl border border-line bg-surface p-4">
      <h2 className="mb-2 border-b border-line pb-2 font-semibold">Members</h2>
      <ul className="divide-y divide-soft">
        {answers.map((answer) => (
          <li key={answer.member.user_id} className="flex items-center gap-3 py-2">
            <Circle src={answer.member.avatar} label={answer.member.name} size={36} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {answer.member.name}
                {answer.member.role === "leader" && <span className="font-normal text-muted"> · leader</span>}
              </p>
              <p className="truncate text-sm text-muted">
                {answer.kind === "picked" && (
                  <>
                    {answer.pick.menu_item!.name}
                    {Object.keys(answer.pick.options).length > 0 && ` (${optionsLabel(answer.pick.options)})`}
                    {" · "}{restaurantShortName(answer.pick.menu_item!.restaurant.name)}
                  </>
                )}
                {answer.kind === "skipped" && "Not joining today"}
                {answer.kind === "no_answer" && (answer.removed ? "Removed, needs to repick" : "No answer yet")}
              </p>
            </div>
            {answer.kind === "picked" && (
              <span className="relative shrink-0">
                <Circle src={answer.pick.menu_item!.photo} label={answer.pick.menu_item!.name} size={40} />
                <span className="absolute -right-1 -bottom-1"><Circle src={answer.pick.menu_item!.restaurant.logo} size={18} /></span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
