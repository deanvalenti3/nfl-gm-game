import type { DraftPick, Player, TeamProfile, TradeAsset } from "@/domain/types";
import { evaluateTeamNeed, statusWeights } from "./ai";
import { capHit, calculateTradeDeadMoney } from "./cap";
import { pickValue, playerValue } from "./value";
import type { Rng } from "./rng";

/**
 * TradeEngine. The AI side values each asset through its own context (status, needs,
 * QB situation, cap) so the same package reads differently to different teams.
 */

export type Interest = "LOW INTEREST" | "POSSIBLE" | "STRONG INTEREST";

export interface TradeContext {
  year: number;
  players: Record<string, Player>;
  picks: Record<string, DraftPick>;
  profiles: Record<string, TeamProfile>;
  /** Cap space per team (user's computed, AI's from profile) */
  capSpace: Record<string, number>;
  /** Roster per team id */
  rosters: Record<string, Player[]>;
}

export interface TradeEvaluation {
  interest: Interest;
  /** Their perceived gain / their perceived loss. Not shown to the player. */
  ratio: number;
  reasons: string[];
  blockers: string[];
  /** If close, what they would want added from the user's side. */
  counter?: TradeAsset;
}

function assetValueFor(ctx: TradeContext, teamId: string, asset: TradeAsset, incoming: boolean): number {
  const profile = ctx.profiles[teamId];
  const w = statusWeights(profile.status);
  if (asset.type === "PICK") {
    const pick = ctx.picks[asset.id];
    return pickValue(pick, ctx.profiles, ctx.year) * w.picks;
  }
  const p = ctx.players[asset.id];
  let v = playerValue(p, ctx.year);
  const young = p.age <= 26;
  v *= young ? w.youngPlayers : p.age >= 30 ? w.oldPlayers : 1;
  if (incoming) {
    const need = evaluateTeamNeed(profile, p.pos, ctx.rosters[teamId] ?? []);
    v *= 0.8 + need * 0.5;
    if (p.ability.ovr >= 82) v *= w.now;
    // A team with a quarterback has almost no use for another expensive one.
    if (p.pos === "QB" && (profile.qb === "FRANCHISE" || profile.qb === "YOUNG STARTER") && capHit(p.contract, ctx.year) > 10_000_000) v *= 0.15;
  } else {
    // Teams overvalue their own good players a little (endowment).
    if (p.ability.ovr >= 80) v *= 1.12;
    if (p.pos === "QB" && (profile.qb === "FRANCHISE" || profile.qb === "YOUNG STARTER") && p.ability.ovr >= 80) v *= 1.6;
  }
  return v;
}

