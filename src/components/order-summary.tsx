import { CopyButton } from "./client-bits";
import { BrandLogo, Card } from "./ui";
import { formatKrw, summaryText, totalLabel, type RestaurantSummary } from "@/lib/round";
import { getT } from "@/lib/i18n";
import { restaurantName } from "@/lib/names";

/** One restaurant's order: what to say to the restaurant, then who owes what. */
export async function OrderSummary({ summary, roundTitle, personAction }: {
  summary: RestaurantSummary;
  roundTitle: string;
  personAction?: (person: RestaurantSummary["people"][number]) => React.ReactNode;
}) {
  const { restaurant } = summary;
  const { lang, t } = await getT();
  const shown = (item: { dish: string; dishEn: string | null }) => (lang === "en" && item.dishEn) || item.dish;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo restaurant={restaurant} size={44} />
          <div className="min-w-0">
            <h3 className="font-display text-xl font-extrabold tracking-tight">{restaurantName(restaurant, lang)}</h3>
            {restaurant.phone && <a href={`tel:${restaurant.phone}`} className="text-sm text-on-accent-soft underline">{restaurant.phone}</a>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {restaurant.delivery_link && (
            <a href={restaurant.delivery_link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-on-accent-soft underline-offset-4 hover:underline">{t("Brand site", "브랜드 사이트")}</a>
          )}
          <CopyButton text={summaryText(summary, roundTitle)} />
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {summary.lines.map((line) => (
          <li key={`${line.dish}|${line.options}`} className="text-sm">
            <div className="flex justify-between gap-3">
              <span><strong>{line.qty}x</strong> {shown(line)}{line.options && ` (${line.options})`}</span>
              <span className={`text-right ${line.unpriced ? "text-muted" : ""}`}>{totalLabel(line.amount, line.unpriced, lang)}</span>
            </div>
            {line.notes.map((n) => <p key={n.who} className="text-muted">{n.who}: {n.note}</p>)}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-bold">
        <span>{t("Total", "합계")}</span><span className="text-right">{totalLabel(summary.total, summary.unpriced, lang)}</span>
      </p>
      <details className="mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-muted">{t(`Who ordered what (${summary.people.length})`, `누가 뭘 주문했나 (${summary.people.length})`)}</summary>
        <ul>
          {summary.people.map((person) => (
            <li key={person.pick_id} className="flex flex-wrap items-center justify-between gap-x-3 py-1 text-sm">
              <span className="min-w-0"><strong>{person.name}</strong> {shown(person)}{person.qty > 1 && ` x${person.qty}`}</span>
              <span className="flex items-center gap-1 text-muted">{formatKrw(person.amount, lang)}{personAction?.(person)}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
