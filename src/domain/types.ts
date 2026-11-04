/**
 * Normalized domain model. Everything the engine reads is one of these.
 * No provider-specific fields; adapters map external data into this shape.
 * Money is in dollars (integers) unless a field name says otherwise.
 */

export type Conference = "AFC" | "NFC";
export type Division = "East" | "North" | "South" | "West";

export type Position =
  | "QB" | "RB" | "WR" | "TE" | "OT" | "G" | "C"
  | "EDGE" | "DT" | "LB" | "CB" | "S" | "K" | "P" | "LS";

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "OT", "G", "C", "EDGE", "DT", "LB", "CB", "S", "K", "P", "LS"];

/** Football-language tier shown to the player instead of a number. */
export type Tier = "ELITE" | "HIGH-END STARTER" | "STARTER" | "ROTATIONAL" | "DEPTH" | "REPLACEMENT";

export type TeamStatus = "CONTENDER" | "PLAYOFF TEAM" | "FRINGE" | "RETOOLING" | "REBUILDING";

export type QbSituation = "FRANCHISE" | "YOUNG STARTER" | "BRIDGE" | "OPEN";

export interface Team {
  id: string;           // "NE"
  city: string;         // "New England"
  name: string;         // "Patriots"
  abbr: string;         // "NE"
  conference: Conference;
  division: Division;
  colors: { primary: string; secondary: string };
  /** Where the team finished in its division the previous season (1-4). Drives schedule rotation. */
  prevDivisionRank: number;
  prevRecord: { w: number; l: number; t: number };
}

export interface Contract {
  /** First and last league year covered, inclusive. */
  startYear: number;
  endYear: number;
  totalValue: number;
  /** Fully guaranteed at signing. */
  guaranteed: number;
  /** Cap hit per league year, keyed by year. */
  capHits: Record<number, number>;
  /** Remaining prorated bonus by year: what accelerates as dead money on release. */
  proratedBonus: Record<number, number>;
  /** Guaranteed salary still owed per year (counts as dead money if released). */
  guaranteedSalary: Record<number, number>;
  /** How the contract came to be. Rookie deals are cheap and short, which matters for trade value. */
  kind: "VETERAN" | "ROOKIE" | "FRANCHISE_TAG" | "MINIMUM";
}

/** Internal talent model. The UI exposes `tier`, never `ovr`. */
export interface Ability {
  /** 0-100 current quality at the position. */
  ovr: number;
  /** Hidden; how the player is trending this season (-3..+3). */
  trajectory: number;
  /** 0-100 chance of staying healthy for the season. */
  durability: number;
}

export interface Player {
  id: string;
  name: string;
  pos: Position;
  age: number;
  /** Years of accrued NFL experience at the cutoff. */
  exp: number;
  college?: string;
  /** Team at cutoff; null when a free agent. */
  teamId: string | null;
  contract: Contract | null;
  ability: Ability;
  /** Set when the player entered via the draft in this run. */
  draftedPick?: number;
  /** Set for free agents: what the market expects. */
  market?: FreeAgentMarket;
  /** Injured through this many remaining weeks (0 = healthy). */
  injuredWeeks?: number;
  /** Previous season's line, when the snapshot has it. */
  stats?: SeasonStats;
}

/** Previous-season production, aggregated from public box-score data. Only what a GM would glance at. */
export interface SeasonStats {
  gp: number;
  /** Games with a starter-sized snap share. */
  gs?: number;
  /** Average snap share across games played, 0-100. */
  snapPct?: number;
  pass?: { cmp: number; att: number; yds: number; td: number; int: number };
  rush?: { att: number; yds: number; td: number };
  rec?: { rec: number; yds: number; td: number };
  def?: { tkl: number; tfl: number; sk: number; int: number; pd: number; qbh: number };
  kick?: { fgm: number; fga: number; long: number };
}

export interface FreeAgentMarket {
  /** Projected contract, as the public would read it before free agency opened. */
  years: number;
  aav: number;
  guaranteedPct: number;
  /** HIGH | MEDIUM | LOW demand across the league. */
  interest: "HIGH" | "MEDIUM" | "LOW";
  /** Where the player played last year, for the card. */
  prevTeamId: string;
}

export interface DraftPick {
  id: string;            // "2025-1-4"
  year: number;
  round: number;
  /** Overall slot; undefined for future-year picks until the order is set. */
  overall?: number;
  /** Original owner (for display: "via SEA"). */
  originalTeamId: string;
  /** Current owner. A pick is owned by exactly one team. */
  teamId: string;
  /** Filled in when used. */
  usedOnPlayerId?: string;
}

