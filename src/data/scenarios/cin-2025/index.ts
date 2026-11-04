import { M } from "@/data/build";
import { buildPicks } from "@/data/picks-2025";
import { TEAMS } from "@/data/teams";
import type { ScenarioSnapshot, TeamProfile } from "@/domain/types";
import { FREE_AGENTS } from "../ne-2025/free-agents";
import { LEAGUE_PLAYERS, LEAGUE_PROFILES } from "../ne-2025/league";
import { PROSPECTS_2025 } from "../ne-2025/prospects";
import { CIN_ROSTER } from "./roster";
import { STATS_2024 } from "./stats";

const CIN_PROFILE: TeamProfile = {
  teamId: "CIN",
  status: "FRINGE",
  qb: "FRANCHISE",
  capSpace: Math.round(46 * M),
  needs: ["EDGE", "G", "S", "LB", "DT"],
  units: { qb: 94, offSkill: 88, oLine: 70, passRush: 72, runDefense: 62, coverage: 64, specialTeams: 70, depth: 60 },
};

const rosterIds = new Set(CIN_ROSTER.map((p) => p.id));

export const CIN_2025: ScenarioSnapshot = {
  version: 1,
  scenario: {
    id: "cin-2025",
    title: "Cincinnati · 2025 Offseason",
    subtitle: "Burrow's window is open and the cap is tight. Can you fix the defense without breaking up the offense?",
    season: 2025,
    teamId: "CIN",
    cutoffDate: "2025-03-10",
    salaryCap: Math.round(279.2 * M),
    carryover: Math.round(6 * M),
    minRosterForSeason: 46,
    objective: {
      headline: "Beat the real Bengals. Your season is judged against what Cincinnati actually did in 2025.",
      targetWins: 9,
      playoffsRequired: false,
    },
    defaultScheme: { offense: "SPREAD", defense: "FOUR_THREE" },
    realResult: { w: 7, l: 10, t: 0, playoffDepth: 0, label: "7–10 · Missed playoffs · Burrow lost 10 games to a toe injury" },
    keyProblems: ["EDGE", "G", "S", "LB"],
    briefingNotes: [
      "Joe Burrow and Ja'Marr Chase are the best QB-WR pair in football. Everything else is a question.",
      "Tee Higgins, Mike Gesicki and B.J. Hill are free agents. Trey Hendrickson wants a new deal and may ask out.",
      "The defense finished bottom-ten in points allowed. Two veteran contracts can be cleared for about $17M.",
    ],
    auditDecisions: [
      {
        id: "higgins",
        playerId: "tee-higgins",
        prompt: "Tee Higgins is a free agent. The franchise tag is $26.2M for one year.",
        context: "73 catches and 10 touchdowns in 12 games last year, but he's missed 10 games in two seasons. The tag keeps him; a long-term deal would run $28M+ a year for four years.",
        options: ["TAG", "RESIGN", "WALK"],
        terms: { TAG: { years: 1, aav: 26.2 * M, guaranteedPct: 1 }, RESIGN: { years: 4, aav: 28.75 * M, guaranteedPct: 0.6 } },
      },
      {
        id: "hendrickson",
        playerId: "trey-hendrickson",
        prompt: "Trey Hendrickson led the NFL in sacks and wants to be paid like it.",
        context: "One year left at $18.7M. He's 30. Keep him and he plays angry; shop him and a contender will pay a premium pick for 17.5 sacks.",
        options: ["KEEP", "TRADE"],
      },
      {
        id: "cappa",
        playerId: "alex-cappa",
        prompt: "Alex Cappa was the worst-graded starting guard in the league.",
        context: "$9.5M cap hit on the last year of his deal. Cutting him saves $8M and leaves Cordell Volson and a rookie at guard.",
        options: ["KEEP", "CUT"],
      },
      {
        id: "rankins",
        playerId: "sheldon-rankins",
        prompt: "Sheldon Rankins played seven games and had one sack for $12.9M.",
        context: "$11.6M this year, last year of the deal. Cutting him saves most of it. The interior behind him is two second-year players.",
        options: ["KEEP", "CUT"],
      },
      {
        id: "pratt",
        playerId: "germaine-pratt",
        prompt: "Germaine Pratt has asked for a trade.",
        context: "Started every game, 143 tackles, two picks, and an $8.4M cap hit on an expiring deal. Logan Wilson is signed; Pratt isn't.",
        options: ["KEEP", "TRADE", "CUT"],
      },
      {
        id: "gesicki",
        playerId: "mike-gesicki",
        prompt: "Mike Gesicki wants to come back. His agent's number is three years, $25.5M.",
        context: "65 catches and 665 yards as Burrow's safety valve. Erick All is coming off an ACL. Re-sign before the market opens, or see what else is out there.",
        options: ["RESIGN", "WALK"],
        terms: { RESIGN: { years: 3, aav: 8.5 * M, guaranteedPct: 0.6 } },
      },
    ],
    deadlineWeek: 9,
  },
  teams: TEAMS,
  profiles: [CIN_PROFILE, ...LEAGUE_PROFILES.filter((p) => p.teamId !== "CIN")],
  players: [...CIN_ROSTER, ...LEAGUE_PLAYERS.filter((p) => p.teamId !== "CIN" && !rosterIds.has(p.id)), ...FREE_AGENTS].map((p) => ({ ...p, stats: STATS_2024[p.id] })),
  picks: buildPicks("CIN", [17, 49, 81, 119, 153, 193]),
  prospects: PROSPECTS_2025,
};
