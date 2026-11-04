import { useState } from "react";
import type { ScenarioSnapshot } from "@/domain/types";
import { capSummary, type Action, type RunState } from "@/engine/game";
import { calculateCutSavings, calculateDeadMoney, capHit, fmtMoney } from "@/engine/cap";
import { Button, Callout, Headline, Stat } from "@/components/ui";
import { PlayerCard } from "@/components/PlayerCard";

type Choice = "KEEP" | "CUT" | "TRADE";

const LABEL: Record<Choice, string> = { KEEP: "Keep", CUT: "Cut", TRADE: "Explore trade" };

/** One decision at a time. Choose, see the consequence, continue. */
export function Audit({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const decision = snapshot.scenario.auditDecisions[state.audit.index];
  const [picked, setPicked] = useState<Choice | null>(null);
  const [locked, setLocked] = useState(false);
  const cap = capSummary(state, snapshot);
  if (!decision) return null;
  const player = state.players[decision.playerId];
  const hit = capHit(player.contract, state.year);
  const dead = calculateDeadMoney(player.contract, state.year);
  const savings = calculateCutSavings(player.contract, state.year);
  const total = snapshot.scenario.auditDecisions.length;

  const consequence = (c: Choice) => {
    if (c === "CUT") return { tone: savings > 0 ? ("up" as const) : ("down" as const), title: `Saves ${fmtMoney(savings)} this year`, detail: `${fmtMoney(dead)} in dead money. ${player.name} becomes a free agent.` };
    if (c === "TRADE") return { tone: "risk" as const, title: "Shopping him", detail: `You'll find a partner in the trade window. A trade clears ${fmtMoney(hit - dead)} if someone takes the salary.` };
    return { tone: "even" as const, title: `Keeps ${fmtMoney(hit)} on the books`, detail: `${player.contract ? player.contract.endYear - state.year + 1 : 0} year(s) left. You can still move him later.` };
  };

  const next = () => {
    dispatch({ type: "AUDIT_DECIDE", decisionId: decision.id, choice: picked! });
    setPicked(null);
    setLocked(false);
  };

  return (
    <div className="flex flex-col gap-5" key={decision.id}>
      <Headline kicker={`Roster audit · ${state.audit.index + 1} of ${total}`}>{decision.prompt}</Headline>
      <div className="grid grid-cols-2 gap-2.5">
        <Stat label="Cap space" value={fmtMoney(cap.space, { decimals: 1 })} tone="up" />
        <Stat label="Rookie reserve" value={fmtMoney(cap.cap - cap.committed - cap.deadMoney - cap.space)} sub="held for the draft class" />
      </div>
      <PlayerCard player={player} year={state.year} />
      <p className="text-[17px] leading-snug text-ink-2">{decision.context}</p>

      <div role="radiogroup" className="stagger grid gap-2.5" style={{ gridTemplateColumns: `repeat(${decision.options.filter((o) => o !== "RESTRUCTURE").length}, minmax(0,1fr))` }}>
        {decision.options.filter((o): o is Choice => o !== "RESTRUCTURE").map((o) => {
          const sel = picked === o;
          return (
            <button key={o} role="radio" aria-checked={sel} disabled={locked && !sel} onClick={() => !locked && setPicked(o)} className={`card display px-3 py-4 text-center text-[19px] font-bold uppercase tracking-wide transition-[border-color,transform] active:scale-[0.98] ${sel ? "border-team ring-2 ring-team/50" : "hover:border-line-strong"} ${locked && !sel ? "opacity-40" : ""}`}>
              {LABEL[o]}
              <div className="num mt-1 text-[14px] font-semibold text-ink-3">{o === "CUT" ? `${savings >= 0 ? "+" : ""}${fmtMoney(savings)}` : o === "KEEP" ? fmtMoney(hit) : "Shop"}</div>
            </button>
          );
        })}
      </div>

      {!locked ? (
        <Button size="lg" full disabled={!picked} onClick={() => setLocked(true)}>Lock it in</Button>
      ) : (
        <div className="anim-fade-up flex flex-col gap-3">
          <Callout {...consequence(picked!)} />
          <Button size="lg" full onClick={next}>{state.audit.index + 1 === total ? "Rank your needs" : "Next decision"}</Button>
        </div>
      )}
    </div>
  );
}
