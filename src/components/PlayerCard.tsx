import type { Player } from "@/domain/types";
import { capHit, fmtMoney } from "@/engine/cap";
import { tierFor } from "@/engine/roster";
import { Pill, tierTone } from "./ui";

/** Compact roster card: name, position, age, tier, contract line. No numbers the GM wouldn't have. */
export function PlayerCard({ player, year, right, onClick, selected, muted, teamLabel }: { player: Player; year: number; right?: React.ReactNode; onClick?: () => void; selected?: boolean; muted?: boolean; teamLabel?: string }) {
  const tier = tierFor(player.ability.ovr);
  const c = player.contract;
  const hit = capHit(c, year);
  const yearsLeft = c ? c.endYear - year + 1 : 0;
  const injured = (player.injuredWeeks ?? 0) > 0;
  const body = (
    <div className={`flex items-center gap-3 ${muted ? "opacity-50" : ""}`}>
      <div className="display flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-lg bg-sunk text-[13px] font-bold leading-none text-ink-2">
        {player.pos}
        <span className="num mt-0.5 text-[10px] font-semibold text-ink-3">{player.age}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="truncate text-[15px] font-bold tracking-tight">{player.name}</span>
          <Pill tone={tierTone(tier)}>{tier}</Pill>
          {injured && <Pill tone="down">OUT {player.injuredWeeks! >= 18 ? "SZN" : `${player.injuredWeeks}W`}</Pill>}
          {teamLabel && <Pill>{teamLabel}</Pill>}
        </div>
        <div className="num mt-0.5 text-[12px] text-ink-2">
          {c ? (
            <>
              {fmtMoney(hit)} cap · {yearsLeft} yr{yearsLeft === 1 ? "" : "s"} left · {fmtMoney(c.totalValue / (c.endYear - c.startYear + 1))}/yr
            </>
          ) : player.market ? (
            <>
              Proj. {player.market.years} yr / {fmtMoney(player.market.aav * player.market.years)} · from {player.market.prevTeamId}
            </>
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
