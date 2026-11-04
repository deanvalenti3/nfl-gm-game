import { useEffect, useRef, useState } from "react";
import type { ScenarioSnapshot } from "@/domain/types";
import { allStrengths, type Action, type RunState } from "@/engine/game";
import { computeStandings, playoffProbability, rankTeams } from "@/engine/season";
import { Button, Headline, Pill, Stat } from "@/components/ui";

/** Weekly results. Each week resolves with a quick reveal; hold the button to sprint. */
export function Season({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const [auto, setAuto] = useState(false);
  const timer = useRef<number | null>(null);
  const st = computeStandings(snapshot.teams, state.results);
  const me = st[state.teamId];
  const team = snapshot.teams.find((t) => t.id === state.teamId)!;
  const myGames = state.results.filter((g) => g.stage === "REG" && (g.homeId === state.teamId || g.awayId === state.teamId)).sort((a, b) => b.week - a.week);
  const division = snapshot.teams.filter((t) => t.conference === team.conference && t.division === team.division).map((t) => t.id);
  const divRank = rankTeams(division, st, state.results, state.seed);
  const strengths = allStrengths(state);
  const rank = Object.entries(strengths).sort((a, b) => b[1] - a[1]).findIndex(([id]) => id === state.teamId) + 1;
  const gamesLeft = 17 - (me.w + me.l + me.t);
  const prob = playoffProbability(me.w, gamesLeft, rank);
  const toDeadline = !state.deadline.done;
  const weekLabel = state.week <= 18 ? `Week ${state.week}` : "Season over";
  const hurt = Object.values(state.players).filter((p) => p.teamId === state.teamId && (p.injuredWeeks ?? 0) > 0 && p.ability.ovr >= 70);

  useEffect(() => {
    if (!auto || state.phase !== "SEASON") {
      setAuto(false);
      return;
    }
    timer.current = window.setTimeout(() => dispatch({ type: "SIM_WEEK" }), 650);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [auto, state.week, state.phase, dispatch]);

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker={`${state.year} season · ${weekLabel}`} sub={toDeadline ? `Simulation pauses at the trade deadline after week ${snapshot.scenario.deadlineWeek}.` : "Simulation runs to the end of the regular season."}>
        {me.w}–{me.l}{me.t ? `–${me.t}` : ""}
      </Headline>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Division" value={`${ordinal(divRank.indexOf(state.teamId) + 1)}`} sub={`${team.conference} ${team.division}`} />
        <Stat label="Playoff odds" value={`${prob}%`} tone={prob >= 60 ? "up" : prob >= 30 ? "risk" : "down"} />
        <Stat label="Point diff" value={`${me.pf - me.pa >= 0 ? "+" : ""}${me.pf - me.pa}`} tone={me.pf - me.pa >= 0 ? "up" : "down"} />
      </div>

      {hurt.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hurt.map((p) => (
            <Pill key={p.id} tone="down">{p.pos} {p.name.split(" ").slice(-1)[0]} · out {p.injuredWeeks! >= 18 ? "season" : `${p.injuredWeeks}w`}</Pill>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => setAuto((a) => !a)}>{auto ? "Pause" : toDeadline ? "Sim to deadline" : "Sim to end"}</Button>
        <Button size="lg" full disabled={auto} onClick={() => dispatch({ type: "SIM_WEEK" })}>Play {weekLabel}</Button>
      </div>

      <section className="card p-4">
        <div className="label mb-2">Results</div>
        {myGames.length === 0 && <div className="text-[14px] text-ink-3">Kickoff is next.</div>}
        <ol className="flex flex-col divide-y divide-line">
          {myGames.map((g, i) => {
            const home = g.homeId === state.teamId;
            const us = home ? g.homeScore : g.awayScore;
            const them = home ? g.awayScore : g.homeScore;
            const opp = home ? g.awayId : g.homeId;
            const won = us > them;
            return (
              <li key={g.week} className={`flex items-center gap-3 py-2 ${i === 0 ? "anim-slide" : ""}`}>
                <span className="label w-12">Wk {g.week}</span>
                <span className={`display w-7 text-[16px] font-bold ${won ? "text-up" : us === them ? "text-ink-3" : "text-down"}`}>{won ? "W" : us === them ? "T" : "L"}</span>
                <span className="display flex-1 text-[17px] font-bold uppercase tracking-wide">
                  {home ? "" : "@ "}{opp} <span className="num text-ink-2">{them}</span>
                  <span className="mx-2 text-ink-3">—</span>
                  {state.teamId} <span className="num">{us}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <Standings state={state} snapshot={snapshot} />
    </div>
  );
}

export function Standings({ state, snapshot, conferenceOnly = false }: { state: RunState; snapshot: ScenarioSnapshot; conferenceOnly?: boolean }) {
  const st = computeStandings(snapshot.teams, state.results);
  const team = snapshot.teams.find((t) => t.id === state.teamId)!;
  const divs = conferenceOnly ? ["East", "North", "South", "West"] : [team.division];
  return (
    <section className="grid gap-2.5 sm:grid-cols-2">
      {divs.map((d) => {
        const ids = snapshot.teams.filter((t) => t.conference === team.conference && t.division === d).map((t) => t.id);
        const ranked = rankTeams(ids, st, state.results, state.seed);
        return (
          <div key={d} className="card p-4">
            <div className="label mb-2">{team.conference} {d}</div>
            <ol className="flex flex-col gap-1">
              {ranked.map((id) => (
                <li key={id} className={`flex items-center justify-between text-[14px] ${id === state.teamId ? "font-bold text-team" : ""}`}>
                  <span className="display uppercase tracking-wide">{snapshot.teams.find((t) => t.id === id)?.name}</span>
                  <span className="num">{st[id].w}–{st[id].l}{st[id].t ? `–${st[id].t}` : ""}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </section>
  );
}

function ordinal(n: number) {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}
