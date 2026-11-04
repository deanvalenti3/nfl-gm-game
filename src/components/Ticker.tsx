import type { Team } from "@/domain/types";
import type { FeedItem } from "@/engine/game";

const KIND: Record<FeedItem["kind"], { label: string; tone: string }> = {
  SIGN: { label: "Signed", tone: "text-up" },
  RELEASE: { label: "Released", tone: "text-down" },
  TRADE: { label: "Trade", tone: "text-risk" },
  DRAFT: { label: "Draft", tone: "text-even" },
  INJURY: { label: "Injury", tone: "text-down" },
  NOTE: { label: "", tone: "text-ink-3" },
};

/** League transaction feed, grouped by day. Team chip, one headline, one detail line. */
export function Ticker({ items, teams, userTeam, limit = 30 }: { items: FeedItem[]; teams: Team[]; userTeam?: string; limit?: number }) {
  const shown = items.slice(0, limit);
  if (!shown.length) return <div className="text-[15px] text-ink-3">Nothing has happened yet.</div>;
  const byTeam = Object.fromEntries(teams.map((t) => [t.id, t]));
  const groups: { when: string; items: FeedItem[] }[] = [];
  for (const f of shown) {
    const g = groups[groups.length - 1];
    if (g && g.when === f.when) g.items.push(f);
    else groups.push({ when: f.when, items: [f] });
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={`${g.when}-${g.items[0].id}`}>
          <div className="label mb-1.5">{g.when}</div>
          <ul className="flex flex-col gap-1.5">
            {g.items.map((f, i) => {
              const t = byTeam[f.teamId];
              const mine = f.teamId === userTeam;
              return (
                <li key={f.id} className={`flex items-center gap-2.5 rounded-lg border px-2.5 py-2 ${mine ? "border-team/50 bg-team-soft" : "border-line bg-elev"} ${i === 0 ? "anim-slide" : ""}`}>
                  <span className="display flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[13px] font-bold text-white" style={{ background: t?.colors.primary ?? "#333" }} aria-label={t?.name ?? f.teamId}>
                    {f.teamId}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] font-semibold leading-tight">{f.headline}</div>
                    <div className="num mt-0.5 truncate text-[13px] text-ink-3">
                      <span className={`display mr-1.5 font-bold uppercase tracking-wide ${KIND[f.kind].tone}`}>{KIND[f.kind].label}</span>
                      {f.detail}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
