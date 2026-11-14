"use client";

import React from "react";
import { LiveFixture, LivePlayerEvent, LiveSnapshot } from "@/types";
import { LiveConnectionState, liveEventKey } from "./useLiveLeague";

export interface LiveMatchdayBarProps {
  snapshot: LiveSnapshot | null;
  connection: LiveConnectionState;
  freshEventKeys: Set<string>;
}

function matchClock(f: LiveFixture): string {
  if (f.finished) return "FT";
  if (f.started) return `${f.minutes}'`;
  if (!f.kickoffTime) return "TBC";
  return new Date(f.kickoffTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function eventLabels(e: LivePlayerEvent): Array<{ label: string; className: string }> {
  const labels: Array<{ label: string; className: string }> = [];
  if (e.goals) labels.push({ label: e.goals > 1 ? `Goal x${e.goals}` : "Goal", className: "text-emerald-300" });
  if (e.assists) labels.push({ label: e.assists > 1 ? `Assist x${e.assists}` : "Assist", className: "text-sky-300" });
  if (e.yellowCards) labels.push({ label: "Yellow", className: "text-amber-300" });
  if (e.redCards) labels.push({ label: "Red", className: "text-rose-400" });
  if (e.saves) labels.push({ label: `${e.saves} saves`, className: "text-slate-300" });
  if (e.bonus) labels.push({ label: `+${e.bonus} bonus`, className: "text-violet-300" });
  return labels;
}

export const LiveMatchdayBar: React.FC<LiveMatchdayBarProps> = ({
  snapshot,
  connection,
  freshEventKeys,
}) => {
  const fixtures = [...(snapshot?.fixtures ?? [])].sort(
    (a, b) => Number(b.started && !b.finished) - Number(a.started && !a.finished)
  );
  const events = snapshot?.events ?? [];
  const isLive = connection === "live";

  return (
    <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${isLive ? "bg-rose-500 animate-pulse" : "bg-slate-400"}`}
          />
          <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
            Live {snapshot?.gameweek ? `· ${snapshot.gameweek.name}` : "Matchday"}
          </h2>
        </div>
        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-50 px-2.5 py-0.5 rounded-full border border-slate-200">
          {connection === "live" ? "Streaming" : connection === "reconnecting" ? "Reconnecting..." : "Connecting..."}
        </span>
      </div>

      {/* Fixtures with match clock and score */}
      {fixtures.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {fixtures.map((f) => {
            const inPlay = f.started && !f.finished;
            return (
              <div
                key={f.id}
                className={`flex-shrink-0 px-3 py-2 rounded-2xl border text-xs font-mono ${
                  inPlay ? "border-rose-300 bg-rose-50/70" : "border-slate-200/80 bg-slate-50/80"
                }`}
              >
                <div className="flex items-center gap-2 text-slate-900 font-bold">
                  <span>{f.homeTeam}</span>
                  <span className="tabular-nums">
                    {f.started ? `${f.homeScore ?? 0} - ${f.awayScore ?? 0}` : "v"}
                  </span>
                  <span>{f.awayTeam}</span>
                </div>
                <div className={`text-[10px] text-center mt-0.5 ${inPlay ? "text-rose-400" : "text-slate-500"}`}>
                  {matchClock(f)}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-slate-500">No fixtures for the current gameweek.</p>
      )}

      {/* Event ticker */}
      {events.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 border-t border-slate-800/80 pt-3">
          {events.map((e) => {
            const fresh = freshEventKeys.has(liveEventKey(e));
            return (
              <div
                key={e.playerId}
                className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                  fresh
                    ? "border-emerald-400/60 bg-emerald-500/10 animate-pulse"
                    : "border-slate-800 bg-slate-950/60"
                }`}
              >
                <span className="font-semibold text-white">{e.playerName}</span>
                <span className="text-slate-500">{e.teamShortName}</span>
                {eventLabels(e).map((l) => (
                  <span key={l.label} className={`font-bold ${l.className}`}>
                    {l.label}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
