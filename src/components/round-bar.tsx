import { Countdown } from "./client-bits";
import { Pill } from "./ui";
import type { RoundState } from "@/lib/round";
import type { Round } from "@/lib/types";

const STATE_PILL: Record<RoundState, { label: string; tone: "accent" | "amber" | "neutral" }> = {
  open: { label: "Open", tone: "accent" },
  closing_soon: { label: "Closing soon", tone: "amber" },
  closed: { label: "Closed", tone: "amber" },
  finalized: { label: "Finalized", tone: "accent" },
  ordered: { label: "Ordered", tone: "neutral" },
};

export function RoundBar({ round, state, counts }: {
  round: Round;
  state: RoundState;
  counts: { picked: number; skipped: number; total: number };
}) {
  const pill = STATE_PILL[state];
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-accent bg-accent-soft px-4 py-3">
      <p className="flex items-center gap-2 font-semibold">
        {round.title} <span className="font-normal capitalize text-muted">· {round.mode}</span> <Pill tone={pill.tone}>{pill.label}</Pill>
      </p>
      <p className="text-sm">
        {counts.picked}/{counts.total} picked · {counts.skipped} skipped
        {round.status === "open" && <> · <Countdown round={round} /></>}
      </p>
    </div>
  );
}
