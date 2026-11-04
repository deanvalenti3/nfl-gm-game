import { useEffect, useState } from "react";
import type { ScenarioSnapshot } from "@/domain/types";
import { capSummary, type RunState } from "@/engine/game";
import { useRun } from "@/hooks/useRun";
import { fmtMoney } from "@/engine/cap";
import { PhaseStrip, phaseTitle } from "./PhaseStrip";
import { Ticker } from "./Ticker";
import { Briefing } from "./screens/Briefing";
import { Audit } from "./screens/Audit";
import { Needs } from "./screens/Needs";
import { FreeAgency } from "./screens/FreeAgency";
import { TradeWindow } from "./screens/TradeWindow";
import { Draft } from "./screens/Draft";
import { Roster } from "./screens/Roster";
import { Season } from "./screens/Season";
import { Deadline } from "./screens/Deadline";
import { Playoffs } from "./screens/Playoffs";
import { Report } from "./screens/Report";
import { Sheet } from "./ui";

export function Game({ snapshot, initial, onExit }: { snapshot: ScenarioSnapshot; initial: RunState | null; onExit: () => void }) {
  const { state, dispatch } = useRun(snapshot, initial);
  const [showFeed, setShowFeed] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const team = snapshot.teams.find((t) => t.id === state.teamId)!;
  const cap = capSummary(state, snapshot);

  useEffect(() => {
    const accent = accentFor(team.colors.primary, team.colors.secondary);
    document.documentElement.style.setProperty("--team", accent);
    document.documentElement.style.setProperty("--team-soft", hexToSoft(accent));
    document.documentElement.style.setProperty("--team-ink", luminance(accent) > 0.5 ? "#0b0d12" : "#ffffff");
    return () => {
      document.documentElement.style.removeProperty("--team");
      document.documentElement.style.removeProperty("--team-soft");
    };
  }, [team.colors.primary, team.colors.secondary]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [state.phase, state.audit.index, state.fa.day]);

  const inRun = state.phase !== "BRIEFING" && state.phase !== "REPORT";

  return (
    <div className="min-h-dvh" data-phase={state.phase}>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="hairline" />
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onExit} aria-label="Home" className="display flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[14px] font-bold text-white" style={{ background: team.colors.primary }}>
              {team.abbr}
            </button>
            <div className="min-w-0">
              <div className="label truncate">{snapshot.scenario.title}</div>
              <div className="display truncate text-[16px] font-bold uppercase leading-none tracking-wide">{phaseTitle(state.phase)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {inRun && (
              <button onClick={() => setShowRoster(true)} className="hidden items-center gap-2 rounded-lg bg-sunk px-3 py-1.5 sm:flex">
                <span className="label">Cap</span>
                <span className={`display num text-[16px] font-bold ${cap.space < 0 ? "text-down" : "text-up"}`}>{fmtMoney(cap.space, { decimals: 1 })}</span>
              </button>
            )}
            <button onClick={() => setShowFeed(true)} className="rounded-lg bg-sunk px-3 py-1.5 lg:hidden" aria-label="League feed">
              <span className="label">Feed</span>
            </button>
            <PhaseStrip phase={state.phase} />
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 pb-20 pt-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main key={state.phase} className="anim-fade-up mx-auto w-full max-w-2xl lg:mx-0 lg:max-w-none">
          {state.phase === "BRIEFING" && <Briefing state={state} snapshot={snapshot} onStart={() => dispatch({ type: "START" })} />}
          {state.phase === "AUDIT" && <Audit state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "NEEDS" && <Needs state={state} dispatch={dispatch} />}
          {state.phase === "FREE_AGENCY" && <FreeAgency state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "TRADE_WINDOW" && <TradeWindow state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "DRAFT" && <Draft state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "ROSTER" && <Roster state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "SEASON" && <Season state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "DEADLINE" && <Deadline state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "PLAYOFFS" && <Playoffs state={state} snapshot={snapshot} dispatch={dispatch} />}
          {state.phase === "REPORT" && state.report && <Report state={state} snapshot={snapshot} onReplay={() => dispatch({ type: "RESET" })} onNewTeam={onExit} />}
        </main>
        <aside className="rail hidden max-h-[calc(100dvh-80px)] overflow-y-auto lg:sticky lg:top-[72px] lg:block">
          <div className="label mb-2">League transactions</div>
          <Ticker items={state.feed} />
        </aside>
      </div>

      <Sheet open={showFeed} onClose={() => setShowFeed(false)} title="League transactions">
        <Ticker items={state.feed} limit={60} />
      </Sheet>
      <Sheet open={showRoster} onClose={() => setShowRoster(false)} title="Depth chart" wide>
        <Roster state={state} snapshot={snapshot} dispatch={dispatch} inSeason />
      </Sheet>
    </div>
  );
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Team colour as an accent on a dark UI: use the primary unless it is too dark or too pale, then the secondary. */
function accentFor(primary: string, secondary: string): string {
  const ok = (c: string) => {
    const l = luminance(c);
    return l >= 0.06 && l <= 0.75;
  };
  if (ok(primary)) return primary;
  if (ok(secondary)) return secondary;
  return "#c60c30";
}

function hexToSoft(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgb(${r} ${g} ${b} / 0.18)`;
}
