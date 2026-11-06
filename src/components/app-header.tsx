import Link from "next/link";
import { signOut } from "@/app/actions";
import { getUser } from "@/lib/data";

const MAX_BADGE = 20;

export async function AppHeader() {
  const { supabase } = await getUser();
  const { data } = await supabase.from("notifications").select("id").is("read_at", null).limit(MAX_BADGE);
  const unread = data?.length ?? 0;
  return (
    <header className="border-b border-line bg-surface print:hidden">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-bold tracking-tight">GroupOrder</Link>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Link href="/" className="inline-flex min-h-11 items-center">
              <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-white">
                {unread} {unread === 1 ? "notice" : "notices"}
              </span>
            </Link>
          )}
          <form action={signOut}>
            <button className="min-h-11 cursor-pointer px-2 text-sm text-muted hover:text-ink">Log out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
