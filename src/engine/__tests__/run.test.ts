import { describe, expect, it } from "vitest";
import { NE_2025 } from "@/data/scenarios/ne-2025";
import { M } from "@/data/build";
import { capSummary, createRun, currentPick, freeAgents, runReducer, tradeContext, userOnClock, userRoster, type Action, type RunState } from "@/engine/game";
import { evaluateTrade } from "@/engine/trade";
import { calculateDeadMoney } from "@/engine/cap";

const reduce = runReducer(NE_2025);
const run = (s: RunState, ...actions: Action[]) => actions.reduce((st, a) => reduce(st, a), s);

function throughAudit(s: RunState, choice: "KEEP" | "CUT" = "KEEP") {
  s = reduce(s, { type: "START" });
  for (const d of NE_2025.scenario.auditDecisions) s = reduce(s, { type: "AUDIT_DECIDE", decisionId: d.id, choice: d.options.includes(choice) ? choice : "KEEP" });
  return s;
}

describe("Run state machine", () => {
  it("moves from briefing through audit to needs", () => {
    let s = createRun(NE_2025, 1);
    expect(s.phase).toBe("BRIEFING");
    s = throughAudit(s);
    expect(s.phase).toBe("NEEDS");
    expect(Object.keys(s.audit.decisions).length).toBe(NE_2025.scenario.auditDecisions.length);
  });

  it("ignores actions out of phase", () => {
    const s = createRun(NE_2025, 1);
    expect(reduce(s, { type: "SIM_WEEK" })).toBe(s);
    expect(reduce(s, { type: "DRAFT_ADVANCE" })).toBe(s);
  });

  it("cutting a player books dead money, frees him to free agency and logs the transaction", () => {
    let s = createRun(NE_2025, 1);
    const before = capSummary(s, NE_2025);
    const andrews = s.players["david-andrews"];
    const dead = calculateDeadMoney(andrews.contract, 2025);
    s = reduce(s, { type: "START" });
    s = reduce(s, { type: "AUDIT_DECIDE", decisionId: "andrews", choice: "CUT" });
    expect(s.players["david-andrews"].teamId).toBeNull();
    expect(s.players["david-andrews"].market).toBeDefined();
    expect(s.deadMoney.NE).toBe(dead);
    const after = capSummary(s, NE_2025);
    expect(after.space).toBeGreaterThan(before.space);
    expect(s.transactions.find((t) => t.kind === "RELEASE")).toBeDefined();
    expect(freeAgents(s).some((p) => p.id === "david-andrews")).toBe(true);
  });

  it("refuses an offer the cap cannot fit", () => {
    let s = throughAudit(createRun(NE_2025, 1));
    s = reduce(s, { type: "CONFIRM_NEEDS" });
    const space = capSummary(s, NE_2025).space;
    const offer = { playerId: "tee-higgins", teamId: "NE", years: 1, aav: space + 50 * M, guaranteedPct: 0.5 };
    const next = reduce(s, { type: "FA_OFFER", offer });
    expect(next).toBe(s);
  });

  it("a blow-away offer signs the player and nobody else can sign him", () => {
    let s = throughAudit(createRun(NE_2025, 7));
    s = reduce(s, { type: "CONFIRM_NEEDS" });
    s = reduce(s, { type: "FA_OFFER", offer: { playerId: "tee-higgins", teamId: "NE", years: 4, aav: 40 * M, guaranteedPct: 0.8 } });
    s = reduce(s, { type: "FA_ADVANCE" });
    const higgins = s.players["tee-higgins"];
    expect(higgins.teamId).toBe("NE");
    expect(higgins.contract?.totalValue).toBe(160 * M);
    expect(s.transactions.filter((t) => t.kind === "SIGN" && t.playerId === "tee-higgins").length).toBe(1);
    // Rest of the league moved too.
    expect(s.transactions.filter((t) => t.kind === "SIGN").length).toBeGreaterThan(1);
  });

  it("other teams sign free agents on their own over five days", () => {
    let s = throughAudit(createRun(NE_2025, 3));
    s = reduce(s, { type: "CONFIRM_NEEDS" });
    const start = freeAgents(s).length;
    for (let i = 0; i < 5; i++) s = reduce(s, { type: "FA_ADVANCE" });
    expect(s.phase).toBe("TRADE_WINDOW");
    expect(freeAgents(s).length).toBeLessThan(start * 0.7);
    // No player appears on two teams.
    const ids = Object.values(s.players).filter((p) => p.teamId).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("evaluates trades through the partner's context", () => {
    let s = throughAudit(createRun(NE_2025, 5));
    s = run(s, { type: "CONFIRM_NEEDS" }, { type: "FA_FINISH" });
    const ctx = tradeContext(s, NE_2025);
    // Rebuilding Tennessee should like a first-round pick for an older starter more than a contender would.
    const forPick = evaluateTrade(ctx, "NE", "TEN", [{ type: "PICK", id: "2025-2-38" }], [{ type: "PLAYER", id: "calvin-ridley" }]);
    expect(["POSSIBLE", "STRONG INTEREST"]).toContain(forPick.interest);
    // Nonsense: a late pick for a superstar.
    const lowball = evaluateTrade(ctx, "NE", "DAL", [{ type: "PICK", id: "2025-7-257" }], [{ type: "PLAYER", id: "micah-parsons" }]);
    expect(lowball.interest).toBe("LOW INTEREST");
    // Teams with a franchise QB don't want an expensive one.
    const qbDump = evaluateTrade(ctx, "NE", "BUF", [{ type: "PLAYER", id: "drake-maye" }], [{ type: "PICK", id: "2025-1-30" }]);
    expect(qbDump.reasons.join(" ")).toMatch(/aren't looking for a QB/);
  });

  it("an executed trade moves assets exactly once and a used pick cannot be traded again", () => {
    let s = throughAudit(createRun(NE_2025, 11));
    s = run(s, { type: "CONFIRM_NEEDS" }, { type: "FA_FINISH" });
    // Overpay so it is accepted deterministically.
    s = reduce(s, { type: "TRADE_EXECUTE", partner: "TEN", give: [{ type: "PICK", id: "2025-1-4" }], get: [{ type: "PLAYER", id: "calvin-ridley" }] });
    expect(s.lastTrade?.accepted).toBe(true);
    expect(s.picks["2025-1-4"].teamId).toBe("TEN");
    expect(s.players["calvin-ridley"].teamId).toBe("NE");
    expect(s.departed.TEN).toContain("calvin-ridley");
    // Can't give a pick we no longer own.
    const ctx = tradeContext(s, NE_2025);
    const again = evaluateTrade(ctx, "NE", "CLE", [{ type: "PICK", id: "2025-1-4" }], [{ type: "PLAYER", id: "jerry-jeudy" }]);
    expect(again.blockers[0]).toMatch(/don't own/);
  });

  it("runs the draft to the user's pick, lets the user select, then auto-drafts the rest", () => {
    let s = throughAudit(createRun(NE_2025, 21));
    s = run(s, { type: "CONFIRM_NEEDS" }, { type: "FA_FINISH" }, { type: "TRADE_DONE" });
    expect(s.phase).toBe("DRAFT");
    s = reduce(s, { type: "DRAFT_ADVANCE" });
    expect(userOnClock(s)).toBe(true);
    expect(currentPick(s)!.overall).toBe(4);
    expect(s.draft.log.length).toBe(3);
    const available = Object.values(s.prospects).find((p) => !s.drafted.includes(p.id))!;
    s = reduce(s, { type: "DRAFT_SELECT", prospectId: available.id });
    expect(s.players[available.id.replace(/^p-/, "")].teamId).toBe("NE");
    expect(s.picks["2025-1-4"].usedOnPlayerId).toBeDefined();
    expect(currentPick(s)!.overall).toBe(38);
    s = reduce(s, { type: "DRAFT_AUTO_REMAINING" });
    expect(s.phase).toBe("ROSTER");
    expect(s.draft.log.length).toBe(257);
    // No prospect drafted twice and no pick used twice.
    expect(new Set(s.drafted).size).toBe(s.drafted.length);
    const used = Object.values(s.picks).filter((p) => p.year === 2025).map((p) => p.usedOnPlayerId);
    expect(used.every(Boolean)).toBe(true);
    expect(new Set(used).size).toBe(used.length);
    expect(userRoster(s).filter((p) => p.exp === 0).length).toBe(11);
  });

  it("simulates a full season, stops at the deadline, finishes playoffs and produces a report", () => {
    let s = throughAudit(createRun(NE_2025, 42), "KEEP");
    s = run(s, { type: "CONFIRM_NEEDS" });
    for (let i = 0; i < 5; i++) s = reduce(s, { type: "FA_ADVANCE" });
    s = run(s, { type: "TRADE_DONE" }, { type: "DRAFT_AUTO_REMAINING" });
    expect(s.phase).toBe("ROSTER");
    s = reduce(s, { type: "START_SEASON" });
    expect(s.phase).toBe("SEASON");
    expect(s.schedule.filter((f) => f.homeId === "NE" || f.awayId === "NE").length).toBe(17);
    let guard = 0;
    while (s.phase === "SEASON" && guard++ < 30) s = reduce(s, { type: "SIM_WEEK" });
    expect(s.phase).toBe("DEADLINE");
    expect(s.week).toBe(NE_2025.scenario.deadlineWeek + 1);
    expect(s.deadline.note.length).toBeGreaterThan(10);
    s = reduce(s, { type: "DEADLINE_DONE" });
    while (s.phase === "SEASON" && guard++ < 60) s = reduce(s, { type: "SIM_WEEK" });
    expect(s.phase).toBe("PLAYOFFS");
    expect(s.seedings!.every((x) => x.seeds.length === 7)).toBe(true);
    while (s.phase === "PLAYOFFS" && guard++ < 80) s = reduce(s, { type: "SIM_PLAYOFF_ROUND" });
    expect(s.phase).toBe("REPORT");
    expect(s.playoffs.filter((g) => g.stage === "SB").length).toBe(1);
    expect(s.playoffs.length).toBe(13);
    expect(s.report!.score).toBeGreaterThanOrEqual(0);
    expect(s.report!.score).toBeLessThanOrEqual(100);
    expect(s.report!.dimensions.length).toBe(6);
    // Every team played 17.
    const games: Record<string, number> = {};
    for (const g of s.results) {
      games[g.homeId] = (games[g.homeId] ?? 0) + 1;
      games[g.awayId] = (games[g.awayId] ?? 0) + 1;
    }
    expect(Object.values(games).every((n) => n === 17)).toBe(true);
  });

  it("is reproducible from a seed", () => {
    const play = (seed: number) => {
      let s = throughAudit(createRun(NE_2025, seed), "CUT");
      s = run(s, { type: "CONFIRM_NEEDS" });
      for (let i = 0; i < 5; i++) s = reduce(s, { type: "FA_ADVANCE" });
      s = run(s, { type: "TRADE_DONE" }, { type: "DRAFT_AUTO_REMAINING" }, { type: "START_SEASON" });
      let guard = 0;
      while (s.phase !== "REPORT" && guard++ < 200) {
        if (s.phase === "SEASON") s = reduce(s, { type: "SIM_WEEK" });
        else if (s.phase === "DEADLINE") s = reduce(s, { type: "DEADLINE_DONE" });
        else if (s.phase === "PLAYOFFS") s = reduce(s, { type: "SIM_PLAYOFF_ROUND" });
      }
      return s;
    };
    const a = play(99);
    const b = play(99);
    const c = play(100);
    expect(a.results).toEqual(b.results);
    expect(a.report).toEqual(b.report);
    expect(a.results).not.toEqual(c.results);
  });

  it("a much stronger roster wins materially more often", () => {
    const winsFor = (boost: number) => {
      let total = 0;
      for (let seed = 1; seed <= 6; seed++) {
        let s = throughAudit(createRun(NE_2025, seed * 13));
        for (const p of userRoster(s)) p.ability.ovr = Math.min(99, p.ability.ovr + boost);
        s = run(s, { type: "CONFIRM_NEEDS" }, { type: "FA_FINISH" }, { type: "TRADE_DONE" }, { type: "DRAFT_AUTO_REMAINING" }, { type: "START_SEASON" });
        let guard = 0;
        while (s.phase !== "PLAYOFFS" && guard++ < 60) s = reduce(s, s.phase === "DEADLINE" ? { type: "DEADLINE_DONE" } : { type: "SIM_WEEK" });
        const st = s.results.filter((g) => g.stage === "REG").reduce((w, g) => {
          const ne = g.homeId === "NE" ? [g.homeScore, g.awayScore] : g.awayId === "NE" ? [g.awayScore, g.homeScore] : null;
          return ne && ne[0] > ne[1] ? w + 1 : w;
        }, 0);
        total += st;
      }
      return total / 6;
    };
    expect(winsFor(15)).toBeGreaterThan(winsFor(0) + 3);
  });
});
