import { redirect } from "next/navigation";

// The stable link printed on QR codes and written to NFC tags: always the current round.
export default async function NowPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  redirect(`/g/${code}`);
}
