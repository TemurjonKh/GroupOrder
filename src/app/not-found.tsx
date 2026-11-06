import Link from "next/link";
import { buttonStyles } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-5xl font-extrabold tracking-tight">Nothing on this plate.</h1>
      <p className="mt-3 mb-6 text-muted">That page or invite code does not exist. Check the link with whoever sent it.</p>
      <Link href="/" className={`${buttonStyles.primary} self-start`}>Back to my groups</Link>
    </main>
  );
}
