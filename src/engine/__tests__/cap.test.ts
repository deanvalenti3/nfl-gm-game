import { describe, expect, it } from "vitest";
import { M, rookie, vet } from "@/data/build";
import { buildOfferContract, calculateCapSpace, calculateCutSavings, calculateDeadMoney, calculateTradeDeadMoney, capHit } from "@/engine/cap";
import { player } from "@/data/build";

describe("CapEngine", () => {
  const deal = vet({ start: 2024, end: 2027, total: 58 * M, gtd: 32.5 * M, hits: [8 * M, 12.7 * M, 15.3 * M, 17 * M] });

  it("reads the cap hit for a year", () => {
    expect(capHit(deal, 2025)).toBe(12.7 * M);
    expect(capHit(deal, 2030)).toBe(0);
    expect(capHit(null, 2025)).toBe(0);
  });

  it("dead money is remaining proration plus guaranteed salary", () => {
    const dead = calculateDeadMoney(deal, 2025);
    const proration = (deal.proratedBonus[2025] ?? 0) + (deal.proratedBonus[2026] ?? 0) + (deal.proratedBonus[2027] ?? 0);
    const gtd = (deal.guaranteedSalary[2025] ?? 0) + (deal.guaranteedSalary[2026] ?? 0) + (deal.guaranteedSalary[2027] ?? 0);
    expect(dead).toBe(proration + gtd);
    expect(dead).toBeGreaterThan(0);
  });

  it("cut savings = cap hit minus dead money and can be negative", () => {
    expect(calculateCutSavings(deal, 2025)).toBe(capHit(deal, 2025) - calculateDeadMoney(deal, 2025));
    const frontLoaded = vet({ start: 2025, end: 2027, total: 60 * M, gtd: 60 * M, bonus: 30 * M });
    expect(calculateCutSavings(frontLoaded, 2025)).toBeLessThan(0);
  });

  it("trade dead money excludes guaranteed salary", () => {
    expect(calculateTradeDeadMoney(deal, 2025)).toBeLessThanOrEqual(calculateDeadMoney(deal, 2025));
  });

  it("offer contracts total to years × AAV with the requested guarantee", () => {
    const c = buildOfferContract(2025, 4, 25 * M, 0.6);
    expect(c.totalValue).toBe(100 * M);
    expect(c.guaranteed).toBe(60 * M);
    const hits = Object.values(c.capHits).reduce((a, b) => a + b, 0);
    expect(Math.abs(hits - c.totalValue)).toBeLessThan(5); // rounding
    expect(c.endYear).toBe(2028);
  });

  it("cap space counts the top 51 and subtracts dead money and the rookie reserve", () => {
    const players = Array.from({ length: 60 }, (_, i) => player({ name: `P${i}`, pos: "WR", age: 25, exp: 2, ovr: 60, teamId: "X", contract: vet({ start: 2025, end: 2025, total: (i + 1) * M, gtd: 0, bonus: 0 }) }));
    const sum = calculateCapSpace(players, 279.2 * M, 2025, 5 * M, 10 * M);
    const top51 = players.map((p) => capHit(p.contract, 2025)).sort((a, b) => b - a).slice(0, 51).reduce((a, b) => a + b, 0);
    expect(sum.committed).toBe(top51);
    expect(sum.space).toBe(279.2 * M - top51 - 15 * M);
  });

  it("rookie contracts scale with slot", () => {
    expect(rookie(2025, 4).totalValue).toBeGreaterThan(rookie(2025, 38).totalValue);
    expect(rookie(2025, 38).totalValue).toBeGreaterThan(rookie(2025, 220).totalValue);
    expect(Object.keys(rookie(2024, 3, 3).capHits)).toEqual(["2025", "2026", "2027"]);
  });
});
