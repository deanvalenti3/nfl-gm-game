import type { DraftPick, DraftProspect, Player, Team } from "@/domain/types";
import type { NflDataProvider } from "./index";
import { TEAMS } from "@/data/teams";
import { slug } from "@/data/build";

/**
 * nflverse adapter. Reads the public CSV releases and maps them into the domain model.
 * Used by the ingest script; not bundled into the game at play time.
 *
 * Release URLs verified 2026-11-04 (see docs/02-data-sources.md).
 */
const BASE = "https://github.com/nflverse/nflverse-data/releases/download";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = splitRow(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function splitRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

const POS_MAP: Record<string, Player["pos"]> = {
  QB: "QB", RB: "RB", FB: "RB", WR: "WR", TE: "TE", T: "OT", OT: "OT", OL: "OT", G: "G", OG: "G", C: "C",
  DE: "EDGE", OLB: "EDGE", EDGE: "EDGE", DT: "DT", NT: "DT", DL: "DT", LB: "LB", ILB: "LB", MLB: "LB",
  CB: "CB", DB: "CB", S: "S", FS: "S", SS: "S", K: "K", P: "P", LS: "LS",
};

export class NflverseProvider implements NflDataProvider {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  private async csv(release: string, file: string) {
    const res = await this.fetchImpl(`${BASE}/${release}/${file}`);
    if (!res.ok) throw new Error(`nflverse ${release}/${file}: ${res.status}`);
    return parseCsv(await res.text());
  }

  async teams(): Promise<Team[]> {
    return TEAMS;
  }

  async roster(season: number, teamId: string, asOf: string): Promise<Player[]> {
    const rows = await this.csv("rosters", `roster_${season}.csv`);
    const cutoffYear = Number(asOf.slice(0, 4));
    return rows
      .filter((r) => r.team === teamId && POS_MAP[r.position])
      .map((r) => ({
        id: r.gsis_id || slug(r.full_name),
        name: r.full_name,
        pos: POS_MAP[r.position],
        age: r.birth_date ? cutoffYear - Number(r.birth_date.slice(0, 4)) : 26,
        exp: Number(r.years_exp || 0),
        college: r.college || undefined,
        teamId,
        contract: null, // filled by ContractDataProvider
        ability: { ovr: 60, trajectory: 0, durability: 85 }, // filled by the quality model
      }));
  }

  async draftPicks(year: number): Promise<DraftPick[]> {
    const rows = await this.csv("draft_picks", "draft_picks.csv");
    return rows
      .filter((r) => Number(r.season) === year)
      .map((r) => ({ id: `${year}-${r.round}-${r.pick}`, year, round: Number(r.round), overall: Number(r.pick), originalTeamId: r.team, teamId: r.team }));
  }

  async draftClass(year: number): Promise<DraftProspect[]> {
    // The real selections tell us who was in the class; grades must still be curated by hand
    // from pre-draft consensus so historical scenarios keep their information cutoff.
    const rows = await this.csv("draft_picks", "draft_picks.csv");
    return rows
      .filter((r) => Number(r.season) === year && POS_MAP[r.position])
      .map((r) => ({
        id: `p-${slug(r.pfr_player_name || r.gsis_id)}`,
        name: r.pfr_player_name,
        pos: POS_MAP[r.position],
        school: r.college,
        age: Number(r.age || 22),
        grade: "C",
        projectedRange: [Number(r.pick), Number(r.pick)],
        athletic: "AVERAGE",
        production: "SOLID",
        risk: "MEDIUM",
        trueOvr: 55,
        ceiling: 70,
      }));
  }
}
