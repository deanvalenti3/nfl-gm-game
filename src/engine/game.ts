import type { DraftPick, DraftProspect, GameResult, Player, Position, ScenarioSnapshot, TeamProfile, TradeAsset, Transaction } from "@/domain/types";
import { rookie } from "@/data/build";
import { aiUnitRatings, deadlineStatus, evaluateTeamNeed, userTeamStrength } from "./ai";
import { buildOfferContract, calculateCapSpace, calculateCutSavings, calculateDeadMoney, calculateTradeDeadMoney, capHit, fmtMoney } from "./cap";
import { consensusValue, draftOrder, positionalPremium, prospectToPlayer, simulateDraftSelection } from "./draft";
import { generateFreeAgentOffer, resolveOffer, signsElsewhereToday, type Offer, type Resolution } from "./freeAgency";
import { Rng, hashString } from "./rng";
import { buildDepthChart, calculateTeamStrength, gradePositions, unitRatings } from "./roster";
import { generateSchedule, type Fixture } from "./schedule";
import { calculateGMScore, type GMReport } from "./scoring";
import { computeSeeding, computeStandings, nextPlayoffRound, simulateGame, type PlayoffGame, type Seeding } from "./season";
import { decideTrade, evaluateTrade, type TradeContext, type TradeEvaluation } from "./trade";
import { marketAav } from "./value";
import type { DefenseScheme, OffenseScheme, Scheme } from "./scheme";

/**
 * The whole run as one serialisable state object and one pure reducer.
 * No React, no storage. Every random draw goes through `state.rng`.
 */

export type Phase = "BRIEFING" | "AUDIT" | "NEEDS" | "FREE_AGENCY" | "TRADE_WINDOW" | "DRAFT" | "ROSTER" | "SEASON" | "DEADLINE" | "PLAYOFFS" | "REPORT";

export const PHASES: Phase[] = ["BRIEFING", "AUDIT", "NEEDS", "FREE_AGENCY", "TRADE_WINDOW", "DRAFT", "ROSTER", "SEASON", "DEADLINE", "PLAYOFFS", "REPORT"];

export interface FeedItem {
  id: number;
  when: string;
  teamId: string;
  /** "Signed WR Tee Higgins" */
  headline: string;
  /** "4 yrs / $91.0M" */
  detail: string;
  kind: Transaction["kind"] | "NOTE";
}

export interface DraftLogEntry {
  pickId: string;
  overall: number;
  round: number;
  teamId: string;
  playerId: string;
}

export interface RunState {
  version: 1;
  scenarioId: string;
  teamId: string;
  year: number;
  seed: number;
  rng: number;
  phase: Phase;
  players: Record<string, Player>;
  picks: Record<string, DraftPick>;
  profiles: Record<string, TeamProfile>;
  prospects: Record<string, DraftProspect>;
  drafted: string[];
  startRosters: Record<string, string[]>;
  departed: Record<string, string[]>;
  deadMoney: Record<string, number>;
  transactions: Transaction[];
  feed: FeedItem[];
  audit: { index: number; decisions: Record<string, string>; shopping: string[] };
  needs: Position[];
  fa: {
    day: number;
    maxDay: number;
    offers: Record<string, Offer>;
    asks: Record<string, { ask: Offer; rival: string | null }>;
    passed: string[];
    lastResolutions: Resolution[];
  };
  lastTrade: { accepted: boolean; evaluation: TradeEvaluation; partner: string } | null;
  draft: { order: string[]; index: number; log: DraftLogEntry[]; sinceLast: number; userAuto: boolean };
  depthOverrides: Record<string, string>;
  scheme: Scheme;
  schedule: Fixture[];
  results: GameResult[];
  week: number;
  deadline: { done: boolean; note: string };
  seedings: Seeding[] | null;
  playoffs: PlayoffGame[];
  strengthStart: number;
  strengthEnd: number;
  report: GMReport | null;
  feedSeq: number;
}

