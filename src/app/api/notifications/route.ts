import { NextResponse } from "next/server";
import { getLang } from "@/lib/i18n";
import { NOTE_TEXT, noteText, type PopupNote } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";

type Row = { id: string; type: string; sent_at: string; round: { title: string; group: { name: string; invite_code: string } | null } | null };

/** The caller's unread notices, newest first, for the pop-ups. Row-level security keeps it to their own. */
export async function GET() {
  const supabase = await createClient();
  const lang = await getLang();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, sent_at, round:order_rounds(title, group:groups(name, invite_code))")
    .is("read_at", null)
    .order("sent_at", { ascending: false })
    .limit(10);
  const notes: PopupNote[] = ((data ?? []) as unknown as Row[])
    .filter((n) => n.round?.group && NOTE_TEXT[n.type])
    .map((n) => ({
      id: n.id,
      sentAt: n.sent_at,
      title: n.type === "ordered" ? (lang === "ko" ? "점심 주문 완료" : "Lunch is ordered") : n.round!.group!.name,
      body: `${n.round!.group!.name}: ${n.round!.title} ${noteText(n.type, lang)}`,
      href: `/g/${n.round!.group!.invite_code}`,
    }));
  return NextResponse.json(notes, { headers: { "cache-control": "no-store" } });
}
