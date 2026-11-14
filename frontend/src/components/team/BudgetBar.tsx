"use client";

import React from "react";
import { SQUAD_RULES } from "@/types";
import { IconFootball, IconAlertCircle, IconRefresh } from "@/components/ui/Icons";
import { Button } from "@/components/ui/Button";

import { useTeamStore } from "@/store/teamStore";

export interface BudgetBarProps {
  onAutoPick?: () => void;
  onReset?: () => void;
  isSaving?: boolean;
  onSave?: () => void;
  canSave?: boolean;
}

export const BudgetBar: React.FC<BudgetBarProps> = ({
  onAutoPick,
  onReset,
  isSaving = false,
  onSave,
  canSave = false,
}) => {
  const players = useTeamStore((state) => state.players);
  const spent = players.reduce((sum, p) => sum + (Number(p.player?.price) || 0), 0);
  const playerCount = players.length;
  const clubCounts: Record<number, number> = {};
  players.forEach((p) => {
    if (p.player?.teamId) {
      clubCounts[p.player.teamId] = (clubCounts[p.player.teamId] || 0) + 1;
    }
  });
  const maxBudget = SQUAD_RULES.STARTING_BUDGET;
  const spentM = Number(spent) || 0;
  const remainingM = maxBudget - spentM;
  const isOverBudget = remainingM < 0;

  // Find any club exceeding limit of 3
  const violatingClubs = Object.entries(clubCounts).filter(([_, count]) => count > SQUAD_RULES.MAX_PER_TEAM);

  return (
    <div className="w-full bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4" data-testid="budget-bar">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Key Metrics */}
        <div className="flex items-center gap-6 sm:gap-8">
          {/* Players Selected */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Players Picked
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                {playerCount}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                / {SQUAD_RULES.TOTAL_PLAYERS}
              </span>
            </div>
          </div>

          {/* Budget Spent */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Squad Value
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-xl sm:text-2xl font-black text-slate-900 font-mono">
                £{spentM.toFixed(1)}m
              </span>
            </div>
          </div>

          {/* Budget Remaining */}
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Remaining
            </div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span
                data-testid="budget-remaining"
                className={`text-xl sm:text-2xl font-black font-mono ${
                  isOverBudget ? "text-rose-600" : "text-emerald-700"
                }`}
              >
                £{remainingM.toFixed(1)}m
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {onAutoPick && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onAutoPick}
              className="text-xs font-semibold"
              title="Draft a valid, balanced squad within budget"
              data-testid="auto-pick-button"
            >
              <IconRefresh className="w-3.5 h-3.5 text-emerald-600" />
              <span>Auto-Pick Squad</span>
            </Button>
          )}

          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="text-xs text-slate-500 hover:text-rose-600 font-semibold"
            >
              Reset
            </Button>
          )}

          {onSave && (
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={!canSave || isSaving}
              isLoading={isSaving}
              onClick={onSave}
              className="uppercase font-bold tracking-wide text-xs px-5 rounded-xl"
              data-testid="save-squad-button"
            >
              Save Squad
            </Button>
          )}
        </div>
      </div>

      {/* Visual Budget Progress Bar */}
      <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden border border-slate-200">
        <div
          className={`h-full transition-all duration-300 rounded-full ${
            isOverBudget
              ? "bg-rose-500"
              : remainingM < 5
              ? "bg-amber-400"
              : "bg-emerald-500"
          }`}
          style={{ width: `${Math.min(100, (spentM / maxBudget) * 100)}%` }}
        />
      </div>

      {/* Warnings / Errors */}
      {isOverBudget && (
        <div data-testid="budget-over-warning" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2 shadow-sm font-medium">
          <IconAlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          <span>
            You have exceeded the £100.0m limit by £{Math.abs(remainingM).toFixed(1)}m. Replace or transfer players to balance budget.
          </span>
        </div>
      )}

      {violatingClubs.length > 0 && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2 shadow-sm font-medium">
          <IconAlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
          <span>
            Exceeded club limit: Maximum 3 players allowed from any Premier League team.
          </span>
        </div>
      )}
    </div>
  );
};
