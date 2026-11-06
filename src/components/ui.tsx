import Image from "next/image";
import type { ComponentProps } from "react";
import type { Restaurant } from "@/lib/types";

// Shape rule: buttons are pills, cards 20px, inputs 12px, photos 14-16px.
const buttonBase =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold whitespace-nowrap transition duration-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";
export const buttonStyles = {
  primary: `${buttonBase} bg-accent text-on-accent hover:bg-accent-hover`,
  secondary: `${buttonBase} border border-line bg-surface text-ink hover:border-ink`,
  danger: `${buttonBase} border border-line bg-surface text-danger hover:border-danger`,
};
export const textLink = "inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-on-accent-soft underline-offset-4 hover:underline";

export function Button({ look = "primary", className = "", ...props }: ComponentProps<"button"> & { look?: keyof typeof buttonStyles }) {
  return <button {...props} className={`${buttonStyles[look]} ${className}`} />;
}

export const inputStyles =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-base text-ink placeholder:text-muted transition-colors focus:border-accent";

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-sm text-muted">{hint}</span>}
    </label>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-[20px] border border-line bg-surface ${className}`} />;
}

/** A person's initial, or their avatar when they have one. */
export function Avatar({ src, name, size = 36 }: { src?: string | null; name: string; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user avatars come from any host
    return <img src={src} alt="" style={style} className="shrink-0 rounded-xl object-cover" />;
  }
  return (
    <span aria-hidden style={style} className="flex shrink-0 items-center justify-center rounded-xl bg-soft text-sm font-bold text-muted">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * A dish photo on its light tile, from the brand's own servers and resized on the way.
 * Cut-out product shots (PNG) sit inside the tile with some air; full-frame photos (JPG) fill it.
 */
export function DishPhoto({ src, alt = "", size, sizes, className = "" }: {
  src?: string | null;
  alt?: string;
  /** Fixed size in pixels. Leave out when the class sets the size, and pass `sizes` instead. */
  size?: number;
  sizes?: string;
  className?: string;
}) {
  const style = size ? { width: size, height: size } : undefined;
  const fit = src && /\.jpe?g/i.test(src) ? "object-cover" : "object-contain p-[6%]";
  return (
    <span style={style} className={`relative block shrink-0 overflow-hidden rounded-[14px] bg-tile ${className}`}>
      {src && <Image src={src} alt={alt} fill sizes={size ? `${size}px` : (sizes ?? "(max-width: 768px) 50vw, 260px")} className={fit} />}
    </span>
  );
}

export function BrandLogo({ restaurant, size = 40 }: { restaurant: Pick<Restaurant, "name" | "logo" | "logo_bg">; size?: number }) {
  const { name, logo, logo_bg } = restaurant;
  return (
    <span
      style={{ width: size, height: size, padding: Math.round(size * 0.12), backgroundColor: logo_bg ?? undefined }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-surface"
    >
      {logo
        // eslint-disable-next-line @next/next/no-img-element -- hosts are the brands' own, not known at build time
        ? <img src={logo} alt={`${name} logo`} loading="lazy" referrerPolicy="no-referrer" className="size-full object-contain" />
        : <span className="text-xs font-bold text-ink">{name.charAt(0)}</span>}
    </span>
  );
}

export function Tag({ tone = "neutral", children }: { tone?: "neutral" | "accent" | "ink"; children: React.ReactNode }) {
  const tones = { neutral: "bg-soft text-muted", accent: "bg-accent-soft text-on-accent-soft", ink: "bg-ink text-page" };
  return <span className={`inline-block rounded-lg px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export const PageTitle = ({ children }: { children: React.ReactNode }) => (
  <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight md:text-5xl">{children}</h1>
);
