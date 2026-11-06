"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/browser";
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

/** The main links in the header, with the current page marked. */
export function HeaderNav({ links, className = "" }: { links: { href: string; label: string; icon: ReactNode }[]; className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={`flex gap-1 ${className}`}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href ? "page" : undefined}
          className={`flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold whitespace-nowrap transition-colors ${
            pathname === link.href ? "bg-ink text-page" : "text-muted hover:bg-soft hover:text-ink"
          }`}
        >
          {link.icon} {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function GroupTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  // The Lunch tab is the group root, so it also covers the pages reached from it.
  const active = [...tabs].reverse().find((tab) => pathname.startsWith(tab.href))?.href;
  return (
    <nav aria-label="Group" className="no-scrollbar mt-3 flex gap-1 overflow-x-auto">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === active ? "page" : undefined}
          className={`flex min-h-10 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
            tab.href === active ? "bg-ink text-page" : "text-muted hover:bg-soft hover:text-ink"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

/** A native modal dialog, so focus handling and Escape come from the browser. */
export function Sheet({ closeHref, label, children }: { closeHref: string; label: string; children: ReactNode }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      className="sheet"
      onClose={() => router.push(closeHref, { scroll: false })}
      onClick={(event) => { if (event.target === ref.current) ref.current?.close(); }}
    >
      {children}
    </dialog>
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
