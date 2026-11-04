import type { Team } from "@/domain/types";

type Row = [id: string, city: string, name: string, conf: "AFC" | "NFC", div: "East" | "North" | "South" | "West", primary: string, secondary: string, rank: number, w: number, l: number, t: number];

/** 2024 season results drive the 2025 draft order and schedule rotation. */
const ROWS: Row[] = [
  ["BUF", "Buffalo", "Bills", "AFC", "East", "#00338D", "#C60C30", 1, 13, 4, 0],
  ["MIA", "Miami", "Dolphins", "AFC", "East", "#008E97", "#FC4C02", 2, 8, 9, 0],
  ["NYJ", "New York", "Jets", "AFC", "East", "#125740", "#FFFFFF", 3, 5, 12, 0],
  ["NE", "New England", "Patriots", "AFC", "East", "#002244", "#C60C30", 4, 4, 13, 0],
  ["BAL", "Baltimore", "Ravens", "AFC", "North", "#241773", "#9E7C0C", 1, 12, 5, 0],
  ["PIT", "Pittsburgh", "Steelers", "AFC", "North", "#FFB612", "#101820", 2, 10, 7, 0],
  ["CIN", "Cincinnati", "Bengals", "AFC", "North", "#FB4F14", "#000000", 3, 9, 8, 0],
  ["CLE", "Cleveland", "Browns", "AFC", "North", "#311D00", "#FF3C00", 4, 3, 14, 0],
  ["HOU", "Houston", "Texans", "AFC", "South", "#03202F", "#A71930", 1, 10, 7, 0],
  ["IND", "Indianapolis", "Colts", "AFC", "South", "#002C5F", "#A2AAAD", 2, 8, 9, 0],
  ["JAX", "Jacksonville", "Jaguars", "AFC", "South", "#006778", "#D7A22A", 3, 4, 13, 0],
  ["TEN", "Tennessee", "Titans", "AFC", "South", "#0C2340", "#4B92DB", 4, 3, 14, 0],
  ["KC", "Kansas City", "Chiefs", "AFC", "West", "#E31837", "#FFB81C", 1, 15, 2, 0],
  ["LAC", "Los Angeles", "Chargers", "AFC", "West", "#0080C6", "#FFC20E", 2, 11, 6, 0],
  ["DEN", "Denver", "Broncos", "AFC", "West", "#FB4F14", "#002244", 3, 10, 7, 0],
  ["LV", "Las Vegas", "Raiders", "AFC", "West", "#000000", "#A5ACAF", 4, 4, 13, 0],
  ["PHI", "Philadelphia", "Eagles", "NFC", "East", "#004C54", "#A5ACAF", 1, 14, 3, 0],
  ["WAS", "Washington", "Commanders", "NFC", "East", "#5A1414", "#FFB612", 2, 12, 5, 0],
  ["DAL", "Dallas", "Cowboys", "NFC", "East", "#041E42", "#869397", 3, 7, 10, 0],
  ["NYG", "New York", "Giants", "NFC", "East", "#0B2265", "#A71930", 4, 3, 14, 0],
  ["DET", "Detroit", "Lions", "NFC", "North", "#0076B6", "#B0B7BC", 1, 15, 2, 0],
  ["MIN", "Minnesota", "Vikings", "NFC", "North", "#4F2683", "#FFC62F", 2, 14, 3, 0],
  ["GB", "Green Bay", "Packers", "NFC", "North", "#203731", "#FFB612", 3, 11, 6, 0],
  ["CHI", "Chicago", "Bears", "NFC", "North", "#0B162A", "#C83803", 4, 5, 12, 0],
  ["TB", "Tampa Bay", "Buccaneers", "NFC", "South", "#D50A0A", "#34302B", 1, 10, 7, 0],
  ["ATL", "Atlanta", "Falcons", "NFC", "South", "#A71930", "#000000", 2, 8, 9, 0],
  ["CAR", "Carolina", "Panthers", "NFC", "South", "#0085CA", "#101820", 3, 5, 12, 0],
  ["NO", "New Orleans", "Saints", "NFC", "South", "#D3BC8D", "#101820", 4, 5, 12, 0],
  ["LAR", "Los Angeles", "Rams", "NFC", "West", "#003594", "#FFA300", 1, 10, 7, 0],
  ["SEA", "Seattle", "Seahawks", "NFC", "West", "#002244", "#69BE28", 2, 10, 7, 0],
  ["ARI", "Arizona", "Cardinals", "NFC", "West", "#97233F", "#000000", 3, 8, 9, 0],
  ["SF", "San Francisco", "49ers", "NFC", "West", "#AA0000", "#B3995D", 4, 6, 11, 0],
];

export const TEAMS: Team[] = ROWS.map(([id, city, name, conference, division, primary, secondary, prevDivisionRank, w, l, t]) => ({
  id,
  abbr: id,
  city,
  name,
  conference,
  division,
  colors: { primary, secondary },
  prevDivisionRank,
  prevRecord: { w, l, t },
}));

export const TEAM_BY_ID: Record<string, Team> = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

/** 2025 round-one draft order (reverse 2024 standings, playoff teams by exit round). */
export const DRAFT_ORDER_2025 = [
  "TEN", "CLE", "NYG", "NE", "JAX", "LV", "NYJ", "CAR", "NO", "CHI", "SF", "DAL", "MIA", "IND", "ATL", "ARI",
  "CIN", "SEA", "TB", "DEN", "PIT", "LAC", "GB", "MIN", "HOU", "LAR", "BAL", "DET", "WAS", "BUF", "KC", "PHI",
];
