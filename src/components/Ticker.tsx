import type { FeedItem } from "@/engine/game";

/** League transaction feed: the thing that makes the league feel alive. */
export function Ticker({ items, limit = 30, compact = false }: { items: FeedItem[]; limit?: number; compact?: boolean }) {
  const shown = items.slice(0, limit);
  if (!shown.length) return <div className="text-[15px] text-ink-3">No transactions yet.</div>;
  return (
    <ul className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
      {shown.map((f, i) => (
        <li key={f.id} className={`flex gap-2.5 text-[15px] leading-snug ${i === 0 ? "anim-slide" : ""}`}>
          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${f.kind === "SIGN" ? "bg-up" : f.kind === "RELEASE" ? "bg-down" : f.kind === "TRADE" ? "bg-risk" : f.kind === "INJURY" ? "bg-down" : "bg-even"}`} />
          <div className="min-w-0">
            <span className="label mr-1.5 text-[12px]">{f.when}</span>
            <span className="text-ink-2">{f.text}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
