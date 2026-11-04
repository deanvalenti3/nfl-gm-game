import type { ScenarioSnapshot } from "@/domain/types";
import { NE_2025 } from "./ne-2025";

/** Registry of playable scenario snapshots. Add a new snapshot here. */
export const SCENARIOS: ScenarioSnapshot[] = [NE_2025];

export function getScenario(id: string): ScenarioSnapshot | undefined {
  return SCENARIOS.find((s) => s.scenario.id === id);
}
