import type { DraftPick, Player, Position, TeamProfile } from "@/domain/types";
import { POSITION_VALUE } from "./roster";

/**
 * Asset valuation shared by the trade engine, free agency and scoring.
 * Values are abstract "points"; a late first-round pick is about 1000.
 */

/** What a player of this quality should earn per year on the open market (dollars). */
export function marketAav(ovr: number, pos: Position, age: number): number {
  // Calibrated against the 2025 free-agent market (see data/scenarios/ne-2025/free-agents.ts):
  // WR 85 ≈ $28M, EDGE 82 ≈ $19M, DT 82 ≈ $26M, QB 78 ≈ $33M, OT 82 ≈ $25M, CB 80 ≈ $18M.
  const posScale: Record<Position, number> = {
    QB: 80, WR: 43, OT: 42, EDGE: 34, CB: 37, DT: 44, S: 33, G: 38, C: 32, TE: 30, LB: 24, RB: 16, K: 5, P: 3.5, LS: 1.5,
  };
  const top = posScale[pos] * 1_000_000;
  const q = Math.max(0, (ovr - 58) / 37);
  let aav = 1_100_000 + top * Math.pow(q, 1.5);
  if (age >= 31) aav *= 0.8;
  if (age >= 33) aav *= 0.75;
  return Math.round(aav);
}

/** Raw talent value on a convex curve: stars are worth far more than two starters. */
export function talentValue(ovr: number, pos: Position): number {
  const q = Math.max(0, ovr - 50) / 45; // 0..1
  return 2400 * Math.pow(q, 2.4) * POSITION_VALUE[pos];
}

export function ageFactor(age: number, pos: Position): number {
  const peakEnd = pos === "QB" ? 34 : pos === "RB" ? 26 : pos === "K" || pos === "P" ? 36 : 29;
  if (age <= peakEnd) return 1 + Math.max(0, (25 - age) * 0.03);
  return Math.max(0.3, 1 - (age - peakEnd) * 0.12);
}

/** Contract surplus: how much better (or worse) the deal is than the player's market rate. */
export function contractFactor(p: Player, year: number): number {
  if (!p.contract) return 1;
  const yearsLeft = p.contract.endYear - year + 1;
  const hit = p.contract.capHits[year] ?? 0;
  const market = marketAav(p.ability.ovr, p.pos, p.age);
  const surplus = (market - hit) / Math.max(market, 3_000_000);
  // Cheap deals (rookie contracts) add value; big overpays subtract. Longer control amplifies.
  const f = 1 + Math.max(-0.6, Math.min(0.45, surplus * 0.7)) * Math.min(1.3, 0.6 + yearsLeft * 0.2);
  if (p.contract.kind === "ROOKIE") return f * 1.05;
  return f;
}

export function playerValue(p: Player, year: number): number {
  return talentValue(p.ability.ovr, p.pos) * ageFactor(p.age, p.pos) * contractFactor(p, year) * (0.6 + p.ability.durability / 250);
}

/** Pick value chart: steep at the top like Jimmy Johnson's, with a Fitzgerald-Spielberger style floor late. */
export function pickValueByOverall(overall: number): number {
  const o = Math.max(1, overall) - 1;
  return Math.round(2600 * Math.exp(-0.04 * o) + 400 * Math.exp(-0.011 * o));
}

/** Future-year picks use the owner's projected slot; discount for time. */
export function pickValue(pick: DraftPick, profiles: Record<string, TeamProfile>, year: number): number {
  if (pick.overall) return pickValueByOverall(pick.overall);
  const p = profiles[pick.originalTeamId];
  const slotByStatus: Record<TeamProfile["status"], number> = { REBUILDING: 6, RETOOLING: 11, FRINGE: 16, "PLAYOFF TEAM": 23, CONTENDER: 29 };
  const slot = (slotByStatus[p?.status ?? "FRINGE"] ?? 16) + (pick.round - 1) * 32;
  return pickValueByOverall(slot) * Math.pow(0.82, pick.year - year);
}
