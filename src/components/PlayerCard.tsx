import type { Player } from "@/domain/types";
import { capHit, fmtMoney } from "@/engine/cap";
import { gradeTone, publicGrade, statLine } from "@/engine/grades";
import { Pill } from "./ui";

/**
 * Roster card: scouting grade, name, position, age, last season's line, contract line.
 * Everything here is information the GM would have had on the cutoff date.
 */
export function PlayerCard({ player, year, right, onClick, selected, muted, teamLabel, compact = false }: { player: Player; year: number; right?: React.ReactNode; onClick?: () => void; selected?: boolean; muted?: boolean; teamLabel?: string; compact?: boolean }) {
  const grade = publicGrade(player);
  const tone = gradeTone(grade);
  const c = player.contract;
  const hit = capHit(c, year);
  const yearsLeft = c ? c.endYear - year + 1 : 0;
  const injured = (player.injuredWeeks ?? 0) > 0;
  const gradeColor = tone === "up" ? "text-up bg-up-soft" : tone === "even" ? "text-even bg-even-soft" : tone === "down" ? "text-down bg-down-soft" : "text-ink bg-sunk";
  const body = (
    <div className={`flex items-center gap-3 ${muted ? "opacity-50" : ""}`}>
      <div className={`display flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-[28px] font-bold leading-none ${gradeColor}`} aria-label={`Grade ${grade}`}>
        {grade}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-[18px] font-bold tracking-tight">{player.name}</span>
          <span className="display text-[15px] font-bold uppercase tracking-wide text-ink-2">{player.pos} · {player.age}</span>
          {injured && <Pill tone="down">OUT {player.injuredWeeks! >= 18 ? "SZN" : `${player.injuredWeeks}W`}</Pill>}
          {teamLabel && <Pill>{teamLabel}</Pill>}
        </div>
        {!compact && <div className="num mt-0.5 truncate text-[14px] text-ink-2">{statLine(player.pos, player.stats)}</div>}
        <div className="num mt-0.5 text-[14px] text-ink-3">
          {c ? (
            <>{fmtMoney(hit)} cap · {yearsLeft} yr{yearsLeft === 1 ? "" : "s"} left · {fmtMoney(c.totalValue / (c.endYear - c.startYear + 1))}/yr</>
          ) : player.market ? (
            <>Asking {player.market.years} yr / {fmtMoney(player.market.aav * player.market.years)} · from {player.market.prevTeamId}</>
          ) : (
            "No contract"
          )}
        </div>
      </div>
      {right}
    </div>
  );
  if (!onClick) return <div className="card px-3 py-2.5">{body}</div>;
  return (
    <button type="button" onClick={onClick} className={`card w-full px-3 py-2.5 text-left transition-[border-color,transform] active:scale-[0.99] ${selected ? "border-team ring-2 ring-team/50" : "hover:border-line-strong"}`}>
      {body}
    </button>
  );
}
