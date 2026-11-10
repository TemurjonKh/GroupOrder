"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { MagnifyingGlass, SquaresFour, X } from "@phosphor-icons/react";
import { KIND_PHOTOS, RESTAURANT_KINDS, type RestaurantKind } from "@/lib/restaurant-kind";
import { useT } from "./lang";

export type FinderItem = {
  id: string;
  /** Lowercase text to search: the name, the cuisine and the dish names. */
  text: string;
  kinds: RestaurantKind[];
  card: ReactNode;
};

/** Search and food-type chips over the restaurant list. The cards keep their order: suggested first. */
export function RestaurantFinder({ items }: { items: FinderItem[] }) {
  const t = useT();
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
        <span className="sr-only">{t("Search restaurants and dishes", "식당과 메뉴 검색")}</span>
        <MagnifyingGlass aria-hidden size={20} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
          placeholder={t("Search restaurants or dishes, like jjamppong or burger", "식당이나 메뉴 검색 (예: 짬뽕, 버거)")}
          className="min-h-12 w-full rounded-full border border-line bg-surface pr-4 pl-11 text-base outline-none transition-colors placeholder:text-muted focus:border-ink" />
      </label>
      <div role="group" aria-label={t("Food type", "음식 종류")} className="no-scrollbar -mx-4 mt-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <Sticker active={kind === null} onClick={() => setKind(null)} label={t("All", "전체")} count={items.length}>
          <SquaresFour aria-hidden size={34} weight="duotone" />
        </Sticker>
        {chips.map((k) => (
          <Sticker key={k.key} active={kind === k.key} onClick={() => setKind(kind === k.key ? null : k.key)} label={t(k.label, k.korean)} count={k.count}>
            <Image src={KIND_PHOTOS[k.key]} alt="" fill sizes="80px" className="object-cover" />
          </Sticker>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="mt-4 rounded-[20px] border border-line bg-surface p-6 text-center text-sm text-muted">
          {t("No restaurant here matches", "조건에 맞는 식당이 없습니다")}{query && <> &quot;{query}&quot;</>}{kind && <> ({t(chips.find((k) => k.key === kind)!.label, chips.find((k) => k.key === kind)!.korean)})</>}.
          <button type="button" onClick={() => { setQuery(""); setKind(null); }}
            className="ml-2 inline-flex min-h-11 cursor-pointer items-center gap-1 font-semibold text-on-accent-soft underline-offset-4 hover:underline">
            <X aria-hidden size={14} /> {t("Clear", "초기화")}
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

/** A round food picture with its name underneath, like the category row in delivery apps. */
function Sticker({ active, onClick, label, count, children }: {
  active: boolean; onClick: () => void; label: string; count: number; children: ReactNode;
}) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} aria-label={`${label}, ${count}`}
      className="group flex w-20 shrink-0 cursor-pointer flex-col items-center gap-1.5 text-center">
      <span className={`relative flex size-[72px] items-center justify-center overflow-hidden rounded-full bg-tile text-muted shadow-sm ring-offset-2 ring-offset-page transition ${
        active ? "ring-3 ring-accent" : "ring-1 ring-line group-hover:ring-ink"}`}>
        {children}
      </span>
      <span className={`text-sm leading-tight ${active ? "font-bold text-ink" : "font-semibold text-muted group-hover:text-ink"}`}>
        {label} <span className="font-normal opacity-70">{count}</span>
      </span>
    </button>
  );
}
