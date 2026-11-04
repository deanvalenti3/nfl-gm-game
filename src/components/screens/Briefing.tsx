import type { ScenarioSnapshot } from "@/domain/types";
import { capSummary, userRoster, type RunState } from "@/engine/game";
import { fmtMoney } from "@/engine/cap";
import { Button, Headline, Pill, Stat } from "@/components/ui";

export function Briefing({ state, snapshot, onStart }: { state: RunState; snapshot: ScenarioSnapshot; onStart: () => void }) {
  const sc = snapshot.scenario;
  const team = snapshot.teams.find((t) => t.id === sc.teamId)!;
  const cap = capSummary(state, snapshot);
  const picks = Object.values(state.picks).filter((p) => p.teamId === state.teamId && p.year === state.year);
  const first = picks.filter((p) => p.round === 1).map((p) => `#${p.overall}`).join(", ");
  const expiring = userRoster(state).filter((p) => p.contract && p.contract.endYear === state.year && p.ability.ovr >= 70).length;

  return (
    <div className="stagger flex flex-col gap-6">
      <Headline kicker={`${team.city} · ${sc.season} offseason`} sub={sc.subtitle}>Front Office Briefing</Headline>

      <section className="card p-5">
        <div className="label mb-1">Ownership expectations</div>
        <div className="display text-[27px] font-bold uppercase leading-tight">{sc.objective.headline}</div>
        <p className="mt-2 text-[15px] leading-snug text-ink-2">The real result stays hidden until your season is over. No hindsight, no peeking.</p>
      </section>

      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Last season" value={`${team.prevRecord.w}–${team.prevRecord.l}`} tone="down" />
        <Stat label="Cap space" value={fmtMoney(cap.space, { decimals: 1 })} tone="up" sub={`${fmtMoney(cap.committed)} committed`} />
        <Stat label="Draft capital" value={first || "—"} sub={`${picks.length} total picks`} />
        <Stat label="Expiring starters" value={expiring} sub="entering free agency" tone={expiring >= 3 ? "risk" : undefined} />
      </section>

      <section className="card p-5">
        <div className="label mb-2">Key problems</div>
        <div className="flex flex-wrap gap-2">
          {sc.keyProblems.map((p) => (
            <Pill key={p} tone="down" className="text-[16px]">{p}</Pill>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <div className="label mb-2">Important decisions</div>
        <ul className="flex flex-col gap-1.5 text-[17px] leading-snug">
          {sc.briefingNotes.map((n) => (
            <li key={n} className="flex gap-2.5">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-team" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <Button size="lg" full onClick={onStart}>Open the roster audit</Button>
    </div>
  );
}
