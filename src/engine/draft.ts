import type { DraftPick, DraftProspect, Player, Position, TeamProfile } from "@/domain/types";
import { rookie } from "@/data/build";
import { evaluateTeamNeed } from "./ai";
import type { Rng } from "./rng";

/**
 * DraftEngine. AI teams pick from the *public* board (grade + projected range) with need and
 * noise, never from hidden true talent, so the board is uncertain for everyone.
 */

const GRADE_SCORE: Record<DraftProspect["grade"], number> = { "A+": 100, A: 94, "A-": 88, "B+": 80, B: 72, "B-": 64, "C+": 56, C: 48, "C-": 40 };

export function consensusValue(p: DraftProspect): number {
  const mid = (p.projectedRange[0] + p.projectedRange[1]) / 2;
  return GRADE_SCORE[p.grade] * 0.6 + Math.max(0, 100 - mid * 0.4) * 0.4;
}

export function positionalPremium(pos: Position): number {
  const prem: Record<Position, number> = { QB: 1.15, OT: 1.08, EDGE: 1.1, WR: 1.05, CB: 1.06, DT: 1.03, S: 0.97, G: 0.95, C: 0.93, TE: 0.98, LB: 0.95, RB: 0.9, K: 0.4, P: 0.35, LS: 0.3 };
  return prem[pos];
}

/** Which prospect an AI team takes with a given pick. */
export function simulateDraftSelection(board: DraftProspect[], profile: TeamProfile, roster: Player[], pick: DraftPick, rng: Rng, drafted: Set<string>): DraftProspect | null {
  const available = board.filter((p) => !drafted.has(p.id));
  if (!available.length) return null;
  let best: DraftProspect | null = null;
  let bestScore = -Infinity;
  for (const p of available) {
    // Specialists only go late.
    if ((p.pos === "K" || p.pos === "P" || p.pos === "LS") && pick.round < 5) continue;
    const need = evaluateTeamNeed(profile, p.pos, roster);
    // Already have a young QB? Don't draft one early.
    if (p.pos === "QB" && (profile.qb === "FRANCHISE" || profile.qb === "YOUNG STARTER") && pick.round <= 3) continue;
    let score = consensusValue(p) * positionalPremium(p.pos) * (0.9 + need * 0.3);
    // Reach penalty: the board is public, and teams rarely take someone projected far later.
    const overall = pick.overall ?? 0;
    const reach = p.projectedRange[0] - overall;
    if (reach > 50) score *= 0.45;
    else if (reach > 25) score *= 0.65;
    else if (reach > 12) score *= 0.85;
    score += rng.gauss(0, 4);
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/** Turn a drafted prospect into a rostered player. */
export function prospectToPlayer(p: DraftProspect, teamId: string, pick: DraftPick, year: number, rng: Rng): Player {
  const jitter = rng.gauss(0, 2.5);
  const ovr = Math.round(Math.max(40, Math.min(p.ceiling, p.trueOvr + jitter)));
  return {
    id: p.id.replace(/^p-/, ""),
    name: p.name,
    pos: p.pos,
    age: p.age,
    exp: 0,
    college: p.school,
    teamId,
    contract: rookie(year, pick.overall ?? 200),
    ability: { ovr, trajectory: Math.max(1, Math.round((p.ceiling - ovr) / 6)), durability: p.risk === "HIGH" ? 70 : p.risk === "MEDIUM" ? 82 : 90 },
    draftedPick: pick.overall,
  };
}

/** The ordered list of 2025 picks, by overall. */
export function draftOrder(picks: DraftPick[], year: number): DraftPick[] {
  return picks.filter((p) => p.year === year && p.overall).sort((a, b) => a.overall! - b.overall!);
}

/** Team-need fit shown on the board (public info only). */
export function needFit(profile: TeamProfile, roster: Player[], pos: Position): "STRONG" | "FIT" | "LUXURY" {
  const need = evaluateTeamNeed(profile, pos, roster);
  return need >= 0.5 ? "STRONG" : need >= 0.2 ? "FIT" : "LUXURY";
}
