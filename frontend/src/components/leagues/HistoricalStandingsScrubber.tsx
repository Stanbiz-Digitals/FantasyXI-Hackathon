"use client";

import React from "react";
import type { LeagueStandingsEntry } from "@/types";
import { StandingsTable } from "@/components/leagues/StandingsTable";

export interface CompletedGameweek {
  id: number;
  name: string;
}

interface HistoricalStandingsScrubberProps {
  gameweeks: CompletedGameweek[];
  selectedGameweekId: number;
  standings: LeagueStandingsEntry[];
  loading?: boolean;
  error?: string | null;
  onSelectGameweek: (gameweekId: number) => void;
  entryFee?: number;
  prizePool?: number;
  currentUserId?: string;
}

export function HistoricalStandingsScrubber({
  gameweeks,
  selectedGameweekId,
  standings,
  loading = false,
  error = null,
  onSelectGameweek,
  entryFee,
  prizePool,
  currentUserId,
}: HistoricalStandingsScrubberProps) {
  const selectedIndex = gameweeks.findIndex((gameweek) => gameweek.id === selectedGameweekId);
  if (gameweeks.length === 0 || selectedIndex < 0) return null;

  return (
    <section aria-label="Historical league standings" className="space-y-4">
      <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 sm:p-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label htmlFor="standings-gameweek" className="text-xs sm:text-sm font-bold text-slate-800">
            Standings after {gameweeks[selectedIndex].name}
          </label>
          <span className="text-xs font-mono font-bold text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">{selectedIndex + 1} of {gameweeks.length}</span>
        </div>
        <input
          id="standings-gameweek"
          aria-label="Select completed gameweek"
          type="range"
          min={0}
          max={gameweeks.length - 1}
          step={1}
          value={selectedIndex}
          onInput={(event) => onSelectGameweek(gameweeks[Number(event.currentTarget.value)].id)}
          className="min-h-8 w-full cursor-pointer accent-[#37003c] touch-pan-y"
        />
        <div className="flex justify-between text-xs font-medium text-slate-400" aria-hidden="true">
          <span>{gameweeks[0].name}</span><span>{gameweeks[gameweeks.length - 1].name}</span>
        </div>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-rose-600 bg-rose-50 p-3 rounded-xl border border-rose-200">{error}</p>}
      {loading ? (
        <div role="status" aria-label="Loading historical standings" className="animate-pulse space-y-3 py-4">
          <span className="sr-only">Loading historical standings</span>
          {[0, 1, 2, 3].map((row) => <div key={row} className="h-10 rounded-xl bg-slate-100" />)}
        </div>
      ) : (
        <StandingsTable
          standings={standings}
          entryFee={entryFee}
          prizePool={prizePool}
          currentUserId={currentUserId}
          rankChanges={Object.fromEntries(standings.flatMap((entry) => entry.rankChange == null ? [] : [[entry.userId, entry.rankChange]]))}
        />
      )}
    </section>
  );
}
