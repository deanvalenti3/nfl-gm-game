import { DRAFT_ORDER_2025 } from "@/data/teams";
import type { DraftPick } from "@/domain/types";

/**
 * Pick ownership for the 2025 draft (257 selections) and 2026 rounds 1-3.
 *
 * Base order is the 2025 round-one order repeated each round, with compensatory slots padding
 * rounds 3-7 to the real 257 total. New England's real slots (4, 38, 69, 95, 106, 137, 146,
 * 182, 220, 251, 257) are honoured exactly: where a real slot differs from NE's base slot in
 * that round, the two owners swap, so every other team keeps its pick count. The DK Metcalf
 * trade moves Pittsburgh's 52 to Seattle.
 */

const ROUND_SIZES = [32, 32, 38, 36, 40, 40, 39]; // = 257
const NE_SLOTS = [4, 38, 69, 95, 106, 137, 146, 182, 220, 251, 257];
const OVERRIDES: Record<number, string> = { 52: "SEA" };

export function build2025Picks(): DraftPick[] {
  const picks: DraftPick[] = [];
  let overall = 0;
  ROUND_SIZES.forEach((size, ri) => {
    const round = ri + 1;
    const roundStart = overall + 1;
    for (let i = 0; i < size; i++) {
      overall++;
      const base = i < 32 ? DRAFT_ORDER_2025[i] : DRAFT_ORDER_2025[31 - ((i - 32) % 10)];
      picks.push({ id: `2025-${round}-${overall}`, year: 2025, round, overall, originalTeamId: base, teamId: base });
    }
    const roundEnd = overall;
    const neBase = picks.find((p) => p.overall! >= roundStart && p.overall! <= roundEnd && p.originalTeamId === "NE")!;
    const neReal = NE_SLOTS.filter((s) => s >= roundStart && s <= roundEnd);
    if (!neReal.includes(neBase.overall!)) {
      const target = picks.find((p) => p.overall === neReal[0])!;
      neBase.teamId = target.originalTeamId;
      target.teamId = "NE";
    }
    for (const s of neReal.slice(1)) {
      const p = picks.find((x) => x.overall === s)!;
      if (p.teamId !== "NE") p.teamId = "NE";
    }
  });
  for (const [slot, owner] of Object.entries(OVERRIDES)) {
    const p = picks.find((x) => x.overall === Number(slot))!;
    p.teamId = owner;
  }
  return picks;
}

export function build2026Picks(): DraftPick[] {
  const picks: DraftPick[] = [];
  for (let round = 1; round <= 3; round++) {
    for (const team of DRAFT_ORDER_2025) {
      picks.push({ id: `2026-${round}-${team}`, year: 2026, round, originalTeamId: team, teamId: team });
    }
  }
  return picks;
}

export const PICKS: DraftPick[] = [...build2025Picks(), ...build2026Picks()];
