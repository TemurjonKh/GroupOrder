import Link from "next/link";
import { ArrowRight, HourglassMedium, Prohibit, ThumbsUp, WarningCircle } from "@phosphor-icons/react/ssr";
import { Avatar, BrandLogo, DishPhoto } from "./ui";
import type { Answer } from "@/lib/round";
import type { Member, OrderPick, Restaurant } from "@/lib/types";
import { getT } from "@/lib/i18n";
import { dishName, restaurantName } from "@/lib/names";
import { formatKrw, optionsLabel, totalLabel } from "@/lib/round";

export type SuggestedRestaurant = {
  restaurant: Pick<Restaurant, "id" | "name" | "name_en" | "name_ko" | "logo" | "logo_bg">;
  by: Member[];
  href: string;
};

const sum = (picks: OrderPick[]) => ({
  total: picks.reduce((n, p) => n + (p.price_at_pick ?? 0) * p.qty, 0),
  unpriced: picks.reduce((n, p) => n + (p.price_at_pick === null ? p.qty : 0), 0),
});

/** Each dish gets its own photo and price; people without a pick get a coloured badge, so gaps stand out. */
export async function MembersPanel({ answers, suggested = [], children }: {
  answers: Answer[]; suggested?: SuggestedRestaurant[]; children?: React.ReactNode;
}) {
  const { lang, t } = await getT();
  const allPicks = answers.flatMap((a) => (a.kind === "picked" ? a.picks : []));
  const group = sum(allPicks);
  return (
    <section aria-label={t("Members", "멤버")}
      className="rounded-[20px] border border-line bg-surface p-5 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
      <h2 className="mb-1 font-display text-xl font-extrabold tracking-tight">{t("Who's eating what", "누가 뭘 먹나요")}</h2>
      <ul className="divide-y divide-line">
        {answers.map((answer) => (
          <li key={answer.member.user_id} className="py-3">
            <div className="flex items-center gap-3">
              <span className={answer.kind === "skipped" ? "opacity-50 grayscale" : ""}>
                <Avatar src={answer.member.avatar} name={answer.member.name} size={44} />
              </span>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${answer.kind === "skipped" ? "text-muted" : ""}`}>
                  {answer.member.name}
                  {answer.member.role === "leader" && <span className="font-normal text-muted"> ({t("leader", "리더")})</span>}
                </p>
                {answer.kind === "skipped" && (
                  <Badge className="bg-danger-soft text-on-danger-soft"><Prohibit aria-hidden size={16} weight="bold" />{t("Not joining today", "오늘은 불참")}</Badge>
                )}
                {answer.kind === "no_answer" && (answer.removed
                  ? <Badge className="bg-danger-soft text-on-danger-soft"><WarningCircle aria-hidden size={16} weight="bold" />{t("Removed, needs to repick", "메뉴가 빠져서 다시 골라야 함")}</Badge>
                  : <Badge className="bg-warn-soft text-on-warn-soft"><HourglassMedium aria-hidden size={16} weight="bold" />{t("No answer yet", "아직 응답 없음")}</Badge>)}
              </div>
              {answer.kind === "picked" && answer.picks.length > 1 && (
                <p className="shrink-0 text-right text-sm font-bold tabular-nums">{totalLabel(sum(answer.picks).total, sum(answer.picks).unpriced, lang)}</p>
              )}
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
                    <p className={`shrink-0 text-right tabular-nums ${pick.price_at_pick === null ? "max-w-20 text-xs text-muted" : "text-sm font-bold"}`}>
                      {formatKrw(pick.price_at_pick === null ? null : pick.price_at_pick * pick.qty, lang)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {allPicks.length > 0 && (
        <p className="flex items-baseline justify-between gap-3 border-t-2 border-ink pt-3 font-display">
          <span className="font-bold whitespace-nowrap">{t("Total so far", "지금까지 합계")}</span>
          <span className="text-right text-lg font-extrabold tabular-nums">{totalLabel(group.total, group.unpriced, lang)}</span>
        </p>
      )}
      {suggested.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
            <ThumbsUp aria-hidden size={20} weight="fill" className="text-accent" />{t("Suggested restaurants", "추천 식당")}
          </h3>
          <ul className="mt-2 space-y-2">
            {suggested.map(({ restaurant, by, href }) => (
              <li key={restaurant.id}>
                <Link href={href} className="group flex items-center gap-3 rounded-2xl border border-accent p-2.5 transition hover:bg-soft">
                  <BrandLogo restaurant={restaurant} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{restaurantName(restaurant, lang)}</span>
                    <span className="block truncate text-xs text-muted">
                      {t(`By ${by.map((m) => m.name).join(", ")}`, `${by.map((m) => m.name).join(", ")}님의 추천`)}
                    </span>
                  </span>
                  <span className="flex -space-x-2">
                    {by.slice(0, 3).map((m) => <span key={m.user_id} className="rounded-xl ring-2 ring-surface"><Avatar src={m.avatar} name={m.name} size={28} /></span>)}
                  </span>
                  <ArrowRight aria-hidden size={18} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </section>
  );
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`mt-1 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-bold ${className}`}>{children}</span>;
}
