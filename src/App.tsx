import { useState } from "react";
import { SCENARIOS, getScenario } from "@/data/scenarios";
import type { RunState } from "@/engine/game";
import { clearSavedRun, loadSavedRun } from "@/hooks/useRun";
import { Home } from "./components/screens/Home";
import { Game } from "./components/Game";

export default function App() {
  const [saved, setSaved] = useState<RunState | null>(() => loadSavedRun());
  const [active, setActive] = useState<{ scenarioId: string; initial: RunState | null } | null>(null);

  if (active) {
    const snapshot = getScenario(active.scenarioId);
    if (snapshot) {
      return (
        <Game
          key={`${active.scenarioId}-${active.initial?.seed ?? "new"}`}
          snapshot={snapshot}
          initial={active.initial}
          onExit={() => {
            setSaved(loadSavedRun());
            setActive(null);
          }}
        />
      );
    }
  }

  return (
    <Home
      scenarios={SCENARIOS}
      saved={saved && getScenario(saved.scenarioId) ? saved : null}
      onStart={(id) => {
        clearSavedRun();
        setSaved(null);
        setActive({ scenarioId: id, initial: null });
      }}
      onResume={() => saved && setActive({ scenarioId: saved.scenarioId, initial: saved })}
      onDiscard={() => {
        clearSavedRun();
        setSaved(null);
      }}
    />
  );
}
