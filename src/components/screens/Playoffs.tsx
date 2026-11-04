import type { ScenarioSnapshot } from "@/domain/types";
import type { Action, RunState } from "@/engine/game";
import { computeStandings } from "@/engine/season";
import { Button, Headline, Pill } from "@/components/ui";

const STAGE_LABEL = { WC: "Wild Card", DIV: "Divisional Round", CONF: "Conference Championship", SB: "Super Bowl" } as const;

/** Round-by-round playoff reveal. Your games are highlighted; elimination is loud. */
export function Playoffs({ state, snapshot, dispatch }: { state: RunState; snapshot: ScenarioSnapshot; dispatch: (a: Action) => void }) {
  const st = computeStandings(snapshot.teams, state.results)[state.teamId];
  const seeding = state.seedings?.find((s) => s.seeds.includes(state.teamId));
  const seed = seeding ? seeding.seeds.indexOf(state.teamId) + 1 : null;
  const rounds = (["WC", "DIV", "CONF", "SB"] as const).map((stage) => ({ stage, games: state.playoffs.filter((g) => g.stage === stage) }));
  const played = state.playoffs.length;
  const nextStage = played === 0 ? "WC" : played === 6 ? "DIV" : played === 10 ? "CONF" : played === 12 ? "SB" : null;
  const myGames = state.playoffs.filter((g) => g.homeId === state.teamId || g.awayId === state.teamId);
  const lastMine = myGames[myGames.length - 1];
  const eliminated = lastMine?.result && (lastMine.result.homeScore > lastMine.result.awayScore ? lastMine.homeId : lastMine.awayId) !== state.teamId;
  const champion = lastMine?.stage === "SB" && lastMine.result && (lastMine.result.homeScore > lastMine.result.awayScore ? lastMine.homeId : lastMine.awayId) === state.teamId;
  const name = (id: string) => snapshot.teams.find((t) => t.id === id)?.name ?? id;
  const divisionChamp = seeding?.divisionWinners.includes(state.teamId);

  return (
    <div className="flex flex-col gap-5">
      <Headline kicker={`Final record ${st.w}–${st.l}${st.t ? `–${st.t}` : ""}`} sub={seed ? `${divisionChamp ? "Division champions. " : ""}You're the ${seed} seed in the ${seeding!.conference}.` : "You missed the playoffs. Watch how the field shakes out."}>
        {champion ? "Super Bowl Champions" : eliminated ? "Eliminated" : seed ? "Playoffs" : "Season over"}
      </Headline>

      {rounds.filter((r) => r.games.length).map((r) => (
        <section key={r.stage} className="card p-4">
          <div className="label mb-2">{STAGE_LABEL[r.stage]}</div>
          <ol className="stagger flex flex-col divide-y divide-line">
            {r.games.map((g) => {
              const res = g.result!;
              const hw = res.homeScore > res.awayScore;
              const mine = g.homeId === state.teamId || g.awayId === state.teamId;
              return (
                <li key={g.id} className={`flex items-center gap-2 py-2 text-[17px] ${mine ? "text-team" : ""}`}>
                  <Pill className="w-10 justify-center">{g.conference === "SB" ? "SB" : g.conference}</Pill>
                  <span className={`display flex-1 uppercase tracking-wide ${!hw ? "font-bold" : "text-ink-2"}`}>{name(g.awayId)} <span className="num">{res.awayScore}</span></span>
                  <span className="text-ink-3">@</span>
                  <span className={`display flex-1 text-right uppercase tracking-wide ${hw ? "font-bold" : "text-ink-2"}`}><span className="num">{res.homeScore}</span> {name(g.homeId)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      {nextStage ? (
        <Button size="lg" full onClick={() => dispatch({ type: "SIM_PLAYOFF_ROUND" })}>{seed && !eliminated ? `Play the ${STAGE_LABEL[nextStage]}` : `Simulate the ${STAGE_LABEL[nextStage]}`}</Button>
      ) : (
        <Button size="lg" full onClick={() => dispatch({ type: "FINISH" })}>See your GM report</Button>
      )}
    </div>
  );
}
