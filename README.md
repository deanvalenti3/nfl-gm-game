# Front Office

Take over a real NFL team at the start of an offseason. Sign, cut, trade, draft. Set your roster, simulate the season, make one more set of calls at the trade deadline, and find out whether the team you built can win.

Built on the interaction grammar of the Vertical Slice game (brief → decision → consequence → next decision → score), not on its code. See `docs/01-vertical-slice-patterns.md`.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5180. No server, no accounts, no network calls at play time. The current run is saved to localStorage after every action, so closing the tab and coming back resumes mid-draft.

| Command | What it does |
| --- | --- |
| `npm test` | Vitest: snapshot integrity, cap arithmetic, and a full end-to-end run through the reducer |
| `npm run typecheck` | TypeScript |
| `npm run build` | Typecheck + production build |
| `npm run check` | All of the above |

## The run

1. **Briefing.** Ownership expectation, last season, cap space, draft capital, key problems.
2. **Roster audit.** One decision at a time: keep, cut, or shop a veteran. The consequence (savings, dead money) shows after you lock it in.
3. **Needs.** Rank your three biggest holes. This drives your free-agent shortlist and auto-draft.
4. **Free agency.** Five market days. Make offers (years, average, guaranteed share). Other teams bid, agents counter, players sign elsewhere while you wait.
5. **Trade window.** Madden-style builder: your offer vs their assets, with an interest read (LOW / POSSIBLE / STRONG) and counters.
6. **Draft.** Real 2025 class. Public scouting info only (grade, projected range, athletic, production, risk). Run to your pick, draft, trade the pick, or auto-draft the rest.
7. **Roster.** Depth chart, strengths, weaknesses, depth concerns. Tap a slot to change a starter.
8. **Season.** Week-by-week results, standings, playoff odds, injuries. Stops at the deadline.
9. **Deadline.** Buy, sell, or stand pat. Other teams' posture reflects their record.
10. **Playoffs** round by round, then the **GM report**: score, six dimensions, best move, worst move, draft steal, cap health.

## Architecture

```
src/
  domain/types.ts           Normalised model: Team, Player, Contract, DraftPick, DraftProspect,
                            TeamProfile, Scenario, ScenarioSnapshot, Transaction, GameResult
  data/
    teams.ts                32 teams, colours, 2024 records, 2025 draft order
    build.ts                Contract/rookie/player builders shared by snapshots and ingest
    providers/              NflDataProvider, ContractDataProvider, PlayerMetadataProvider,
                            nflverse adapter (ingest-time only)
    scenarios/ne-2025/      The New England 2025 snapshot: roster, 31 league profiles with
                            tradeable players, the real FA class, the real draft class, pick ownership
  engine/                   No React anywhere in here
    rng.ts                  Seeded mulberry32; the run stores the RNG state
    cap.ts                  calculateCapSpace, calculateDeadMoney, calculateCutSavings, offer contracts
    roster.ts               Depth charts, unit ratings, calculateTeamStrength, position grades, tiers
    value.ts                marketAav, playerValue, pick value chart
    ai.ts                   evaluateTeamNeed, status weights, deadline re-evaluation
    freeAgency.ts           generateFreeAgentOffer, resolveOffer, shortlist
    trade.ts                evaluateTrade (partner context), decideTrade
    draft.ts                simulateDraftSelection (public board only), prospectToPlayer
    schedule.ts             17-game schedule with the real 2025 rotation formula
    season.ts               simulateGame, standings, tiebreakers, seeding, playoff bracket
    scoring.ts              calculateGMScore
    game.ts                 RunState + runReducer: the whole run as one pure state machine
  storage/run.ts            RunStore interface; localStorage + memory implementations
  hooks/useRun.ts           React binding with autosave
  components/               Thin UI over the engine
```

Design rules:

- **No hindsight.** The GM sees grades, ranges and tiers. Hidden `ovr`/`trueOvr` drive the simulator. AI teams draft from the public board too.
- **Deterministic.** Same seed, same decisions, same season. Tests pin it.
- **Snapshots.** A run never fetches. Scenarios are frozen, versioned modules.
- **Hard cap.** Illegal moves are refused with a one-line reason.

## Adding a scenario

1. Create `src/data/scenarios/<id>/` with a roster, league profiles, free agents, prospects and picks in the same shape as `ne-2025/` (or run the ingest adapter in `src/data/providers/nflverse.ts` and curate the pre-draft grades by hand as of the cutoff date).
2. Export a `ScenarioSnapshot` and add it to `src/data/scenarios/index.ts`.
3. `npm test`. The snapshot suite checks unique players, pick ownership, prospect counts and contracts.

Data sources and what each is good for: `docs/02-data-sources.md`.
# nfl-gm-game
