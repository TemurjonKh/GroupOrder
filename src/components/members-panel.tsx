import { Avatar, BrandLogo, DishPhoto } from "./ui";
import type { Answer } from "@/lib/round";
import { getT } from "@/lib/i18n";
import { dishName, restaurantName } from "@/lib/names";
import { optionsLabel } from "@/lib/round";

/** Each dish gets its own photo, large enough to recognise; people without a pick show text, so gaps stand out. */
export async function MembersPanel({ answers, children }: { answers: Answer[]; children?: React.ReactNode }) {
  const { lang, t } = await getT();
  return (
    <section aria-label={t("Members", "멤버")} className="rounded-[20px] border border-line bg-surface p-5 lg:sticky lg:top-20">
      <h2 className="mb-1 font-display text-xl font-extrabold tracking-tight">{t("Who's eating what", "누가 뭘 먹나요")}</h2>
      <ul className="divide-y divide-line">
        {answers.map((answer) => (
          <li key={answer.member.user_id} className="py-3">
            <div className="flex items-center gap-3">
              <Avatar src={answer.member.avatar} name={answer.member.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {answer.member.name}
                  {answer.member.role === "leader" && <span className="font-normal text-muted"> ({t("leader", "리더")})</span>}
                </p>
                {answer.kind !== "picked" && (
                  <p className="text-sm text-muted">
                    {answer.kind === "skipped" && t("Not joining today", "오늘은 불참")}
                    {answer.kind === "no_answer" && (answer.removed ? t("Removed, needs to repick", "메뉴가 빠져서 다시 골라야 함") : t("No answer yet", "아직 응답 없음"))}
                  </p>
                )}
              </div>
            </div>
            {answer.kind === "picked" && (
              <ul className="mt-2.5 space-y-2.5">
                {answer.picks.map((pick) => (
                  <li key={pick.id} className="flex items-center gap-3">
                    <DishPhoto src={pick.menu_item!.photo} alt={dishName(pick.menu_item!, lang)} size={88} sizes="88px" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug font-semibold break-words">
                        {dishName(pick.menu_item!, lang)}
                        {pick.qty > 1 && <span className="text-muted"> x{pick.qty}</span>}
                      </p>
                      {Object.keys(pick.options).length > 0 && <p className="text-xs text-muted">{optionsLabel(pick.options)}</p>}
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <BrandLogo restaurant={pick.menu_item!.restaurant} size={28} />
                        <span className="truncate">{restaurantName(pick.menu_item!.restaurant, lang)}</span>
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
