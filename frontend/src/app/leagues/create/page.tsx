"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import { Gameweek, League, ScoringType, TeamVisibility } from "@/types";
import { PrizeCalculator } from "@/components/leagues/PrizeCalculator";
import { Button } from "@/components/ui/Button";
import {
  IconTrophy,
  IconShield,
  IconAlertCircle,
  IconCheck,
  IconChevronLeft,
  IconLock,
  IconEye,
} from "@/components/ui/Icons";

export default function CreateLeaguePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryFee, setEntryFee] = useState<number>(10);
  const [maxMembers, setMaxMembers] = useState<number>(10);
  const [startGameweekId, setStartGameweekId] = useState<number>(1);
  const [endGameweekId, setEndGameweekId] = useState<number>(5);
  const [isPrivate, setIsPrivate] = useState(false);
  const [teamVisibility, setTeamVisibility] = useState<TeamVisibility>(TeamVisibility.PUBLIC);

  const [isLoadingGw, setIsLoadingGw] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Require auth
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login?returnTo=/leagues/create");
    }
  }, [isAuthenticated, authLoading, router]);

  // Load gameweeks
  useEffect(() => {
    async function loadGameweeks() {
      try {
        const res = await api.get<{ success: boolean; data: Gameweek[] }>("/api/v1/gameweeks");
        if (res?.data && res.data.length > 0) {
          setGameweeks(res.data);
          const current = res.data.find((g) => g.isCurrent) || res.data[0];
          setStartGameweekId(current.id);
          // Default end to 4 gameweeks later or max available
          const endIdx = Math.min(res.data.length - 1, res.data.indexOf(current) + 4);
          setEndGameweekId(res.data[endIdx].id);
        }
      } catch (err) {
        console.error("Failed to load gameweeks:", err);
      } finally {
        setIsLoadingGw(false);
      }
    }

    loadGameweeks();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Please give your fantasy league a name.");
      return;
    }

    if (maxMembers < 2 || maxMembers > 100) {
      setErrorMessage("Participant capacity must be between 2 and 100 managers.");
      return;
    }

    if (startGameweekId > endGameweekId) {
      setErrorMessage("Start Gameweek cannot be after End Gameweek.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await api.post<{ success: boolean; data: League }>("/api/v1/leagues", {
        name: name.trim(),
        description: description.trim() || undefined,
        entryFee: Number(entryFee),
        maxMembers: Number(maxMembers),
        startGameweekId: Number(startGameweekId),
        endGameweekId: Number(endGameweekId),
        scoringType: ScoringType.CLASSIC,
        isPrivate,
        teamVisibility,
      });

      if (res?.data?.id) {
        router.push(`/leagues/${res.data.id}`);
      } else {
        router.push("/leagues");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Failed to create league.");
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("An unexpected error occurred while creating the league.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top back link */}
      <div>
        <Link
          href="/leagues"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-emerald-400 font-semibold transition-colors"
        >
          <IconChevronLeft className="w-4 h-4" />
          <span>Back to Leagues Hub</span>
        </Link>
      </div>

      {/* Header */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
            Competition Builder
          </span>
          <span className="text-xs text-slate-400 font-mono">&bull; Soroban Escrow Enabled</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase tracking-tight">
          Create Fantasy League
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
          Set your entry fee, choose the Premier League gameweek duration, and invite fellow managers.
        </p>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2.5 font-semibold animate-shake">
          <IconAlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2-Column Form & Live Prize Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Left Form: 3 cols */}
        <form onSubmit={handleSubmit} className="lg:col-span-3 space-y-5 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm">
          {/* League Name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              League Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Premier League Legends"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-[#37003c] focus:ring-1 focus:ring-[#37003c]"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Description <span className="text-slate-400 font-normal lowercase">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your competition rules or banter..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 text-xs focus:outline-none focus:border-[#37003c] focus:ring-1 focus:ring-[#37003c] resize-none"
            />
          </div>

          {/* Entry Fee in USDC */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Entry Fee (USDC)
              </label>
              <span className="text-[10px] text-slate-400">Set 0 for free league</span>
            </div>
            <div className="grid grid-cols-4 gap-2 mb-2">
              {[0, 5, 10, 25].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setEntryFee(amt)}
                  className={`py-1.5 rounded-xl text-xs font-mono font-bold uppercase transition-colors cursor-pointer ${
                    entryFee === amt
                      ? "bg-[#37003c] text-white shadow-xs"
                      : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {amt === 0 ? "Free" : `${amt} USDC`}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={0}
              max={1000}
              step={1}
              value={entryFee}
              onChange={(e) => setEntryFee(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-xs focus:outline-none focus:border-[#37003c] focus:ring-1 focus:ring-[#37003c]"
            />
          </div>

          {/* Max Participants */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Max Participant Capacity
            </label>
            <input
              type="number"
              min={2}
              max={100}
              value={maxMembers}
              onChange={(e) => setMaxMembers(Math.max(2, parseInt(e.target.value, 10) || 2))}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-xs focus:outline-none focus:border-[#37003c] focus:ring-1 focus:ring-[#37003c]"
            />
            <p className="text-[10px] text-slate-400 mt-1">Min 2, maximum 100 participants.</p>
          </div>

          {/* Duration Gameweeks */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Start Gameweek
              </label>
              <select
                value={startGameweekId}
                onChange={(e) => setStartGameweekId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#37003c] focus:ring-1 focus:ring-[#37003c]"
              >
                {gameweeks.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} {g.isCurrent ? "(Current)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                End Gameweek
              </label>
              <select
                value={endGameweekId}
                onChange={(e) => setEndGameweekId(parseInt(e.target.value, 10))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-[#37003c] focus:ring-1 focus:ring-[#37003c]"
              >
                {gameweeks.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Team Visibility Mode: Classic vs Private Team Mode */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Team Privacy Mode
              </label>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                FantasyXI Shielded Mode
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Classic League */}
              <div
                onClick={() => setTeamVisibility(TeamVisibility.PUBLIC)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  teamVisibility === TeamVisibility.PUBLIC
                    ? "bg-purple-50/50 border-[#37003c] ring-2 ring-[#37003c]/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-xl shrink-0 ${teamVisibility === TeamVisibility.PUBLIC ? "bg-[#37003c] text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
                    <IconEye className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Classic League</span>
                      {teamVisibility === TeamVisibility.PUBLIC && (
                        <span className="text-[9px] font-mono uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Standard fantasy football rules. Participating managers can inspect competitors&apos; squads and player selections.
                    </p>
                  </div>
                </div>
              </div>

              {/* Private Team League */}
              <div
                onClick={() => setTeamVisibility(TeamVisibility.PRIVATE)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                  teamVisibility === TeamVisibility.PRIVATE
                    ? "bg-purple-50/50 border-[#37003c] ring-2 ring-[#37003c]/20 shadow-xs"
                    : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-xl shrink-0 ${teamVisibility === TeamVisibility.PRIVATE ? "bg-[#37003c] text-white" : "bg-white text-slate-500 border border-slate-200"}`}>
                    <IconLock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Private Team League</span>
                      {teamVisibility === TeamVisibility.PRIVATE && (
                        <span className="text-[9px] font-mono uppercase bg-purple-100 text-purple-900 px-1.5 py-0.5 rounded font-bold">Shielded</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      Competitors compare points and rankings on the leaderboard, but cannot inspect each other&apos;s squad selections.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Note: Privacy mode is locked once the competition begins to protect managers&apos; tactical secrecy.
            </p>
          </div>

          {/* Visibility */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mt-0.5 accent-[#37003c]"
            />
            <span>
              <span className="block text-xs font-bold text-slate-800">
                Private League
              </span>
              <span className="block text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Hidden from public search. Managers can only join with a single-use invitation link you generate.
              </span>
            </span>
          </label>

          <div className="pt-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="w-full justify-center uppercase font-bold tracking-wide text-xs"
            >
              Deploy League &amp; Escrow
            </Button>
          </div>
        </form>

        {/* Right: Live Prize Calculator: 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Live Prize Simulation
          </div>
          <PrizeCalculator entryFee={entryFee} participants={maxMembers} />

          <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2 text-xs text-slate-500">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <IconCheck className="w-4 h-4 text-emerald-600" />
              <span>Soroban Automated Payouts</span>
            </div>
            <p className="leading-relaxed text-[11px]">
              When the final gameweek concludes, scores are locked and prizes are automatically settled to the top 3 managers on Stellar Testnet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
