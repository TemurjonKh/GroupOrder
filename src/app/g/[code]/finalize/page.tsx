import Link from "next/link";
import { notFound } from "next/navigation";
import { finalizeRound, markOrdered, remindNoAnswer, removePickLine } from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { LiveRefresh } from "@/components/client-bits";
import { OrderSummary } from "@/components/order-summary";
import { RoundBar } from "@/components/round-bar";
import { Button, Card } from "@/components/ui";
import { getGroupContext } from "@/lib/data";
import { getT } from "@/lib/i18n";
import { buildSummary, totalLabel } from "@/lib/round";

export default async function FinalizePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const context = await getGroupContext(code);
  if (!context) notFound();
  const { group, round, answers, counts, isLeader } = context;
  const { lang, t } = await getT();

  if (!isLeader) return <p className="text-muted">{t("Only a group leader can finalize a round.", "그룹 리더만 라운드를 확정할 수 있습니다.")}</p>;
  if (!round) return <Card className="p-8 text-center text-muted">{t("There is no round to finalize.", "확정할 라운드가 없습니다.")}</Card>;

  const hidden = { code, round: round.id };
  const summaries = buildSummary(answers);
  const open = round.status === "open";
  const missing = answers.filter((a) => a.kind === "no_answer");
  const skipped = answers.filter((a) => a.kind === "skipped");
  const grandTotal = summaries.reduce((sum, s) => sum + s.total, 0);
  const grandUnpriced = summaries.reduce((sum, s) => sum + s.unpriced, 0);

  return (
    <div className="space-y-5">
      <LiveRefresh groupId={group.id} roundId={round.id} />
      <RoundBar round={round} counts={counts} />

      <div className="flex flex-wrap items-start gap-2">
        {open && (
          <ActionForm action={finalizeRound} hidden={hidden}>
            <Button>{missing.length > 0 ? t(`Finalize without ${missing.length}`, `${missing.length}명 빼고 확정`) : t("Finalize", "확정하기")}</Button>
          </ActionForm>
        )}
        {open && missing.length > 0 && (
          <ActionForm action={remindNoAnswer} hidden={hidden}>
            <Button look="secondary">{t(`Remind ${missing.length} with no answer`, `미응답 ${missing.length}명에게 알림`)}</Button>
          </ActionForm>
        )}
        {round.status === "finalized" && (
          <ActionForm action={markOrdered} hidden={hidden}>
            <Button>{t("Mark as ordered", "주문 완료")}</Button>
          </ActionForm>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_440px]">
        <section aria-label={t("Order per restaurant", "식당별 주문")} className="space-y-3">
          {summaries.length === 0 && <Card className="p-8 text-center text-muted">{t("No picks yet.", "아직 고른 메뉴가 없습니다.")}</Card>}
          {summaries.map((summary) => (
            <OrderSummary
              key={summary.restaurant.id}
              summary={summary}
              roundTitle={round.title}
              personAction={open ? (person) => (
                <>
                  <Link href={`/g/${code}/finalize/pick/${person.user_id}`} className="inline-flex min-h-11 items-center px-2 font-semibold text-on-accent-soft underline-offset-4 hover:underline">{t("Edit", "수정")}</Link>
                  <ActionForm action={removePickLine} hidden={{ ...hidden, line: person.pick_id }}>
                    <button aria-label={`Remove ${person.name}'s ${person.dish}`} className="min-h-11 cursor-pointer px-2 font-semibold text-danger underline-offset-4 hover:underline">{t("Remove", "빼기")}</button>
                  </ActionForm>
                </>
              ) : undefined}
            />
          ))}
          {summaries.length > 1 && (
            <p className="px-1 text-right font-display text-xl font-extrabold tracking-tight">{t("All restaurants", "전체 식당")}: {totalLabel(grandTotal, grandUnpriced, lang)}</p>
          )}
        </section>
        <aside className="space-y-3">
          <NameList
            title={t("No answer", "미응답")}
            names={missing.map((a) => a.member.name)}
            hint={open && missing.length > 0 ? t("Tap a name to pick for them.", "이름을 누르면 대신 고를 수 있습니다.") : undefined}
            hrefs={open ? missing.map((a) => `/g/${code}/finalize/pick/${a.member.user_id}`) : undefined}
          />
          <NameList title={t("Not joining", "불참")} names={skipped.map((a) => a.member.name)} />
        </aside>
      </div>
    </div>
  );
}

function NameList({ title, names, hrefs, hint }: { title: string; names: string[]; hrefs?: string[]; hint?: string }) {
  return (
    <Card className="p-5">
      <h3 className="font-display text-lg font-extrabold tracking-tight">{title} ({names.length})</h3>
      {hint && <p className="text-sm text-muted">{hint}</p>}
      {names.length > 0 && (
        <ul className="mt-1 text-sm text-muted">
          {names.map((name, i) => (
            <li key={`${name}${i}`}>
              {hrefs ? <Link href={hrefs[i]} className="inline-flex min-h-11 items-center font-semibold text-on-accent-soft underline underline-offset-4">{name}</Link> : name}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
