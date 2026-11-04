import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { ScenarioSnapshot } from "@/domain/types";
import { createRun, runReducer, type Action, type RunState } from "@/engine/game";
import { LocalStorageRunStore, type RunStore } from "@/storage/run";

const defaultStore = new LocalStorageRunStore();

/** React binding over the run reducer with autosave. */
export function useRun(snapshot: ScenarioSnapshot, initial: RunState | null, store: RunStore = defaultStore) {
  const reduce = useMemo(() => runReducer(snapshot), [snapshot]);
  const [state, rawDispatch] = useReducer(reduce, initial, (init) => init ?? createRun(snapshot));
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    store.save(state);
  }, [state, store]);

  const dispatch = useCallback((action: Action) => rawDispatch(action), []);
  return { state, dispatch };
}

export function loadSavedRun(store: RunStore = defaultStore): RunState | null {
  return store.load();
}

export function clearSavedRun(store: RunStore = defaultStore) {
  store.clear();
}
