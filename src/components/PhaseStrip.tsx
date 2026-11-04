import type { Phase } from "@/engine/game";

const STEPS: { key: Phase[]; label: string }[] = [
  { key: ["BRIEFING"], label: "Brief" },
  { key: ["AUDIT", "NEEDS"], label: "Audit" },
  { key: ["FREE_AGENCY"], label: "Free agency" },
  { key: ["TRADE_WINDOW"], label: "Trades" },
  { key: ["DRAFT"], label: "Draft" },
  { key: ["ROSTER"], label: "Roster" },
  { key: ["SEASON", "DEADLINE"], label: "Season" },
  { key: ["PLAYOFFS"], label: "Playoffs" },
  { key: ["REPORT"], label: "Report" },
];

export function PhaseStrip({ phase }: { phase: Phase }) {
  const index = STEPS.findIndex((s) => s.key.includes(phase));
  return (
    <ol className="flex items-center gap-1" aria-label={`Phase ${index + 1} of ${STEPS.length}: ${STEPS[index]?.label}`}>
      {STEPS.map((s, i) => (
        <li key={s.label} title={s.label} aria-current={i === index ? "step" : undefined} className={`h-1.5 rounded-full transition-all duration-300 ${i < index ? "w-3 bg-team/50" : i === index ? "w-6 bg-team" : "w-3 bg-line-strong"}`} />
      ))}
    </ol>
  );
}

export function phaseTitle(phase: Phase): string {
  return STEPS.find((s) => s.key.includes(phase))?.label ?? phase;
}
