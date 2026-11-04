import type { ScenarioSnapshot } from "@/domain/types";
import { CIN_2025 } from "./cin-2025";
import { NE_2025 } from "./ne-2025";

/** Registry of playable scenario snapshots. Add a new snapshot here. */
export const SCENARIOS: ScenarioSnapshot[] = [CIN_2025, NE_2025];

export function getScenario(id: string): ScenarioSnapshot | undefined {
  return SCENARIOS.find((s) => s.scenario.id === id);
}
