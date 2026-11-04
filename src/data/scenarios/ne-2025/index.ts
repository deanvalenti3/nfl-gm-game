import { M } from "@/data/build";
import { TEAMS } from "@/data/teams";
import type { ScenarioSnapshot, TeamProfile } from "@/domain/types";
import { FREE_AGENTS } from "./free-agents";
import { LEAGUE_PLAYERS, LEAGUE_PROFILES } from "./league";
import { PICKS } from "./picks";
import { PROSPECTS_2025 } from "./prospects";
import { NE_ROSTER } from "./roster";
import { STATS_2024 } from "./stats";

const NE_PROFILE: TeamProfile = {
  teamId: "NE",
  status: "REBUILDING",
  qb: "YOUNG STARTER",
  capSpace: Math.round(119.8 * M),
  needs: ["OT", "WR", "EDGE", "DT", "LB"],
  // Not used for NE: its full roster drives the rating. Kept for shape parity.
  units: { qb: 74, offSkill: 62, oLine: 58, passRush: 60, runDefense: 66, coverage: 72, specialTeams: 70, depth: 56 },
};

export const NE_2025: ScenarioSnapshot = {
  version: 1,
  scenario: {
    id: "ne-2025",
    title: "New England · 2025 Offseason",
    subtitle: "Can you rebuild a 4–13 team around a second-year quarterback?",
    season: 2025,
    teamId: "NE",
    cutoffDate: "2025-03-10",
    salaryCap: Math.round(279.2 * M),
    carryover: Math.round(22 * M),
    minRosterForSeason: 46,
    objective: {
      headline: "Beat the real Patriots. Your season is judged against what New England actually did in 2025.",
      targetWins: 9,
      playoffsRequired: false,
    },
    defaultScheme: { offense: "SPREAD", defense: "FOUR_THREE" },
    realResult: { w: 14, l: 3, t: 0, playoffDepth: 4, label: "14–3 · AFC East champions · Lost Super Bowl LX" },
    keyProblems: ["OT", "WR", "EDGE", "DT"],
    briefingNotes: [
      "Drake Maye flashed as a rookie behind the league's worst pass protection.",
      "Most cap space in the NFL, but a roster with few blue-chip players outside the secondary.",
      "Three starters are entering free agency. One expensive veteran safety could be moved.",
    ],
    auditDecisions: [
      {
        id: "andrews",
        playerId: "david-andrews",
        prompt: "Your 32-year-old captain at center is coming off shoulder surgery.",
        context: "David Andrews carries a $6.4M cap hit on the last year of his deal. Cutting him saves $4.4M and opens a hole at center.",
        options: ["KEEP", "CUT"],
      },
      {
        id: "dugger",
        playerId: "kyle-dugger",
        prompt: "Kyle Dugger's extension is starting to look heavy for a box safety.",
        context: "$12.7M this year, rising to $17M. Cutting him now leaves $14.4M in dead money. A trade partner would take most of that off your books.",
        options: ["KEEP", "CUT", "TRADE"],
      },
      {
        id: "bourne",
        playerId: "kendrick-bourne",
        prompt: "Kendrick Bourne is your highest-paid receiver and was your fourth-best one.",
        context: "$7.6M cap hit, two years left. Cutting him saves $5.5M. Your receiver room would then be DeMario Douglas and rookies.",
        options: ["KEEP", "CUT"],
      },
      {
        id: "godchaux",
        playerId: "davon-godchaux",
        prompt: "Davon Godchaux is a 30-year-old nose tackle on a $9.1M cap hit.",
        context: "Solid against the run, nothing as a pass rusher. A contender with a hole up front might give you a late pick.",
        options: ["KEEP", "TRADE", "CUT"],
      },
      {
        id: "peppers",
        playerId: "jabrill-peppers",
        prompt: "Jabrill Peppers is your other safety on a mid-size deal.",
        context: "$7.6M this year with $5.2M dead if cut. Keeping both him and Dugger means $20M in box safeties.",
        options: ["KEEP", "CUT"],
      },
    ],
    deadlineWeek: 9,
  },
  teams: TEAMS,
  profiles: [NE_PROFILE, ...LEAGUE_PROFILES.filter((p) => p.teamId !== "NE")],
  players: [...NE_ROSTER, ...LEAGUE_PLAYERS.filter((p) => p.teamId !== "NE"), ...FREE_AGENTS].map((p) => ({ ...p, stats: STATS_2024[p.id] })),
  picks: PICKS,
  prospects: PROSPECTS_2025,
};
