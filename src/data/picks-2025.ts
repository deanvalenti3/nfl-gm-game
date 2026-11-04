import { DRAFT_ORDER_2025 } from "@/data/teams";
import type { DraftPick } from "@/domain/types";

/**
 * Pick ownership for the 2025 draft (257 selections) and 2026 rounds 1-3, shared by every
 * 2025 scenario. Base order is the round-one order repeated each round, with compensatory
 * slots padding rounds 3-7 to the real 257 total. The DK Metcalf trade moves Pittsburgh's 52
 * to Seattle.
 */

const ROUND_SIZES = [32, 32, 38, 36, 40, 40, 39]; // = 257
/** Picks that changed hands before the cutoff and affect every scenario. */
const OVERRIDES: Record<number, string> = { 52: "SEA" };

/**
 * Build the 2025 draft with the user's team at its real slots. Other teams sit in base order,
 * swapping with the user's team round by round so each keeps its pick count.
 */
export function build2025Picks(userTeam: string, userSlots: number[]): DraftPick[] {
  const NE_SLOTS = userSlots;
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
    const neBase = picks.find((p) => p.overall! >= roundStart && p.overall! <= roundEnd && p.originalTeamId === userTeam)!;
    const neReal = NE_SLOTS.filter((s) => s >= roundStart && s <= roundEnd);
    if (!neReal.length) {
      // The user's team traded this round's pick away before the cutoff; a contender holds it.
      neBase.teamId = DRAFT_ORDER_2025[(DRAFT_ORDER_2025.indexOf(userTeam) + 13) % 32];
      return;
    }
    if (!neReal.includes(neBase.overall!)) {
      const target = picks.find((p) => p.overall === neReal[0])!;
      neBase.teamId = target.originalTeamId;
      target.teamId = userTeam;
    }
    for (const s of neReal.slice(1)) {
      const p = picks.find((x) => x.overall === s)!;
      if (p.teamId !== userTeam) p.teamId = userTeam;
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

export function buildPicks(userTeam: string, userSlots: number[]): DraftPick[] {
  return [...build2025Picks(userTeam, userSlots), ...build2026Picks()];
}
