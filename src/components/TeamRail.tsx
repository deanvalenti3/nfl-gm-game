import { useState } from "react";
import type { Position, ScenarioSnapshot } from "@/domain/types";
import { capSummary, userRoster, type Action, type RunState } from "@/engine/game";
import { fmtMoney } from "@/engine/cap";
import { buildDepthChart, gradePositions } from "@/engine/roster";
import { gradeTone, letterFor } from "@/engine/grades";
import { DEFENSE_SCHEMES, OFFENSE_SCHEMES, schemeDef, schemeFit, type DefenseScheme, type OffenseScheme } from "@/engine/scheme";
import { computeStandings } from "@/engine/season";
import { Button, Pill, Sheet } from "./ui";
import { PlayerCard } from "./PlayerCard";

const GROUPS: { label: string; positions: Position[] }[] = [
  { label: "Offense", positions: ["QB", "RB", "WR", "TE", "OT", "G", "C"] },
  { label: "Defense", positions: ["EDGE", "DT", "LB", "CB", "S"] },
];

/**
 * Left rail: a glanceable team sheet. Cap, picks, scheme, roster by position.
 * Read-mostly; the only control is the scheme picker (until the season locks it).
 */
export function TeamRail({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const [openPos, setOpenPos] = useState<Position | null>(null);
  const [schemeOpen, setSchemeOpen] = useState(false);
  const roster = userRoster(state);
  const cap = capSummary(state, snapshot);
  const chart = buildDepthChart(roster, state.depthOverrides);
  const grades = gradePositions(roster, chart);
  const gradeOf = (pos: Position) => grades.find((g) => g.pos === pos)!;
  const picks = Object.values(state.picks).filter((p) => p.teamId === state.teamId && !p.usedOnPlayerId && p.year === state.year).sort((a, b) => a.overall! - b.overall!);
  const future = Object.values(state.picks).filter((p) => p.teamId === state.teamId && p.year > state.year).length;
  const team = snapshot.teams.find((t) => t.id === state.teamId)!;
  const st = state.results.length ? computeStandings(snapshot.teams, state.results)[state.teamId] : null;
  const off = schemeDef("offense", state.scheme.offense);
  const def = schemeDef("defense", state.scheme.defense);
  const fitOff = letterFor(schemeFit(roster, "offense", state.scheme.offense, state.depthOverrides));
  const fitDef = letterFor(schemeFit(roster, "defense", state.scheme.defense, state.depthOverrides));

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-3.5">
        <div className="display text-[20px] font-bold uppercase leading-none">{team.city} {team.name}</div>
        <div className="num mt-1 text-[14px] text-ink-2">{st ? `${st.w}–${st.l}${st.t ? `–${st.t}` : ""} · ${state.year}` : `${roster.length} players · ${state.year}`}</div>
      </section>

      <section className="card p-3.5">
        <div className="label mb-2">Cap</div>
        <Row label="Space" value={fmtMoney(cap.space, { decimals: 1 })} tone={cap.space < 0 ? "text-down" : "text-up"} />
        <Row label="Next year" value={fmtMoney(cap.nextYearSpace, { decimals: 0 })} />
        <Row label="Dead money" value={fmtMoney(state.deadMoney[state.teamId] ?? 0, { decimals: 1 })} tone={(state.deadMoney[state.teamId] ?? 0) > 20_000_000 ? "text-risk" : undefined} />
      </section>

      <section className="card p-3.5">
        <div className="label mb-2">Picks</div>
        {picks.length ? (
          <div className="flex flex-wrap gap-1">
            {picks.map((p) => (
              <span key={p.id} className={`display num rounded-md px-1.5 py-0.5 text-[13px] font-bold ${p.round === 1 ? "bg-team-soft text-team" : "bg-sunk text-ink-2"}`}>#{p.overall}</span>
            ))}
          </div>
        ) : (
          <div className="text-[14px] text-ink-3">No {state.year} picks left</div>
        )}
        <div className="num mt-1.5 text-[13px] text-ink-3">{future} future picks</div>
      </section>

      <section className="card p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="label">Scheme</div>
          {state.scheme.locked ? <Pill>Locked</Pill> : <button onClick={() => setSchemeOpen(true)} className="display text-[13px] font-bold uppercase tracking-wide text-team">Change</button>}
        </div>
        <SchemeLine side="Off" name={off.name} fit={fitOff} />
        <SchemeLine side="Def" name={def.name} fit={fitDef} />
      </section>

      {GROUPS.map((g) => (
        <section key={g.label} className="card p-3.5">
          <div className="label mb-2">{g.label}</div>
          <div className="grid grid-cols-2 gap-1.5">
            {g.positions.map((pos) => {
              const grade = letterFor(gradeOf(pos).score);
              const tone = gradeTone(grade);
              return (
                <button key={pos} onClick={() => setOpenPos(pos)} className="flex items-center justify-between rounded-md bg-sunk px-2 py-1.5 text-left hover:bg-line">
                  <span className="display text-[14px] font-bold uppercase text-ink-2">{pos}</span>
                  <span className={`display text-[16px] font-bold ${tone === "up" ? "text-up" : tone === "even" ? "text-even" : tone === "down" ? "text-down" : "text-ink"}`}>{grade}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <Sheet open={!!openPos} onClose={() => setOpenPos(null)} title={openPos ? `${openPos} room` : ""}>
        {openPos && (
          <div className="flex flex-col gap-1.5">
            {roster.filter((p) => p.pos === openPos).sort((a, b) => b.ability.ovr - a.ability.ovr).map((p) => {
              const starter = Object.values(chart.starters).includes(p.id);
              return <PlayerCard key={p.id} player={p} year={state.year} teamLabel={starter ? "Starter" : undefined} />;
            })}
            {!roster.some((p) => p.pos === openPos) && <div className="text-[15px] text-down">Nobody on the roster.</div>}
          </div>
        )}
      </Sheet>

      <Sheet open={schemeOpen} onClose={() => setSchemeOpen(false)} title="Pick your scheme" wide>
        <p className="mb-4 text-[15px] text-ink-2">Each scheme leans on a few positions. Talent there counts for more; holes there hurt more. It locks when the season starts.</p>
        <div className="grid gap-5 md:grid-cols-2">
          <SchemeColumn title="Offense" options={OFFENSE_SCHEMES} current={state.scheme.offense} fit={(id) => letterFor(schemeFit(roster, "offense", id as OffenseScheme, state.depthOverrides))} onPick={(id) => dispatch({ type: "SET_SCHEME", offense: id as OffenseScheme })} />
          <SchemeColumn title="Defense" options={DEFENSE_SCHEMES} current={state.scheme.defense} fit={(id) => letterFor(schemeFit(roster, "defense", id as DefenseScheme, state.depthOverrides))} onPick={(id) => dispatch({ type: "SET_SCHEME", defense: id as DefenseScheme })} />
        </div>
        <Button size="lg" full className="mt-4" onClick={() => setSchemeOpen(false)}>Done</Button>
      </Sheet>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span className="text-[14px] text-ink-2">{label}</span>
      <span className={`display num text-[17px] font-bold ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

function SchemeLine({ side, name, fit }: { side: string; name: string; fit: string }) {
  const tone = gradeTone(fit as never);
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-[14px]"><span className="label mr-1.5">{side}</span>{name}</span>
      <span className={`display text-[16px] font-bold ${tone === "up" ? "text-up" : tone === "even" ? "text-even" : tone === "down" ? "text-down" : "text-ink"}`}>Fit {fit}</span>
    </div>
  );
}

function SchemeColumn<T extends string>({ title, options, current, fit, onPick }: { title: string; options: { id: T; name: string; blurb: string; emphasis: Position[] }[]; current: T; fit: (id: T) => string; onPick: (id: T) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="label">{title}</div>
      {options.map((o) => {
        const sel = o.id === current;
        const f = fit(o.id);
        const tone = gradeTone(f as never);
        return (
          <button key={o.id} role="radio" aria-checked={sel} onClick={() => onPick(o.id)} className={`card p-3.5 text-left transition-[border-color] ${sel ? "border-team ring-2 ring-team/50" : "hover:border-line-strong"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="display text-[20px] font-bold uppercase leading-none">{o.name}</span>
              <span className={`display text-[18px] font-bold ${tone === "up" ? "text-up" : tone === "even" ? "text-even" : tone === "down" ? "text-down" : "text-ink"}`}>Fit {f}</span>
            </div>
            <p className="mt-1 text-[14px] leading-snug text-ink-2">{o.blurb}</p>
            <div className="mt-2 flex gap-1">{Array.from(new Set(o.emphasis)).map((p) => <Pill key={p} tone="team">{p}</Pill>)}</div>
          </button>
        );
      })}
    </div>
  );
}
