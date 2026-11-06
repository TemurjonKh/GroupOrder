import Link from "next/link";
import { signOut } from "@/app/actions";

export function AppHeader() {
  return (
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-bold tracking-tight">GroupOrder</Link>
        <form action={signOut}>
          <button className="min-h-11 cursor-pointer px-2 text-sm text-muted hover:text-ink">Log out</button>
        </form>
      </div>
    </header>
  );
}
