import { useMemo, useState } from "react";
import type { DraftPick, ScenarioSnapshot, TradeAsset } from "@/domain/types";
import { type Action, type RunState, rosterOf, tradeContext } from "@/engine/game";
import { evaluateTrade, type Interest } from "@/engine/trade";
import { fmtMoney } from "@/engine/cap";
import { Button, Callout, Pill, SectionLabel } from "./ui";
import { PlayerCard } from "./PlayerCard";

/**
 * Madden-style two-column trade builder. YOUR OFFER vs THEIR ASSETS.
 * The interest meter comes from the engine; the formula stays hidden.
 */
export function TradeBuilder({ state, dispatch, snapshot, initialPartner, initialGive = [], onClose }: { state: RunState; dispatch: (a: Action) => void; snapshot: ScenarioSnapshot; initialPartner?: string; initialGive?: TradeAsset[]; onClose: () => void }) {
  const [partner, setPartner] = useState<string>(initialPartner ?? "");
  const [give, setGive] = useState<TradeAsset[]>(initialGive);
  const [get, setGet] = useState<TradeAsset[]>([]);
  const [tab, setTab] = useState<"players" | "picks">("players");

  const ctx = useMemo(() => tradeContext(state, snapshot), [state, snapshot]);
  const evaluation = useMemo(() => (partner ? evaluateTrade(ctx, state.teamId, partner, give, get) : null), [ctx, partner, give, get, state.teamId]);
  const result = state.lastTrade && state.lastTrade.partner === partner ? state.lastTrade : null;

  const myRoster = rosterOf(state, state.teamId).sort((a, b) => b.ability.ovr - a.ability.ovr);
  const theirRoster = partner ? rosterOf(state, partner).sort((a, b) => b.ability.ovr - a.ability.ovr) : [];
  const myPicks = Object.values(state.picks).filter((p) => p.teamId === state.teamId && !p.usedOnPlayerId).sort(sortPicks);
  const theirPicks = Object.values(state.picks).filter((p) => p.teamId === partner && !p.usedOnPlayerId).sort(sortPicks);

  const toggle = (list: TradeAsset[], set: (x: TradeAsset[]) => void, asset: TradeAsset) => {
    const exists = list.some((a) => a.type === asset.type && a.id === asset.id);
    set(exists ? list.filter((a) => !(a.type === asset.type && a.id === asset.id)) : [...list, asset]);
    dispatch({ type: "TRADE_CLEAR" });
  };
  const has = (list: TradeAsset[], asset: TradeAsset) => list.some((a) => a.type === asset.type && a.id === asset.id);
  const teams = snapshot.teams.filter((t) => t.id !== state.teamId).sort((a, b) => a.id.localeCompare(b.id));
  const profile = partner ? state.profiles[partner] : null;

  const submit = () => dispatch({ type: "TRADE_EXECUTE", partner, give, get });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="label">Trade partner</label>
        <select value={partner} onChange={(e) => { setPartner(e.target.value); setGet([]); dispatch({ type: "TRADE_CLEAR" }); }} className="display h-10 rounded-lg border border-line-strong bg-sunk px-3 text-[17px] font-bold uppercase tracking-wide">
          <option value="">Select a team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.id} · {t.name}</option>
          ))}
        </select>
        {profile && (
          <>
            <Pill tone={profile.status === "CONTENDER" || profile.status === "PLAYOFF TEAM" ? "up" : profile.status === "REBUILDING" ? "down" : "neutral"}>{profile.status}</Pill>
            <Pill>QB: {profile.qb}</Pill>
            <Pill>Cap {fmtMoney(profile.capSpace)}</Pill>
            <span className="text-[14px] text-ink-3">Needs: {profile.needs.join(" · ")}</span>
          </>
        )}
      </div>

      {partner && (
        <>
          <div className="flex gap-2">
            {(["players", "picks"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`display rounded-lg px-3 py-1.5 text-[15px] font-bold uppercase tracking-wide ${tab === t ? "bg-team text-team-ink" : "bg-sunk text-ink-2"}`}>{t}</button>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <SectionLabel right={<span className="num text-[14px] text-ink-3">{give.length} selected</span>}>Your offer</SectionLabel>
              <div className="rail flex max-h-[42dvh] flex-col gap-1.5 overflow-y-auto pr-1">
                {tab === "players"
                  ? myRoster.map((p) => <PlayerCard key={p.id} player={p} year={state.year} selected={has(give, { type: "PLAYER", id: p.id })} onClick={() => toggle(give, setGive, { type: "PLAYER", id: p.id })} />)
                  : myPicks.map((p) => <PickRow key={p.id} pick={p} selected={has(give, { type: "PICK", id: p.id })} onClick={() => toggle(give, setGive, { type: "PICK", id: p.id })} />)}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <SectionLabel right={<span className="num text-[14px] text-ink-3">{get.length} selected</span>}>Their assets</SectionLabel>
              <div className="rail flex max-h-[42dvh] flex-col gap-1.5 overflow-y-auto pr-1">
                {tab === "players"
                  ? theirRoster.map((p) => <PlayerCard key={p.id} player={p} year={state.year} selected={has(get, { type: "PLAYER", id: p.id })} onClick={() => toggle(get, setGet, { type: "PLAYER", id: p.id })} />)
                  : theirPicks.map((p) => <PickRow key={p.id} pick={p} selected={has(get, { type: "PICK", id: p.id })} onClick={() => toggle(get, setGet, { type: "PICK", id: p.id })} />)}
              </div>
            </div>
          </div>

          {evaluation && !result?.accepted && (give.length > 0 || get.length > 0) && (
            <div className="card flex flex-col gap-2 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="label">Their read</span>
                <InterestMeter interest={evaluation.interest} />
              </div>
              {evaluation.blockers.map((b) => (
                <div key={b} className="text-[16px] text-down">{b}</div>
              ))}
              {evaluation.reasons.map((r) => (
                <div key={r} className="text-[16px] text-ink-2">{r}</div>
              ))}
              {evaluation.counter && !evaluation.blockers.length && evaluation.interest !== "STRONG INTEREST" && (
                <button onClick={() => { setGive([...give, evaluation.counter!]); dispatch({ type: "TRADE_CLEAR" }); }} className="display self-start rounded-lg bg-risk-soft px-3 py-1.5 text-[15px] font-bold uppercase tracking-wide text-risk">
                  They'd want {assetLabel(state, evaluation.counter)} added · Add it
                </button>
              )}
            </div>
          )}

          {result && (
            <Callout tone={result.accepted ? "up" : "down"} title={result.accepted ? "Trade accepted" : "Trade rejected"} detail={result.accepted ? "Assets have moved. Cap and picks are updated." : result.evaluation.blockers[0] ?? "They passed. Sweeten the deal or try another partner."} />
          )}

          <div className="flex gap-2">
            {result?.accepted ? (
              <Button size="lg" full onClick={onClose}>Done</Button>
            ) : (
              <>
                <Button variant="secondary" size="lg" onClick={onClose}>Back</Button>
                <Button size="lg" full disabled={!give.length || !get.length || !!evaluation?.blockers.length} onClick={submit}>Propose trade</Button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function sortPicks(a: DraftPick, b: DraftPick) {
  return a.year - b.year || (a.overall ?? a.round * 32) - (b.overall ?? b.round * 32);
}

export function pickLabel(p: DraftPick): string {
  return p.overall ? `${p.year} Round ${p.round} · Pick ${p.overall}` : `${p.year} Round ${p.round}`;
}

export function PickRow({ pick, selected, onClick }: { pick: DraftPick; selected?: boolean; onClick?: () => void }) {
  const inner = (
    <div className="flex items-center gap-3">
      <div className="display flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sunk text-[17px] font-bold text-ink-2">R{pick.round}</div>
      <div className="min-w-0 flex-1">
        <div className="text-[17px] font-bold tracking-tight">{pickLabel(pick)}</div>
        <div className="text-[14px] text-ink-2">{pick.originalTeamId !== pick.teamId ? `via ${pick.originalTeamId}` : "Own pick"}</div>
      </div>
    </div>
  );
  if (!onClick) return <div className="card px-3 py-2.5">{inner}</div>;
  return (
    <button type="button" onClick={onClick} className={`card w-full px-3 py-2.5 text-left active:scale-[0.99] ${selected ? "border-team ring-2 ring-team/50" : "hover:border-line-strong"}`}>
      {inner}
    </button>
  );
}

export function InterestMeter({ interest }: { interest: Interest }) {
  const tone = interest === "STRONG INTEREST" ? "up" : interest === "POSSIBLE" ? "risk" : "down";
  return <Pill tone={tone}>{interest}</Pill>;
}

export function assetLabel(state: RunState, a: TradeAsset): string {
  if (a.type === "PLAYER") return state.players[a.id]?.name ?? a.id;
  const p = state.picks[a.id];
  return p ? (p.overall ? `pick #${p.overall}` : `${p.year} R${p.round}`) : a.id;
}
