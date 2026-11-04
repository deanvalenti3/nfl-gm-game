import { useState } from "react";
import type { Player, Position, ScenarioSnapshot } from "@/domain/types";
import { capSummary, freeAgents, userRoster, type Action, type RunState } from "@/engine/game";
import { DEFENSE, OFFENSE, STARTER_SLOTS, buildDepthChart, gradePositions, rosterAge } from "@/engine/roster";
import { gradeTone, publicGrade } from "@/engine/grades";
import { fmtMoney } from "@/engine/cap";
import { Button, Headline, Pill, Sheet, Stat } from "@/components/ui";
import { PlayerCard } from "@/components/PlayerCard";

/** Depth chart with tap-to-swap starters, strengths/weaknesses, and the start button. */
export function Roster({ state, snapshot, dispatch, inSeason = false }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void; inSeason?: boolean }) {
  const roster = userRoster(state);
  const chart = buildDepthChart(roster, state.depthOverrides);
  const byId = Object.fromEntries(roster.map((p) => [p.id, p]));
  const grades = gradePositions(roster, chart);
  const strengths = grades.filter((g) => g.score >= 78).sort((a, b) => b.score - a.score).slice(0, 3);
  const weaknesses = grades.filter((g) => g.score < 68).sort((a, b) => a.score - b.score).slice(0, 3);
  const depthConcerns = STARTER_SLOTS.filter((s) => !["K", "P"].includes(s.pos)).filter((s) => {
    const b = chart.backups[s.pos]?.[0];
    return !b || byId[b].ability.ovr < 58;
  }).map((s) => s.pos);
  const cap = capSummary(state, snapshot);
  const [editing, setEditing] = useState<string | null>(null);
  const [showFa, setShowFa] = useState(false);
  const tooFew = roster.length < snapshot.scenario.minRosterForSeason;
  const cheapFa = freeAgents(state).filter((p) => (p.market?.aav ?? 0) <= cap.space).sort((a, b) => b.ability.ovr - a.ability.ovr).slice(0, 20);

  const group = (positions: Position[]) => STARTER_SLOTS.filter((s) => positions.includes(s.pos));
  const Slot = ({ slot, i }: { slot: { pos: Position; count: number }; i: number }) => {
    const key = `${slot.pos}${i}`;
    const p = byId[chart.starters[key] ?? ""];
    return (
      <button onClick={() => !inSeason && setEditing(key)} className={`flex items-center gap-2 rounded-lg border border-line bg-elev px-2.5 py-2 text-left ${inSeason ? "" : "hover:border-line-strong"}`}>
        <span className="display w-9 shrink-0 text-[15px] font-bold text-ink-3">{slot.pos}{slot.count > 1 ? i : ""}</span>
        {p ? (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-semibold">{p.name}</span>
            <span className={`display text-[14px] font-bold uppercase tracking-wide ${gradeTone(publicGrade(p)) === "up" ? "text-up" : gradeTone(publicGrade(p)) === "down" ? "text-down" : gradeTone(publicGrade(p)) === "even" ? "text-even" : "text-ink-3"}`}>Grade {publicGrade(p)}{(p.injuredWeeks ?? 0) > 0 ? " · OUT" : ""}</span>
          </span>
        ) : (
          <span className="text-[15px] text-down">Empty</span>
        )}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker={inSeason ? "Depth chart" : "Roster finalization"} sub={inSeason ? undefined : "Your projected starters. Tap a slot to change the starter. When you're ready, start the season."}>{inSeason ? `${snapshot.teams.find((t) => t.id === state.teamId)?.name}` : "This is your team"}</Headline>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Cap space" value={fmtMoney(cap.space, { decimals: 1 })} tone={cap.space < 0 ? "down" : "up"} sub={`${fmtMoney(cap.nextYearSpace)} next year`} />
        <Stat label="Roster" value={roster.length} sub={tooFew ? `need ${snapshot.scenario.minRosterForSeason}` : "players"} tone={tooFew ? "down" : undefined} />
        <Stat label="Starter age" value={rosterAge(roster).toFixed(1)} sub="average" />
        <Stat label="Dead money" value={fmtMoney(state.deadMoney[state.teamId] ?? 0)} tone={(state.deadMoney[state.teamId] ?? 0) > 20_000_000 ? "risk" : undefined} />
      </div>

      <section className="grid gap-2.5 sm:grid-cols-3">
        <div className="card p-4">
          <div className="label mb-1.5 text-up">Strengths</div>
          <div className="flex flex-wrap gap-1.5">{strengths.length ? strengths.map((g) => <Pill key={g.pos} tone="up">{g.pos}</Pill>) : <span className="text-[15px] text-ink-3">No elite units</span>}</div>
        </div>
        <div className="card p-4">
          <div className="label mb-1.5 text-down">Weaknesses</div>
          <div className="flex flex-wrap gap-1.5">{weaknesses.length ? weaknesses.map((g) => <Pill key={g.pos} tone="down">{g.pos}</Pill>) : <span className="text-[15px] text-ink-3">None glaring</span>}</div>
        </div>
        <div className="card p-4">
          <div className="label mb-1.5 text-risk">Depth concerns</div>
          <div className="flex flex-wrap gap-1.5">{depthConcerns.length ? depthConcerns.map((p) => <Pill key={p} tone="risk">{p}</Pill>) : <span className="text-[15px] text-ink-3">Solid</span>}</div>
        </div>
      </section>

      {(["Offense", "Defense", "Special teams"] as const).map((name) => {
        const slots = name === "Offense" ? group(OFFENSE) : name === "Defense" ? group(DEFENSE) : group(["K", "P"]);
        return (
          <section key={name}>
            <div className="label mb-2">{name}</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {slots.flatMap((s) => Array.from({ length: s.count }, (_, i) => <Slot key={`${s.pos}${i + 1}`} slot={s} i={i + 1} />))}
            </div>
          </section>
        );
      })}

      {!inSeason && (
        <>
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={() => setShowFa(true)}>Add a free agent</Button>
            <Button size="lg" full disabled={tooFew} onClick={() => dispatch({ type: "START_SEASON" })}>Start season</Button>
          </div>
          {tooFew && <p className="text-[15px] text-down">You need at least {snapshot.scenario.minRosterForSeason} players to start the season.</p>}
        </>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={`Starter · ${editing}`}>
        {editing && (
          <div className="flex flex-col gap-1.5">
            {roster.filter((p) => p.pos === editing.replace(/\d+$/, "")).sort((a, b) => b.ability.ovr - a.ability.ovr).map((p: Player) => (
              <PlayerCard key={p.id} player={p} year={state.year} selected={chart.starters[editing] === p.id} onClick={() => { dispatch({ type: "SET_STARTER", slot: editing, playerId: p.id }); setEditing(null); }} />
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={showFa} onClose={() => setShowFa(false)} title="Remaining free agents">
        <div className="mb-3 text-[15px] text-ink-2">Leftover free agents sign for their asking price immediately.</div>
        <div className="flex flex-col gap-1.5">
          {cheapFa.map((p) => (
            <PlayerCard key={p.id} player={p} year={state.year} right={<Button size="sm" onClick={() => dispatch({ type: "FA_OFFER", offer: { playerId: p.id, teamId: state.teamId, years: p.market!.years, aav: p.market!.aav, guaranteedPct: p.market!.guaranteedPct } })}>Sign {fmtMoney(p.market!.aav)}</Button>} />
          ))}
          {!cheapFa.length && <div className="text-[15px] text-ink-3">Nobody you can afford.</div>}
        </div>
      </Sheet>
    </div>
  );
}
