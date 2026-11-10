"use client";

import { useOptimistic, useTransition } from "react";
import { Heart } from "@phosphor-icons/react";
import { toggleFavourite } from "@/app/actions";
import { useT } from "./lang";

/** A heart over a dish card. It fills at once; the page refreshes behind it. */
export function FavouriteButton({ code, dishId, dishLabel, on }: { code: string; dishId: string; dishLabel: string; on: boolean }) {
  const t = useT();
  const [hearted, setHearted] = useOptimistic(on);
  const [, startTransition] = useTransition();
  return (
    <button type="button" aria-pressed={hearted}
      aria-label={hearted ? t(`Remove ${dishLabel} from favourites`, `${dishLabel} 즐겨찾기 해제`) : t(`Add ${dishLabel} to favourites`, `${dishLabel} 즐겨찾기`)}
      onClick={() => startTransition(async () => {
        setHearted(!hearted);
        const form = new FormData();
        form.set("code", code);
        form.set("dish", dishId);
        await toggleFavourite(null, form);
      })}
      className={`flex size-10 cursor-pointer items-center justify-center rounded-full shadow-sm backdrop-blur-sm transition active:scale-90 ${
        hearted ? "bg-surface text-accent" : "bg-surface/85 text-muted hover:text-accent"}`}>
      <Heart aria-hidden size={22} weight={hearted ? "fill" : "bold"} />
    </button>
  );
}
