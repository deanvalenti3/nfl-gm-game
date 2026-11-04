import type { Player, Position } from "@/domain/types";
import { buildDepthChart, gradePositions } from "./roster";

/**
 * Scheme: a light identity on each side of the ball. Each scheme leans on a few positions.
 * Talent at those positions is worth a little more; holes there cost a little more.
 * The player picks one per side and it locks when the season starts.
 */

export type OffenseScheme = "WIDE_ZONE" | "SPREAD" | "POWER";
export type DefenseScheme = "FOUR_THREE" | "THREE_FOUR" | "COVERAGE";

export interface SchemeDef<T extends string> {
  id: T;
  name: string;
  blurb: string;
  /** Positions the scheme leans on, most important first. */
  emphasis: Position[];
}

export const OFFENSE_SCHEMES: SchemeDef<OffenseScheme>[] = [
  { id: "WIDE_ZONE", name: "Wide zone", blurb: "Outside zone runs, play-action off it. Needs athletic tackles, a decisive back and a tight end who can block.", emphasis: ["OT", "RB", "TE"] },
  { id: "SPREAD", name: "Spread", blurb: "Three receivers, quick game, tempo. Lives on the quarterback's accuracy and receiver depth.", emphasis: ["QB", "WR", "WR"] },
  { id: "POWER", name: "Power run", blurb: "Gap scheme, pulling guards, heavy sets. Interior line and the back carry it; the passing game is play-action.", emphasis: ["G", "C", "RB"] },
];

export const DEFENSE_SCHEMES: SchemeDef<DefenseScheme>[] = [
  { id: "FOUR_THREE", name: "4-3 attack", blurb: "Four down linemen who get upfield. Edge rushers and an interior penetrator win it.", emphasis: ["EDGE", "DT", "EDGE"] },
  { id: "THREE_FOUR", name: "3-4 hybrid", blurb: "Two-gapping linemen, rangy linebackers, pressure from anywhere. Needs stout tackles and linebackers who can run.", emphasis: ["LB", "DT", "LB"] },
  { id: "COVERAGE", name: "Coverage first", blurb: "Rush four, drop seven, make the quarterback hold it. Corners and safeties are the stars.", emphasis: ["CB", "S", "CB"] },
];

export interface Scheme {
  offense: OffenseScheme;
  defense: DefenseScheme;
  locked: boolean;
}

export function schemeDef(side: "offense", id: OffenseScheme): SchemeDef<OffenseScheme>;
export function schemeDef(side: "defense", id: DefenseScheme): SchemeDef<DefenseScheme>;
export function schemeDef(side: "offense" | "defense", id: string) {
  return (side === "offense" ? OFFENSE_SCHEMES : DEFENSE_SCHEMES).find((s) => s.id === id)!;
}

/** Strength adjustment (roughly -3..+3) from how well the roster fits the chosen schemes. */
export function schemeBonus(roster: Player[], scheme: Scheme, overrides: Record<string, string> = {}): number {
  const grades = gradePositions(roster, buildDepthChart(roster, overrides));
  const score = (pos: Position) => grades.find((g) => g.pos === pos)?.score ?? 50;
  let bonus = 0;
  for (const pos of [...schemeDef("offense", scheme.offense).emphasis, ...schemeDef("defense", scheme.defense).emphasis]) {
    bonus += (score(pos) - 72) * 0.07;
  }
  return Math.max(-3.5, Math.min(3.5, bonus));
}

/** Per-side fit grade shown in the rail. */
export function schemeFit(roster: Player[], side: "offense" | "defense", id: OffenseScheme | DefenseScheme, overrides: Record<string, string> = {}): number {
  const grades = gradePositions(roster, buildDepthChart(roster, overrides));
  const def = side === "offense" ? OFFENSE_SCHEMES.find((s) => s.id === id)! : DEFENSE_SCHEMES.find((s) => s.id === id)!;
  const scores = def.emphasis.map((pos) => grades.find((g) => g.pos === pos)?.score ?? 50);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Does this position matter to the current scheme? Used for the "scheme fit" tag. */
export function isEmphasized(pos: Position, scheme: Scheme): boolean {
  return schemeDef("offense", scheme.offense).emphasis.includes(pos) || schemeDef("defense", scheme.defense).emphasis.includes(pos);
}
