import { notFound } from "next/navigation";
import { OrderSummary } from "@/components/order-summary";
import { Card, Tag } from "@/components/ui";
import { getGroupContext, getPicks, getUser } from "@/lib/data";
import { buildSummary, formatDate, memberAnswers, totalLabel } from "@/lib/round";
import { getT } from "@/lib/i18n";
import type { Member, Round } from "@/lib/types";

export default async function HistoryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();

  const { supabase } = await getUser();
  const { lang, t } = await getT();
  const { data } = await supabase
    .from("order_rounds")
    .select("*")
    .eq("group_id", context.group.id)
    .neq("status", "open")
    .order("created_at", { ascending: false })
    .limit(30);
  const rounds = (data ?? []) as Round[];
  const picks = await getPicks(rounds.map((r) => r.id));

  if (rounds.length === 0) return <Card className="p-8 text-center text-muted">{t("Finished rounds will appear here.", "끝난 라운드가 여기에 표시됩니다.")}</Card>;

  return (
    <ul className="mx-auto max-w-3xl space-y-3">
      {rounds.map((round) => {
        const roundPicks = picks.filter((p) => p.round_id === round.id);
        // People who have since left the group are still part of what was ordered.
        const known = new Set(context.members.map((m) => m.user_id));
        const former = roundPicks
          .filter((p) => !known.has(p.user_id))
          .map((p): Member => ({ user_id: p.user_id, role: "member", name: t("Former member", "나간 멤버"), avatar: null }));
        const summaries = buildSummary(memberAnswers([...context.members, ...former], roundPicks));
        const total = summaries.reduce((sum, s) => sum + s.total, 0);
        const unpriced = summaries.reduce((sum, s) => sum + s.unpriced, 0);
        return (
          <li key={round.id}>
            <Card>
              <details>
                <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-4">
                  <span className="font-display text-xl font-extrabold tracking-tight">{round.title}</span>
                  <span className="text-sm text-muted">{formatDate(round.created_at, lang)}, {totalLabel(total, unpriced, lang)}</span>
                  <Tag tone={round.status === "ordered" ? "neutral" : "accent"}>{round.status === "ordered" ? t("Ordered", "주문 완료") : t("Not marked as ordered", "주문 완료 표시 안 됨")}</Tag>
                </summary>
                <div className="space-y-3 border-t border-line p-4">
                  {summaries.length === 0 && <p className="text-sm text-muted">{t("Nobody picked anything.", "아무도 메뉴를 고르지 않았습니다.")}</p>}
                  {summaries.map((s) => <OrderSummary key={s.restaurant.id} summary={s} roundTitle={round.title} />)}
                </div>
              </details>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
