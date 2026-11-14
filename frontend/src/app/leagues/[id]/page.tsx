"use client";

import React, { useState, useEffect, useCallback, use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { api, ApiError } from "@/lib/api";
import {
  League,
  LeagueStandingsEntry,
  Squad,
  MembershipStatus,
  LeagueStatus,
} from "@/types";
import { StandingsTable } from "@/components/leagues/StandingsTable";
import { HistoricalStandingsScrubber, type CompletedGameweek } from "@/components/leagues/HistoricalStandingsScrubber";
import { LeagueChat } from "@/components/chat/LeagueChat";
import { PrizeCalculator } from "@/components/leagues/PrizeCalculator";
import { PaymentModal } from "@/components/leagues/PaymentModal";
import { InvitationManager } from "@/components/leagues/InvitationManager";
import { CopyButton } from "@/components/ui/CopyButton";
import { getOnChainLeague, OnChainLeagueState } from "@/lib/stellar/sorobanAudit";
import { LiveMatchdayBar } from "@/components/live/LiveMatchdayBar";
import { LiveSquadModal } from "@/components/live/LiveSquadModal";
import { useLiveLeague } from "@/components/live/useLiveLeague";
import { LeagueStatusBadge, Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/context/ToastContext";
import {
  IconTrophy,
  IconCheck,
  IconAlertCircle,
  IconChevronLeft,
  IconShield,
  IconLock,
} from "@/components/ui/Icons";

export default function LeagueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const leagueId = resolvedParams.id;

  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [league, setLeague] = useState<League | null>(null);
  const [standings, setStandings] = useState<LeagueStandingsEntry[]>([]);
  const [completedGameweeks, setCompletedGameweeks] = useState<CompletedGameweek[]>([]);
  const [selectedGameweekId, setSelectedGameweekId] = useState<number | null>(null);
  const [historicalStandings, setHistoricalStandings] = useState<LeagueStandingsEntry[]>([]);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const historicalCache = useRef(new Map<number, LeagueStandingsEntry[]>());
  const [userSquads, setUserSquads] = useState<Squad[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<string>("");

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isJoining, setIsJoining] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [liveSquadUserId, setLiveSquadUserId] = useState<string | null>(null);
  const [onChainLeague, setOnChainLeague] = useState<OnChainLeagueState | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [depositEvidence, setDepositEvidence] = useState<{
    txHash: string;
    ledgerSeq?: number;
  } | null>(null);

  const escrowContractId =
    process.env.NEXT_PUBLIC_STELLAR_ESCROW_CONTRACT_ID ||
    "CB4KIK42P32SZHKG4JBDCJUV4A4KGCDN6RHOOTIFSBGZHS2IF653VOEA";
  const usdcAssetContract =
    process.env.NEXT_PUBLIC_STELLAR_USDC_TOKEN_CONTRACT_ID ||
    process.env.NEXT_PUBLIC_STELLAR_USDC_ISSUER ||
    "";
  const stellarExpertBase = "https://stellar.expert/explorer/testnet";

  // Live matchday feed (SSE) while the competition is running
  const { snapshot, rankChanges, freshEventKeys, connection } = useLiveLeague(
    leagueId,
    league?.status === LeagueStatus.ACTIVE
  );

  // Load league data, standings, and user squads
  const loadLeagueData = useCallback(async () => {
    try {
      // 1. Fetch league details
      const lgRes = await api.get<{ success: boolean; data: League }>(
        `/api/v1/leagues/${leagueId}`
      );
      if (lgRes?.data) {
        setLeague(lgRes.data);
      }

      // 2. Fetch standings
      const stdRes = await api.get<{
        success: boolean;
        data: LeagueStandingsEntry[] | { standings: LeagueStandingsEntry[]; completedGameweeks?: CompletedGameweek[] };
      }>(`/api/v1/leagues/${leagueId}/standings`);
      if (stdRes?.data) {
        const data = Array.isArray(stdRes.data) ? stdRes.data : stdRes.data;
        setStandings(Array.isArray(data) ? data : data.standings);
        if (!Array.isArray(data) && data.completedGameweeks) {
          setCompletedGameweeks(data.completedGameweeks);
          setSelectedGameweekId(data.completedGameweeks.at(-1)?.id ?? null);
        }
      }

      // 3. Fetch user's squads if logged in
      if (isAuthenticated) {
        const squadRes = await api.get<{ success: boolean; data: Squad[] }>(
          "/api/v1/squads/me"
        );
        if (squadRes?.data && squadRes.data.length > 0) {
          setUserSquads(squadRes.data);
          setSelectedSquadId(squadRes.data[0].id);
        }
      }
    } catch (err: unknown) {
      console.error("Failed to load league:", err);
      if (err instanceof ApiError) {
        setErrorMessage(err.message || "Failed to load league details.");
      } else {
        setErrorMessage("Could not load competition data.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [leagueId, isAuthenticated]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const lgRes = await api.get<{ success: boolean; data: League }>(
          `/api/v1/leagues/${leagueId}`
        );
        if (!cancelled && lgRes?.data) {
          setLeague(lgRes.data);
        }

        const stdRes = await api.get<{
          success: boolean;
          data: LeagueStandingsEntry[] | { standings: LeagueStandingsEntry[]; completedGameweeks?: CompletedGameweek[] };
        }>(`/api/v1/leagues/${leagueId}/standings`);
        if (!cancelled && stdRes?.data) {
          const data = stdRes.data;
          setStandings(Array.isArray(data) ? data : data.standings);
          if (!Array.isArray(data) && data.completedGameweeks) {
            setCompletedGameweeks(data.completedGameweeks);
            setSelectedGameweekId(data.completedGameweeks.at(-1)?.id ?? null);
          }
        }

        if (isAuthenticated) {
          const squadRes = await api.get<{ success: boolean; data: Squad[] }>(
            "/api/v1/squads/me"
          );
          if (!cancelled && squadRes?.data && squadRes.data.length > 0) {
            setUserSquads(squadRes.data);
            setSelectedSquadId(squadRes.data[0].id);
          }
        }
      } catch (err: unknown) {
        if (!cancelled) {
          if (err instanceof ApiError) {
            setErrorMessage(err.message || "Failed to load league details.");
          } else {
            setErrorMessage("Could not load competition data.");
          }
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [leagueId, isAuthenticated]);

  useEffect(() => {
    if (selectedGameweekId === null) return;
    const cached = historicalCache.current.get(selectedGameweekId);
    if (cached) {
      setHistoricalStandings(cached);
      setHistoricalLoading(false);
      setHistoricalError(null);
      return;
    }
    let cancelled = false;
    setHistoricalLoading(true);
    setHistoricalError(null);
    setHistoricalStandings([]);
    api.get<{ success: boolean; data: { standings: LeagueStandingsEntry[] } }>(
      `/api/v1/leagues/${leagueId}/standings?gameweekId=${selectedGameweekId}`
    ).then((response) => {
      if (!cancelled && response?.data) {
        historicalCache.current.set(selectedGameweekId, response.data.standings);
        setHistoricalStandings(response.data.standings);
      }
    }).catch((error: unknown) => {
      if (!cancelled) {
        console.error("Failed to load historical standings:", error);
        setHistoricalError("Could not load standings for this gameweek. Move the slider to try another week.");
      }
    }).finally(() => {
      if (!cancelled) setHistoricalLoading(false);
    });
    return () => { cancelled = true; };
  }, [leagueId, selectedGameweekId]);

  useEffect(() => {
    if (!league || league.entryFee <= 0) return;

    let cancelled = false;
    getOnChainLeague(leagueId, { contractId: escrowContractId })
      .then((state) => {
        if (!cancelled) setOnChainLeague(state);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOnChainLeague(null);
          setAuditError(error instanceof Error ? error.message : "RPC unavailable");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [league, leagueId, escrowContractId]);

  // Join league
  const handleJoinLeague = async () => {
    if (!isAuthenticated) {
      router.push(`/login?returnTo=/leagues/${leagueId}`);
      return;
    }

    if (!selectedSquadId) {
      const msg = "Please select a squad to enter this league.";
      setErrorMessage(msg);
      toast.warning(msg);
      return;
    }

    setIsJoining(true);
    setErrorMessage(null);

    try {
      await api.post(`/api/v1/leagues/${leagueId}/join`, {
        squadId: selectedSquadId,
      });

      toast.success(`Successfully joined ${league?.name || "league"}!`);

      // Reload standings
      await loadLeagueData();

      // If this league has an entry fee, open payment modal automatically!
      if (league && league.entryFee > 0) {
        setShowPaymentModal(true);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof ApiError
          ? err.message || "Failed to join league."
          : err instanceof Error
            ? err.message
            : "An unexpected error occurred.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsJoining(false);
    }
  };

  // Live standings replace the static table while the feed is streaming
  const liveStandings = snapshot?.standings ?? [];
  const displayStandings: LeagueStandingsEntry[] =
    liveStandings.length > 0
      ? liveStandings.map((live) => {
          const base = standings.find((s) => s.userId === live.userId);
          return {
            bestGameweekPoints: base?.bestGameweekPoints ?? 0,
            gameweekScores: base?.gameweekScores ?? [],
            joinedAt: base?.joinedAt ?? "",
            rank: live.rank,
            userId: live.userId,
            username: live.username,
            squadId: live.squadId,
            squadName: live.squadName,
            membershipStatus: live.membershipStatus,
            totalPoints: live.totalPoints,
          };
        })
      : standings;
  const livePoints =
    liveStandings.length > 0
      ? Object.fromEntries(liveStandings.map((s) => [s.userId, s.livePoints]))
      : undefined;
  const liveSquadEntry = liveStandings.find((s) => s.userId === liveSquadUserId);

  // Check if current user is already a member
  const myEntry = user ? standings.find((s) => s.userId === user.id) : null;
  const isMember = !!myEntry;
  const hasPaid = myEntry?.membershipStatus === MembershipStatus.ACTIVE || league?.entryFee === 0;
  const isCreator = !!user && league?.creatorId === user.id;

  if (isLoading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <div className="inline-block w-8 h-8 border-2 border-[#37003c] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs font-medium text-slate-500">Loading competition standings & escrow state...</p>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="py-20 text-center space-y-4 bg-white border border-slate-200/80 rounded-3xl p-8 max-w-lg mx-auto shadow-sm">
        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mx-auto border border-rose-200">
          <IconAlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-black text-slate-900 tracking-tight">League Not Found</h2>
        <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
          The competition requested does not exist or may have been deleted.
        </p>
        <Link href="/leagues">
          <Button variant="primary" size="md" className="font-bold text-xs bg-[#37003c] text-white hover:bg-[#28002c] rounded-xl shadow-sm">
            Return to Leagues
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top back navigation */}
      <div>
        <Link
          href="/leagues"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#37003c] font-bold transition-colors"
        >
          <IconChevronLeft className="w-4 h-4" />
          <span>Back to All Leagues</span>
        </Link>
      </div>

      {/* League Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <LeagueStatusBadge status={league.status} />
              {league.teamVisibility === "PRIVATE" && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  <IconLock className="w-3 h-3 text-purple-700" />
                  <span>Private Team Mode</span>
                </span>
              )}
              {league.isPrivate && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  <IconShield className="w-3 h-3" />
                  <span>Private</span>
                </span>
              )}
              <span className="text-xs font-mono font-bold text-slate-400">
                GW {league.startGameweekId} &rarr; GW {league.endGameweekId}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {league.name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl leading-relaxed">
              {league.description || "Official FantasyXI Competition."}
            </p>
          </div>

          {/* Invite Code Widget */}
          {league.inviteCode && (
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-purple-50/60 border border-purple-100 self-start md:self-auto">
              <div>
                <div className="text-[10px] uppercase font-bold text-purple-900/70">Invite Code</div>
                <div className="font-mono font-black text-[#37003c] tracking-widest text-sm">
                  {league.inviteCode}
                </div>
              </div>
              <CopyButton value={league.inviteCode} ariaLabel="Copy invite code" />
            </div>
          )}
        </div>

        {/* 4 Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-100 font-mono">
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Entry Fee</span>
            <div className="text-lg font-black text-slate-900 mt-0.5">
              {league.entryFee > 0 ? `${league.entryFee} USDC` : "Free"}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Prize Pool</span>
            <div className="text-lg font-black text-amber-600 mt-0.5">
              ${league.prizePool || 0} USDC
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Participants</span>
            <div className="text-lg font-black text-slate-800 mt-0.5">
              {league.currentMembers} / {league.maxMembers}
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/70">
            <span className="text-[10px] text-slate-400 uppercase font-sans font-bold">Escrow Verification</span>
            <div className="text-sm font-bold text-emerald-700 mt-1 flex items-center gap-1.5 font-sans">
              <IconShield className="w-4 h-4 text-emerald-600" />
              <span>Smart Escrow</span>
            </div>
          </div>
        </div>

        {/* User Status / Action Bar */}
        <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            {!isAuthenticated ? (
              <span className="text-xs text-slate-500 font-medium">
                Sign in to join this competition with your fantasy squad.
              </span>
            ) : isMember ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Your Status:</span>
                {hasPaid ? (
                  <Badge variant="success" className="gap-1 font-bold">
                    <IconCheck className="w-3.5 h-3.5" />
                    <span>Entered & Escrow Confirmed</span>
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1 font-bold">
                    <IconAlertCircle className="w-3.5 h-3.5" />
                    <span>Entry Pending Payment</span>
                  </Badge>
                )}
              </div>
            ) : league.isPrivate ? (
              <span className="text-xs text-slate-500 font-medium">
                This is a private league. Ask the creator for an invitation link to join.
              </span>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-700">Enter with Squad:</span>
                {userSquads.length > 0 ? (
                  <select
                    value={selectedSquadId}
                    onChange={(e) => setSelectedSquadId(e.target.value)}
                    className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs font-medium focus:outline-none focus:border-[#37003c]"
                  >
                    {userSquads.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.totalPoints} pts)
                      </option>
                    ))}
                  </select>
                ) : (
                  <Link href="/team" className="text-xs text-emerald-700 hover:underline font-bold">
                    Create a squad first &rarr;
                  </Link>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isAuthenticated ? (
              <Link href={`/login?returnTo=/leagues/${leagueId}`}>
                <Button variant="primary" size="md" className="font-bold tracking-wide text-xs bg-[#37003c] text-white hover:bg-[#28002c] rounded-xl shadow-sm">
                  Sign In to Join
                </Button>
              </Link>
            ) : isMember && !hasPaid && league.entryFee > 0 ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={() => setShowPaymentModal(true)}
                className="font-bold tracking-wide text-xs bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl shadow-sm"
              >
                Pay {league.entryFee} USDC Entry Fee
              </Button>
            ) : !isMember && !league.isPrivate ? (
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={isJoining || userSquads.length === 0}
                isLoading={isJoining}
                onClick={handleJoinLeague}
                className="font-bold tracking-wide text-xs bg-[#37003c] text-white hover:bg-[#28002c] rounded-xl shadow-sm"
              >
                Join League
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 animate-shake">
          <IconAlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span className="font-bold">{errorMessage}</span>
        </div>
      )}

      {/* Live matchday: fixtures, clock and event ticker */}
      {league.status === LeagueStatus.ACTIVE && (
        <LiveMatchdayBar
          snapshot={snapshot}
          connection={connection}
          freshEventKeys={freshEventKeys}
        />
      )}

      {/* Main Grid: Standings + Prize Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Standings Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <IconTrophy className="w-5 h-5 text-amber-500" />
                  <span>League Standings</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {livePoints
                    ? "Live leaderboard · click a manager to inspect their lineup"
                    : "Leaderboard updated after each gameweek resolution"}
                </p>
              </div>

              <div className="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-3 py-1 rounded-xl border border-slate-200/60">
                {standings.length} Teams
              </div>
            </div>

            <ErrorBoundary
              name="LeagueStandings"
              fallbackTitle="Standings table encountered an error"
              onReset={loadLeagueData}
              resetKeys={[leagueId, selectedGameweekId]}
            >
              {completedGameweeks.length > 0 && selectedGameweekId !== null ? (
                <HistoricalStandingsScrubber
                  gameweeks={completedGameweeks}
                  selectedGameweekId={selectedGameweekId}
                  standings={historicalStandings}
                  loading={historicalLoading}
                  error={historicalError}
                  onSelectGameweek={setSelectedGameweekId}
                  entryFee={league.entryFee}
                  prizePool={league.prizePool}
                  currentUserId={user?.id}
                />
              ) : (
                <StandingsTable
                  standings={displayStandings}
                  entryFee={league.entryFee}
                  prizePool={league.prizePool}
                  currentUserId={user?.id}
                  livePoints={livePoints}
                  rankChanges={rankChanges}
                  teamVisibility={league.teamVisibility}
                  onSelectEntry={
                    livePoints
                      ? (userId) => {
                          if (league.teamVisibility === "PRIVATE" && userId !== user?.id) {
                            toast.info(
                              "Private Team Mode: This manager's team is private. You can follow their performance on the leaderboard without viewing their squad."
                            );
                            return;
                          }
                          setLiveSquadUserId(userId);
                        }
                      : undefined
                  }
                />
              )}
            </ErrorBoundary>
          </div>

          {user && (isMember || isCreator) && (
            <ErrorBoundary
              name="LeagueChat"
              fallbackTitle="League chat temporarily unavailable"
              resetKeys={[league.id]}
            >
              <LeagueChat leagueId={league.id} currentUser={{ id: user.id, username: user.username }} />
            </ErrorBoundary>
          )}
        </div>

        {/* Right 1 Col: Prize Payout Calculator & Rules */}
        <div className="space-y-6">
          {league.isPrivate && isCreator && league.status === LeagueStatus.UPCOMING && (
            <InvitationManager leagueId={league.id} />
          )}

          <PrizeCalculator entryFee={league.entryFee} participants={league.currentMembers || league.maxMembers} />

          {league.entryFee > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
                    <IconShield className="w-4 h-4 text-emerald-600" />
                    <span>On-chain escrow audit</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-1">Soroban RPC · get_league</p>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${
                  onChainLeague &&
                  onChainLeague.totalDeposited >= league.entryFee * league.currentMembers &&
                  onChainLeague.participantCount >= league.currentMembers
                    ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                    : "text-amber-700 bg-amber-50 border-amber-200"
                }`}>
                  {onChainLeague ? `${Math.min(100, Math.round((onChainLeague.totalDeposited / Math.max(league.entryFee * league.currentMembers, 1)) * 100))}% solvent` : "Checking"}
                </span>
              </div>

              {onChainLeague ? (
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">On-chain deposits</div>
                    <div className="text-slate-900 font-black mt-0.5">{onChainLeague.totalDeposited.toFixed(2)} USDC</div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-3">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-bold">Participants</div>
                    <div className="text-slate-900 font-black mt-0.5">{onChainLeague.participantCount} / {league.currentMembers}</div>
                  </div>
                  <div className="col-span-2 flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span>Contract status</span>
                    <span className="text-emerald-700 font-bold uppercase">{onChainLeague.status}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">{auditError || "Reading escrow state..."}</p>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-2 text-[11px] font-bold pt-1 border-t border-slate-100">
                <a href={`${stellarExpertBase}/contract/${escrowContractId}`} target="_blank" rel="noreferrer" className="text-purple-900 hover:text-purple-700 underline">Escrow contract</a>
                {usdcAssetContract && <a href={`${stellarExpertBase}/contract/${usdcAssetContract}`} target="_blank" rel="noreferrer" className="text-purple-900 hover:text-purple-700 underline">USDC asset</a>}
                {depositEvidence && <a href={`${stellarExpertBase}/tx/${depositEvidence.txHash}`} target="_blank" rel="noreferrer" className="text-purple-900 hover:text-purple-700 underline">Your deposit tx</a>}
                {depositEvidence?.ledgerSeq && <a href={`${stellarExpertBase}/ledger/${depositEvidence.ledgerSeq}`} target="_blank" rel="noreferrer" className="text-purple-900 hover:text-purple-700 underline">Ledger #{depositEvidence.ledgerSeq}</a>}
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-3 text-xs text-slate-500">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-2">
              <IconShield className="w-4 h-4 text-emerald-600" />
              <span>Smart Escrow Settlement</span>
            </h3>
            <ul className="space-y-2 leading-relaxed">
              <li>&bull; Entry fees are held in decentralized Soroban escrow.</li>
              <li>&bull; Standings are resolved using official FPL match data.</li>
              <li>&bull; Prizes are distributed automatically at the conclusion of Gameweek {league.endGameweekId}.</li>
              <li>&bull; 1st = 60%, 2nd = 30%, 3rd = 10% of total prize pool.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Live squad points */}
      {liveSquadEntry && (
        <LiveSquadModal
          entry={liveSquadEntry}
          events={snapshot?.events}
          onClose={() => setLiveSquadUserId(null)}
        />
      )}

      {/* USDC Payment Modal */}
      {showPaymentModal && myEntry && (
        <PaymentModal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          leagueId={league.id}
          leagueName={league.name}
          squadId={myEntry.squadId}
          entryFee={league.entryFee}
          onPaymentSuccess={(deposit) => {
            setDepositEvidence(deposit);
            loadLeagueData();
          }}
        />
      )}
    </div>
  );
}
