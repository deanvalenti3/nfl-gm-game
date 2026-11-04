import type { Player, Position, Tier, UnitRatings } from "@/domain/types";

/**
 * RosterEngine: depth charts, unit ratings and team strength from a set of players.
 */

export const STARTER_SLOTS: { pos: Position; count: number }[] = [
  { pos: "QB", count: 1 },
  { pos: "RB", count: 1 },
  { pos: "WR", count: 3 },
  { pos: "TE", count: 1 },
  { pos: "OT", count: 2 },
  { pos: "G", count: 2 },
  { pos: "C", count: 1 },
  { pos: "EDGE", count: 2 },
  { pos: "DT", count: 2 },
  { pos: "LB", count: 2 },
  { pos: "CB", count: 3 },
  { pos: "S", count: 2 },
  { pos: "K", count: 1 },
  { pos: "P", count: 1 },
];

export const OFFENSE: Position[] = ["QB", "RB", "WR", "TE", "OT", "G", "C"];
export const DEFENSE: Position[] = ["EDGE", "DT", "LB", "CB", "S"];
export const SPECIAL: Position[] = ["K", "P", "LS"];

/** Positional value: how much one roster spot at this position moves games. */
export const POSITION_VALUE: Record<Position, number> = {
  QB: 2.6, OT: 1.25, EDGE: 1.3, WR: 1.15, CB: 1.1, DT: 1.0, S: 0.85, G: 0.85, C: 0.8, TE: 0.85, LB: 0.8, RB: 0.7, K: 0.35, P: 0.25, LS: 0.1,
};

export function tierFor(ovr: number): Tier {
  if (ovr >= 88) return "ELITE";
  if (ovr >= 80) return "HIGH-END STARTER";
  if (ovr >= 72) return "STARTER";
  if (ovr >= 65) return "ROTATIONAL";
  if (ovr >= 58) return "DEPTH";
  return "REPLACEMENT";
}

export function effectiveOvr(p: Player): number {
  return (p.injuredWeeks ?? 0) > 0 ? 0 : p.ability.ovr;
}

export function byPosition(players: Player[], pos: Position): Player[] {
  return players.filter((p) => p.pos === pos).sort((a, b) => b.ability.ovr - a.ability.ovr);
}

export interface DepthChart {
  /** slot key like "WR1" → player id */
  starters: Record<string, string>;
  backups: Record<Position, string[]>;
}

/** Auto depth chart: best available by ovr, honouring overrides where the player exists at that position. */
export function buildDepthChart(players: Player[], overrides: Record<string, string> = {}): DepthChart {
  const starters: Record<string, string> = {};
  const used = new Set<string>();
  const byId = new Map(players.map((p) => [p.id, p]));
  for (const slot of STARTER_SLOTS) {
    for (let i = 1; i <= slot.count; i++) {
      const key = `${slot.pos}${i}`;
      const o = overrides[key];
      if (o && byId.get(o)?.pos === slot.pos && !used.has(o) && byId.get(o)!.teamId) {
        starters[key] = o;
        used.add(o);
      }
    }
  }
  for (const slot of STARTER_SLOTS) {
    const pool = byPosition(players, slot.pos).filter((p) => !used.has(p.id) && (p.injuredWeeks ?? 0) === 0);
    for (let i = 1; i <= slot.count; i++) {
      const key = `${slot.pos}${i}`;
      if (starters[key]) continue;
      const next = pool.shift();
      if (next) {
        starters[key] = next.id;
        used.add(next.id);
      }
    }
  }
  const backups = Object.fromEntries(
    STARTER_SLOTS.map((s) => [s.pos, byPosition(players, s.pos).filter((p) => !used.has(p.id)).map((p) => p.id)]),
  ) as Record<Position, string[]>;
  return { starters, backups };
}

function starterOvrs(players: Player[], chart: DepthChart, pos: Position): number[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const out: number[] = [];
  const count = STARTER_SLOTS.find((s) => s.pos === pos)?.count ?? 0;
  for (let i = 1; i <= count; i++) {
    const p = byId.get(chart.starters[`${pos}${i}`] ?? "");
    out.push(p ? effectiveOvr(p) || 45 : 45);
  }
  return out;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 45);

/** Unit ratings from a full roster. */
export function unitRatings(players: Player[], chart = buildDepthChart(players)): UnitRatings {
  const qb = starterOvrs(players, chart, "QB")[0];
  const wr = starterOvrs(players, chart, "WR");
  const te = starterOvrs(players, chart, "TE")[0];
  const rb = starterOvrs(players, chart, "RB")[0];
  const ol = [...starterOvrs(players, chart, "OT"), ...starterOvrs(players, chart, "G"), ...starterOvrs(players, chart, "C")];
  const edge = starterOvrs(players, chart, "EDGE");
  const dt = starterOvrs(players, chart, "DT");
  const lb = starterOvrs(players, chart, "LB");
  const cb = starterOvrs(players, chart, "CB");
  const s = starterOvrs(players, chart, "S");
  const k = starterOvrs(players, chart, "K")[0];
  const p = starterOvrs(players, chart, "P")[0];
  const byId = new Map(players.map((x) => [x.id, x]));
  const backupOvrs = (["QB", "WR", "OT", "EDGE", "CB", "DT", "LB", "S", "RB", "G"] as Position[]).map((pos) => {
    const b = chart.backups[pos]?.[0];
    return b ? byId.get(b)!.ability.ovr : 45;
  });
  return {
    qb,
    offSkill: wr[0] * 0.3 + wr[1] * 0.2 + wr[2] * 0.1 + te * 0.2 + rb * 0.2,
    oLine: avg(ol),
    passRush: avg(edge) * 0.65 + avg(dt) * 0.35,
    runDefense: avg(dt) * 0.5 + avg(lb) * 0.5,
    coverage: avg(cb) * 0.6 + avg(s) * 0.4,
    specialTeams: k * 0.55 + p * 0.45,
    depth: avg(backupOvrs),
  };
}

/** Single power rating (roughly 40-95) from unit ratings. */
export function calculateTeamStrength(u: UnitRatings): number {
  return u.qb * 0.28 + u.offSkill * 0.14 + u.oLine * 0.14 + u.passRush * 0.12 + u.runDefense * 0.08 + u.coverage * 0.14 + u.specialTeams * 0.04 + u.depth * 0.06;
}

export interface PositionGrade {
  pos: Position;
  starters: number;
  tier: Tier;
  /** Normalised 0-100 after positional expectations. */
  score: number;
}

/** Strengths/weaknesses view used by the briefing and roster screens. */
export function gradePositions(players: Player[], chart = buildDepthChart(players)): PositionGrade[] {
  return STARTER_SLOTS.filter((s) => !["K", "P"].includes(s.pos)).map((slot) => {
    const ovrs = starterOvrs(players, chart, slot.pos);
    const score = avg(ovrs);
    return { pos: slot.pos, starters: ovrs.length, tier: tierFor(score), score };
  });
}

export function rosterAge(players: Player[]): number {
  const chart = buildDepthChart(players);
  const byId = new Map(players.map((p) => [p.id, p]));
  const ages = Object.values(chart.starters).map((id) => byId.get(id)!.age);
  return avg(ages);
}
