import type { ComponentProps } from "react";

const buttonBase =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-white hover:bg-accent-dark`,
  secondary: `${buttonBase} border border-line bg-surface text-ink hover:bg-soft`,
  danger: `${buttonBase} border border-line bg-surface text-danger hover:bg-soft`,
};

export function Button({ look = "primary", className = "", ...props }: ComponentProps<"button"> & { look?: keyof typeof buttonStyles }) {
  return <button {...props} className={`${buttonStyles[look]} ${className}`} />;
}

export const inputStyles = "min-h-11 w-full rounded-lg border border-line bg-surface px-3 text-base";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-xl border border-line bg-surface ${className}`} />;
}

/** Round picture. Images here are decorative: the name is always written next to them. */
export function Circle({ src, label, size = 40 }: { src?: string | null; label?: string; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- photos come from Supabase Storage or data URIs
    return <img src={src} alt="" style={style} className="shrink-0 rounded-full border border-line object-cover" />;
  }
  return (
    <span aria-hidden style={style} className="flex shrink-0 items-center justify-center rounded-full bg-soft text-sm font-semibold text-muted">
      {label?.charAt(0).toUpperCase()}
    </span>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "amber"; children: React.ReactNode }) {
  const tones = { neutral: "bg-soft text-muted", accent: "bg-accent-soft text-accent-dark", amber: "bg-amber-soft text-amber" };
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}
