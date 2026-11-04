import type { Contract, DraftPick, DraftProspect, Player, ScenarioSnapshot, Team } from "@/domain/types";

/**
 * Provider interfaces. These run at snapshot-build time (scripts/build-snapshot.ts),
 * never during play. The engine only ever consumes a ScenarioSnapshot.
 */

export interface NflDataProvider {
  teams(season: number): Promise<Team[]>;
  roster(season: number, teamId: string, asOf: string): Promise<Player[]>;
  draftPicks(year: number): Promise<DraftPick[]>;
  draftClass(year: number): Promise<DraftProspect[]>;
}

export interface ContractDataProvider {
  contractFor(playerId: string, season: number): Promise<Contract | null>;
}

export interface PlayerMetadataProvider {
  college(playerId: string): Promise<string | undefined>;
  headshotUrl(playerId: string): Promise<string | undefined>;
}

export interface SnapshotProvider {
  load(scenarioId: string): ScenarioSnapshot | undefined;
}

export { NflverseProvider } from "./nflverse";
