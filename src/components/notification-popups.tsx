"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { BellRinging, X } from "@phosphor-icons/react";
import type { PopupNote } from "@/lib/notifications";

const CHECK_MS = 15_000;
// A notice older than this when the app opens is already on the home page; it does not pop up.
const FRESH_MS = 3 * 60_000;
const SHOWN_KEY = "grouporder-popped";
const ASKED_KEY = "grouporder-asked-alerts";

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* private mode */ } };
const supported = () => typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
// Asking is a click away, never automatic, and only until the person answers once.
const askable = () => supported() && Notification.permission === "default" && !read(ASKED_KEY);
const noSubscription = () => () => {};

/** Pops up new notices, such as "lunch is ordered", inside the app and as a phone or computer notification. */
export function NotificationPopups() {
  const [toasts, setToasts] = useState<PopupNote[]>([]);
  const [answered, setAnswered] = useState(false);
  const canAsk = useSyncExternalStore(noSubscription, askable, () => false) && !answered;
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    shown.current = new Set(JSON.parse(read(SHOWN_KEY) ?? "[]") as string[]);
    if (supported()) navigator.serviceWorker.register("/sw.js").catch(() => {});

    let stopped = false;
    async function check() {
      if (stopped) return;
      const response = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
      if (!response?.ok) return;
      const notes = (await response.json()) as PopupNote[];
      const fresh = notes.filter((n) => !shown.current.has(n.id) && Date.now() - Date.parse(n.sentAt) < FRESH_MS);
      for (const note of notes) shown.current.add(note.id);
      write(SHOWN_KEY, JSON.stringify([...shown.current].slice(-100)));
      if (fresh.length === 0) return;
      setToasts((current) => [...fresh, ...current].slice(0, 3));
      if (supported() && Notification.permission === "granted") {
        const registration = await navigator.serviceWorker.ready.catch(() => null);
        for (const note of fresh) {
          registration?.showNotification(note.title, { body: note.body, tag: note.id, data: { href: note.href }, icon: "/icon.svg" });
        }
      }
    }
    check();
    const timer = setInterval(check, CHECK_MS);
    const whenVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", whenVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", whenVisible);
    };
  }, []);

  async function turnOn() {
    write(ASKED_KEY, "1");
    setAnswered(true);
    await Notification.requestPermission().catch(() => "denied");
  }
  const dismiss = (id: string) => setToasts((current) => current.filter((t) => t.id !== id));

  if (toasts.length === 0 && !canAsk) return null;
  return (
    <div aria-live="polite" className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-4 sm:bottom-4 print:hidden">
      {toasts.map((toast) => (
        <div key={toast.id} role="status" className="rise flex items-start gap-3 rounded-[20px] border border-line bg-surface p-4 shadow-lift">
          <BellRinging aria-hidden size={22} weight="fill" className="mt-0.5 shrink-0 text-accent" />
          <Link href={toast.href} onClick={() => dismiss(toast.id)} className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">{toast.title}</span>
            <span className="text-muted">{toast.body}</span>
          </Link>
          <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}
            className="-m-2 flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink">
            <X aria-hidden size={16} />
          </button>
        </div>
      ))}
      {canAsk && (
        <div className="rounded-[20px] border border-line bg-surface p-4 text-sm shadow-lift">
          <p className="font-semibold">Get a pop-up when lunch is ordered?</p>
          <p className="mt-0.5 text-muted">Also for reminders and changes to your picks, while GroupOrder is open.</p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={turnOn} className="min-h-11 cursor-pointer rounded-full bg-accent px-4 font-semibold text-on-accent">Turn on</button>
            <button type="button" onClick={() => { write(ASKED_KEY, "1"); setAnswered(true); }} className="min-h-11 cursor-pointer rounded-full px-4 font-semibold text-muted hover:bg-soft">Not now</button>
          </div>
        </div>
      )}
    </div>
  );
}
