import type { Ability, Contract, DraftProspect, Player, Position } from "@/domain/types";

/** Shared helpers used by hand-curated snapshots and by the ingest script. */

export const M = 1_000_000;

export function slug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export interface VetSpec {
  start: number;
  end: number;
  total: number;
  gtd: number;
  /** Signing bonus; defaults to the smaller of guaranteed and 35% of total. */
  bonus?: number;
  /** Explicit per-year cap hits (overrides the generated curve). */
  hits?: number[];
  kind?: Contract["kind"];
}

/** Build a realistic-enough veteran contract: prorated bonus plus a rising salary curve. */
export function vet(spec: VetSpec): Contract {
  const years = spec.end - spec.start + 1;
  const bonus = Math.min(spec.gtd, spec.bonus ?? Math.round(spec.total * 0.35));
  const proration = Math.round(bonus / Math.min(years, 5));
  const salaryPool = spec.total - bonus;
  const weights = Array.from({ length: years }, (_, i) => 0.78 + i * (0.44 / Math.max(1, years - 1)));
  const wsum = weights.reduce((a, b) => a + b, 0);
  const capHits: Record<number, number> = {};
  const proratedBonus: Record<number, number> = {};
  const guaranteedSalary: Record<number, number> = {};
  let gtdLeft = Math.max(0, spec.gtd - bonus);
  for (let i = 0; i < years; i++) {
    const y = spec.start + i;
    const salary = Math.round((salaryPool * weights[i]) / wsum);
    const pro = i < 5 ? proration : 0;
    capHits[y] = spec.hits?.[i] ?? salary + pro;
    proratedBonus[y] = pro;
    const g = Math.min(gtdLeft, salary);
    guaranteedSalary[y] = g;
    gtdLeft -= g;
  }
  return { startYear: spec.start, endYear: spec.end, totalValue: spec.total, guaranteed: spec.gtd, capHits, proratedBonus, guaranteedSalary, kind: spec.kind ?? "VETERAN" };
}

/** Approximate rookie-scale total by overall pick (2025 scale). */
export function rookieTotal(overall: number): number {
  if (overall <= 1) return 48.8 * M;
  if (overall <= 4) return (43 - (overall - 2) * 2.6) * M;
  if (overall <= 10) return (33 - (overall - 5) * 2.4) * M;
  if (overall <= 20) return (20 - (overall - 11) * 0.5) * M;
  if (overall <= 32) return (15.2 - (overall - 21) * 0.2) * M;
  if (overall <= 64) return (10.6 - (overall - 33) * 0.12) * M;
  if (overall <= 100) return (6.4 - (overall - 65) * 0.03) * M;
  if (overall <= 136) return 5.1 * M;
  if (overall <= 176) return 4.7 * M;
  if (overall <= 216) return 4.5 * M;
  return 4.4 * M;
}

/** Four-year rookie contract (fifth-year option ignored in V1). */
export function rookie(draftYear: number, overall: number, yearsLeft = 4): Contract {
  const total = Math.round(rookieTotal(overall));
  const start = draftYear + (4 - yearsLeft);
  const bonus = overall <= 32 ? Math.round(total * 0.55) : overall <= 100 ? Math.round(total * 0.25) : Math.round(total * 0.08);
  const gtd = overall <= 32 ? total : overall <= 64 ? Math.round(total * 0.6) : bonus;
  const c = vet({ start: draftYear, end: draftYear + 3, total, gtd, bonus, kind: "ROOKIE" });
  // Trim already-played years.
  for (const y of Object.keys(c.capHits).map(Number)) {
    if (y < start) {
      delete c.capHits[y];
      delete c.proratedBonus[y];
      delete c.guaranteedSalary[y];
    }
  }
  c.startYear = start;
  return c;
}

/** One-year minimum-type deal for depth. */
export function min1(year: number, amount = 1.2 * M): Contract {
  return vet({ start: year, end: year, total: amount, gtd: 0, bonus: 0, kind: "MINIMUM" });
}

export function ability(ovr: number, trajectory = 0, durability = 85): Ability {
  return { ovr, trajectory, durability };
}

export interface PlayerRow {
  name: string;
  pos: Position;
  age: number;
  exp: number;
  ovr: number;
  teamId: string | null;
  contract: Contract | null;
  trajectory?: number;
  durability?: number;
  college?: string;
}

export function player(row: PlayerRow): Player {
  return {
    id: slug(row.name),
    name: row.name,
    pos: row.pos,
    age: row.age,
    exp: row.exp,
    college: row.college,
    teamId: row.teamId,
    contract: row.contract,
    ability: ability(row.ovr, row.trajectory ?? (row.age <= 25 ? 1 : row.age >= 31 ? -1 : 0), row.durability ?? 85),
  };
}

export type ProspectRow = [
  name: string,
  pos: Position,
  school: string,
  age: number,
  grade: DraftProspect["grade"],
  lo: number,
  hi: number,
  athletic: DraftProspect["athletic"],
  production: DraftProspect["production"],
  risk: DraftProspect["risk"],
  trueOvr: number,
  ceiling: number,
];

export function prospect(r: ProspectRow): DraftProspect {
  const [name, pos, school, age, grade, lo, hi, athletic, production, risk, trueOvr, ceiling] = r;
  return { id: `p-${slug(name)}`, name, pos, school, age, grade, projectedRange: [lo, hi], athletic, production, risk, trueOvr, ceiling };
}
