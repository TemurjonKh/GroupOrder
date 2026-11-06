import { Tag } from "./ui";
import { formatDate } from "@/lib/round";
import type { Round } from "@/lib/types";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="font-display text-3xl leading-none font-extrabold">{value}</p>
      <p className="mt-1 text-xs font-medium text-muted">{label}</p>
    </div>
  );
}

export function RoundBar({ round, counts }: {
  round: Round;
  counts: { picked: number; skipped: number; noAnswer: number };
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 rounded-[20px] bg-accent-soft px-5 py-5 md:px-7">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-on-accent-soft">
          {formatDate(round.created_at)}
          <Tag tone={round.status === "open" ? "accent" : "ink"}>{round.status === "open" ? "Picks open" : "Finalized"}</Tag>
        </p>
        <h2 className="mt-1 font-display text-4xl leading-none font-extrabold tracking-tight">{round.title}</h2>
      </div>
      <div className="flex gap-7">
        <Stat value={counts.picked} label="Picked" />
        <Stat value={counts.skipped} label="Not joining" />
        <Stat value={counts.noAnswer} label="No answer" />
      </div>
    </div>
  );
}
