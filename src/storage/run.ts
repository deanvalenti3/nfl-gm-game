import type { RunState } from "@/engine/game";

/**
 * Run persistence behind an interface, so localStorage can be swapped for anything else.
 * The whole RunState is saved after every action; a refresh resumes mid-draft.
 */
export interface RunStore {
  load(): RunState | null;
  save(state: RunState): void;
  clear(): void;
}

export const RUN_KEY = "front-office:run:v1";

export class LocalStorageRunStore implements RunStore {
  constructor(private readonly storage: Storage | null = typeof window === "undefined" ? null : window.localStorage) {}
  load(): RunState | null {
    if (!this.storage) return null;
    try {
      const raw = this.storage.getItem(RUN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as RunState;
      return parsed?.version === 1 && parsed.scenarioId ? parsed : null;
    } catch {
      return null;
    }
  }
  save(state: RunState) {
    try {
      this.storage?.setItem(RUN_KEY, JSON.stringify(state));
    } catch {
      // Quota or privacy mode: the run just won't survive a refresh.
    }
  }
  clear() {
    this.storage?.removeItem(RUN_KEY);
  }
}

export class MemoryRunStore implements RunStore {
  private state: RunState | null = null;
  load() {
    return this.state ? structuredClone(this.state) : null;
  }
  save(state: RunState) {
    this.state = structuredClone(state);
  }
  clear() {
    this.state = null;
  }
}
