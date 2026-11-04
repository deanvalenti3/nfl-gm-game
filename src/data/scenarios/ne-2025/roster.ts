import { M, min1, player, rookie, vet } from "@/data/build";
import type { Player, Position } from "@/domain/types";

/**
 * New England Patriots as of 10 March 2025 (cutoff), before the legal tampering window.
 * Contracts are approximations of the public numbers (OverTheCap / Spotrac) in the shape
 * the ingest script produces.
 */

type Spec =
  | ["v", number, number, number, number, number[]?]
  | ["r", number, number, number]
  | ["m", number?];

type Row = [name: string, pos: Position, age: number, exp: number, ovr: number, spec: Spec, opts?: { d?: number; t?: number; college?: string }];

const rows: Row[] = [
  ["Drake Maye", "QB", 22, 1, 74, ["r", 2024, 3, 3], { t: 3, college: "North Carolina" }],
  ["Joe Milton III", "QB", 25, 1, 58, ["r", 2024, 193, 3], { t: 1 }],
  ["Rhamondre Stevenson", "RB", 27, 4, 73, ["v", 2024, 2028, 36 * M, 17 * M]],
  ["Antonio Gibson", "RB", 27, 5, 68, ["v", 2024, 2026, 11.25 * M, 5.5 * M]],
  ["Terrell Jennings", "RB", 24, 1, 50, ["m"]],
  ["Kendrick Bourne", "WR", 29, 8, 66, ["v", 2024, 2026, 19.5 * M, 8 * M, [4.9 * M, 7.6 * M, 7.8 * M]], { t: -1 }],
  ["DeMario Douglas", "WR", 24, 2, 69, ["r", 2023, 210, 2], { t: 1 }],
  ["Kayshon Boutte", "WR", 23, 2, 65, ["r", 2023, 187, 2], { t: 1 }],
  ["Ja'Lynn Polk", "WR", 23, 1, 58, ["r", 2024, 37, 3], { t: 1 }],
  ["Javon Baker", "WR", 23, 1, 52, ["r", 2024, 110, 3]],
  ["Hunter Henry", "TE", 30, 9, 74, ["v", 2024, 2026, 27 * M, 16 * M, [5.6 * M, 9.5 * M, 11.9 * M]], { t: -1 }],
  ["Jack Westover", "TE", 24, 1, 55, ["m"]],
  ["Jaheim Bell", "TE", 23, 1, 54, ["r", 2024, 231, 3]],
  ["Mike Onwenu", "OT", 27, 5, 79, ["v", 2024, 2026, 57 * M, 38 * M, [8.1 * M, 18.9 * M, 21.3 * M]]],
  ["Vederian Lowe", "OT", 26, 4, 60, ["v", 2025, 2026, 5.5 * M, 2.5 * M]],
  ["Caedan Wallace", "OT", 24, 1, 57, ["r", 2024, 68, 3]],
  ["Demontrey Jacobs", "OT", 26, 2, 55, ["m"]],
  ["Cole Strange", "G", 26, 3, 62, ["r", 2022, 29, 1], { d: 65 }],
  ["Layden Robinson", "G", 23, 1, 58, ["r", 2024, 103, 3]],
  ["Sidy Sow", "G", 25, 2, 59, ["r", 2023, 117, 2]],
  ["Michael Jordan", "G", 27, 6, 56, ["m"]],
  ["David Andrews", "C", 32, 10, 72, ["v", 2024, 2025, 12.5 * M, 6 * M, [4.4 * M, 6.4 * M]], { t: -2, d: 60 }],
  ["Ben Brown", "C", 27, 3, 58, ["m"]],
  ["Christian Barmore", "DT", 25, 4, 82, ["v", 2025, 2028, 84 * M, 41.8 * M, [9.9 * M, 20.5 * M, 24.8 * M, 25.8 * M]], { d: 60 }],
  ["Davon Godchaux", "DT", 30, 8, 71, ["v", 2025, 2026, 19 * M, 8 * M, [9.1 * M, 9.9 * M]], { t: -1 }],
  ["Jeremiah Pharms", "DT", 27, 3, 60, ["m"]],
  ["Jaquelin Roy", "DT", 24, 2, 56, ["m"]],
  ["Keion White", "EDGE", 26, 2, 71, ["r", 2023, 46, 2]],
  ["Anfernee Jennings", "EDGE", 28, 5, 67, ["v", 2024, 2025, 12 * M, 5 * M, [4.4 * M, 7.6 * M]]],
  ["Titus Leo", "EDGE", 25, 2, 54, ["m"]],
  ["Ja'Whaun Bentley", "LB", 28, 7, 72, ["v", 2024, 2025, 19 * M, 9 * M, [7.5 * M, 9.1 * M]], { d: 65 }],
  ["Jahlani Tavai", "LB", 28, 6, 68, ["v", 2025, 2027, 15 * M, 5 * M]],
  ["Marte Mapu", "LB", 25, 2, 60, ["r", 2023, 76, 2]],
  ["Sione Takitaki", "LB", 30, 6, 63, ["v", 2024, 2025, 6.5 * M, 2.5 * M]],
  ["Raekwon McMillan", "LB", 29, 7, 58, ["m"]],
  ["Christian Gonzalez", "CB", 22, 2, 84, ["r", 2023, 17, 2], { t: 2 }],
  ["Marcus Jones", "CB", 26, 3, 72, ["r", 2022, 85, 1]],
  ["Alex Austin", "CB", 24, 2, 62, ["m"]],
  ["Marco Wilson", "CB", 26, 4, 57, ["m"]],
  ["Isaiah Bolden", "CB", 25, 2, 52, ["m"]],
  ["Kyle Dugger", "S", 29, 5, 73, ["v", 2024, 2027, 58 * M, 32.5 * M, [8 * M, 12.7 * M, 15.3 * M, 17 * M]], { t: -1 }],
  ["Jabrill Peppers", "S", 29, 7, 70, ["v", 2024, 2026, 24 * M, 12 * M, [5.2 * M, 7.6 * M, 8.5 * M]], { t: -1 }],
  ["Jaylinn Hawkins", "S", 27, 5, 63, ["v", 2024, 2025, 5.5 * M, 2 * M]],
  ["Dell Pettus", "S", 25, 1, 55, ["m"]],
  ["Brenden Schooler", "S", 27, 3, 60, ["v", 2025, 2027, 10.5 * M, 4 * M]],
  ["Joey Slye", "K", 28, 7, 70, ["m", 1.4 * M]],
  ["Bryce Baringer", "P", 25, 2, 71, ["r", 2023, 192, 2]],
  ["Joe Cardona", "LS", 32, 10, 70, ["v", 2024, 2027, 7.5 * M, 2.5 * M]],
];

function build(spec: Spec) {
  if (spec[0] === "v") return vet({ start: spec[1], end: spec[2], total: spec[3], gtd: spec[4], hits: spec[5] });
  if (spec[0] === "r") return rookie(spec[1], spec[2], spec[3]);
  return min1(2025, spec[1]);
}

export const NE_ROSTER: Player[] = rows.map(([name, pos, age, exp, ovr, spec, opts]) =>
  player({ name, pos, age, exp, ovr, teamId: "NE", contract: build(spec), durability: opts?.d, trajectory: opts?.t, college: opts?.college }),
);
