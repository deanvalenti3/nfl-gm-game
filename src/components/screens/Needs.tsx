import type { Position } from "@/domain/types";
import { userRoster, type Action, type RunState } from "@/engine/game";
import { buildDepthChart, gradePositions } from "@/engine/roster";
import { Button, Chevron, Headline, Pill, tierTone } from "@/components/ui";

const CANDIDATES: Position[] = ["QB", "RB", "WR", "TE", "OT", "G", "C", "EDGE", "DT", "LB", "CB", "S"];

/** Ranking interaction: order your three biggest needs. Drives the shortlist and auto-draft. */
export function Needs({ state, dispatch }: { state: RunState; dispatch: (a: Action) => void }) {
  const roster = userRoster(state);
  const grades = gradePositions(roster, buildDepthChart(roster));
  const gradeOf = (pos: Position) => grades.find((g) => g.pos === pos)!;
  const ranked = state.needs;
  const rest = CANDIDATES.filter((p) => !ranked.includes(p)).sort((a, b) => gradeOf(a).score - gradeOf(b).score);

  const set = (needs: Position[]) => dispatch({ type: "SET_NEEDS", needs });
  const move = (i: number, d: -1 | 1) => {
    const n = [...ranked];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    set(n);
  };

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker="Priorities" sub="Your shortlist in free agency and the auto-draft follow this order. The tiers shown are your projected starters right now.">Rank your three biggest needs</Headline>
      <ol className="flex flex-col gap-2">
        {ranked.map((pos, i) => (
          <li key={pos} className="card flex items-center gap-3 px-3 py-2.5">
            <span className="display num flex h-10 w-10 items-center justify-center rounded-lg bg-team text-[18px] font-bold text-team-ink">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="display text-[20px] font-bold uppercase leading-none">{pos}</div>
              <Pill tone={tierTone(gradeOf(pos).tier)} className="mt-1">{gradeOf(pos).tier}</Pill>
            </div>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${pos} up`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-sunk text-ink-2 disabled:opacity-25"><Chevron up /></button>
              <button onClick={() => move(i, 1)} disabled={i === ranked.length - 1} aria-label={`Move ${pos} down`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-sunk text-ink-2 disabled:opacity-25"><Chevron /></button>
              <button onClick={() => set(ranked.filter((p) => p !== pos))} aria-label={`Remove ${pos}`} className="flex h-9 w-9 items-center justify-center rounded-lg bg-sunk text-ink-3 hover:text-down">×</button>
            </div>
          </li>
        ))}
      </ol>
      <div>
        <div className="label mb-2">Add a position{ranked.length >= 3 ? " (replaces #3)" : ""}</div>
        <div className="flex flex-wrap gap-1.5">
          {rest.map((pos) => (
            <button key={pos} onClick={() => set(ranked.length >= 3 ? [...ranked.slice(0, 2), pos] : [...ranked, pos])} className="card display flex items-center gap-2 px-3 py-1.5 text-[14px] font-bold uppercase tracking-wide hover:border-line-strong">
              {pos}
              <span className={`h-2 w-2 rounded-full ${gradeOf(pos).score < 65 ? "bg-down" : gradeOf(pos).score < 74 ? "bg-risk" : "bg-up"}`} />
            </button>
          ))}
        </div>
      </div>
      <Button size="lg" full disabled={ranked.length < 3} onClick={() => dispatch({ type: "CONFIRM_NEEDS" })}>Open free agency</Button>
    </div>
  );
}
