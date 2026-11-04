import { useMemo, useState } from "react";
import type { Player, ScenarioSnapshot } from "@/domain/types";
import { capSummary, freeAgents, type Action, type RunState } from "@/engine/game";
import { fairAav, shortlist, suggestedOffer, type Offer, type Resolution } from "@/engine/freeAgency";
import { buildOfferContract, fmtMoney } from "@/engine/cap";
import { Button, Callout, Headline, Pill, Sheet, Stat } from "@/components/ui";
import { PlayerCard } from "@/components/PlayerCard";

export function FreeAgency({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const [offering, setOffering] = useState<Player | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");
  const cap = capSummary(state, snapshot);
  const pool = freeAgents(state);
  const committed = Object.values(state.fa.offers).reduce((s, o) => s + buildOfferContract(state.year, o.years, o.aav, o.guaranteedPct).capHits[state.year], 0);
  const available = cap.space - committed;
  const list = useMemo(() => shortlist(pool.filter((p) => !state.fa.passed.includes(p.id)), state.needs, 8), [pool, state.needs, state.fa.passed]);
  const offersCount = Object.keys(state.fa.offers).length;
  const asks = Object.values(state.fa.asks);
  const last = state.fa.lastResolutions;
  const teamName = (id: string) => snapshot.teams.find((t) => t.id === id)?.city ?? id;

  const resolutionLine = (r: Resolution) => {
    const p = state.players[r.playerId];
    switch (r.kind) {
      case "SIGNED_WITH_USER": return { tone: "up" as const, text: `${p.name} signed · ${r.offer.years} yrs / ${fmtMoney(r.offer.aav * r.offer.years)}` };
      case "SIGNED_ELSEWHERE": return { tone: "down" as const, text: `${p.name} signed with ${teamName(r.offer.teamId)} · ${r.offer.years} yrs / ${fmtMoney(r.offer.aav * r.offer.years)}` };
      case "ASKING_MORE": return { tone: "risk" as const, text: `${p.name}'s agent wants ${fmtMoney(r.ask.aav)}/yr${r.rival ? ` · ${teamName(r.rival)} is bidding` : ""}` };
      case "ENTERED_BIDDING": return { tone: "risk" as const, text: `${teamName(r.teamId)} has entered the bidding for ${p.name}` };
    }
  };

  const positions = ["ALL", ...Array.from(new Set(pool.map((p) => p.pos)))];
  const allList = pool.filter((p) => filter === "ALL" || p.pos === filter).sort((a, b) => b.ability.ovr - a.ability.ovr);

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker={`Free agency · Day ${state.fa.day} of ${state.fa.maxDay}`} sub="Make offers, then advance the day. Other teams are bidding too, and players sign elsewhere while you wait.">The market is open</Headline>

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Cap space" value={fmtMoney(available, { decimals: 1 })} tone={available < 10_000_000 ? "risk" : "up"} sub={offersCount ? `${fmtMoney(committed)} in pending offers` : "after rookie reserve"} />
        <Stat label="Offers out" value={offersCount} sub={asks.length ? `${asks.length} counter${asks.length > 1 ? "s" : ""} waiting` : "pending resolution"} />
        <Stat label="Available" value={pool.length} sub="free agents left" />
      </div>

      {last.length > 0 && (
        <section className="card flex flex-col gap-1.5 p-4">
          <div className="label">Overnight</div>
          {last.map((r, i) => {
            const l = resolutionLine(r);
            return (
              <div key={i} className={`flex gap-2 text-[16px] ${l.tone === "up" ? "text-up" : l.tone === "down" ? "text-down" : "text-risk"}`}>
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                <span>{l.text}</span>
              </div>
            );
          })}
        </section>
      )}

      {asks.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="label text-risk">Agents waiting on you</div>
          {asks.map(({ ask, rival }) => {
            const p = state.players[ask.playerId];
            return (
              <div key={ask.playerId} className="card border-risk/40 p-3">
                <PlayerCard player={p} year={state.year} />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[16px]">
                    Asking <span className="num font-bold">{fmtMoney(ask.aav)}/yr</span> × {ask.years}, {Math.round(ask.guaranteedPct * 100)}% guaranteed{rival ? ` · ${teamName(rival)} is in` : ""}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "FA_PASS", playerId: p.id })}>Walk away</Button>
                    <Button size="sm" variant="secondary" onClick={() => setOffering(p)}>Counter</Button>
                    <Button size="sm" disabled={buildOfferContract(state.year, ask.years, ask.aav, ask.guaranteedPct).capHits[state.year] > available} onClick={() => dispatch({ type: "FA_OFFER", offer: ask })}>Meet it</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="label">{showAll ? "All free agents" : "Your shortlist"}</div>
          <button onClick={() => setShowAll((v) => !v)} className="display text-[14px] font-bold uppercase tracking-wide text-team">{showAll ? "Back to shortlist" : `View all ${pool.length}`}</button>
        </div>
        {showAll && (
          <div className="flex flex-wrap gap-1.5">
            {positions.map((pos) => (
              <button key={pos} onClick={() => setFilter(pos)} className={`display rounded-md px-2 py-1 text-[14px] font-bold uppercase tracking-wide ${filter === pos ? "bg-team text-team-ink" : "bg-sunk text-ink-2"}`}>{pos}</button>
            ))}
          </div>
        )}
        <div className="stagger flex flex-col gap-2">
          {(showAll ? allList : list).map((p) => (
            <FreeAgentRow key={p.id} player={p} state={state} offer={state.fa.offers[p.id]} needRank={state.needs.indexOf(p.pos)} onOffer={() => setOffering(p)} onPass={() => dispatch({ type: "FA_PASS", playerId: p.id })} onWithdraw={() => dispatch({ type: "FA_WITHDRAW", playerId: p.id })} />
          ))}
          {!showAll && list.length === 0 && <div className="text-[16px] text-ink-3">Nothing left on the shortlist. View all, or move on.</div>}
        </div>
      </section>

      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={() => dispatch({ type: "FA_FINISH" })}>Leave market</Button>
        <Button size="lg" full onClick={() => dispatch({ type: "FA_ADVANCE" })}>{offersCount ? `Submit ${offersCount} offer${offersCount > 1 ? "s" : ""} · advance day` : "Advance to next day"}</Button>
      </div>

      <Sheet open={!!offering} onClose={() => setOffering(null)} title={offering ? `Offer · ${offering.name}` : ""}>
        {offering && (
          <OfferBuilder player={offering} state={state} available={available + (state.fa.offers[offering.id] ? buildOfferContract(state.year, state.fa.offers[offering.id].years, state.fa.offers[offering.id].aav, state.fa.offers[offering.id].guaranteedPct).capHits[state.year] : 0)} initial={state.fa.offers[offering.id] ?? state.fa.asks[offering.id]?.ask ?? suggestedOffer(offering, state.teamId)} onSubmit={(o) => { dispatch({ type: "FA_OFFER", offer: o }); setOffering(null); }} />
        )}
      </Sheet>
    </div>
  );
}

function FreeAgentRow({ player, state, offer, needRank, onOffer, onPass, onWithdraw }: { player: Player; state: RunState; offer?: Offer; needRank: number; onOffer: () => void; onPass: () => void; onWithdraw: () => void }) {
  const m = player.market!;
  const fit = needRank === 0 ? "EXCELLENT" : needRank > 0 ? "GOOD" : "NEUTRAL";
  return (
    <div className={`card p-3 ${offer ? "border-team/60" : ""}`}>
      <PlayerCard player={player} year={state.year} />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Pill tone={m.interest === "HIGH" ? "down" : m.interest === "MEDIUM" ? "risk" : "neutral"}>Market: {m.interest}</Pill>
        <Pill tone={fit === "EXCELLENT" ? "up" : fit === "GOOD" ? "even" : "neutral"}>Fit: {fit}</Pill>
        <span className="num ml-auto text-[14px] text-ink-2">Proj. {m.years} yr / {fmtMoney(m.aav * m.years)}</span>
      </div>
      <div className="mt-2.5 flex gap-2">
        {offer ? (
          <>
            <div className="num flex-1 self-center text-[15px] text-team">Offer out: {offer.years} yr × {fmtMoney(offer.aav)} · {Math.round(offer.guaranteedPct * 100)}% gtd</div>
            <Button size="sm" variant="ghost" onClick={onWithdraw}>Withdraw</Button>
            <Button size="sm" variant="secondary" onClick={onOffer}>Edit</Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" onClick={onPass}>Pass</Button>
            <Button size="sm" full onClick={onOffer}>Make offer</Button>
          </>
        )}
      </div>
    </div>
  );
}

/** Lightweight contract construction: years, AAV, guaranteed share. */
function OfferBuilder({ player, state, available, initial, onSubmit }: { player: Player; state: RunState; available: number; initial: Offer; onSubmit: (o: Offer) => void }) {
  const [years, setYears] = useState(initial.years);
  const [aav, setAav] = useState(initial.aav);
  const [gtd, setGtd] = useState(initial.guaranteedPct);
  const contract = buildOfferContract(state.year, years, aav, gtd);
  const hit = contract.capHits[state.year];
  const over = hit > available;
  const m = player.market!;
  const fair = fairAav(player);
  const vsMarket = aav / m.aav;
  const hot = m.interest === "HIGH" ? 1.14 : m.interest === "MEDIUM" ? 1.05 : 0.97;
  const read =
    vsMarket >= hot + 0.06 ? { tone: "up" as const, text: "Blows away the market. He'll likely take it." }
    : vsMarket >= hot ? { tone: "up" as const, text: m.interest === "HIGH" ? "Above market, which is what a hot name costs. Favoured." : "Competitive. Favoured unless a contender jumps in." }
    : vsMarket >= 0.95 ? { tone: "risk" as const, text: m.interest === "HIGH" ? "At market, but he has multiple suitors. Expect to be outbid or countered." : "At market. Could go either way." }
    : vsMarket >= 0.85 ? { tone: "risk" as const, text: "Below market. Expect a counter or a rival." }
    : { tone: "down" as const, text: "Well under his ask. Long shot." };
  const step = 250_000;

  return (
    <div className="flex flex-col gap-4">
      <PlayerCard player={player} year={state.year} />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Market" value={fmtMoney(m.aav)} sub={`${m.years} yr ask`} />
        <Stat label="Our value" value={fmtMoney(fair)} sub="what he's worth to us" tone={fair < m.aav * 0.85 ? "risk" : undefined} />
        <Stat label="Cap hit yr 1" value={fmtMoney(hit)} sub={`of ${fmtMoney(available)} available`} tone={over ? "down" : "up"} />
      </div>
      <Slider label="Years" value={years} min={1} max={5} step={1} onChange={setYears} format={(v) => `${v} yr${v > 1 ? "s" : ""}`} />
      <Slider label="Average per year" value={aav} min={Math.max(1_000_000, Math.round(m.aav * 0.5 / step) * step)} max={Math.round(m.aav * 1.6 / step) * step} step={step} onChange={setAav} format={(v) => fmtMoney(v)} />
      <Slider label="Guaranteed" value={gtd} min={0} max={1} step={0.05} onChange={setGtd} format={(v) => `${Math.round(v * 100)}% · ${fmtMoney(contract.guaranteed)}`} />
      <Callout tone={read.tone} title={`${years} yr / ${fmtMoney(contract.totalValue)} · ${fmtMoney(contract.guaranteed)} guaranteed`} detail={over ? `You need another ${fmtMoney(hit - available)} in cap space to make this offer.` : read.text} />
      <Button size="lg" full disabled={over} onClick={() => onSubmit({ playerId: player.id, teamId: state.teamId, years, aav, guaranteedPct: gtd })}>Submit offer</Button>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format: (v: number) => string }) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="label">{label}</span>
        <span className="display num text-[20px] font-bold">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 w-full cursor-pointer accent-[var(--team)]" />
    </label>
  );
}
