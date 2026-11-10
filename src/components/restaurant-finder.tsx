"use client";

import { useMemo, useState, type ReactNode } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { RESTAURANT_KINDS, type RestaurantKind } from "@/lib/restaurant-kind";

export type FinderItem = {
  id: string;
  /** Lowercase text to search: the name, the cuisine and the dish names. */
  text: string;
  kinds: RestaurantKind[];
  card: ReactNode;
};

/** Search and food-type chips over the restaurant list. The cards keep their order: suggested first. */
export function RestaurantFinder({ items }: { items: FinderItem[] }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<RestaurantKind | null>(null);
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);

  // Only types that some restaurant here has, so no chip leads to an empty list.
  const chips = useMemo(() => RESTAURANT_KINDS
    .map((k) => ({ ...k, count: items.filter((item) => item.kinds.includes(k.key)).length }))
    .filter((k) => k.count > 0), [items]);
  const shown = items.filter((item) =>
    (!kind || item.kinds.includes(kind)) && words.every((word) => item.text.includes(word)));

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search restaurants and dishes</span>
        <MagnifyingGlass aria-hidden size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder="Search restaurants or dishes, like 짬뽕 or burger"
          className="min-h-12 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-base outline-none transition-colors placeholder:text-muted focus:border-ink" />
      </label>
      <div role="group" aria-label="Food type" className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        <Chip active={kind === null} onClick={() => setKind(null)}>All <span className="opacity-60">{items.length}</span></Chip>
        {chips.map((k) => (
          <Chip key={k.key} active={kind === k.key} onClick={() => setKind(kind === k.key ? null : k.key)}>
            {k.label} <span className="font-normal opacity-70">{k.korean}</span> <span className="opacity-60">{k.count}</span>
          </Chip>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-line bg-surface p-6 text-center text-sm text-muted">
          No restaurant here matches{query && <> &quot;{query}&quot;</>}{kind && <> in {chips.find((k) => k.key === kind)?.label}</>}.
          <button type="button" onClick={() => { setQuery(""); setKind(null); }}
            className="ml-2 inline-flex min-h-11 cursor-pointer items-center gap-1 font-semibold text-on-accent-soft underline-offset-4 hover:underline">
            <X aria-hidden size={14} /> Clear
          </button>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {shown.map((item) => <li key={item.id}>{item.card}</li>)}
        </ul>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-1 rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
        active ? "border-ink bg-ink text-page" : "border-line bg-surface hover:border-ink"}`}>
      {children}
    </button>
  );
}
