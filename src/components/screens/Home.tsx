import type { ScenarioSnapshot } from "@/domain/types";
import type { RunState } from "@/engine/game";
import { Button, Headline, Pill } from "@/components/ui";
import { phaseTitle } from "@/components/PhaseStrip";

export function Home({ scenarios, saved, onStart, onResume, onDiscard }: { scenarios: ScenarioSnapshot[]; saved: RunState | null; onStart: (id: string) => void; onResume: () => void; onDiscard: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6">
      <div>
        <div className="display text-[15px] font-bold uppercase tracking-[0.3em] text-ink-3">Front Office</div>
        <Headline sub="Take over a real NFL team at the start of an offseason. Sign, cut, trade, draft. Then find out whether the roster you built can win.">Build the roster.<br />Simulate the result.</Headline>
      </div>

      {saved && (
        <section className="card anim-fade-up flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <div className="label">Run in progress</div>
            <Pill tone="team">{phaseTitle(saved.phase)}</Pill>
          </div>
          <div className="display text-[25px] font-bold uppercase">{scenarios.find((s) => s.scenario.id === saved.scenarioId)?.scenario.title ?? saved.scenarioId}</div>
          <div className="flex gap-2">
            <Button full onClick={onResume}>Resume</Button>
            <Button variant="ghost" onClick={onDiscard}>Discard</Button>
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="label">Scenarios</div>
        <div className="stagger flex flex-col gap-3">
          {scenarios.map((s) => (
            <button key={s.scenario.id} onClick={() => onStart(s.scenario.id)} className="card flex w-full items-center gap-4 p-5 text-left transition-[border-color,transform] hover:border-line-strong active:scale-[0.99]">
              <div className="display flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-[22px] font-bold text-white" style={{ background: s.teams.find((t) => t.id === s.scenario.teamId)?.colors.primary }}>
                {s.scenario.teamId}
              </div>
              <div className="min-w-0 flex-1">
                <div className="display text-[25px] font-bold uppercase leading-none">{s.scenario.title}</div>
                <div className="mt-1 text-[16px] text-ink-2">{s.scenario.subtitle}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Pill>Last season {s.teams.find((t) => t.id === s.scenario.teamId)!.prevRecord.w}–{s.teams.find((t) => t.id === s.scenario.teamId)!.prevRecord.l}</Pill>
                  <Pill>Cutoff {s.scenario.cutoffDate}</Pill>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>
      <p className="text-[14px] leading-relaxed text-ink-3">Historical scenarios only show what was known on the cutoff date. The engine knows more; the GM doesn't. Progress is saved in this browser.</p>
    </div>
  );
}
