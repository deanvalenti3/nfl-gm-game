import type { GameResult, StandingRow, Team } from "@/domain/types";
import type { Rng } from "./rng";

/**
 * SeasonSimulator: games, standings, seeding, playoffs. Strength is supplied per team
 * by the caller (it depends on rosters and injuries, which live in the run state).
 */

export function simulateGame(week: number, homeId: string, awayId: string, homeStrength: number, awayStrength: number, rng: Rng, stage: GameResult["stage"] = "REG"): GameResult {
  const edge = (homeStrength - awayStrength) * 0.72 + 1.8; // home field
  const diff = Math.round(rng.gauss(edge, 10));
  const total = Math.max(13, Math.round(rng.gauss(45, 9)));
  let home = Math.round((total + diff) / 2);
  let away = total - home;
  home = Math.max(0, home);
  away = Math.max(0, away);
  if (home === away) {
    // Playoffs can't tie; regular season ties are rare, so break with the favourite.
    if (stage !== "REG" || rng.chance(0.97)) edge >= 0 ? home++ : away++;
  }
  return { week, homeId, awayId, homeScore: home, awayScore: away, stage };
}

export function computeStandings(teams: Team[], results: GameResult[]): Record<string, StandingRow> {
  const rows: Record<string, StandingRow> = Object.fromEntries(teams.map((t) => [t.id, { teamId: t.id, w: 0, l: 0, t: 0, pf: 0, pa: 0 }]));
  for (const g of results) {
    if (g.stage !== "REG") continue;
    const h = rows[g.homeId];
    const a = rows[g.awayId];
    h.pf += g.homeScore; h.pa += g.awayScore;
    a.pf += g.awayScore; a.pa += g.homeScore;
    if (g.homeScore > g.awayScore) { h.w++; a.l++; }
    else if (g.homeScore < g.awayScore) { a.w++; h.l++; }
    else { h.t++; a.t++; }
  }
  return rows;
}

export function winPct(r: StandingRow): number {
  const g = r.w + r.l + r.t;
  return g ? (r.w + r.t * 0.5) / g : 0;
}

function headToHead(a: string, b: string, results: GameResult[]): number {
  let diff = 0;
  for (const g of results) {
    if (g.stage !== "REG") continue;
    const ab = g.homeId === a && g.awayId === b;
    const ba = g.homeId === b && g.awayId === a;
    if (!ab && !ba) continue;
    const aScore = ab ? g.homeScore : g.awayScore;
    const bScore = ab ? g.awayScore : g.homeScore;
    diff += aScore > bScore ? 1 : aScore < bScore ? -1 : 0;
  }
  return diff;
}

export function rankTeams(ids: string[], standings: Record<string, StandingRow>, results: GameResult[], tieSeed: number): string[] {
  return [...ids].sort((a, b) => {
    const pa = winPct(standings[a]);
    const pb = winPct(standings[b]);
    if (pa !== pb) return pb - pa;
    const h2h = headToHead(a, b, results);
    if (h2h !== 0) return -h2h;
    const da = standings[a].pf - standings[a].pa;
    const db = standings[b].pf - standings[b].pa;
    if (da !== db) return db - da;
    return ((tieSeed + a.charCodeAt(0)) % 7) - ((tieSeed + b.charCodeAt(0)) % 7);
  });
}

export interface Seeding {
  conference: "AFC" | "NFC";
  seeds: string[]; // 7 team ids, seed 1 first
  divisionWinners: string[];
}

export function computeSeeding(teams: Team[], standings: Record<string, StandingRow>, results: GameResult[], tieSeed: number): Seeding[] {
  return (["AFC", "NFC"] as const).map((conference) => {
    const divs = ["East", "North", "South", "West"];
    const winners = divs.map((d) => rankTeams(teams.filter((t) => t.conference === conference && t.division === d).map((t) => t.id), standings, results, tieSeed)[0]);
    const rankedWinners = rankTeams(winners, standings, results, tieSeed);
    const rest = teams.filter((t) => t.conference === conference && !winners.includes(t.id)).map((t) => t.id);
    const wildcards = rankTeams(rest, standings, results, tieSeed).slice(0, 3);
    return { conference, seeds: [...rankedWinners, ...wildcards], divisionWinners: winners };
  });
}

export interface PlayoffGame {
  id: string;
  stage: "WC" | "DIV" | "CONF" | "SB";
  conference: "AFC" | "NFC" | "SB";
  homeId: string;
  awayId: string;
  result?: GameResult;
}

/** Build the next round's games given the previous round's winners. */
export function nextPlayoffRound(seedings: Seeding[], played: PlayoffGame[]): PlayoffGame[] {
  const wc = played.filter((g) => g.stage === "WC");
  const div = played.filter((g) => g.stage === "DIV");
  const conf = played.filter((g) => g.stage === "CONF");
  const sb = played.filter((g) => g.stage === "SB");
  if (sb.length) return [];
  const seedOf = (conference: "AFC" | "NFC", id: string) => seedings.find((s) => s.conference === conference)!.seeds.indexOf(id) + 1;
  const winner = (g: PlayoffGame) => (g.result!.homeScore > g.result!.awayScore ? g.homeId : g.awayId);

  if (!wc.length) {
    return seedings.flatMap((s) => [
      [2, 7], [3, 6], [4, 5],
    ].map(([h, a]) => ({ id: `WC-${s.conference}-${h}`, stage: "WC" as const, conference: s.conference, homeId: s.seeds[h - 1], awayId: s.seeds[a - 1] })));
  }
  if (wc.every((g) => g.result) && !div.length) {
    return seedings.flatMap((s) => {
      const winners = wc.filter((g) => g.conference === s.conference).map(winner).sort((a, b) => seedOf(s.conference, a) - seedOf(s.conference, b));
      const one = s.seeds[0];
      const low = winners[winners.length - 1];
      const mid = winners[0];
      const hi = winners[1];
      return [
        { id: `DIV-${s.conference}-1`, stage: "DIV" as const, conference: s.conference, homeId: one, awayId: low },
        { id: `DIV-${s.conference}-2`, stage: "DIV" as const, conference: s.conference, homeId: mid, awayId: hi },
      ];
    });
  }
  if (div.length && div.every((g) => g.result) && !conf.length) {
    return seedings.map((s) => {
      const winners = div.filter((g) => g.conference === s.conference).map(winner).sort((a, b) => seedOf(s.conference, a) - seedOf(s.conference, b));
      return { id: `CONF-${s.conference}`, stage: "CONF" as const, conference: s.conference, homeId: winners[0], awayId: winners[1] };
    });
  }
  if (conf.length && conf.every((g) => g.result)) {
    const afc = winner(conf.find((g) => g.conference === "AFC")!);
    const nfc = winner(conf.find((g) => g.conference === "NFC")!);
    return [{ id: "SB", stage: "SB", conference: "SB", homeId: afc, awayId: nfc }];
  }
  return [];
}

/** Rough playoff probability from record and games left. */
export function playoffProbability(w: number, gamesLeft: number, strengthRank: number): number {
  const pace = (w + gamesLeft * (0.5 + (16 - strengthRank) / 64)) / 17;
  const x = (pace - 0.53) * 18;
  return Math.round((1 / (1 + Math.exp(-x))) * 100);
}
