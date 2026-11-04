import { useState } from "react";
import type { ScenarioSnapshot, TradeAsset } from "@/domain/types";
import { capSummary, userRoster, type Action, type RunState } from "@/engine/game";
import { fmtMoney } from "@/engine/cap";
import { Button, Headline, Stat } from "@/components/ui";
import { PlayerCard } from "@/components/PlayerCard";
import { TradeBuilder } from "@/components/TradeBuilder";

export function TradeWindow({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const [building, setBuilding] = useState<{ partner?: string; give: TradeAsset[] } | null>(null);
  const cap = capSummary(state, snapshot);
  const shopping = state.audit.shopping.map((id) => state.players[id]).filter((p) => p && p.teamId === state.teamId);
  const roster = userRoster(state);
  const picks = Object.values(state.picks).filter((p) => p.teamId === state.teamId && !p.usedOnPlayerId);
  const trades = state.transactions.filter((t) => t.kind === "TRADE").length;

  if (building) {
    return (
      <div className="flex flex-col gap-4">
        <Headline kicker="Trade builder">Your offer vs their assets</Headline>
        <TradeBuilder state={state} dispatch={dispatch} snapshot={snapshot} initialPartner={building.partner} initialGive={building.give} onClose={() => { setBuilding(null); dispatch({ type: "TRADE_CLEAR" }); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker="Trade window · pre-draft" sub="Shop players you flagged, chase a starter, or move up the board. Rebuilding teams sell veterans; contenders pay for help now.">Work the phones</Headline>
      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Cap space" value={fmtMoney(cap.space, { decimals: 1 })} tone="up" />
        <Stat label="Picks" value={picks.filter((p) => p.year === state.year).length} sub={`${picks.filter((p) => p.year > state.year).length} future`} />
        <Stat label="Trades made" value={trades} />
      </div>

      {shopping.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="label">On the block</div>
          {shopping.map((p) => (
            <PlayerCard key={p.id} player={p} year={state.year} right={<Button size="sm" onClick={() => setBuilding({ give: [{ type: "PLAYER", id: p.id }] })}>Shop</Button>} />
          ))}
        </section>
      )}

      <section className="stagger grid gap-2.5 sm:grid-cols-2">
        <button onClick={() => setBuilding({ give: [] })} className="card p-5 text-left hover:border-line-strong active:scale-[0.99]">
          <div className="display text-[22px] font-bold uppercase leading-none">Open the trade builder</div>
          <div className="mt-1 text-[14px] text-ink-2">Pick a partner, build a package from players and picks, read their interest before you submit.</div>
        </button>
        <button onClick={() => dispatch({ type: "TRADE_DONE" })} className="card p-5 text-left hover:border-line-strong active:scale-[0.99]">
          <div className="display text-[22px] font-bold uppercase leading-none">Go to the draft</div>
          <div className="mt-1 text-[14px] text-ink-2">You can still trade picks while you're on the clock.</div>
        </button>
      </section>

      <details className="card p-4">
        <summary className="label cursor-pointer">Your roster ({roster.length})</summary>
        <div className="mt-3 flex flex-col gap-1.5">
          {roster.sort((a, b) => b.ability.ovr - a.ability.ovr).map((p) => (
            <PlayerCard key={p.id} player={p} year={state.year} right={<Button size="sm" variant="ghost" onClick={() => setBuilding({ give: [{ type: "PLAYER", id: p.id }] })}>Shop</Button>} />
          ))}
        </div>
      </details>
    </div>
  );
}
