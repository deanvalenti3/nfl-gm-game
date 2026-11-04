import type { Player, Position, TeamProfile } from "@/domain/types";
import { evaluateTeamNeed, statusWeights } from "./ai";
import type { Rng } from "./rng";
import { marketAav } from "./value";

/**
 * FreeAgencyEngine. The market runs in "days". Each day the user's offers are resolved
 * against the best AI offer, and some unpursued players sign elsewhere.
 */

export interface Offer {
  playerId: string;
  teamId: string;
  years: number;
  aav: number;
  guaranteedPct: number;
}

export type Resolution =
  | { kind: "SIGNED_WITH_USER"; playerId: string; offer: Offer }
  | { kind: "SIGNED_ELSEWHERE"; playerId: string; offer: Offer }
  | { kind: "ASKING_MORE"; playerId: string; ask: Offer; rival: string | null }
  | { kind: "ENTERED_BIDDING"; playerId: string; teamId: string };

/** Cash-equivalent score of an offer from the player's seat. */
export function offerScore(o: Offer, player: Player, profile: TeamProfile | undefined, userTeamPull: number): number {
  const years = Math.max(1, o.years);
  const total = o.aav * years;
  const gtd = total * o.guaranteedPct;
  let score = o.aav * 0.55 + (gtd / years) * 0.35 + (years >= 3 ? o.aav * 0.05 : 0);
  // Older players want guarantees; young stars want years.
  if (player.age >= 30) score += (gtd / years) * 0.15;
  if (player.age <= 27 && years >= 4) score += o.aav * 0.04;
  const pull = profile ? (profile.status === "CONTENDER" ? 1.07 : profile.status === "PLAYOFF TEAM" ? 1.04 : profile.status === "REBUILDING" ? 0.95 : 1.0) : userTeamPull;
  return score * pull;
}

/** Which AI teams would bid on this player, with the strength of their offer. */
export function generateFreeAgentOffer(player: Player, profiles: TeamProfile[], rosters: Record<string, Player[]>, capSpace: Record<string, number>, rng: Rng, day: number): Offer | null {
  if (!player.market) return null;
  const market = player.market;
  const candidates = profiles
    .map((prof) => {
      const need = evaluateTeamNeed(prof, player.pos, rosters[prof.teamId] ?? []);
      const w = statusWeights(prof.status);
      const space = capSpace[prof.teamId] ?? prof.capSpace;
      const afford = space >= market.aav * 1.05;
      const appetite = need * (player.age >= 30 ? w.oldPlayers : w.youngPlayers) * (player.ability.ovr >= 80 ? w.now : 1);
      return { prof, need, afford, appetite: appetite + rng.range(-0.15, 0.15) };
    })
    .filter((c) => c.afford && c.appetite > 0.35)
    .sort((a, b) => b.appetite - a.appetite);
  if (!candidates.length) return null;
  const best = candidates[0];
  // Demand drives price. HIGH interest players get bid up; day 1 is hottest.
  const heat = (market.interest === "HIGH" ? 1.08 : market.interest === "MEDIUM" ? 1.0 : 0.9) * (1 - (day - 1) * 0.03) * rng.range(0.92, 1.08);
  const aav = Math.round((market.aav * heat) / 100_000) * 100_000;
  const years = Math.max(1, Math.min(5, market.years + rng.int(-1, 1)));
  return { playerId: player.id, teamId: best.prof.teamId, years, aav, guaranteedPct: Math.min(0.95, market.guaranteedPct + rng.range(-0.08, 0.08)) };
}

/** Does the player sign somewhere on their own this day (when the user isn't bidding)? */
export function signsElsewhereToday(player: Player, rng: Rng, day: number): boolean {
  const base = player.market?.interest === "HIGH" ? 0.42 : player.market?.interest === "MEDIUM" ? 0.26 : 0.1;
  return rng.chance(Math.min(0.9, base + day * 0.05));
}

/** Resolve one user offer against the market. */
export function resolveOffer(user: Offer, player: Player, rival: Offer | null, profiles: Record<string, TeamProfile>, rng: Rng, userPull: number): Resolution {
  const mine = offerScore(user, player, undefined, userPull);
  const theirs = rival ? offerScore(rival, player, profiles[rival.teamId], userPull) : 0;
  const floor = offerScore({ playerId: player.id, teamId: "", years: player.market!.years, aav: player.market!.aav, guaranteedPct: player.market!.guaranteedPct }, player, undefined, 1) * 0.9;
  const noise = rng.range(0.96, 1.04);
  if (mine * noise >= Math.max(theirs, floor)) return { kind: "SIGNED_WITH_USER", playerId: player.id, offer: user };
  const target = Math.max(theirs, floor);
  if (mine * noise >= target * 0.88) {
    // Close: the agent comes back with a number.
    const bump = target / Math.max(1, mine);
    const ask: Offer = { ...user, aav: Math.round((user.aav * bump * 1.03) / 100_000) * 100_000, guaranteedPct: Math.min(0.95, user.guaranteedPct + 0.05) };
    return { kind: "ASKING_MORE", playerId: player.id, ask, rival: rival?.teamId ?? null };
  }
  if (rival) return { kind: "SIGNED_ELSEWHERE", playerId: player.id, offer: rival };
  return { kind: "ASKING_MORE", playerId: player.id, ask: { ...user, aav: Math.round((player.market!.aav * 1.02) / 100_000) * 100_000 }, rival: null };
}

/** Curated shortlist: top free agents at the user's ranked needs plus the best remaining names. */
export function shortlist(freeAgents: Player[], needs: Position[], limit = 8): Player[] {
  const seen = new Set<string>();
  const out: Player[] = [];
  const sorted = [...freeAgents].sort((a, b) => b.ability.ovr - a.ability.ovr);
  for (const pos of needs) {
    for (const p of sorted.filter((x) => x.pos === pos).slice(0, 2)) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  }
  for (const p of sorted) {
    if (out.length >= limit) break;
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out.slice(0, limit);
}

/** A sensible default offer the user can tune. */
export function suggestedOffer(player: Player, teamId: string): Offer {
  const m = player.market!;
  return { playerId: player.id, teamId, years: m.years, aav: m.aav, guaranteedPct: Math.round(m.guaranteedPct * 20) / 20 };
}

export function fairAav(player: Player): number {
  return marketAav(player.ability.ovr, player.pos, player.age);
}
