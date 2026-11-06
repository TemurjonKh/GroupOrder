"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formatTime, roundState } from "@/lib/round";
import type { Round } from "@/lib/types";
import { Button } from "./ui";

const FALLBACK_REFRESH_MS = 30_000;

/** Reloads server data when picks change, so everyone's panel updates live. */
export function LiveRefresh({ groupId, roundId }: { groupId: string; roundId?: string }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    const supabase = createClient();
    const channel = supabase.channel(`group-${groupId}`).on(
      "postgres_changes",
      { event: "*", schema: "public", table: "order_rounds", filter: `group_id=eq.${groupId}` },
      refresh,
    );
    if (roundId) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `round_id=eq.${roundId}` },
        refresh,
      );
    }
    channel.subscribe();
    const timer = setInterval(refresh, FALLBACK_REFRESH_MS); // in case the live connection drops
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [router, groupId, roundId]);
  return null;
}

function subscribeToClock(onTick: () => void) {
  const timer = setInterval(onTick, 15_000);
  return () => clearInterval(timer);
}
const roundToQuarterMinute = () => Math.floor(Date.now() / 15_000) * 15_000;

/** "closes 11:20 · 23 min left". The time left appears only in the browser to keep server and client HTML equal. */
export function Countdown({ round }: { round: Pick<Round, "status" | "deadline"> }) {
  const router = useRouter();
  const now = useSyncExternalStore(subscribeToClock, roundToQuarterMinute, () => null);
  const state = now === null ? null : roundState(round, now);
  const previous = useRef(state);
  useEffect(() => {
    if (previous.current && state && previous.current !== state) router.refresh();
    previous.current = state;
  }, [state, router]);
  if (now === null || state === "open" || state === "closing_soon") {
    const left = now === null ? null : Math.ceil((new Date(round.deadline).getTime() - now) / 60_000);
    return <span>closes {formatTime(round.deadline)}{left !== null && ` · ${left} min left`}</span>;
  }
  return <span>closed {formatTime(round.deadline)}</span>;
}

export function CopyButton({ text, label = "Copy summary" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      look="secondary"
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
}

export function PrintButton() {
  return <Button look="secondary" type="button" onClick={() => window.print()}>Print QR</Button>;
}
