# What Front Office reuses from Vertical Slice

Source inspected: `~/dev/vertical-slice-game` (Next.js 16, React 19, Tailwind v4, dnd-kit, Vitest, Playwright).
Front Office reuses the *interaction grammar and design philosophy* below. It does not share code or content.

## Interaction grammar worth keeping

| Pattern | Where it lives in Vertical Slice | How Front Office uses it |
| --- | --- | --- |
| **Brief, then decisions** | `BriefView` → stages. Pills for industry/difficulty, one headline, three short sections, one big CTA. | Front Office Briefing: team + season pills, ownership expectation headline, four compact stat tiles, key problems as pills, one CTA. |
| **Decision card = radio group** | `PickStageView`: cards act as `role="radio"`, selection ring, disabled lock button until a pick. | Roster audit (Keep/Cut/Trade), deadline posture, free-agent shortlist, draft-board picks. |
| **Lock → reveal → continue** | A stage has a `locked` phase: feedback appears *after* commitment, then Continue. | Every GM decision commits, then the consequence line shows (cap delta, dead money, market reaction) before the next card. |
| **Ordering / ranking** | `SequenceStageView`: dnd-kit sortable + arrow buttons as a keyboard/touch fallback. | "Rank your three biggest needs" at the start of free agency (feeds the shortlist and AI pressure). Arrow buttons kept; drag optional. |
| **Immediate score callout** | `ScoreCallout`: tinted bar with a one-line verdict and `+points`. | Consequence strip after each move: "Saves $7.6M · $2.1M dead money". |
| **Progress dots** | `StageDots`: thin pills, current one wider. | Phase strip: Audit · Free Agency · Trade · Draft · Roster · Season · Deadline · Playoffs · Report. |
| **Results with ring + bars** | `ScoreRing` (animated stroke), `Bar` with staggered delay, grid of per-stage scores, expandable "Your decisions" review. | GM Report: score ring, dimension bars, best/worst move, draft steal, season line, expandable transaction review. |
| **Pure state machine** | `engine/session.ts` reducer, no React; tests pin behaviour. | `engine/game.ts` reducer owns the entire run. All football rules live in `engine/*` modules. |
| **Content contract** | `scenarios/types.ts` + `scenarios/data/*.ts` + registry; integrity tests over the data. | `domain/types.ts` + `data/scenarios/*.ts` snapshot + integrity tests (no duplicate players, picks owned once, cap sums). |
| **Persistence behind an interface** | `ProgressStore` (localStorage + memory) bound with `useSyncExternalStore`. | `RunStore` (localStorage + memory). The full run state is saved on every action so a refresh resumes mid-draft. |
| **Design tokens** | CSS variables on `:root` with a dark-mode override, mapped into Tailwind via `@theme inline`. Verdict tones `best/good/weak/poor`. | Same approach. Tones become `up/even/down/risk`. Team colour is injected as `--team` and used only as an accent. |
| **Compact density** | `max-w-xl` single column, 11px uppercase tracked section labels, 15px body, tabular numbers. | Same column on iPad, wider two-column on desktop for the trade builder and draft board. |
| **Motion** | `fade-up`, `pop`, `grow`, `stagger` keyframes, reduced-motion guard. | Same set plus a `ticker` keyframe for the draft and season ticker. |

## Design philosophy carried over

- Brief context → one clear decision → constrained options → immediate consequence → next decision.
- Feedback is earned by committing, never shown before the pick.
- Scores come from deterministic rules on data, never from a model's opinion.
- Everything the UI shows comes from the engine; components never contain rules.
- The engine is tested directly; the UI is thin.

## Deliberately not carried over

- Daily puzzle / streaks / practice library (a GM run is a long session, not a daily).
- Verdict-per-option grading. A GM move is graded by its consequences over the season, not by a pre-authored label.
- Next.js. Front Office is a static client app (Vite). There is no server, no accounts, nothing to fetch at runtime.