/** Evaluate from the counterparty's point of view. `give` is what the user sends; `get` is what they want. */
export function evaluateTrade(ctx: TradeContext, userTeam: string, partner: string, give: TradeAsset[], get: TradeAsset[]): TradeEvaluation {
  const blockers: string[] = [];
  const reasons: string[] = [];
  if (give.length === 0 || get.length === 0) return { interest: "LOW INTEREST", ratio: 0, reasons: ["Add assets to both sides."], blockers: [] };

  for (const a of give) {
    if (a.type === "PICK" && ctx.picks[a.id]?.teamId !== userTeam) blockers.push("You don't own that pick.");
    if (a.type === "PLAYER" && ctx.players[a.id]?.teamId !== userTeam) blockers.push(`${ctx.players[a.id]?.name ?? "That player"} is not on your roster.`);
  }
  for (const a of get) {
    if (a.type === "PICK" && ctx.picks[a.id]?.teamId !== partner) blockers.push("They don't own that pick.");
    if (a.type === "PLAYER" && ctx.players[a.id]?.teamId !== partner) blockers.push(`${ctx.players[a.id]?.name ?? "That player"} is not on their roster.`);
  }

  // Cap check both directions.
  const inHits = give.filter((a) => a.type === "PLAYER").reduce((s, a) => s + capHit(ctx.players[a.id].contract, ctx.year), 0);
  const outHits = get.filter((a) => a.type === "PLAYER").reduce((s, a) => s + capHit(ctx.players[a.id].contract, ctx.year), 0);
  const theirDead = get.filter((a) => a.type === "PLAYER").reduce((s, a) => s + calculateTradeDeadMoney(ctx.players[a.id].contract, ctx.year), 0);
  const theirSpaceBefore = ctx.capSpace[partner] ?? 0;
  const theirSpaceAfter = theirSpaceBefore + outHits - theirDead - inHits;
  // A deal that improves their cap position is never blocked by a deficit they already carry.
  if (theirSpaceAfter < 0 && theirSpaceAfter < theirSpaceBefore) blockers.push(`They can't fit the contracts. They need another ${fmt(-theirSpaceAfter)} in cap space.`);
  const userDead = give.filter((a) => a.type === "PLAYER").reduce((s, a) => s + calculateTradeDeadMoney(ctx.players[a.id].contract, ctx.year), 0);
  const userSpaceAfter = (ctx.capSpace[userTeam] ?? 0) + inHits - userDead - outHits;
  if (userSpaceAfter < 0) blockers.push(`You need another ${fmt(-userSpaceAfter)} in cap space to take on these contracts.`);

  const gain = give.reduce((s, a) => s + assetValueFor(ctx, partner, a, true), 0);
  const loss = get.reduce((s, a) => s + assetValueFor(ctx, partner, a, false), 0);
  const ratio = loss === 0 ? 5 : gain / loss;

  const profile = ctx.profiles[partner];
  if (profile.status === "REBUILDING" && give.some((a) => a.type === "PICK")) reasons.push("They're rebuilding and value draft capital.");
  if (profile.status === "CONTENDER" && give.some((a) => a.type === "PLAYER" && ctx.players[a.id].ability.ovr >= 80)) reasons.push("A contender will pay for a starter who helps now.");
  for (const a of give) {
    if (a.type === "PLAYER") {
      const p = ctx.players[a.id];
      const need = evaluateTeamNeed(profile, p.pos, ctx.rosters[partner] ?? []);
      if (need >= 0.5) reasons.push(`${p.pos} is a need for them.`);
      else if (need <= 0.1) reasons.push(`They aren't looking for a ${p.pos}.`);
      if (p.age >= 31 && profile.status === "REBUILDING") reasons.push(`${p.name.split(" ").slice(-1)[0]} is older than a rebuilding team wants.`);
    }
  }
  for (const a of get) {
    if (a.type === "PLAYER" && ctx.players[a.id].ability.ovr >= 86) reasons.push(`They see ${ctx.players[a.id].name} as a cornerstone.`);
  }

  let interest: Interest = ratio >= 1.08 ? "STRONG INTEREST" : ratio >= 0.9 ? "POSSIBLE" : "LOW INTEREST";
  if (blockers.length) interest = "LOW INTEREST";

  let counter: TradeAsset | undefined;
  if (!blockers.length && ratio < 1.08 && ratio >= 0.6) {
    const needed = loss * 1.1 - gain;
    const candidates: { asset: TradeAsset; v: number }[] = [];
    for (const pick of Object.values(ctx.picks)) {
      if (pick.teamId === userTeam && !pick.usedOnPlayerId && !give.some((a) => a.type === "PICK" && a.id === pick.id)) {
        candidates.push({ asset: { type: "PICK", id: pick.id }, v: assetValueFor(ctx, partner, { type: "PICK", id: pick.id }, true) });
      }
    }
    const fit = candidates.filter((c) => c.v >= needed).sort((a, b) => a.v - b.v)[0];
    if (fit) counter = fit.asset;
  }

  return { interest, ratio, reasons: reasons.slice(0, 3), blockers, counter };
}

/** Final yes/no with a little noise so "POSSIBLE" is a coin flip, not a certainty. */
export function decideTrade(evaluation: TradeEvaluation, rng: Rng): boolean {
  if (evaluation.blockers.length) return false;
  if (evaluation.ratio >= 1.08) return true;
  if (evaluation.ratio >= 0.9) return rng.chance(0.35 + (evaluation.ratio - 0.9) * 3);
  return false;
}

function fmt(n: number) {
  return `$${(n / 1_000_000).toFixed(1)}M`;
}
