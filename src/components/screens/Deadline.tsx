import { useState } from "react";
import type { ScenarioSnapshot, TradeAsset } from "@/domain/types";
import { allStrengths, capSummary, userRoster, type Action, type RunState } from "@/engine/game";
import { computeStandings, playoffProbability } from "@/engine/season";
import { buildDepthChart, gradePositions } from "@/engine/roster";
import { fmtMoney } from "@/engine/cap";
import { Button, Headline, Pill, Stat } from "@/components/ui";
import { TradeBuilder } from "@/components/TradeBuilder";
import { Standings } from "./Season";

/** The deadline stop: record, odds, pressure, and a Buy / Sell / Stand Pat decision. */
export function Deadline({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const [mode, setMode] = useState<null | { give: TradeAsset[]; partner?: string }>(null);
  const st = computeStandings(snapshot.teams, state.results)[state.teamId];
  const strengths = allStrengths(state);
  const rank = Object.entries(strengths).sort((a, b) => b[1] - a[1]).findIndex(([id]) => id === state.teamId) + 1;
  const prob = playoffProbability(st.w, 17 - st.w - st.l - st.t, rank);
  const roster = userRoster(state);
  const grades = gradePositions(roster, buildDepthChart(roster, state.depthOverrides));
  const strong = [...grades].sort((a, b) => b.score - a.score).slice(0, 3);
  const weak = [...grades].sort((a, b) => a.score - b.score).slice(0, 3);
  const cap = capSummary(state, snapshot);
  const sellers = Object.values(state.profiles).filter((p) => p.teamId !== state.teamId && (p.status === "REBUILDING" || p.status === "RETOOLING")).map((p) => p.teamId);
  const buyers = Object.values(state.profiles).filter((p) => p.teamId !== state.teamId && p.status === "CONTENDER").map((p) => p.teamId);
  const expiringVets = roster.filter((p) => p.contract && p.contract.endYear === state.year && p.age >= 28 && p.ability.ovr >= 72);

  if (mode) {
    return (
      <div className="flex flex-col gap-4">
        <Headline kicker="Trade deadline">Make the call</Headline>
        <TradeBuilder state={state} dispatch={dispatch} snapshot={snapshot} initialPartner={mode.partner} initialGive={mode.give} onClose={() => { setMode(null); dispatch({ type: "TRADE_CLEAR" }); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker={`Trade deadline · after week ${snapshot.scenario.deadlineWeek}`} sub={state.deadline.note}>{st.w}–{st.l}{st.t ? `–${st.t}` : ""}</Headline>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Playoff odds" value={`${prob}%`} tone={prob >= 60 ? "up" : prob >= 30 ? "risk" : "down"} />
        <Stat label="Cap space" value={fmtMoney(cap.space, { decimals: 1 })} tone="up" />
        <Stat label="Power rank" value={`#${rank}`} />
      </div>
      <section className="grid grid-cols-2 gap-2.5">
        <div className="card p-4">
          <div className="label mb-1.5 text-up">Strengths</div>
          <div className="flex flex-wrap gap-1.5">{strong.map((g) => <Pill key={g.pos} tone="up">{g.pos}</Pill>)}</div>
        </div>
        <div className="card p-4">
          <div className="label mb-1.5 text-down">Weaknesses</div>
          <div className="flex flex-wrap gap-1.5">{weak.map((g) => <Pill key={g.pos} tone="down">{g.pos}</Pill>)}</div>
        </div>
      </section>

      <div role="radiogroup" className="stagger grid gap-2.5 sm:grid-cols-3">
        <button onClick={() => setMode({ give: [], partner: sellers[0] })} className="card p-4 text-left hover:border-line-strong active:scale-[0.99]">
          <div className="display text-[25px] font-bold uppercase leading-none">Buy</div>
          <div className="mt-1 text-[15px] text-ink-2">Shop a {weak[0].pos}. Sellers right now: {sellers.slice(0, 5).join(", ")}{sellers.length > 5 ? "…" : ""}</div>
        </button>
        <button onClick={() => setMode({ give: expiringVets[0] ? [{ type: "PLAYER", id: expiringVets[0].id }] : [], partner: buyers[0] })} className="card p-4 text-left hover:border-line-strong active:scale-[0.99]">
          <div className="display text-[25px] font-bold uppercase leading-none">Sell</div>
          <div className="mt-1 text-[15px] text-ink-2">{expiringVets.length ? `${expiringVets[0].name} is on an expiring deal. Buyers: ${buyers.slice(0, 4).join(", ")}` : `Move a veteran for picks. Buyers: ${buyers.slice(0, 4).join(", ")}`}</div>
        </button>
        <button onClick={() => dispatch({ type: "DEADLINE_DONE" })} className="card p-4 text-left hover:border-line-strong active:scale-[0.99]">
          <div className="display text-[25px] font-bold uppercase leading-none">Stand pat</div>
          <div className="mt-1 text-[15px] text-ink-2">Ride the roster you built. Simulate the rest of the season.</div>
        </button>
      </div>

      <Standings state={state} snapshot={snapshot} />
      <Button size="lg" full onClick={() => dispatch({ type: "DEADLINE_DONE" })}>Deadline passes · simulate rest of season</Button>
    </div>
  );
}
