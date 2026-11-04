# Football data sources

Checked on 2026-11-04 with plain HTTP requests. Status codes are what the endpoints returned.

## nflverse (primary, free, CSV/parquet, permissive licence)

Releases live under `https://github.com/nflverse/nflverse-data/releases/download/<release>/<file>`.

| Dataset | File | Status | Use |
| --- | --- | --- | --- |
| Players | `players/players.csv` | 200 | Canonical player ids (gsis_id), names, positions, birth dates, draft info, college. |
| Rosters | `rosters/roster_<season>.csv` | 200 | Who was on which team, week by week. Team at scenario cutoff. |
| Draft picks | `draft_picks/draft_picks.csv` | 200 | Every pick 1980–present: round, pick, team, player, college. Real draft classes and real pick ownership. |
| Player stats | `player_stats/player_stats_<season>.csv` | 200 | Season production for the quality model (yards, EPA share, snaps via `snap_counts`). |
| Snap counts | `snap_counts/snap_counts_<season>.csv` | (same release pattern) | Availability and role size. |
| Contracts | `contracts/historical_contracts.csv` | 404 | The contracts release exists but the asset name has changed over time (`historical_contracts.rds/.parquet/.csv.gz`). Fetch the release page and pick the current asset. Data is OverTheCap-derived: years, value, APY, guaranteed, year-by-year cap hits. |
| Play-by-play | `pbp/play_by_play_<season>.csv.gz` | (large) | Only needed if we compute EPA ourselves. Not needed for V1. |

## ESPN (unofficial, JSON)

`https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/<id>/roster` returned 200. Good for current rosters, headshots, jersey numbers, team colours and logos. Not historical, not versioned, can change without notice. Use only for enriching a snapshot, never at play time.

## Contracts and cap

- **OverTheCap** (overthecap.com): per-team cap tables, dead money, contract structures. HTML only; nflverse republishes the core table.
- **Spotrac**: similar, HTML. Both are references for hand-curated snapshots.

## Draft prospects and scouting

- nflverse `draft_picks.csv` gives the real selections for historical classes.
- Pre-draft consensus (projected range, tiers) is not in any open dataset. For historical scenarios it is curated by hand from public consensus boards as of the cutoff date. This is what keeps the "no hindsight" rule honest: the board only encodes what was believed at the time.

## How Front Office uses these

```
Providers (src/data/providers)
  NflDataProvider        rosters, players, draft picks           → nflverse adapter (ingest-time only)
  ContractDataProvider   contract terms, cap hits, dead money     → nflverse contracts / curated
  PlayerMetadataProvider colleges, ages, headshots, team colours  → nflverse players / ESPN
  SnapshotProvider       a frozen ScenarioSnapshot                → src/data/scenarios/*.ts (play-time)
```

The game engine only ever reads a `ScenarioSnapshot`. Ingestion (`scripts/build-snapshot.ts`) is where provider adapters run, and the result is committed as a versioned TypeScript module. A run never calls the network.

For V1 the New England 2025 snapshot is hand-curated from the sources above, in the same shape the ingest script will produce. That keeps the first playable run deterministic while the adapter is finished.
