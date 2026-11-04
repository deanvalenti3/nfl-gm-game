import { useState } from "react";
import type { ScenarioSnapshot } from "@/domain/types";
import type { RunState } from "@/engine/game";
import { fmtMoney } from "@/engine/cap";
import { Bar, Button, Headline, Pill, ScoreRing } from "@/components/ui";
import { Ticker } from "@/components/Ticker";

export function Report({ state, snapshot, onReplay, onNewTeam }: { state: RunState; snapshot: ScenarioSnapshot; onReplay: () => void; onNewTeam: () => void }) {
  const r = state.report!;
  const [showLog, setShowLog] = useState(false);
  const mine = state.feed.filter((f) => f.teamId === state.teamId && f.kind !== "INJURY");
  const team = snapshot.teams.find((t) => t.id === state.teamId)!;

  return (
    <div className="flex flex-col gap-6">
      <Headline kicker={`${team.city} ${team.name} · ${state.year}`}>GM Report</Headline>
      <section className="card anim-pop flex flex-col items-center gap-2 px-6 py-8 text-center">
        <ScoreRing value={r.score} label={`GM Score · ${r.letter}`} />
        <div className="display text-[25px] font-bold uppercase">{r.seasonLine}</div>
        <div className={`mt-2 w-full rounded-xl border px-4 py-3 text-left ${r.benchmark.verdict === "BEAT" ? "border-up/40 bg-up-soft" : r.benchmark.verdict === "MATCHED" ? "border-even/40 bg-even-soft" : "border-down/40 bg-down-soft"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="label">Real life</div>
              <div className="display text-[19px] font-bold uppercase">{r.benchmark.real.label}</div>
            </div>
            <Pill tone={r.benchmark.verdict === "BEAT" ? "up" : r.benchmark.verdict === "MATCHED" ? "even" : "down"} className="text-[16px]">
              {r.benchmark.verdict === "BEAT" ? "You beat it" : r.benchmark.verdict === "MATCHED" ? "You matched it" : "Fell short"}
            </Pill>
          </div>
          <div className="num mt-1 text-[14px] text-ink-2">
            {r.benchmark.winDiff >= 0 ? "+" : ""}{r.benchmark.winDiff} wins · {r.benchmark.depthDiff >= 0 ? "+" : ""}{r.benchmark.depthDiff} playoff rounds vs the real team{r.benchmark.barWins > r.benchmark.real.w ? ` · scored against last year's ${r.benchmark.barWins} wins` : ""}
          </div>
        </div>
      </section>

      <section className="card p-5">
        <div className="label mb-3">Dimensions</div>
        <div className="flex flex-col gap-2.5">
          {r.dimensions.map((d, i) => (
            <Bar key={d.key} label={d.label} value={d.score} delay={i * 80} tone={d.score >= 75 ? "up" : d.score >= 50 ? "team" : "down"} />
          ))}
        </div>
      </section>

      <section className="stagger grid gap-2.5 sm:grid-cols-2">
        {r.bestMove && (
          <div className="card border-up/30 bg-up-soft p-4">
            <div className="label mb-1 text-up">Best move</div>
            <div className="display text-[20px] font-bold uppercase leading-tight">{r.bestMove.label}</div>
            <div className="mt-0.5 text-[15px] text-ink-2">{r.bestMove.detail}</div>
          </div>
        )}
        {r.worstMove && (
          <div className="card border-down/30 bg-down-soft p-4">
            <div className="label mb-1 text-down">Worst move</div>
            <div className="display text-[20px] font-bold uppercase leading-tight">{r.worstMove.label}</div>
            <div className="mt-0.5 text-[15px] text-ink-2">{r.worstMove.detail}</div>
          </div>
        )}
        {r.draftSteal && (
          <div className="card p-4">
            <div className="label mb-1 text-team">Draft steal</div>
            <div className="display text-[20px] font-bold uppercase leading-tight">{r.draftSteal.label}</div>
            <div className="mt-0.5 text-[15px] text-ink-2">{r.draftSteal.detail}</div>
          </div>
        )}
        <div className="card p-4">
          <div className="label mb-1">Cap health</div>
          <div className="flex items-center gap-2">
            <Pill tone={r.capHealth === "STRONG" ? "up" : r.capHealth === "HEALTHY" ? "even" : r.capHealth === "TIGHT" ? "risk" : "down"}>{r.capHealth}</Pill>
            <span className="text-[15px] text-ink-2">{fmtMoney(state.deadMoney[state.teamId] ?? 0)} dead money this year</span>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <button onClick={() => setShowLog((v) => !v)} className="flex w-full items-center justify-between">
          <span className="label">Your moves ({mine.length})</span>
          <span className="display text-[14px] font-bold uppercase text-team">{showLog ? "Hide" : "Show"}</span>
        </button>
        {showLog && (
          <div className="mt-3">
            <Ticker items={mine} teams={snapshot.teams} userTeam={state.teamId} limit={100} />
          </div>
        )}
      </section>

      <div className="flex flex-col gap-2.5">
        <Button size="lg" full onClick={onReplay}>Replay this team</Button>
        <Button variant="secondary" size="lg" full onClick={onNewTeam}>Try another scenario</Button>
      </div>
    </div>
  );
}
