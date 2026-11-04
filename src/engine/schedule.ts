import type { Team } from "@/domain/types";

/**
 * 17-game schedule using the real NFL rotation formula for 2025:
 *  - 6 division games (home and away)
 *  - 4 vs one same-conference division (2025: East–North, South–West)
 *  - 4 vs one other-conference division (2025: AFC East–NFC South, AFC North–NFC North, AFC South–NFC West, AFC West–NFC East)
 *  - 2 same-conference, same-place finishers from the two remaining divisions
 *  - 1 other-conference same-place finisher (17th game)
 */

export interface Fixture {
  week: number;
  homeId: string;
  awayId: string;
}

const SAME_CONF_PAIR: Record<string, string> = { East: "North", North: "East", South: "West", West: "South" };
/** 17th game: AFC division vs NFC division, same-place finishers, distinct from the 4-game cross pairing. */
const GAME17: Record<string, string> = { East: "West", North: "South", South: "East", West: "North" };
const CROSS_PAIR: Record<string, Record<string, string>> = {
  AFC: { East: "South", North: "North", South: "West", West: "East" },
  NFC: { South: "East", North: "North", West: "South", East: "West" },
};

export function generateSchedule(teams: Team[], seed: number): Fixture[] {
  const games: [string, string][] = []; // [home, away]
  const byDiv = (conf: string, div: string) => teams.filter((t) => t.conference === conf && t.division === div);
  const seen = new Set<string>();
  const add = (a: Team, b: Team, homeFirst: boolean) => {
    const key = [a.id, b.id].sort().join("-");
    if (seen.has(key)) return;
    seen.add(key);
    games.push(homeFirst ? [a.id, b.id] : [b.id, a.id]);
  };

  for (const t of teams) {
    const divMates = byDiv(t.conference, t.division).filter((x) => x.id !== t.id);
    for (const m of divMates) {
      // Two games: register both orientations as distinct keys.
      const k1 = `${t.id}>${m.id}`;
      if (!seen.has(k1)) {
        seen.add(k1);
        seen.add(`${m.id}>${t.id}`);
        games.push([t.id, m.id], [m.id, t.id]);
      }
    }
    const sc = byDiv(t.conference, SAME_CONF_PAIR[t.division]);
    sc.forEach((o, i) => add(t, o, (i + t.prevDivisionRank) % 2 === 0));
    const otherConf = t.conference === "AFC" ? "NFC" : "AFC";
    const cc = byDiv(otherConf, CROSS_PAIR[t.conference][t.division]);
    cc.forEach((o, i) => add(t, o, (i + t.prevDivisionRank + 1) % 2 === 0));
  }
  // Place-based same-conference games (2) and cross-conference 17th game (1).
  for (const t of teams) {
    const remainingDivs = ["East", "North", "South", "West"].filter((d) => d !== t.division && d !== SAME_CONF_PAIR[t.division]);
    remainingDivs.forEach((d, i) => {
      const o = byDiv(t.conference, d).find((x) => x.prevDivisionRank === t.prevDivisionRank)!;
      add(t, o, (i + t.prevDivisionRank) % 2 === 0);
    });
    if (t.conference === "AFC") {
      const o = byDiv("NFC", GAME17[t.division]).find((x) => x.prevDivisionRank === t.prevDivisionRank)!;
      add(t, o, t.prevDivisionRank % 2 === 0);
    }
  }

  // Assign weeks: greedy, deterministic by seed, each team at most one game a week, 18 weeks with a bye.
  const fixtures: Fixture[] = [];
  const weekUse: Set<string>[] = Array.from({ length: 18 }, () => new Set());
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 0x100000000;
  };
  const order = [...games].sort(() => rnd() - 0.5);
  for (const [h, a] of order) {
    const start = Math.floor(rnd() * 18);
    let placed = false;
    for (let i = 0; i < 18 && !placed; i++) {
      const w = (start + i) % 18;
      if (!weekUse[w].has(h) && !weekUse[w].has(a)) {
        weekUse[w].add(h);
        weekUse[w].add(a);
        fixtures.push({ week: w + 1, homeId: h, awayId: a });
        placed = true;
      }
    }
    if (!placed) {
      // Should not happen with 17 games per team over 18 weeks; fall back to the least-loaded week.
      const w = weekUse.map((u, i) => [u.size, i]).sort((x, y) => x[0] - y[0])[0][1];
      weekUse[w].add(h);
      weekUse[w].add(a);
      fixtures.push({ week: w + 1, homeId: h, awayId: a });
    }
  }
  return fixtures.sort((a, b) => a.week - b.week);
}