export interface DraftProspect {
  id: string;
  name: string;
  pos: Position;
  school: string;
  age: number;
  /** What a scout would say before the draft. */
  grade: "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-";
  projectedRange: [number, number];
  athletic: "ELITE" | "GOOD" | "AVERAGE" | "LIMITED";
  production: "ELITE" | "STRONG" | "SOLID" | "THIN";
  risk: "LOW" | "MEDIUM" | "HIGH";
  /** Hidden true talent on arrival and a ceiling for development. */
  trueOvr: number;
  ceiling: number;
}

export interface TeamProfile {
  teamId: string;
  status: TeamStatus;
  qb: QbSituation;
  /** League-year cap space before this offseason's moves. */
  capSpace: number;
  /** Positions the team is actively trying to improve, in priority order. */
  needs: Position[];
  /** 0-100 unit ratings for teams whose full roster isn't in the snapshot. */
  units: UnitRatings;
}

export interface UnitRatings {
  qb: number;
  offSkill: number;
  oLine: number;
  passRush: number;
  runDefense: number;
  coverage: number;
  specialTeams: number;
  depth: number;
}

/** What actually happened, used only to judge the run after the season. Never shown before the report. */
export interface RealResult {
  w: number;
  l: number;
  t: number;
  /** 0 missed playoffs, 1 lost wild card, 2 lost divisional, 3 lost conference, 4 lost Super Bowl, 5 won it. */
  playoffDepth: number;
  label: string;
}

export interface OwnershipObjective {
  headline: string;
  /** Minimum wins for the owner to consider the season a success. */
  targetWins: number;
  /** Does making the playoffs satisfy ownership on its own? */
  playoffsRequired: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  subtitle: string;
  season: number;
  teamId: string;
  /** No information after this date is shown to the GM. */
  cutoffDate: string;
  salaryCap: number;
  /** Cap carryover and credits from the prior league year. */
  carryover: number;
  minRosterForSeason: number;
  objective: OwnershipObjective;
  realResult: RealResult;
  /** Where the real coaching staff started; the GM can change it until the season begins. */
  defaultScheme?: { offense: "WIDE_ZONE" | "SPREAD" | "POWER"; defense: "FOUR_THREE" | "THREE_FOUR" | "COVERAGE" };
  /** Shown in the briefing. */
  keyProblems: Position[];
  briefingNotes: string[];
  /** Hand-authored roster-audit decisions for the opening phase. */
  auditDecisions: AuditDecision[];
  /** Week the trade deadline falls after (simulate weeks 1..deadlineWeek, then stop). */
  deadlineWeek: number;
  /** Position-level scouting notes a GM would have had. */
  prospectNotes?: Record<string, string>;
}

export interface AuditDecision {
  id: string;
  playerId: string;
  prompt: string;
  /** Which choices are offered. TRADE opens the trade builder later. */
  options: ("KEEP" | "CUT" | "TRADE" | "RESTRUCTURE")[];
  context: string;
}

export interface ScenarioSnapshot {
  version: number;
  scenario: Scenario;
  teams: Team[];
  profiles: TeamProfile[];
  players: Player[];
  picks: DraftPick[];
  prospects: DraftProspect[];
}

// ---------------------------------------------------------------------------
// Transactions and results produced during a run
// ---------------------------------------------------------------------------

export type Transaction =
  | { kind: "SIGN"; teamId: string; playerId: string; years: number; total: number; aav: number; guaranteed: number; week: string }
  | { kind: "RELEASE"; teamId: string; playerId: string; savings: number; deadMoney: number; week: string }
  | { kind: "TRADE"; teams: [string, string]; sent: TradeAsset[]; received: TradeAsset[]; week: string }
  | { kind: "DRAFT"; teamId: string; playerId: string; pickId: string; overall: number; round: number; week: string }
  | { kind: "INJURY"; teamId: string; playerId: string; weeks: number; week: string };

export type TradeAsset = { type: "PLAYER"; id: string } | { type: "PICK"; id: string };

export interface GameResult {
  week: number;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  /** "REG" | "WC" | "DIV" | "CONF" | "SB" */
  stage: "REG" | "WC" | "DIV" | "CONF" | "SB";
}

export interface StandingRow {
  teamId: string;
  w: number;
  l: number;
  t: number;
  pf: number;
  pa: number;
}
