import type { ButtonHTMLAttributes, ReactNode } from "react";
import { createPortal } from "react-dom";
import type { Tier } from "@/domain/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const base = "display inline-flex items-center justify-center gap-2 rounded-xl font-bold uppercase tracking-[0.08em] transition-[transform,background-color,box-shadow,opacity] duration-150 active:scale-[0.97] disabled:opacity-35 disabled:active:scale-100 disabled:cursor-not-allowed select-none";
const variants: Record<Variant, string> = {
  primary: "bg-team text-team-ink shadow-card hover:brightness-110",
  secondary: "bg-elev text-ink border border-line-strong hover:bg-sunk",
  ghost: "bg-transparent text-ink-2 hover:text-ink hover:bg-sunk",
  danger: "bg-down-soft text-down border border-down/30 hover:bg-down/20",
};
const sizes: Record<Size, string> = { sm: "h-10 px-3.5 text-[15px]", md: "h-12 px-5 text-[17px]", lg: "h-14 px-7 text-[20px]" };

export function Button({ variant = "primary", size = "md", full = false, className = "", children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; full?: boolean; children: ReactNode }) {
  return (
    <button className={[base, variants[variant], sizes[size], full ? "w-full" : "", className].join(" ")} {...rest}>
      {children}
    </button>
  );
}

export type Tone = "neutral" | "team" | "up" | "even" | "down" | "risk";
const tones: Record<Tone, string> = {
  neutral: "bg-sunk text-ink-2 border border-line",
  team: "bg-team-soft text-team",
  up: "bg-up-soft text-up",
  even: "bg-even-soft text-even",
  down: "bg-down-soft text-down",
  risk: "bg-risk-soft text-risk",
};

export function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`display inline-flex items-center rounded-md px-2 py-0.5 text-[15px] font-bold uppercase tracking-[0.08em] ${tones[tone]} ${className}`}>{children}</span>;
}

export function tierTone(tier: Tier): Tone {
  switch (tier) {
    case "ELITE": return "up";
    case "HIGH-END STARTER": return "up";
    case "STARTER": return "even";
    case "ROTATIONAL": return "neutral";
    case "DEPTH": return "neutral";
    case "REPLACEMENT": return "down";
  }
}

export function Stat({ label, value, sub, tone, size = "md" }: { label: string; value: ReactNode; sub?: ReactNode; tone?: Tone; size?: "md" | "lg" }) {
  const color = tone === "up" ? "text-up" : tone === "down" ? "text-down" : tone === "risk" ? "text-risk" : tone === "team" ? "text-team" : "text-ink";
  return (
    <div className="card px-4 py-3">
      <div className="label">{label}</div>
      <div className={`display num mt-0.5 font-bold leading-none ${size === "lg" ? "text-[38px]" : "text-[27px]"} ${color}`}>{value}</div>
      {sub && <div className="mt-1 text-[14px] leading-snug text-ink-2">{sub}</div>}
    </div>
  );
}

export function SectionLabel({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="label">{children}</h2>
      {right}
    </div>
  );
}

export function Headline({ children, kicker, sub }: { children: ReactNode; kicker?: ReactNode; sub?: ReactNode }) {
  return (
    <div>
      {kicker && <div className="label mb-1 text-team">{kicker}</div>}
      <h1 className="display text-[34px] font-bold uppercase leading-[0.95] tracking-tight sm:text-[44px]">{children}</h1>
      {sub && <p className="mt-2 max-w-prose text-[17px] leading-snug text-ink-2">{sub}</p>}
    </div>
  );
}

/** Consequence strip shown after a decision locks. */
export function Callout({ tone = "even", title, detail }: { tone?: Tone; title: ReactNode; detail?: ReactNode }) {
  const ring = tone === "up" ? "border-up/40 bg-up-soft" : tone === "down" ? "border-down/40 bg-down-soft" : tone === "risk" ? "border-risk/40 bg-risk-soft" : tone === "team" ? "border-team/40 bg-team-soft" : "border-even/40 bg-even-soft";
  return (
    <div className={`anim-pop rounded-xl border px-4 py-3 ${ring}`}>
      <div className="display text-[19px] font-bold uppercase tracking-wide">{title}</div>
      {detail && <div className="mt-0.5 text-[16px] leading-snug text-ink-2">{detail}</div>}
    </div>
  );
}

export function Bar({ label, value, delay = 0, tone = "team" }: { label: string; value: number; delay?: number; tone?: Tone }) {
  const color = tone === "up" ? "bg-up" : tone === "down" ? "bg-down" : tone === "risk" ? "bg-risk" : tone === "even" ? "bg-even" : "bg-team";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="num text-[15px] font-bold">{Math.round(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunk">
        <div className={`anim-grow h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%`, animationDelay: `${delay}ms` }} />
      </div>
    </div>
  );
}

export function ScoreRing({ value, label, size = 170 }: { value: number; label?: string; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const end = c - (c * Math.max(0, Math.min(100, value))) / 100;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`Score ${value} of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--team)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} style={{ "--ring-start": c, "--ring-end": end, strokeDashoffset: end, animation: "ring 1.1s cubic-bezier(0.2,0.7,0.2,1) both" } as React.CSSProperties} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display num text-[60px] font-bold leading-none">{value}</span>
        {label && <span className="label mt-1">{label}</span>}
      </div>
    </div>
  );
}

export function Sheet({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6" onClick={onClose} role="dialog" aria-modal>
      <div className={`anim-pop max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-line bg-elev p-5 shadow-lift sm:rounded-2xl ${wide ? "sm:max-w-4xl" : "sm:max-w-xl"}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="display text-[25px] font-bold uppercase leading-none tracking-wide">{title}</div>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-lg bg-sunk text-ink-2 hover:text-ink">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className={up ? "rotate-180" : ""}>
      <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