export type Action =
  | { type: "START" }
  | { type: "AUDIT_DECIDE"; decisionId: string; choice: "KEEP" | "CUT" | "TRADE" }
  | { type: "SET_NEEDS"; needs: Position[] }
  | { type: "CONFIRM_NEEDS" }
  | { type: "FA_OFFER"; offer: Offer }
  | { type: "FA_WITHDRAW"; playerId: string }
  | { type: "FA_PASS"; playerId: string }
  | { type: "FA_ADVANCE" }
  | { type: "FA_FINISH" }
  | { type: "TRADE_EXECUTE"; partner: string; give: TradeAsset[]; get: TradeAsset[] }
  | { type: "TRADE_CLEAR" }
  | { type: "TRADE_DONE" }
  | { type: "RELEASE"; playerId: string }
  | { type: "DRAFT_ADVANCE" }
  | { type: "DRAFT_SELECT"; prospectId: string }
  | { type: "DRAFT_AUTO_REMAINING" }
  | { type: "SET_STARTER"; slot: string; playerId: string }
  | { type: "SET_SCHEME"; offense?: OffenseScheme; defense?: DefenseScheme }
  | { type: "START_SEASON" }
  | { type: "SIM_WEEK" }
  | { type: "DEADLINE_DONE" }
  | { type: "SIM_PLAYOFF_ROUND" }
  | { type: "FINISH" }
  | { type: "RESET"; seed?: number };

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createRun(snapshot: ScenarioSnapshot, seed = Date.now()): RunState {
  const players = Object.fromEntries(snapshot.players.map((p) => [p.id, structuredClone(p)]));
  const startRosters: Record<string, string[]> = {};
  for (const p of snapshot.players) if (p.teamId) (startRosters[p.teamId] ??= []).push(p.id);
  const userRoster = snapshot.players.filter((p) => p.teamId === snapshot.scenario.teamId);
  const state: RunState = {
    version: 1,
    scenarioId: snapshot.scenario.id,
    teamId: snapshot.scenario.teamId,
    year: snapshot.scenario.season,
    seed,
    rng: hashString(String(seed)),
    phase: "BRIEFING",
    players,
    picks: Object.fromEntries(snapshot.picks.map((p) => [p.id, { ...p }])),
    profiles: Object.fromEntries(snapshot.profiles.map((p) => [p.teamId, structuredClone(p)])),
    prospects: Object.fromEntries(snapshot.prospects.map((p) => [p.id, p])),
    drafted: [],
    startRosters,
    departed: {},
    deadMoney: {},
    transactions: [],
    feed: [],
    audit: { index: 0, decisions: {}, shopping: [] },
    needs: [...snapshot.scenario.keyProblems].slice(0, 3),
    fa: { day: 1, maxDay: 5, offers: {}, asks: {}, passed: [], lastResolutions: [] },
    lastTrade: null,
    draft: { order: [], index: 0, log: [], sinceLast: 0, userAuto: false },
    depthOverrides: {},
    scheme: { offense: snapshot.scenario.defaultScheme?.offense ?? "SPREAD", defense: snapshot.scenario.defaultScheme?.defense ?? "FOUR_THREE", locked: false },
    schedule: [],
    results: [],
    week: 1,
    deadline: { done: false, note: "" },
    seedings: null,
    playoffs: [],
    strengthStart: userTeamStrength(userRoster, {}),
    strengthEnd: 0,
    report: null,
    feedSeq: 0,
  };
  return state;
}

// ---------------------------------------------------------------------------
// Selectors (pure reads used by the reducer and the UI)
// ---------------------------------------------------------------------------

export function rosterOf(state: RunState, teamId: string): Player[] {
  return Object.values(state.players).filter((p) => p.teamId === teamId);
}

export function userRoster(state: RunState): Player[] {
  return rosterOf(state, state.teamId);
}

export function freeAgents(state: RunState): Player[] {
  return Object.values(state.players).filter((p) => !p.teamId && p.market);
}

export function rookieReserve(state: RunState): number {
  return Object.values(state.picks)
    .filter((p) => p.teamId === state.teamId && p.year === state.year && !p.usedOnPlayerId && p.overall)
    // Net of the minimum-salary players each rookie displaces from the top 51.
    .reduce((s, p) => s + Math.max(0, (rookie(state.year, p.overall!).capHits[state.year] ?? 0) - 840_000), 0);
}

export function capSummary(state: RunState, snapshot: ScenarioSnapshot) {
  return calculateCapSpace(userRoster(state), snapshot.scenario.salaryCap + snapshot.scenario.carryover, state.year, state.deadMoney[state.teamId] ?? 0, rookieReserve(state));
}

export function teamStrength(state: RunState, teamId: string): number {
  if (teamId === state.teamId) return userTeamStrength(userRoster(state), state.depthOverrides, state.scheme);
  const profile = state.profiles[teamId];
  const now = rosterOf(state, teamId);
  const departed = (state.departed[teamId] ?? []).map((id) => state.players[id]).filter(Boolean);
  return calculateTeamStrength(aiUnitRatings(profile, now, departed, new Set(state.startRosters[teamId] ?? [])));
}

