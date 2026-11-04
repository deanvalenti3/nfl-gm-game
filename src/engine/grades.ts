import type { Player, Position, SeasonStats } from "@/domain/types";
import { hashString } from "./rng";

/**
 * Public scouting grades. The GM sees a letter; the engine keeps the number.
 * The letter is the scouting department's read: true talent blurred by a band that is
 * wider for young players, small samples and rookies. That blur is where hidden gems live.
 * Deterministic per player id, so the read is consistent across a run and across players.
 */

export type Grade = "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D";

const THRESHOLDS: [number, Grade][] = [
  [90, "A+"], [86, "A"], [82, "A-"], [78, "B+"], [74, "B"], [70, "B-"], [66, "C+"], [62, "C"], [58, "C-"],
];

export function letterFor(value: number): Grade {
  for (const [min, g] of THRESHOLDS) if (value >= min) return g;
  return "D";
}

function seededGauss(seed: string): number {
  const h = hashString(seed);
  const u1 = ((h & 0xffff) + 1) / 65537;
  const u2 = (((h >>> 16) & 0xffff) + 1) / 65537;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** How far the public read can miss, in rating points. */
export function uncertainty(p: Player): number {
  let sd = 1.5;
  if (p.age <= 24) sd += 1.5;
  if (p.exp === 0) sd += 2.5;
  if ((p.stats?.gp ?? 17) < 8) sd += 2;
  if ((p.stats?.snapPct ?? 100) < 40) sd += 1.5;
  return sd;
}

/** The letter a GM sees for this player. */
export function publicGrade(p: Player): Grade {
  const perceived = p.ability.ovr + seededGauss(`grade:${p.id}`) * uncertainty(p);
  return letterFor(perceived);
}

export function gradeTone(g: Grade): "up" | "even" | "neutral" | "down" {
  if (g.startsWith("A")) return "up";
  if (g.startsWith("B")) return "even";
  if (g.startsWith("C")) return "neutral";
  return "down";
}

/** One line of last season's numbers, chosen by position. */
export function statLine(pos: Position, s: SeasonStats | undefined): string {
  if (!s || !s.gp) return "Did not play last season";
  const gp = `${s.gp} GP`;
  switch (pos) {
    case "QB":
      return s.pass ? `${gp} · ${Math.round((s.pass.cmp / Math.max(1, s.pass.att)) * 100)}% · ${fmtNum(s.pass.yds)} yds · ${s.pass.td} TD / ${s.pass.int} INT` : `${gp} · no passing stats`;
    case "RB":
      return s.rush ? `${gp} · ${s.rush.att} att · ${fmtNum(s.rush.yds)} yds · ${(s.rush.yds / Math.max(1, s.rush.att)).toFixed(1)} YPC · ${s.rush.td + (s.rec?.td ?? 0)} TD${s.rec ? ` · ${s.rec.rec} rec` : ""}` : `${gp} · ${s.rec?.rec ?? 0} rec`;
    case "WR":
    case "TE":
      return s.rec ? `${gp} · ${s.rec.rec} rec · ${fmtNum(s.rec.yds)} yds · ${s.rec.td} TD` : `${gp} · no receiving stats`;
    case "OT":
    case "G":
    case "C":
      return `${gp} · ${s.gs ?? 0} starts · ${s.snapPct ?? 0}% snaps`;
    case "EDGE":
    case "DT":
      return s.def ? `${gp} · ${s.def.sk} sacks · ${s.def.tfl} TFL · ${s.def.qbh} QB hits · ${s.def.tkl} tkl` : gp;
    case "LB":
      return s.def ? `${gp} · ${s.def.tkl} tkl · ${s.def.tfl} TFL · ${s.def.sk} sacks · ${s.def.pd} PD` : gp;
    case "CB":
    case "S":
      return s.def ? `${gp} · ${s.def.tkl} tkl · ${s.def.int} INT · ${s.def.pd} PD · ${s.def.tfl} TFL` : gp;
    case "K":
      return s.kick ? `${gp} · ${s.kick.fgm}/${s.kick.fga} FG · long ${s.kick.long}` : gp;
    default:
      return gp;
  }
}

function fmtNum(n: number) {
  return n.toLocaleString("en-US");
}
