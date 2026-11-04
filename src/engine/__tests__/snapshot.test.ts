import { describe, expect, it } from "vitest";
import { NE_2025 } from "@/data/scenarios/ne-2025";
import { SCENARIOS } from "@/data/scenarios";
import { capHit } from "@/engine/cap";

describe.each(SCENARIOS.map((s) => [s.scenario.id, s] as const))("%s snapshot integrity", (_id, snap) => {
  it("has unique player ids, a profile for 32 teams, 257 unique 2025 picks, and a full user roster", () => {
    const ids = snap.players.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(snap.profiles.length).toBe(32);
    expect(new Set(snap.profiles.map((p) => p.teamId)).size).toBe(32);
    const picks = snap.picks.filter((p) => p.year === 2025);
    expect(picks.length).toBe(257);
    expect(new Set(picks.map((p) => p.overall)).size).toBe(257);
    expect(snap.players.filter((p) => p.teamId === snap.scenario.teamId).length).toBeGreaterThanOrEqual(40);
    for (const d of snap.scenario.auditDecisions) {
      const p = snap.players.find((x) => x.id === d.playerId);
      expect(p, d.playerId).toBeDefined();
      if (d.options.includes("TAG") || d.options.includes("RESIGN")) expect(p!.teamId).toBeNull();
      else expect(p!.teamId).toBe(snap.scenario.teamId);
    }
    for (const p of snap.players.filter((p) => p.teamId)) expect(capHit(p.contract, 2025), p.name).toBeGreaterThan(0);
  });
});

describe("NE 2025 snapshot integrity", () => {
  it("has unique player ids and no player on two teams", () => {
    const ids = NE_2025.players.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every audit decision points at a Patriots player", () => {
    for (const d of NE_2025.scenario.auditDecisions) {
      const p = NE_2025.players.find((x) => x.id === d.playerId);
      expect(p, d.playerId).toBeDefined();
      expect(p!.teamId).toBe("NE");
    }
  });

  it("has 257 picks in 2025, each owned by exactly one team, with NE's real slots", () => {
    const picks = NE_2025.picks.filter((p) => p.year === 2025);
    expect(picks.length).toBe(257);
    expect(new Set(picks.map((p) => p.overall)).size).toBe(257);
    const ne = picks.filter((p) => p.teamId === "NE").map((p) => p.overall).sort((a, b) => a! - b!);
    expect(ne).toEqual([4, 38, 69, 95, 106, 137, 146, 182, 220, 251, 257]);
    expect(picks.find((p) => p.overall === 52)!.teamId).toBe("SEA");
  });

  it("every other team keeps a first-round pick count of one", () => {
    const r1 = NE_2025.picks.filter((p) => p.year === 2025 && p.round === 1);
    const counts = new Map<string, number>();
    for (const p of r1) counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
    for (const [, n] of counts) expect(n).toBe(1);
  });

  it("has unique prospects and enough of them for the whole draft", () => {
    const ids = NE_2025.prospects.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(257);
  });

  it("free agents have market data and no team", () => {
    for (const p of NE_2025.players.filter((p) => !p.teamId)) {
      expect(p.market, p.name).toBeDefined();
      expect(p.contract).toBeNull();
    }
  });

  it("rostered players carry a current-year cap hit", () => {
    for (const p of NE_2025.players.filter((p) => p.teamId)) {
      expect(capHit(p.contract, 2025), p.name).toBeGreaterThan(0);
    }
  });

  it("has a profile for all 32 teams", () => {
    expect(NE_2025.profiles.length).toBe(32);
    expect(NE_2025.teams.length).toBe(32);
  });
});
