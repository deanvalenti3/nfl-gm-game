import type { Player, RealResult, Scenario, Transaction } from "@/domain/types";
import { capHit, fmtMoney } from "./cap";
import { marketAav, pickValueByOverall, playerValue, talentValue } from "./value";

/**
 * ScoringEngine: the GM report. Uses outcomes (it runs after the season), so it is the one
 * place hindsight is allowed.
 */

export interface MoveGrade {
  label: string;
  detail: string;
  delta: number;
}

export interface GMReport {
  score: number;
  letter: string;
  dimensions: { key: string; label: string; score: number }[];
  bestMove: MoveGrade | null;
  worstMove: MoveGrade | null;
  draftSteal: MoveGrade | null;
  capHealth: "STRONG" | "HEALTHY" | "TIGHT" | "UNDERWATER";
  seasonLine: string;
  /** How the run compares with what really happened. */
  benchmark: { real: RealResult; verdict: "BEAT" | "MATCHED" | "SHORT"; winDiff: number; depthDiff: number; barWins: number };
}

export interface ScoringInput {
  scenario: Scenario;
  players: Record<string, Player>;
  transactions: Transaction[];
  userTeam: string;
  strengthStart: number;
  strengthEnd: number;
  record: { w: number; l: number; t: number };
  madePlayoffs: boolean;
  playoffWins: number;
  wonSuperBowl: boolean;
  divisionChamp: boolean;
  nextYearSpace: number;
  deadMoney: number;
  real: RealResult;
  /** Last season's wins for the user's team. */
  prevWins: number;
  year: number;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, n));
}

