import { CopyButton } from "./client-bits";
import { BrandLogo, Card } from "./ui";
import { formatKrw, lineAmountLabel, summaryText, totalLabel, type RestaurantSummary } from "@/lib/round";

/** One restaurant's order: what to say to the restaurant, then who owes what. */
export function OrderSummary({ summary, roundTitle, personAction }: {
  summary: RestaurantSummary;
  roundTitle: string;
  personAction?: (userId: string) => React.ReactNode;
}) {
  const { restaurant } = summary;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo restaurant={restaurant} size={44} />
          <div className="min-w-0">
            <h3 className="font-display text-xl font-extrabold tracking-tight">{restaurant.name}</h3>
            {restaurant.phone && <a href={`tel:${restaurant.phone}`} className="text-sm text-on-accent-soft underline">{restaurant.phone}</a>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {restaurant.delivery_link && (
            <a href={restaurant.delivery_link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-on-accent-soft underline-offset-4 hover:underline">Brand site</a>
          )}
          <CopyButton text={summaryText(summary, roundTitle)} />
        </div>
      </div>
      <ul className="mt-4 space-y-2.5">
        {summary.lines.map((line) => (
          <li key={`${line.dish}|${line.options}`} className="text-sm">
            <div className="flex justify-between gap-3">
              <span><strong>{line.qty}x</strong> {line.dish}{line.options && ` (${line.options})`}</span>
              <span className={`text-right ${line.unpriced ? "text-muted" : ""}`}>{lineAmountLabel(line)}</span>
            </div>
            {line.notes.map((n) => <p key={n.who} className="text-muted">{n.who}: {n.note}</p>)}
          </li>
        ))}
      </ul>
      <p className="mt-3 flex justify-between gap-3 border-t border-line pt-3 font-bold">
        <span>Total</span><span className="text-right">{totalLabel(summary.total, summary.unpriced)}</span>
      </p>
      <details className="mt-1">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-muted">Who ordered what ({summary.people.length})</summary>
        <ul>
          {summary.people.map((person) => (
            <li key={person.user_id} className="flex flex-wrap items-center justify-between gap-x-3 py-1 text-sm">
              <span className="min-w-0"><strong>{person.name}</strong> {person.dish}{person.qty > 1 && ` x${person.qty}`}</span>
              <span className="flex items-center gap-1 text-muted">{formatKrw(person.amount)}{personAction?.(person.user_id)}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
