import type { Player, Position, TeamProfile, UnitRatings } from "@/domain/types";
import { unitRatings, calculateTeamStrength, buildDepthChart } from "./roster";

/**
 * LeagueAI: what the other 31 front offices want.
 * Deterministic rules; randomness is supplied by callers through the run's Rng.
 */

export const UNIT_FOR_POSITION: Record<Position, keyof UnitRatings> = {
  QB: "qb", RB: "offSkill", WR: "offSkill", TE: "offSkill", OT: "oLine", G: "oLine", C: "oLine",
  EDGE: "passRush", DT: "runDefense", LB: "runDefense", CB: "coverage", S: "coverage", K: "specialTeams", P: "specialTeams", LS: "specialTeams",
};

/** How badly a team needs a position (0..1). */
export function evaluateTeamNeed(profile: TeamProfile, pos: Position, roster: Player[]): number {
  let need = 0;
  const idx = profile.needs.indexOf(pos);
  if (idx >= 0) need += 0.7 - idx * 0.12;
  const unit = profile.units[UNIT_FOR_POSITION[pos]];
  if (unit < 65) need += 0.3;
  else if (unit < 72) need += 0.15;
  const starters = roster.filter((p) => p.pos === pos && p.ability.ovr >= 78).length;
  if (starters >= 2) need -= 0.3;
  if (pos === "QB" && (profile.qb === "FRANCHISE" || profile.qb === "YOUNG STARTER")) need = Math.min(need, 0.05);
  if (pos === "QB" && profile.qb === "OPEN") need = Math.max(need, 0.85);
  return Math.max(0, Math.min(1, need));
}

/** Rebuilders love picks and youth; contenders pay for now. */
export function statusWeights(status: TeamProfile["status"]) {
  switch (status) {
    case "REBUILDING": return { picks: 1.3, youngPlayers: 1.15, oldPlayers: 0.6, now: 0.75 };
    case "RETOOLING": return { picks: 1.15, youngPlayers: 1.1, oldPlayers: 0.8, now: 0.9 };
    case "FRINGE": return { picks: 1.0, youngPlayers: 1.0, oldPlayers: 0.95, now: 1.0 };
    case "PLAYOFF TEAM": return { picks: 0.9, youngPlayers: 1.0, oldPlayers: 1.05, now: 1.12 };
    case "CONTENDER": return { picks: 0.8, youngPlayers: 0.95, oldPlayers: 1.1, now: 1.25 };
  }
}

/** In-season re-evaluation of a team's posture from its record. */
export function deadlineStatus(profile: TeamProfile, w: number, l: number): TeamProfile["status"] {
  const pct = w / Math.max(1, w + l);
  if (pct >= 0.7) return "CONTENDER";
  if (pct >= 0.55) return "PLAYOFF TEAM";
  if (pct >= 0.4) return "FRINGE";
  if (profile.status === "REBUILDING" || pct < 0.3) return "REBUILDING";
  return "RETOOLING";
}

/**
 * Effective unit ratings for an AI team: snapshot units plus the effect of players who
 * arrived, left or got hurt during this run.
 */
export function aiUnitRatings(profile: TeamProfile, rosterNow: Player[], departed: Player[], rosterAtStart: Set<string>): UnitRatings {
  const u = { ...profile.units };
  for (const p of rosterNow) {
    if (!rosterAtStart.has(p.id)) u[UNIT_FOR_POSITION[p.pos]] += Math.max(0, Math.min(8, (p.ability.ovr - 70) * 0.35));
    if ((p.injuredWeeks ?? 0) > 0) u[UNIT_FOR_POSITION[p.pos]] -= Math.max(0, (p.ability.ovr - 68) * 0.3);
  }
  for (const p of departed) u[UNIT_FOR_POSITION[p.pos]] -= Math.max(0, (p.ability.ovr - 68) * 0.35);
  return u;
}

export function userTeamStrength(roster: Player[], overrides: Record<string, string>): number {
  return calculateTeamStrength(unitRatings(roster, buildDepthChart(roster, overrides)));
}
