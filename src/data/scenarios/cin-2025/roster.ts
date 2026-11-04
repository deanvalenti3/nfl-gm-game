import { M, min1, player, rookie, vet } from "@/data/build";
import type { Player, Position } from "@/domain/types";

/**
 * Cincinnati Bengals as of 10 March 2025. Ja'Marr Chase is under his fifth-year option with an
 * extension pending; Tee Higgins, Mike Gesicki and B.J. Hill are free agents handled in the audit.
 */

type Spec =
  | ["v", number, number, number, number, number[]?]
  | ["r", number, number, number]
  | ["m", number?];

type Row = [name: string, pos: Position, age: number, exp: number, ovr: number, spec: Spec, opts?: { d?: number; t?: number; college?: string }];

const rows: Row[] = [
  ["Joe Burrow", "QB", 28, 5, 94, ["v", 2023, 2029, 275 * M, 219 * M, [8.9 * M, 29.6 * M, 46.3 * M, 46.3 * M, 46.3 * M, 46.3 * M, 46.3 * M]], { d: 70, college: "LSU" }],
  ["Jake Browning", "QB", 29, 4, 62, ["v", 2024, 2025, 5 * M, 2 * M]],
  ["Chase Brown", "RB", 25, 2, 76, ["r", 2023, 163, 2], { t: 1 }],
  ["Zack Moss", "RB", 27, 5, 68, ["v", 2024, 2025, 8 * M, 3 * M], { d: 60 }],
  ["Ja'Marr Chase", "WR", 25, 4, 97, ["v", 2025, 2028, 161 * M, 112 * M, [23.6 * M, 36 * M, 46 * M, 46 * M]]],
  ["Andrei Iosivas", "WR", 25, 2, 66, ["r", 2023, 206, 2], { t: 1 }],
  ["Jermaine Burton", "WR", 23, 1, 58, ["r", 2024, 80, 3]],
  ["Charlie Jones", "WR", 26, 2, 60, ["r", 2023, 131, 2]],
  ["Drew Sample", "TE", 28, 6, 62, ["v", 2024, 2026, 7.5 * M, 3 * M]],
  ["Erick All", "TE", 24, 1, 64, ["r", 2024, 115, 3], { d: 50 }],
  ["Tanner Hudson", "TE", 30, 6, 60, ["m"]],
  ["Orlando Brown Jr.", "OT", 29, 7, 75, ["v", 2023, 2026, 64 * M, 31 * M, [8.9 * M, 14.4 * M, 18.9 * M, 21.6 * M]]],
  ["Amarius Mims", "OT", 23, 1, 68, ["r", 2024, 18, 3], { t: 2 }],
  ["Cody Ford", "OT", 28, 6, 62, ["v", 2025, 2026, 4.5 * M, 1.5 * M]],
  ["Cordell Volson", "G", 27, 3, 60, ["r", 2022, 136, 1]],
  ["Alex Cappa", "G", 30, 7, 58, ["v", 2022, 2025, 35 * M, 11 * M, [3.5 * M, 9.5 * M, 10.5 * M, 9.5 * M]], { t: -2 }],
  ["Ted Karras", "C", 32, 9, 74, ["v", 2024, 2026, 18 * M, 7 * M], { t: -1 }],
  ["Matt Lee", "C", 24, 1, 54, ["r", 2024, 237, 3]],
  ["Trey Hill", "G", 25, 4, 56, ["m"]],
  ["Trey Hendrickson", "EDGE", 30, 8, 90, ["v", 2023, 2025, 63 * M, 30 * M, [15 * M, 18.7 * M, 18.7 * M]], { t: -1 }],
  ["Sam Hubbard", "EDGE", 30, 7, 68, ["v", 2024, 2026, 30 * M, 12 * M, [7 * M, 9.6 * M, 13.4 * M]], { t: -1, d: 60 }],
  ["Myles Murphy", "EDGE", 24, 2, 62, ["r", 2023, 28, 2], { t: 1, d: 60 }],
  ["Joseph Ossai", "EDGE", 25, 3, 64, ["v", 2025, 2025, 7 * M, 6 * M]],
  ["Cam Sample", "EDGE", 26, 4, 60, ["v", 2024, 2025, 4 * M, 1 * M]],
  ["Kris Jenkins", "DT", 23, 1, 62, ["r", 2024, 49, 3], { t: 2 }],
  ["McKinnley Jackson", "DT", 23, 1, 58, ["r", 2024, 97, 3]],
  ["Sheldon Rankins", "DT", 31, 9, 64, ["v", 2024, 2025, 24.5 * M, 12 * M, [12.9 * M, 11.6 * M]], { t: -2, d: 60 }],
  ["Jay Tufele", "DT", 26, 4, 58, ["m"]],
  ["Logan Wilson", "LB", 28, 5, 70, ["v", 2024, 2027, 37 * M, 12 * M, [3.1 * M, 9.6 * M, 11.9 * M, 12.4 * M]]],
  ["Germaine Pratt", "LB", 29, 6, 70, ["v", 2023, 2025, 20.25 * M, 8 * M, [4.8 * M, 7 * M, 8.4 * M]]],
  ["Akeem Davis-Gaither", "LB", 27, 5, 64, ["v", 2025, 2026, 11 * M, 5 * M]],
  ["Maema Njongmeta", "LB", 24, 1, 56, ["m"]],
  ["Joe Bachie", "LB", 27, 4, 58, ["m"]],
  ["Cam Taylor-Britt", "CB", 25, 3, 66, ["r", 2022, 60, 1]],
  ["DJ Turner II", "CB", 24, 2, 66, ["r", 2023, 60, 2], { t: 1 }],
  ["Dax Hill", "CB", 24, 3, 64, ["r", 2022, 31, 1], { d: 55 }],
  ["Josh Newton", "CB", 24, 1, 60, ["r", 2024, 149, 3]],
  ["Jalen Davis", "CB", 29, 6, 56, ["m"]],
  ["Geno Stone", "S", 26, 5, 64, ["v", 2024, 2025, 15 * M, 7 * M, [7.7 * M, 7.3 * M]]],
  ["Jordan Battle", "S", 25, 2, 64, ["r", 2023, 95, 2], { t: 1 }],
  ["Tycen Anderson", "S", 26, 3, 56, ["m"]],
  ["Daijahn Anthony", "S", 24, 1, 54, ["r", 2024, 224, 3]],
  ["Evan McPherson", "K", 25, 4, 74, ["v", 2024, 2026, 13.5 * M, 5 * M]],
  ["Ryan Rehkow", "P", 26, 1, 62, ["m"]],
  ["Cal Adomitis", "LS", 26, 3, 60, ["m"]],
];

function build(spec: Spec) {
  if (spec[0] === "v") return vet({ start: spec[1], end: spec[2], total: spec[3], gtd: spec[4], hits: spec[5] });
  if (spec[0] === "r") return rookie(spec[1], spec[2], spec[3]);
  return min1(2025, spec[1]);
}

export const CIN_ROSTER: Player[] = rows.map(([name, pos, age, exp, ovr, spec, opts]) =>
  player({ name, pos, age, exp, ovr, teamId: "CIN", contract: build(spec), durability: opts?.d, trajectory: opts?.t, college: opts?.college }),
);
