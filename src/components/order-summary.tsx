import { CopyButton } from "./client-bits";
import { Card } from "./ui";
import { formatKrw, summaryText, type RestaurantSummary } from "@/lib/round";

/** One restaurant's order: what to say to the restaurant, then who owes what. */
export function OrderSummary({ summary, roundTitle, personAction }: {
  summary: RestaurantSummary;
  roundTitle: string;
  personAction?: (userId: string) => React.ReactNode;
}) {
  const { restaurant } = summary;
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold">{restaurant.name}</h3>
          {restaurant.phone && <a href={`tel:${restaurant.phone}`} className="text-sm text-accent underline">{restaurant.phone}</a>}
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton text={summaryText(summary, roundTitle)} />
          {restaurant.delivery_link && (
            <a href={restaurant.delivery_link} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-accent underline">Delivery page</a>
          )}
        </div>
      </div>
      <ul className="mt-3 divide-y divide-soft">
        {summary.lines.map((line) => (
          <li key={`${line.dish}|${line.options}`} className="py-2 text-sm">
            <div className="flex justify-between gap-3">
              <span><strong>x{line.qty}</strong> {line.dish}{line.options && ` (${line.options})`}</span>
              <span className="whitespace-nowrap">{formatKrw(line.amount)}</span>
            </div>
            {line.notes.map((n) => <p key={n.who} className="text-muted">{n.who}: {n.note}</p>)}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between border-t border-line pt-2 font-semibold">
        <span>Total</span><span>{formatKrw(summary.total)}</span>
      </p>
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium text-muted">Who ordered what ({summary.people.length})</summary>
        <ul className="divide-y divide-soft">
          {summary.people.map((person) => (
            <li key={person.user_id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0"><strong>{person.name}</strong> {person.dish}{person.qty > 1 && ` x${person.qty}`}</span>
              <span className="flex items-center gap-2 whitespace-nowrap">{formatKrw(person.amount)}{personAction?.(person.user_id)}</span>
            </li>
          ))}
        </ul>
      </details>
    </Card>
  );
}