export function allStrengths(state: RunState): Record<string, number> {
  return Object.fromEntries(Object.keys(state.profiles).map((id) => [id, teamStrength(state, id)]));
}

export function aiCapSpace(state: RunState, teamId: string): number {
  return state.profiles[teamId].capSpace;
}

export function tradeContext(state: RunState, snapshot: ScenarioSnapshot): TradeContext {
  const rosters: Record<string, Player[]> = {};
  for (const p of Object.values(state.players)) if (p.teamId) (rosters[p.teamId] ??= []).push(p);
  const capSpace: Record<string, number> = Object.fromEntries(Object.values(state.profiles).map((p) => [p.teamId, p.capSpace]));
  capSpace[state.teamId] = capSummary(state, snapshot).space;
  return { year: state.year, players: state.players, picks: state.picks, profiles: state.profiles, capSpace, rosters };
}

export function currentPick(state: RunState): DraftPick | null {
  const id = state.draft.order[state.draft.index];
  return id ? state.picks[id] : null;
}

export function userOnClock(state: RunState): boolean {
  const p = currentPick(state);
  return !!p && p.teamId === state.teamId;
}

export function standings(state: RunState, snapshot: ScenarioSnapshot) {
  return computeStandings(snapshot.teams, state.results);
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function runReducer(snapshot: ScenarioSnapshot) {
  const scenario = snapshot.scenario;
  const teamsById = Object.fromEntries(snapshot.teams.map((t) => [t.id, t]));
  const teamName = (id: string) => teamsById[id]?.city.toUpperCase() ?? id;

  function feed(s: RunState, teamId: string, headline: string, detail: string, kind: FeedItem["kind"], when: string) {
    s.feed.unshift({ id: ++s.feedSeq, when, teamId, headline, detail, kind });
    if (s.feed.length > 120) s.feed.length = 120;
  }

  function whenLabel(s: RunState): string {
    switch (s.phase) {
      case "AUDIT": return "Offseason";
      case "FREE_AGENCY": return `FA Day ${s.fa.day}`;
      case "TRADE_WINDOW": return "Trade window";
      case "DRAFT": return "Draft";
      case "ROSTER": return "Camp";
      case "SEASON": return `Week ${s.week}`;
      case "DEADLINE": return "Deadline";
      case "PLAYOFFS": return "Playoffs";
      default: return "Offseason";
    }
  }

  function release(s: RunState, teamId: string, playerId: string) {
    const p = s.players[playerId];
    if (!p || p.teamId !== teamId) return;
    const dead = calculateDeadMoney(p.contract, s.year);
    const savings = calculateCutSavings(p.contract, s.year);
    s.deadMoney[teamId] = (s.deadMoney[teamId] ?? 0) + dead;
    p.teamId = null;
    p.contract = null;
    p.market = { years: p.age >= 30 ? 1 : 2, aav: Math.round(marketAav(p.ability.ovr, p.pos, p.age) * 0.85), guaranteedPct: 0.4, interest: p.ability.ovr >= 76 ? "MEDIUM" : "LOW", prevTeamId: teamId };
    if (teamId !== s.teamId) {
      s.profiles[teamId].capSpace += savings;
      (s.departed[teamId] ??= []).push(playerId);
    }
    s.transactions.push({ kind: "RELEASE", teamId, playerId, savings, deadMoney: dead, week: whenLabel(s) });
    feed(s, teamId, `Released ${p.pos} ${p.name}`, `Saves ${fmtMoney(savings)} · ${fmtMoney(dead)} dead`, "RELEASE", whenLabel(s));
  }

  function sign(s: RunState, teamId: string, playerId: string, offer: Offer) {
    const p = s.players[playerId];
    const contract = buildOfferContract(s.year, offer.years, offer.aav, offer.guaranteedPct);
    p.teamId = teamId;
    p.contract = contract;
    p.market = undefined;
    if (teamId !== s.teamId) s.profiles[teamId].capSpace -= contract.capHits[s.year];
    s.transactions.push({ kind: "SIGN", teamId, playerId, years: offer.years, total: contract.totalValue, aav: offer.aav, guaranteed: contract.guaranteed, week: whenLabel(s) });
    feed(s, teamId, `Signed ${p.pos} ${p.name}`, `${offer.years} yr${offer.years > 1 ? "s" : ""} / ${fmtMoney(contract.totalValue)} · ${fmtMoney(contract.guaranteed)} gtd`, "SIGN", whenLabel(s));
  }

  function moveAsset(s: RunState, asset: TradeAsset, from: string, to: string) {
    if (asset.type === "PICK") {
      s.picks[asset.id].teamId = to;
      return;
    }
    const p = s.players[asset.id];
    const dead = calculateTradeDeadMoney(p.contract, s.year);
    s.deadMoney[from] = (s.deadMoney[from] ?? 0) + dead;
    // Proration stays with the old team; the new team carries salary only.
    if (p.contract) {
      for (let y = s.year; y <= p.contract.endYear; y++) {
        p.contract.capHits[y] = (p.contract.capHits[y] ?? 0) - (p.contract.proratedBonus[y] ?? 0);
        p.contract.proratedBonus[y] = 0;
      }
    }
    p.teamId = to;
    if (from !== s.teamId) {
      s.profiles[from].capSpace += capHit(p.contract, s.year) - dead;
      (s.departed[from] ??= []).push(p.id);
    }
    if (to !== s.teamId) s.profiles[to].capSpace -= capHit(p.contract, s.year);
  }

  function assetLabel(s: RunState, a: TradeAsset): string {
    if (a.type === "PLAYER") return `${s.players[a.id].pos} ${s.players[a.id].name}`;
    const p = s.picks[a.id];
    return p.overall ? `pick #${p.overall}` : `${p.year} R${p.round}`;
  }

  function startDraft(s: RunState) {
    s.phase = "DRAFT";
    s.draft = { order: draftOrder(Object.values(s.picks), s.year).map((p) => p.id), index: 0, log: [], sinceLast: 0, userAuto: false };
  }

  function makePick(s: RunState, rng: Rng, pick: DraftPick, prospect: DraftProspect) {
    const player = prospectToPlayer(prospect, pick.teamId, pick, s.year, rng);
    s.players[player.id] = player;
    s.drafted.push(prospect.id);
    pick.usedOnPlayerId = player.id;
    if (pick.teamId !== s.teamId) s.profiles[pick.teamId].capSpace -= player.contract!.capHits[s.year] ?? 0;
    s.draft.log.push({ pickId: pick.id, overall: pick.overall!, round: pick.round, teamId: pick.teamId, playerId: player.id });
    s.draft.sinceLast++;
    s.transactions.push({ kind: "DRAFT", teamId: pick.teamId, playerId: player.id, pickId: pick.id, overall: pick.overall!, round: pick.round, week: "Draft" });
    if (pick.teamId === s.teamId || pick.round === 1) feed(s, pick.teamId, `Pick ${pick.overall} · ${prospect.pos} ${prospect.name}`, `${prospect.school} · Round ${pick.round}`, "DRAFT", "Draft");
  }

  function userAutoPick(s: RunState, rng: Rng, pick: DraftPick): DraftProspect | null {
    const roster = userRoster(s);
    const board = Object.values(s.prospects).filter((p) => !s.drafted.includes(p.id));
    let best: DraftProspect | null = null;
    let bestScore = -Infinity;
    for (const p of board) {
      if ((p.pos === "K" || p.pos === "P" || p.pos === "LS") && pick.round < 5) continue;
      const needIdx = s.needs.indexOf(p.pos);
      const need = needIdx >= 0 ? 0.6 - needIdx * 0.15 : evaluateTeamNeed(s.profiles[s.teamId], p.pos, roster) * 0.5;
      const score = consensusValue(p) * positionalPremium(p.pos) * (0.85 + need * 0.4) + rng.gauss(0, 3);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    return best;
  }

  function advanceDraft(s: RunState, rng: Rng, stopAtUser: boolean) {
    s.draft.sinceLast = 0;
    while (s.draft.index < s.draft.order.length) {
      const pick = s.picks[s.draft.order[s.draft.index]];
      if (pick.usedOnPlayerId) {
        s.draft.index++;
        continue;
      }
      const isUser = pick.teamId === s.teamId;
      if (isUser && stopAtUser && !s.draft.userAuto) return;
      const board = Object.values(s.prospects);
      const drafted = new Set(s.drafted);
      const prospect = isUser ? userAutoPick(s, rng, pick) : simulateDraftSelection(board, s.profiles[pick.teamId], rosterOf(s, pick.teamId), pick, rng, drafted);
      if (!prospect) {
        pick.usedOnPlayerId = "none";
        s.draft.index++;
        continue;
      }
      makePick(s, rng, pick, prospect);
      s.draft.index++;
    }
    s.phase = "ROSTER";
  }

  function simWeek(s: RunState, rng: Rng) {
    const week = s.week;
    const strengths = allStrengths(s);
    for (const f of s.schedule.filter((x) => x.week === week)) {
      s.results.push(simulateGame(week, f.homeId, f.awayId, strengths[f.homeId], strengths[f.awayId], rng));
    }
    // Injuries: heal, then roll.
    for (const p of Object.values(s.players)) if ((p.injuredWeeks ?? 0) > 0) p.injuredWeeks!--;
    const chart = buildDepthChart(userRoster(s), s.depthOverrides);
    for (const id of Object.values(chart.starters)) {
      const p = s.players[id];
      if (rng.chance(((100 - p.ability.durability) / 100) * 0.05 + 0.006)) {
        const weeks = rng.chance(0.12) ? 30 : rng.int(1, 6);
        p.injuredWeeks = weeks;
        s.transactions.push({ kind: "INJURY", teamId: s.teamId, playerId: id, weeks, week: `Week ${week}` });
        feed(s, s.teamId, `${p.pos} ${p.name} injured`, weeks >= 18 ? "Out for the season" : `Out ${weeks} week${weeks > 1 ? "s" : ""}`, "INJURY", `Week ${week}`);
      }
    }
    for (const p of Object.values(s.players)) {
      if (p.teamId && p.teamId !== s.teamId && p.ability.ovr >= 78 && rng.chance(0.004)) p.injuredWeeks = rng.int(2, 8);
    }
    s.week++;
  }

  function deadlineNote(s: RunState): string {
    const st = computeStandings(snapshot.teams, s.results)[s.teamId];
    const roster = userRoster(s);
    const hurt = roster.filter((p) => (p.injuredWeeks ?? 0) >= 4 && p.ability.ovr >= 72).sort((a, b) => b.ability.ovr - a.ability.ovr)[0];
    const grades = gradePositions(roster, buildDepthChart(roster, s.depthOverrides)).sort((a, b) => a.score - b.score);
    const weakest = grades[0];
    const rec = `${st.w}–${st.l}`;
    if (st.w >= st.l + 2) {
      if (hurt) return `You're ${rec} and in the race, but ${hurt.name} is out ${hurt.injuredWeeks! >= 18 ? "for the season" : `another ${hurt.injuredWeeks} weeks`}. Contenders are shopping.`;
      return `You're ${rec}. The roster is winning, but ${weakest.pos} is the soft spot a playoff opponent will find.`;
    }
    if (st.l >= st.w + 2) return `You're ${rec}. Sellers get paid at the deadline; veterans on expiring deals have value to contenders.`;
    return `You're ${rec} and right on the bubble. ${weakest.pos} is the weakest unit on the roster. Buy, sell, or hold?`;
  }

  function finishSeasonToPlayoffs(s: RunState, rng: Rng) {
    const st = computeStandings(snapshot.teams, s.results);
    s.seedings = computeSeeding(snapshot.teams, st, s.results, rng.int(0, 1000));
    s.phase = "PLAYOFFS";
    // Re-set statuses for next-year flavour.
    for (const id of Object.keys(s.profiles)) s.profiles[id].status = deadlineStatus(s.profiles[id], st[id].w, st[id].l);
  }

  function playoffOutcome(s: RunState) {
    const u = s.teamId;
    const seeding = s.seedings?.find((x) => x.seeds.includes(u));
    const madePlayoffs = !!seeding;
    const wins = s.playoffs.filter((g) => g.result && ((g.result.homeScore > g.result.awayScore ? g.homeId : g.awayId) === u)).length;
    const sb = s.playoffs.find((g) => g.stage === "SB");
    const wonSB = !!sb?.result && (sb.result.homeScore > sb.result.awayScore ? sb.homeId : sb.awayId) === u;
    const divisionChamp = !!seeding?.divisionWinners.includes(u);
    return { madePlayoffs, wins, wonSB, divisionChamp };
  }

  return function reduce(prev: RunState, action: Action): RunState {
    if (action.type === "RESET") return createRun(snapshot, action.seed ?? Date.now());
    const s: RunState = structuredClone(prev);
    const rng = new Rng(s.rng);
    const done = () => {
      s.rng = rng.state;
      return s;
    };

    switch (action.type) {
      case "START": {
        if (s.phase !== "BRIEFING") return prev;
        s.phase = "AUDIT";
        return done();
      }

      case "AUDIT_DECIDE": {
        if (s.phase !== "AUDIT") return prev;
        const decision = scenario.auditDecisions[s.audit.index];
        if (!decision || decision.id !== action.decisionId) return prev;
        s.audit.decisions[decision.id] = action.choice;
        if (action.choice === "CUT") release(s, s.teamId, decision.playerId);
        if (action.choice === "TRADE") s.audit.shopping.push(decision.playerId);
        s.audit.index++;
        if (s.audit.index >= scenario.auditDecisions.length) s.phase = "NEEDS";
        return done();
      }

      case "SET_NEEDS": {
        if (s.phase !== "NEEDS") return prev;
        s.needs = action.needs;
        return done();
      }

      case "CONFIRM_NEEDS": {
        if (s.phase !== "NEEDS") return prev;
        s.phase = "FREE_AGENCY";
        s.fa.day = 1;
        // Agents come to you before the market opens: one mid-tier pitch per ranked need.
        const pool = freeAgents(s);
        for (const pos of s.needs) {
          const candidates = pool.filter((p) => p.pos === pos && p.ability.ovr >= 68 && p.ability.ovr <= 80 && p.age <= 31 && !s.fa.asks[p.id]);
          if (!candidates.length) continue;
          const p = rng.pick(candidates);
          const m = p.market!;
          const years = Math.max(1, Math.min(4, m.years + (p.age >= 29 ? -1 : 0)));
          s.fa.asks[p.id] = { ask: { playerId: p.id, teamId: s.teamId, years, aav: Math.round((m.aav * rng.range(0.93, 1.0)) / 100_000) * 100_000, guaranteedPct: Math.min(0.9, m.guaranteedPct + 0.1) }, rival: null };
        }
        return done();
      }

      case "FA_OFFER": {
        if (s.phase !== "FREE_AGENCY" && s.phase !== "ROSTER") return prev;
        const p = s.players[action.offer.playerId];
        if (!p || p.teamId) return prev;
        const space = capSummary(s, snapshot).space;
        const committedElsewhere = Object.values(s.fa.offers)
          .filter((o) => o.playerId !== p.id)
          .reduce((sum, o) => sum + buildOfferContract(s.year, o.years, o.aav, o.guaranteedPct).capHits[s.year], 0);
        const hit = buildOfferContract(s.year, action.offer.years, action.offer.aav, action.offer.guaranteedPct).capHits[s.year];
        if (hit > space - committedElsewhere) return prev;
        s.fa.offers[p.id] = { ...action.offer, teamId: s.teamId };
        delete s.fa.asks[p.id];
        s.fa.passed = s.fa.passed.filter((id) => id !== p.id);
        if (s.phase === "ROSTER") {
          // Post-draft signings resolve immediately at the asking price.
          sign(s, s.teamId, p.id, s.fa.offers[p.id]);
          delete s.fa.offers[p.id];
        }
        return done();
      }

      case "FA_WITHDRAW": {
        delete s.fa.offers[action.playerId];
        return done();
      }

      case "FA_PASS": {
        if (!s.fa.passed.includes(action.playerId)) s.fa.passed.push(action.playerId);
        delete s.fa.offers[action.playerId];
        delete s.fa.asks[action.playerId];
        return done();
      }

      case "FA_ADVANCE": {
        if (s.phase !== "FREE_AGENCY") return prev;
        const resolutions: Resolution[] = [];
        const profiles = Object.values(s.profiles).filter((p) => p.teamId !== s.teamId);
        const rosters: Record<string, Player[]> = {};
        for (const p of Object.values(s.players)) if (p.teamId) (rosters[p.teamId] ??= []).push(p);
        const capSpace: Record<string, number> = Object.fromEntries(profiles.map((p) => [p.teamId, p.capSpace]));
        const userPull = s.profiles[s.teamId].status === "REBUILDING" ? 0.97 : 1.0;

        // 1. Counters the player ignored for a day: the rival may close.
        for (const [id, ask] of Object.entries(s.fa.asks)) {
          const p = s.players[id];
          if (!p || p.teamId) {
            delete s.fa.asks[id];
            continue;
          }
          if (rng.chance(ask.rival ? 0.4 : 0.3)) {
            const offer = generateFreeAgentOffer(p, profiles, rosters, capSpace, rng, s.fa.day);
            if (offer) {
              sign(s, offer.teamId, p.id, offer);
              delete s.fa.asks[id];
              resolutions.push({ kind: "SIGNED_ELSEWHERE", playerId: p.id, offer });
            }
          }
        }
        // 2. Resolve the user's offers.
        for (const offer of Object.values(s.fa.offers)) {
          const p = s.players[offer.playerId];
          if (!p || p.teamId) continue;
          const rival = generateFreeAgentOffer(p, profiles, rosters, capSpace, rng, s.fa.day);
          const r = resolveOffer(offer, p, rival, s.profiles, rng, userPull);
          resolutions.push(r);
          if (r.kind === "SIGNED_WITH_USER") {
            sign(s, s.teamId, p.id, offer);
            delete s.fa.offers[p.id];
            delete s.fa.asks[p.id];
          } else if (r.kind === "SIGNED_ELSEWHERE") {
            sign(s, r.offer.teamId, p.id, r.offer);
            capSpace[r.offer.teamId] -= r.offer.aav;
            delete s.fa.offers[p.id];
            delete s.fa.asks[p.id];
          } else if (r.kind === "ASKING_MORE") {
            s.fa.asks[p.id] = { ask: r.ask, rival: r.rival };
            delete s.fa.offers[p.id];
            if (r.rival) resolutions.push({ kind: "ENTERED_BIDDING", playerId: p.id, teamId: r.rival });
          }
        }
        // 3. Market movement for everyone else.
        for (const p of freeAgents(s)) {
          if (s.fa.offers[p.id] || s.fa.asks[p.id]) continue;
          if (!signsElsewhereToday(p, rng, s.fa.day)) continue;
          const offer = generateFreeAgentOffer(p, profiles, rosters, capSpace, rng, s.fa.day);
          if (!offer) continue;
          sign(s, offer.teamId, p.id, offer);
          capSpace[offer.teamId] -= offer.aav;
          (rosters[offer.teamId] ??= []).push(p);
        }
        s.fa.lastResolutions = resolutions;
        s.fa.day++;
        if (s.fa.day > s.fa.maxDay) s.phase = "TRADE_WINDOW";
        return done();
      }

      case "FA_FINISH": {
        if (s.phase !== "FREE_AGENCY") return prev;
        s.fa.offers = {};
        s.phase = "TRADE_WINDOW";
        return done();
      }

      case "TRADE_EXECUTE": {
        if (!["TRADE_WINDOW", "DRAFT", "DEADLINE", "ROSTER"].includes(s.phase)) return prev;
        const ctx = tradeContext(s, snapshot);
        const evaluation = evaluateTrade(ctx, s.teamId, action.partner, action.give, action.get);
        const accepted = decideTrade(evaluation, rng);
        s.lastTrade = { accepted, evaluation, partner: action.partner };
        if (!accepted) return done();
        for (const a of action.give) moveAsset(s, a, s.teamId, action.partner);
        for (const a of action.get) moveAsset(s, a, action.partner, s.teamId);
        s.transactions.push({ kind: "TRADE", teams: [s.teamId, action.partner], sent: action.give, received: action.get, week: whenLabel(s) });
        feed(s, s.teamId, `Trade with ${teamName(action.partner)}`, `Get ${action.get.map((a) => assetLabel(s, a)).join(", ")} · Send ${action.give.map((a) => assetLabel(s, a)).join(", ")}`, "TRADE", whenLabel(s));
        s.audit.shopping = s.audit.shopping.filter((id) => s.players[id]?.teamId === s.teamId);
        return done();
      }

      case "TRADE_CLEAR": {
        s.lastTrade = null;
        return done();
      }

      case "TRADE_DONE": {
        if (s.phase !== "TRADE_WINDOW") return prev;
        startDraft(s);
        return done();
      }

      case "RELEASE": {
        if (!["TRADE_WINDOW", "ROSTER", "AUDIT"].includes(s.phase)) return prev;
        release(s, s.teamId, action.playerId);
        return done();
      }

      case "DRAFT_ADVANCE": {
        if (s.phase !== "DRAFT") return prev;
        advanceDraft(s, rng, true);
        return done();
      }

      case "DRAFT_SELECT": {
        if (s.phase !== "DRAFT" || !userOnClock(s)) return prev;
        const prospect = s.prospects[action.prospectId];
        if (!prospect || s.drafted.includes(prospect.id)) return prev;
        makePick(s, rng, currentPick(s)!, prospect);
        s.draft.index++;
        advanceDraft(s, rng, true);
        return done();
      }

      case "DRAFT_AUTO_REMAINING": {
        if (s.phase !== "DRAFT") return prev;
        s.draft.userAuto = true;
        advanceDraft(s, rng, false);
        return done();
      }

      case "SET_STARTER": {
        const p = s.players[action.playerId];
        if (!p || p.teamId !== s.teamId) return prev;
        // Swap if the player already occupies another slot.
        for (const [slot, id] of Object.entries(s.depthOverrides)) if (id === action.playerId) delete s.depthOverrides[slot];
        const chart = buildDepthChart(userRoster(s), s.depthOverrides);
        const displaced = chart.starters[action.slot];
        s.depthOverrides[action.slot] = action.playerId;
        if (displaced && displaced !== action.playerId) {
          const vacated = Object.entries(chart.starters).find(([, id]) => id === action.playerId)?.[0];
          if (vacated) s.depthOverrides[vacated] = displaced;
        }
        return done();
      }

      case "SET_SCHEME": {
        if (s.scheme.locked) return prev;
        if (action.offense) s.scheme.offense = action.offense;
        if (action.defense) s.scheme.defense = action.defense;
        return done();
      }

      case "START_SEASON": {
        if (s.phase !== "ROSTER") return prev;
        if (userRoster(s).length < scenario.minRosterForSeason) return prev;
        s.schedule = generateSchedule(snapshot.teams, rng.int(1, 1_000_000));
        s.scheme.locked = true;
        s.strengthEnd = userTeamStrength(userRoster(s), s.depthOverrides, s.scheme);
        s.phase = "SEASON";
        s.week = 1;
        return done();
      }

      case "SIM_WEEK": {
        if (s.phase !== "SEASON") return prev;
        simWeek(s, rng);
        if (!s.deadline.done && s.week > scenario.deadlineWeek) {
          s.phase = "DEADLINE";
          s.deadline.note = deadlineNote(s);
          const st = computeStandings(snapshot.teams, s.results);
          for (const id of Object.keys(s.profiles)) if (id !== s.teamId) s.profiles[id].status = deadlineStatus(s.profiles[id], st[id].w, st[id].l);
        } else if (s.week > 18) {
          finishSeasonToPlayoffs(s, rng);
        }
        return done();
      }

      case "DEADLINE_DONE": {
        if (s.phase !== "DEADLINE") return prev;
        s.deadline.done = true;
        s.phase = "SEASON";
        return done();
      }

      case "SIM_PLAYOFF_ROUND": {
        if (s.phase !== "PLAYOFFS" || !s.seedings) return prev;
        const next = nextPlayoffRound(s.seedings, s.playoffs);
        if (!next.length) {
          s.phase = "REPORT";
          return reduce(done(), { type: "FINISH" });
        }
        const strengths = allStrengths(s);
        for (const g of next) {
          g.result = simulateGame(19 + s.playoffs.length, g.homeId, g.awayId, strengths[g.homeId], strengths[g.awayId], rng, g.stage);
          s.playoffs.push(g);
        }
        return done();
      }

      case "FINISH": {
        if (s.phase !== "PLAYOFFS" && s.phase !== "REPORT") return prev;
        const st = computeStandings(snapshot.teams, s.results)[s.teamId];
        const po = playoffOutcome(s);
        const cap = capSummary(s, snapshot);
        s.report = calculateGMScore({
          scenario,
          players: s.players,
          transactions: s.transactions,
          userTeam: s.teamId,
          strengthStart: s.strengthStart,
          strengthEnd: userTeamStrength(userRoster(s).map((p) => ({ ...p, injuredWeeks: 0 })), s.depthOverrides, s.scheme),
          record: { w: st.w, l: st.l, t: st.t },
          madePlayoffs: po.madePlayoffs,
          playoffWins: po.wins,
          wonSuperBowl: po.wonSB,
          divisionChamp: po.divisionChamp,
          nextYearSpace: cap.nextYearSpace,
          real: scenario.realResult,
          deadMoney: s.deadMoney[s.teamId] ?? 0,
          year: s.year,
        });
        s.phase = "REPORT";
        return done();
      }
    }
    return prev;
  };
}

/** Quick unit view for the UI. */
export function userUnits(state: RunState) {
  const roster = userRoster(state);
  return unitRatings(roster, buildDepthChart(roster, state.depthOverrides));
}
