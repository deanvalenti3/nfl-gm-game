import type { Contract, Player } from "@/domain/types";

/**
 * CapEngine: pure salary-cap arithmetic.
 * Everything is in dollars for one league year unless stated.
 */

export function capHit(contract: Contract | null, year: number): number {
  return contract?.capHits[year] ?? 0;
}

/** Dead money if the player is released before `year` (pre-June-1 accounting). */
export function calculateDeadMoney(contract: Contract | null, year: number): number {
  if (!contract) return 0;
  let dead = 0;
  for (let y = year; y <= contract.endYear; y++) {
    dead += contract.proratedBonus[y] ?? 0;
    // Guaranteed salary is only owed for the current year and any fully guaranteed future years.
    dead += contract.guaranteedSalary[y] ?? 0;
  }
  return dead;
}

/** Net cap savings from releasing the player this year (can be negative). */
export function calculateCutSavings(contract: Contract | null, year: number): number {
  return capHit(contract, year) - calculateDeadMoney(contract, year);
}

/**
 * Dead money left behind by a traded player: this year's proration accelerates now;
 * later years' proration is treated post-June-1 style (it lands next league year).
 */
export function calculateTradeDeadMoney(contract: Contract | null, year: number): number {
  if (!contract) return 0;
  return contract.proratedBonus[year] ?? 0;
}

export interface CapSummary {
  cap: number;
  committed: number;
  deadMoney: number;
  space: number;
  /** Top-51 style projection for next year. */
  nextYearCommitted: number;
  nextYearSpace: number;
}

/** Cap space for a team given the players currently on it. */
export function calculateCapSpace(players: Player[], cap: number, year: number, deadMoney: number, rookieReserve = 0): CapSummary {
  const hits = players.map((p) => capHit(p.contract, year)).sort((a, b) => b - a);
  // Offseason accounting counts the top 51 contracts.
  const committed = hits.slice(0, 51).reduce((a, b) => a + b, 0);
  const nextYearCommitted = players.map((p) => capHit(p.contract, year + 1)).reduce((a, b) => a + b, 0);
  return {
    cap,
    committed,
    deadMoney,
    space: cap - committed - deadMoney - rookieReserve,
    nextYearCommitted,
    nextYearSpace: Math.round(cap * 1.07) - nextYearCommitted,
  };
}

/** Build a veteran contract from an offer: years, AAV, guaranteed share. */
export function buildOfferContract(year: number, years: number, aav: number, guaranteedPct: number): Contract {
  const total = Math.round(aav * years);
  const guaranteed = Math.round(total * guaranteedPct);
  const bonus = Math.min(guaranteed, Math.round(total * 0.3));
  const proration = Math.round(bonus / Math.min(years, 5));
  const capHits: Record<number, number> = {};
  const proratedBonus: Record<number, number> = {};
  const guaranteedSalary: Record<number, number> = {};
  const salaryPool = total - bonus;
  const weights = Array.from({ length: years }, (_, i) => 0.8 + i * (0.4 / Math.max(1, years - 1)));
  const wsum = weights.reduce((a, b) => a + b, 0);
  let gtdLeft = guaranteed - bonus;
  for (let i = 0; i < years; i++) {
    const y = year + i;
    const salary = Math.round((salaryPool * weights[i]) / wsum);
    capHits[y] = salary + proration;
    proratedBonus[y] = proration;
    const g = Math.min(gtdLeft, salary);
    guaranteedSalary[y] = g;
    gtdLeft -= g;
  }
  return { startYear: year, endYear: year + years - 1, totalValue: total, guaranteed, capHits, proratedBonus, guaranteedSalary, kind: "VETERAN" };
}

export function fmtMoney(n: number, opts: { sign?: boolean; decimals?: number } = {}): string {
  const abs = Math.abs(n);
  const d = opts.decimals ?? (abs >= 100_000_000 ? 0 : 1);
  const s = abs >= 1_000_000 ? `$${(abs / 1_000_000).toFixed(d)}M` : abs >= 1000 ? `$${Math.round(abs / 1000)}K` : `$${abs}`;
  if (n < 0) return `-${s}`;
  return opts.sign ? `+${s}` : s;
}
