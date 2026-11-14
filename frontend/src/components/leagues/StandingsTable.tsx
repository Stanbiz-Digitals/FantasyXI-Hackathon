"use client";

import React, { useLayoutEffect, useRef } from "react";
import { LeagueStandingsEntry, MembershipStatus } from "@/types";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconCheck, IconAlertCircle, IconChevronUp, IconChevronDown, IconUsers, IconLock } from "@/components/ui/Icons";

export interface StandingsTableProps {
  standings: LeagueStandingsEntry[];
  entryFee?: number;
  prizePool?: number;
  currentUserId?: string;
  /** Live points in the current gameweek by userId (shows the Live GW column) */
  livePoints?: Record<string, number>;
  /** Positions moved since the previous live update by userId (positive = up) */
  rankChanges?: Record<string, number>;
  /** Team visibility: PUBLIC allows squad inspection, PRIVATE conceals competitor squads */
  teamVisibility?: string;
  /** Makes rows clickable, e.g. to open a manager's live squad */
  onSelectEntry?: (userId: string) => void;
}

/**
 * StandingsTableClient — prop-driven, 'use client' component.
 *
 * Used by LeagueInteractivePanel for live SSE standings updates.
 * The RSC variant below (StandingsTable) fetches data server-side.
 */
export const StandingsTable: React.FC<StandingsTableProps> = ({
  standings,
  entryFee = 0,
  prizePool = 0,
  currentUserId,
  livePoints,
  rankChanges = {},
  teamVisibility = "PUBLIC",
  onSelectEntry,
}) => {
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const lastTops = useRef(new Map<string, number>());
  const order = standings.map((s) => s.userId).join(",");

  // FLIP animation: slide rows from their previous position when the ranking changes
  useLayoutEffect(() => {
    const nextTops = new Map<string, number>();
    rowRefs.current.forEach((row, userId) => {
      // offsetTop is relative to the table, so page scrolling does not trigger animations
      const top = row.offsetTop;
      nextTops.set(userId, top);
      const previousTop = lastTops.current.get(userId);
      if (previousTop !== undefined && previousTop !== top) {
        row.animate(
          [{ transform: `translateY(${previousTop - top}px)` }, { transform: "translateY(0)" }],
          { duration: 600, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
        );
      }
    });
    lastTops.current = nextTops;
  }, [order]);

  if (standings.length === 0) {
    return (
      <EmptyState
        icon={<IconUsers className="w-6 h-6" />}
        title="No teams have joined this league yet"
        description="Be the first to enter your squad and start competing for the prize pool!"
      />
    );
  }

  // Calculate projected prizes for top 3
  const firstPrize = Math.round(prizePool * 0.6 * 100) / 100;
  const secondPrize = Math.round(prizePool * 0.3 * 100) / 100;
  const thirdPrize = Math.round(prizePool * 0.1 * 100) / 100;

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <span className="w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center font-mono shadow-xs">
            1
          </span>
        );
      case 2:
        return (
          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-black text-xs flex items-center justify-center font-mono shadow-xs">
            2
          </span>
        );
      case 3:
        return (
          <span className="w-6 h-6 rounded-full bg-amber-600/20 text-amber-800 border border-amber-300 font-black text-xs flex items-center justify-center font-mono">
            3
          </span>
        );
      default:
        return (
          <span className="w-6 h-6 rounded font-bold text-slate-400 text-xs flex items-center justify-center font-mono">
            {rank}
          </span>
        );
    }
  };

  const getProjectedPrize = (rank: number) => {
    if (prizePool <= 0) return null;
    if (rank === 1) return `$${firstPrize.toFixed(2)}`;
    if (rank === 2) return `$${secondPrize.toFixed(2)}`;
    if (rank === 3) return `$${thirdPrize.toFixed(2)}`;
    return null;
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px] bg-slate-50 tracking-wider">
            <th className="py-3 px-3 w-12 text-center">Rank</th>
            <th className="py-3 px-3">Manager &amp; Squad</th>
            <th className="py-3 px-3">Escrow Status</th>
            <th className="py-3 px-3 text-center">Best GW</th>
            {livePoints && <th className="py-3 px-3 text-right">Live GW</th>}
            <th className="py-3 px-3 text-right">Total Pts</th>
            {prizePool > 0 && <th className="py-3 px-3 text-right">Projected USDC</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium">
          {standings.map((entry) => {
            const isMe = currentUserId && entry.userId === currentUserId;
            const prize = getProjectedPrize(entry.rank);
            const change = rankChanges[entry.userId] ?? 0;

            return (
              <tr
                key={entry.userId}
                ref={(row) => {
                  if (row) rowRefs.current.set(entry.userId, row);
                  else rowRefs.current.delete(entry.userId);
                }}
                onClick={onSelectEntry ? () => onSelectEntry(entry.userId) : undefined}
                onKeyDown={
                  onSelectEntry
                    ? (e) => e.key === "Enter" && onSelectEntry(entry.userId)
                    : undefined
                }
                tabIndex={onSelectEntry ? 0 : undefined}
                className={`transition-colors ${onSelectEntry ? "cursor-pointer" : ""} ${
                  isMe
                    ? "bg-purple-50/70 hover:bg-purple-50"
                    : "hover:bg-slate-50"
                }`}
              >
                {/* Rank */}
                <td className="py-3.5 px-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    {getRankBadge(entry.rank)}
                    {change !== 0 && (
                      <span
                        className={`flex items-center text-[10px] font-bold font-mono ${
                          change > 0 ? "text-emerald-600" : "text-rose-500"
                        }`}
                        title={`${change > 0 ? "Up" : "Down"} ${Math.abs(change)}`}
                      >
                        {change > 0 ? (
                          <IconChevronUp className="w-3 h-3" />
                        ) : (
                          <IconChevronDown className="w-3 h-3" />
                        )}
                        {Math.abs(change)}
                      </span>
                    )}
                  </div>
                </td>

                {/* Manager & Squad */}
                <td className="py-3.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className={`font-black text-xs sm:text-sm tracking-tight ${isMe ? "text-[#37003c]" : "text-slate-900"}`}>
                      {entry.squadName || "Fantasy Squad"}
                    </span>
                    {teamVisibility === "PRIVATE" && !isMe && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200/80 font-bold" title="Squad selections hidden in Private Team League">
                        <IconLock className="w-2.5 h-2.5 text-purple-600" />
                        <span>Private</span>
                      </span>
                    )}
                    {isMe && (
                      <span className="text-[10px] uppercase font-bold tracking-wider text-purple-800 bg-purple-100/70 px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans mt-0.5">
                    Manager: <span className="font-semibold text-slate-700">@{entry.username}</span>
                  </div>
                </td>

                {/* Escrow Status */}
                <td className="py-3.5 px-3">
                  {entryFee === 0 ? (
                    <span className="text-xs text-slate-400 font-medium">Free league</span>
                  ) : entry.membershipStatus === MembershipStatus.ACTIVE ? (
                    <Badge variant="success" className="gap-1 font-bold">
                      <IconCheck className="w-3 h-3" />
                      <span>Confirmed</span>
                    </Badge>
                  ) : (
                    <Badge variant="warning" className="gap-1 font-bold">
                      <IconAlertCircle className="w-3 h-3" />
                      <span>Pending Fee</span>
                    </Badge>
                  )}
                </td>

                {/* Best GW */}
                <td className="py-3.5 px-3 text-center font-mono text-xs font-semibold text-slate-600">
                  {entry.bestGameweekPoints ?? "—"} pts
                </td>

                {/* Live Gameweek Points */}
                {livePoints && (
                  <td className="py-3.5 px-3 text-right font-mono font-bold text-emerald-700 tabular-nums text-xs">
                    {livePoints[entry.userId] ?? 0}
                  </td>
                )}

                {/* Total Points */}
                <td className="py-3.5 px-3 text-right">
                  <span className="font-mono font-black text-sm text-slate-900">
                    {entry.totalPoints}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 ml-1">pts</span>
                </td>

                {/* Projected Prize */}
                {prizePool > 0 && (
                  <td className="py-3.5 px-3 text-right">
                    {prize ? (
                      <span className="font-mono font-black text-amber-600 text-sm">
                        {prize}
                      </span>
                    ) : (
                      <span className="text-slate-300 font-mono">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ─── Async RSC wrapper — fetches standings on the server ──────────────────────

interface StandingsRscProps {
  leagueId: string;
  entryFee?: number;
  prizePool?: number;
}

/**
 * StandingsTableRSC — async Server Component.
 *
 * Fetches league standings server-side so they stream in via React Suspense
 * without blocking the initial page render.
 * Wrapped in <Suspense fallback={<StandingsLoading />}> by the page.
 */
export async function StandingsTableRSC({
  leagueId,
  entryFee = 0,
  prizePool = 0,
}: StandingsRscProps) {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

  let standings: LeagueStandingsEntry[] = [];

  try {
    const res = await fetch(
      `${apiBase}/api/v1/leagues/${leagueId}/standings`,
      {
        next: { revalidate: 60 },
        cache: "no-store",
      }
    );

    if (res.ok) {
      const json = (await res.json()) as {
        success: boolean;
        data: LeagueStandingsEntry[] | { standings: LeagueStandingsEntry[] };
      };

      if (json?.data) {
        standings = Array.isArray(json.data)
          ? json.data
          : json.data.standings;
      }
    }
  } catch (err) {
    console.error("[StandingsTableRSC] Failed to fetch standings:", err);
  }

  return (
    <StandingsTable
      standings={standings}
      entryFee={entryFee}
      prizePool={prizePool}
    />
  );
}
