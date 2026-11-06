"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
import { formatTime, roundState } from "@/lib/round";
import type { Round } from "@/lib/types";
import { Button, Field, inputStyles } from "./ui";

const FALLBACK_REFRESH_MS = 30_000;
// npm run dev:local has no Realtime server, so it polls quickly instead.
const LOCAL_MODE = process.env.NEXT_PUBLIC_LOCAL_BACKEND === "1";
const LOCAL_REFRESH_MS = 3_000;

/** Reloads server data when picks change, so everyone's panel updates live. */
export function LiveRefresh({ groupId, roundId }: { groupId: string; roundId?: string }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => router.refresh();
    if (LOCAL_MODE) {
      const timer = setInterval(refresh, LOCAL_REFRESH_MS);
      return () => clearInterval(timer);
    }
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

const formatLeft = (minutes: number) =>
  minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;

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
    return <span>closes {formatTime(round.deadline)}{left !== null && ` · ${formatLeft(left)} left`}</span>;
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

export function GroupTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // The Lunch tab is the group root, so it also covers the pages reached from it.
  const active = [...tabs].reverse().find((tab) => pathname.startsWith(tab.href))?.href;
  return (
    <nav aria-label="Group" className="mt-2 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={`-mb-px flex min-h-11 items-center border-b-2 px-3 text-sm font-medium whitespace-nowrap ${
            tab.href === active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function LocationFields({ lat, lng }: { lat: number; lng: number }) {
  const [coords, setCoords] = useState({ lat: String(lat), lng: String(lng) });
  const [message, setMessage] = useState("");
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Latitude">
          <input name="lat" inputMode="decimal" required value={coords.lat} onChange={(e) => setCoords({ ...coords, lat: e.target.value })} className={inputStyles} />
        </Field>
        <Field label="Longitude">
          <input name="lng" inputMode="decimal" required value={coords.lng} onChange={(e) => setCoords({ ...coords, lng: e.target.value })} className={inputStyles} />
        </Field>
      </div>
      <Button
        look="secondary"
        type="button"
        onClick={() => {
          setMessage("Finding your location…");
          navigator.geolocation.getCurrentPosition(
            ({ coords: c }) => {
              setCoords({ lat: c.latitude.toFixed(5), lng: c.longitude.toFixed(5) });
              setMessage("Location filled in. Press Save to keep it.");
            },
            () => setMessage("Could not get your location. You can type the coordinates instead."),
          );
        }}
      >
        Use my current location
      </Button>
      {message && <p role="status" className="text-sm text-muted">{message}</p>}
    </>
  );
}
