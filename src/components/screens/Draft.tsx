import { useEffect, useMemo, useRef, useState } from "react";
import type { DraftProspect, Position, ScenarioSnapshot } from "@/domain/types";
import { currentPick, userOnClock, userRoster, type Action, type RunState } from "@/engine/game";
import { needFit } from "@/engine/draft";
import { Button, Headline, Pill, Sheet, Stat } from "@/components/ui";
import { TradeBuilder } from "@/components/TradeBuilder";

const GRADE_TONE = (g: DraftProspect["grade"]) => (g.startsWith("A") ? "up" : g.startsWith("B") ? "even" : "neutral") as "up" | "even" | "neutral";

export function Draft({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const pick = currentPick(state);
  const onClock = userOnClock(state);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<Position | "ALL">("ALL");
  const [trading, setTrading] = useState(false);
  const [revealed, setRevealed] = useState(state.draft.sinceLast);
  const lastLogLen = useRef(state.draft.log.length);

  // Animate the ticker: reveal picks made since the last advance one by one.
  useEffect(() => {
    const since = state.draft.sinceLast;
    if (state.draft.log.length !== lastLogLen.current) {
      lastLogLen.current = state.draft.log.length;
      setRevealed(0);
      let i = 0;
      const id = setInterval(() => {
        i++;
        setRevealed(i);
        if (i >= since) clearInterval(id);
      }, Math.max(60, Math.min(260, 2600 / Math.max(1, since))));
      return () => clearInterval(id);
    }
  }, [state.draft.log.length, state.draft.sinceLast]);

  const roster = userRoster(state);
  const profile = state.profiles[state.teamId];
  const board = useMemo(() => Object.values(state.prospects).filter((p) => !state.drafted.includes(p.id)).filter((p) => filter === "ALL" || p.pos === filter).sort((a, b) => a.projectedRange[0] + a.projectedRange[1] - (b.projectedRange[0] + b.projectedRange[1])), [state.prospects, state.drafted, filter]);
  const recent = state.draft.log.slice(Math.max(0, state.draft.log.length - state.draft.sinceLast), state.draft.log.length - state.draft.sinceLast + revealed);
  const userPicks = Object.values(state.picks).filter((p) => p.teamId === state.teamId && p.year === state.year && !p.usedOnPlayerId).sort((a, b) => a.overall! - b.overall!);
  const nextUser = userPicks[0];
  const picksUntil = nextUser && pick ? nextUser.overall! - pick.overall! : null;
  const teamName = (id: string) => snapshot.teams.find((t) => t.id === id)?.city ?? id;
  const animating = revealed < state.draft.sinceLast;
  const sel = selected ? state.prospects[selected] : null;
  const positions: (Position | "ALL")[] = ["ALL", "QB", "RB", "WR", "TE", "OT", "G", "C", "EDGE", "DT", "LB", "CB", "S"];

  if (trading) {
    return (
      <div className="flex flex-col gap-4">
        <Headline kicker="Draft-day trade">Move the pick</Headline>
        <TradeBuilder state={state} dispatch={dispatch} snapshot={snapshot} initialGive={pick && onClock ? [{ type: "PICK", id: pick.id }] : []} onClose={() => { setTrading(false); dispatch({ type: "TRADE_CLEAR" }); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker={`${state.year} NFL Draft · Round ${pick?.round ?? "—"}`} sub={onClock ? undefined : picksUntil === 1 ? "You're on deck." : picksUntil ? `${picksUntil} picks until you're up.` : "No picks left. Watch the board or auto-complete."}>
        {onClock ? "You're on the clock" : animating ? "Picks are coming in" : picksUntil === 1 ? "You're on deck" : `Pick ${pick?.overall ?? "—"} · ${pick ? teamName(pick.teamId) : ""}`}
      </Headline>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Your next pick" value={nextUser ? `#${nextUser.overall}` : "—"} sub={nextUser ? `Round ${nextUser.round}` : "none left"} tone="team" />
        <Stat label="Picks remaining" value={userPicks.length} />
        <Stat label="Rookies drafted" value={state.draft.log.filter((l) => l.teamId === state.teamId).length} />
      </div>

      {recent.length > 0 && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="label">Draft ticker</div>
            {recent.length > 12 && <span className="num text-[13px] text-ink-3">+{recent.length - 12} earlier</span>}
          </div>
          <ol className="flex flex-col gap-1.5">
            {[...recent].reverse().slice(0, 12).map((l, i) => {
              const p = state.players[l.playerId];
              return (
                <li key={l.pickId} className={`flex items-center gap-3 text-[16px] ${i === 0 ? "anim-slide" : ""} ${l.teamId === state.teamId ? "text-team" : ""}`}>
                  <span className="display num w-10 shrink-0 text-right text-[18px] font-bold">{l.overall}</span>
                  <span className="display w-10 shrink-0 font-bold uppercase text-ink-2">{l.teamId}</span>
                  <span className="truncate font-semibold">{p.name}</span>
                  <span className="text-ink-3">{p.pos} · {p.college}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {onClock && !animating && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {positions.map((pos) => (
              <button key={pos} onClick={() => setFilter(pos)} className={`display rounded-md px-2 py-1 text-[14px] font-bold uppercase tracking-wide ${filter === pos ? "bg-team text-team-ink" : "bg-sunk text-ink-2"}`}>{pos}</button>
            ))}
          </div>
          <div role="radiogroup" className="stagger flex flex-col gap-2">
            {board.slice(0, 14).map((p) => (
              <ProspectRow key={p.id} prospect={p} fit={needFit(profile, roster, p.pos)} selected={selected === p.id} onClick={() => setSelected(p.id)} needs={state.needs} />
            ))}
          </div>
          <div className="sticky bottom-3 z-10 flex gap-2 rounded-2xl border border-line bg-elev/95 p-2 shadow-lift backdrop-blur">
            <Button variant="ghost" size="lg" onClick={() => dispatch({ type: "DRAFT_AUTO_REMAINING" })} title="Auto-draft all remaining picks">Auto</Button>
            <Button variant="secondary" size="lg" onClick={() => setTrading(true)}>Trade pick</Button>
            <Button size="lg" full disabled={!sel} onClick={() => { dispatch({ type: "DRAFT_SELECT", prospectId: sel!.id }); setSelected(null); }}>{sel ? `Draft ${sel.name}` : "Select a prospect"}</Button>
          </div>
        </>
      )}

      {!onClock && !animating && state.phase === "DRAFT" && (
        <div className="flex gap-2">
          <Button variant="secondary" size="lg" onClick={() => dispatch({ type: "DRAFT_AUTO_REMAINING" })}>Auto-draft remaining</Button>
          <Button size="lg" full onClick={() => dispatch({ type: "DRAFT_ADVANCE" })}>{nextUser ? `Run to pick #${nextUser.overall}` : "Finish the draft"}</Button>
        </div>
      )}

      <Sheet open={!!sel && onClock} onClose={() => setSelected(null)} title={sel?.name ?? ""}>
        {sel && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="team">{sel.pos}</Pill>
              <Pill>{sel.school}</Pill>
              <Pill>Age {sel.age}</Pill>
              <Pill tone={GRADE_TONE(sel.grade)}>Grade {sel.grade}</Pill>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Projected range" value={`${sel.projectedRange[0]}–${sel.projectedRange[1]}`} />
              <Stat label="Risk" value={sel.risk} tone={sel.risk === "HIGH" ? "down" : sel.risk === "MEDIUM" ? "risk" : "up"} />
              <Stat label="Athletic profile" value={sel.athletic} />
              <Stat label="Production" value={sel.production} />
            </div>
            <div className="text-[15px] text-ink-3">Team need fit: <span className="font-bold text-ink">{needFit(profile, roster, sel.pos)}</span>{snapshot.scenario.prospectNotes?.[sel.id] ? ` · ${snapshot.scenario.prospectNotes[sel.id]}` : ""}</div>
            <Button size="lg" full onClick={() => { dispatch({ type: "DRAFT_SELECT", prospectId: sel.id }); setSelected(null); }}>Draft {sel.name}</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function ProspectRow({ prospect: p, fit, selected, onClick, needs }: { prospect: DraftProspect; fit: "STRONG" | "FIT" | "LUXURY"; selected: boolean; onClick: () => void; needs: Position[] }) {
  const needIdx = needs.indexOf(p.pos);
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className={`card w-full px-3 py-2.5 text-left transition-[border-color] active:scale-[0.99] ${selected ? "border-team ring-2 ring-team/50" : "hover:border-line-strong"}`}>
      <div className="flex items-center gap-3">
        <div className="display flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-sunk text-[15px] font-bold leading-none text-ink-2">
          {p.pos}
          <span className={`mt-0.5 text-[13px] ${p.grade.startsWith("A") ? "text-up" : p.grade.startsWith("B") ? "text-even" : "text-ink-3"}`}>{p.grade}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-[17px] font-bold tracking-tight">{p.name}</span>
            <span className="text-[14px] text-ink-3">{p.school} · {p.age}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[14px]">
            <span className="num text-ink-2">Proj. {p.projectedRange[0]}–{p.projectedRange[1]}</span>
            <Pill tone={p.athletic === "ELITE" ? "up" : "neutral"} className="text-[12px]">ATH {p.athletic}</Pill>
            <Pill tone={p.production === "ELITE" ? "up" : "neutral"} className="text-[12px]">PROD {p.production}</Pill>
            <Pill tone={p.risk === "HIGH" ? "down" : p.risk === "MEDIUM" ? "risk" : "neutral"} className="text-[12px]">RISK {p.risk}</Pill>
          </div>
        </div>
        <Pill tone={needIdx === 0 || fit === "STRONG" ? "up" : fit === "FIT" ? "even" : "neutral"}>{needIdx >= 0 ? `Need #${needIdx + 1}` : fit}</Pill>
      </div>
    </button>
  );
}
