/**
 * Ingest previous-season stats from nflverse for every player in a snapshot.
 *
 *   npx vite-node scripts/build-stats.ts <dir-with-csvs> <scenario-id> <season>
 *
 * Expects in <dir>: player_stats_<season>.csv, player_stats_def_<season>.csv,
 * player_stats_kicking_<season>.csv, snap_counts_<season>.csv (all from
 * https://github.com/nflverse/nflverse-data/releases). Writes
 * src/data/scenarios/<scenario-id>/stats.ts. Run at build time only.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getScenario } from "@/data/scenarios";
import { slug } from "@/data/build";
import type { SeasonStats } from "@/domain/types";

const [dir, scenarioId, seasonArg] = process.argv.slice(2);
if (!dir || !scenarioId || !seasonArg) throw new Error("usage: build-stats <dir> <scenario-id> <season>");
const season = Number(seasonArg);
const snapshot = getScenario(scenarioId);
if (!snapshot) throw new Error(`unknown scenario ${scenarioId}`);

function csv(file: string): Record<string, string>[] {
  const text = readFileSync(join(dir, file), "utf8");
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = split(lines[0]);
  return lines.slice(1).map((l) => Object.fromEntries(headers.map((h, i) => [h, split(l)[i] ?? ""])));
}
function split(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
const n = (v: string) => Number(v) || 0;
/** Snapshot name → name as nflverse/PFR spell it. */
const ALIASES: Record<string, string> = {
  "Mike Onwenu": "Michael Onwenu", "Greg Rousseau": "Gregory Rousseau", "Olu Fashanu": "Olumuyiwa Fashanu", "Cam Heyward": "Cameron Heyward",
  "Foye Oluokun": "Foyesade Oluokun", "Pat Surtain II": "Patrick Surtain", "DJ Moore": "D.J. Moore", "Cam Jordan": "Cameron Jordan",
  "Abe Lucas": "Abraham Lucas", "Matthew Judon": "Matt Judon",
};
const key = (name: string) => slug((ALIASES[name] ?? name).replace(/\b(Jr|Sr|II|III|IV)\.?$/i, "").trim());

const byName = new Map<string, SeasonStats>();
const weeks = new Map<string, Set<number>>();
const touch = (name: string) => {
  const k = key(name);
  if (!byName.has(k)) byName.set(k, { gp: 0 });
  return byName.get(k)!;
};
const seen = (name: string, week: number) => {
  const k = key(name);
  if (!weeks.has(k)) weeks.set(k, new Set());
  weeks.get(k)!.add(week);
};

for (const r of csv(`player_stats_${season}.csv`)) {
  if (r.season_type !== "REG") continue;
  const s = touch(r.player_display_name);
  seen(r.player_display_name, n(r.week));
  if (n(r.attempts)) {
    s.pass ??= { cmp: 0, att: 0, yds: 0, td: 0, int: 0 };
    s.pass.cmp += n(r.completions); s.pass.att += n(r.attempts); s.pass.yds += n(r.passing_yards); s.pass.td += n(r.passing_tds); s.pass.int += n(r.interceptions);
  }
  if (n(r.carries)) {
    s.rush ??= { att: 0, yds: 0, td: 0 };
    s.rush.att += n(r.carries); s.rush.yds += n(r.rushing_yards); s.rush.td += n(r.rushing_tds);
  }
  if (n(r.targets)) {
    s.rec ??= { rec: 0, yds: 0, td: 0 };
    s.rec.rec += n(r.receptions); s.rec.yds += n(r.receiving_yards); s.rec.td += n(r.receiving_tds);
  }
}
for (const r of csv(`player_stats_def_${season}.csv`)) {
  if (r.season_type !== "REG") continue;
  const s = touch(r.player_display_name);
  seen(r.player_display_name, n(r.week));
  s.def ??= { tkl: 0, tfl: 0, sk: 0, int: 0, pd: 0, qbh: 0 };
  s.def.tkl += n(r.def_tackles); s.def.tfl += n(r.def_tackles_for_loss); s.def.sk += n(r.def_sacks); s.def.int += n(r.def_interceptions); s.def.pd += n(r.def_pass_defended); s.def.qbh += n(r.def_qb_hits);
}
for (const r of csv(`player_stats_kicking_${season}.csv`)) {
  if (r.season_type !== "REG") continue;
  const s = touch(r.player_display_name);
  seen(r.player_display_name, n(r.week));
  s.kick ??= { fgm: 0, fga: 0, long: 0 };
  s.kick.fgm += n(r.fg_made); s.kick.fga += n(r.fg_att); s.kick.long = Math.max(s.kick.long, n(r.fg_long));
}
for (const r of csv(`snap_counts_${season}.csv`)) {
  if (r.game_type !== "REG") continue;
  const s = touch(r.player);
  seen(r.player, n(r.week));
  const share = Math.max(n(r.offense_pct), n(r.defense_pct));
  s.snapPct = Math.max(s.snapPct ?? 0, 0) + share; // summed; averaged below
  s.gs = (s.gs ?? 0) + (share >= 0.6 ? 1 : 0);
}
for (const [k, s] of byName) {
  s.gp = weeks.get(k)?.size ?? 0;
  if (s.snapPct !== undefined && s.gp) s.snapPct = Math.round((s.snapPct / s.gp) * 100);
}

const out: Record<string, SeasonStats> = {};
const missing: string[] = [];
for (const p of snapshot.players) {
  const s = byName.get(key(p.name));
  if (s && s.gp) out[p.id] = s;
  else missing.push(`${p.name} (${p.pos}, ${p.teamId ?? "FA"})`);
}

const target = join("src/data/scenarios", scenarioId, "stats.ts");
writeFileSync(
  target,
  `import type { SeasonStats } from "@/domain/types";\n\n/** ${season} regular-season stats from nflverse. Generated by scripts/build-stats.ts; do not edit by hand. */\nexport const STATS_${season}: Record<string, SeasonStats> = ${JSON.stringify(out)};\n`,
);
console.log(`wrote ${Object.keys(out).length} players to ${target}`);
console.log(`no stats for ${missing.length}: ${missing.join("; ")}`);