export function calculateGMScore(input: ScoringInput): GMReport {
  const { players, transactions, userTeam, year } = input;

  // Roster improvement: +8 strength points = 100.
  const rosterDelta = input.strengthEnd - input.strengthStart;
  const roster = clamp(50 + rosterDelta * 6);

  // Cap management.
  const capScore = clamp(55 + input.nextYearSpace / 4_000_000 - input.deadMoney / 2_000_000);
  const capHealth: GMReport["capHealth"] = input.nextYearSpace > 40_000_000 ? "STRONG" : input.nextYearSpace > 10_000_000 ? "HEALTHY" : input.nextYearSpace > 0 ? "TIGHT" : "UNDERWATER";

  // Free-agent value: paid vs market for each signing.
  const signings = transactions.filter((t): t is Extract<Transaction, { kind: "SIGN" }> => t.kind === "SIGN" && t.teamId === userTeam);
  const moves: MoveGrade[] = [];
  let faTotal = 0;
  for (const s of signings) {
    const p = players[s.playerId];
    if (!p) continue;
    const fair = marketAav(p.ability.ovr, p.pos, p.age);
    const delta = (fair - s.aav) / Math.max(fair, 2_000_000);
    faTotal += delta;
    moves.push({ label: `Signed ${p.pos} ${p.name}`, detail: `${s.years} yrs / ${fmtMoney(s.total)}`, delta: delta * 40 });
  }
  const fa = signings.length ? clamp(62 + (faTotal / signings.length) * 60) : 60;

  // Draft value: what the pick turned into vs what the slot usually yields.
  const drafts = transactions.filter((t): t is Extract<Transaction, { kind: "DRAFT" }> => t.kind === "DRAFT" && t.teamId === userTeam);
  let draftTotal = 0;
  let steal: MoveGrade | null = null;
  for (const d of drafts) {
    const p = players[d.playerId];
    if (!p) continue;
    // What a slot usually yields on arrival: ~74 at the top, mid-60s late first, high 50s on day three.
    const expectedOvr = 76 - 2.9 * Math.log(d.overall + 1) - d.overall * 0.02;
    const delta = p.ability.ovr - expectedOvr;
    draftTotal += delta;
    const grade: MoveGrade = { label: `${p.name} · Round ${d.round}`, detail: `Pick ${d.overall}, ${p.pos} from ${p.college ?? "college"}`, delta };
    if (d.round >= 2 && (!steal || delta > steal.delta)) steal = grade;
    if (d.round <= 2) moves.push({ label: `Drafted ${p.pos} ${p.name}`, detail: `Pick ${d.overall}`, delta: delta * 3 });
  }
  const draft = drafts.length ? clamp(60 + (draftTotal / drafts.length) * 5) : 50;

  // Trade value: value received minus value sent, with picks at chart value.
  const trades = transactions.filter((t): t is Extract<Transaction, { kind: "TRADE" }> => t.kind === "TRADE" && t.teams[0] === userTeam);
  let tradeTotal = 0;
  for (const t of trades) {
    const val = (assets: typeof t.sent) =>
      assets.reduce((s, a) => {
        if (a.type === "PLAYER") return s + (players[a.id] ? playerValue(players[a.id], year) : 0);
        const m = a.id.match(/^(\d+)-(\d+)-(\d+)$/);
        if (m) return s + pickValueByOverall(Number(m[3]));
        return s + pickValueByOverall(16 + (Number(a.id.split("-")[1]) - 1) * 32) * 0.82;
      }, 0);
    // Shedding salary is worth something too: credit net cap relief this year.
    const hits = (assets: typeof t.sent) => assets.reduce((s, a) => s + (a.type === "PLAYER" ? capHit(players[a.id]?.contract ?? null, year) : 0), 0);
    const relief = Math.max(0, hits(t.sent) - hits(t.received));
    const delta = (val(t.received) + (relief / 1_000_000) * 18 - val(t.sent)) / Math.max(400, val(t.sent));
    tradeTotal += delta;
    const label = `Traded for ${t.received.map((a) => (a.type === "PLAYER" ? players[a.id]?.name ?? a.id : `pick ${a.id.split("-").slice(1).join(".")}`)).join(", ")}`;
    moves.push({ label, detail: `Sent ${t.sent.map((a) => (a.type === "PLAYER" ? players[a.id]?.name ?? a.id : `pick ${a.id.split("-").slice(1).join(".")}`)).join(", ")}`, delta: delta * 40 });
  }
  const trade = trades.length ? clamp(60 + (tradeTotal / trades.length) * 50) : 60;

  // Cuts: did we free money without losing talent?
  const cuts = transactions.filter((t): t is Extract<Transaction, { kind: "RELEASE" }> => t.kind === "RELEASE" && t.teamId === userTeam);
  for (const c of cuts) {
    const p = players[c.playerId];
    if (!p) continue;
    const delta = c.savings / 4_000_000 - talentValue(p.ability.ovr, p.pos) / 300;
    moves.push({ label: `Released ${p.pos} ${p.name}`, detail: `Saved ${fmtMoney(c.savings)}, ${fmtMoney(c.deadMoney)} dead`, delta: delta * 8 });
  }

  // Season: judged against what really happened. Matching real life is a 70; every win and every
  // playoff round above or below it moves the needle.
  const wins = input.record.w + input.record.t * 0.5;
  const depth = input.wonSuperBowl ? 5 : input.madePlayoffs ? 1 + input.playoffWins : 0;
  const realWins = input.real.w + input.real.t * 0.5;
  const winDiff = wins - realWins;
  const depthDiff = depth - input.real.playoffDepth;
  // The score's bar is the tougher of real life and last year's record, so a real season wrecked
  // by injury doesn't make the leaderboard trivial. Matching the bar is a 60; the verdict is still
  // against real life.
  const barWins = Math.max(realWins, input.prevWins);
  const season = clamp(60 + (wins - barWins) * 6 + depthDiff * 7);
  const verdict: "BEAT" | "MATCHED" | "SHORT" = winDiff + depthDiff * 1.5 > 0.5 ? "BEAT" : winDiff + depthDiff * 1.5 >= -0.5 ? "MATCHED" : "SHORT";

  const dimensions = [
    { key: "season", label: "Season result", score: Math.round(season), weight: 0.33 },
    { key: "roster", label: "Roster improvement", score: Math.round(roster), weight: 0.2 },
    { key: "draft", label: "Draft value", score: Math.round(draft), weight: 0.14 },
    { key: "fa", label: "Free-agent value", score: Math.round(fa), weight: 0.11 },
    { key: "trade", label: "Trade value", score: Math.round(trade), weight: 0.1 },
    { key: "cap", label: "Cap management", score: Math.round(capScore), weight: 0.12 },
  ];
  const score = Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0));
  const letter = score >= 93 ? "A+" : score >= 86 ? "A" : score >= 80 ? "A-" : score >= 74 ? "B+" : score >= 68 ? "B" : score >= 62 ? "B-" : score >= 55 ? "C+" : score >= 48 ? "C" : score >= 40 ? "D" : "F";

  const sorted = [...moves].sort((a, b) => b.delta - a.delta);
  const bestMove = sorted[0] && sorted[0].delta > 0 ? sorted[0] : null;
  const worstMove = sorted.length > 1 && sorted[sorted.length - 1].delta < 0 ? sorted[sorted.length - 1] : null;

  const rec = `${input.record.w}–${input.record.l}${input.record.t ? `–${input.record.t}` : ""}`;
  const seasonLine = input.wonSuperBowl ? `${rec} · Super Bowl Champions` : input.madePlayoffs ? `${rec} · ${input.divisionChamp ? "Division Champions" : "Wild Card"} · ${playoffExit(input.playoffWins)}` : `${rec} · Missed playoffs`;

  return {
    score, letter, dimensions: dimensions.map(({ key, label, score }) => ({ key, label, score })), bestMove, worstMove,
    draftSteal: steal && steal.delta > 2 ? steal : null, capHealth, seasonLine,
    benchmark: { real: input.real, verdict, winDiff, depthDiff, barWins },
  };
}

function playoffExit(wins: number) {
  return wins === 0 ? "Lost Wild Card" : wins === 1 ? "Lost Divisional" : wins === 2 ? "Lost Conference Championship" : "Lost Super Bowl";
}
