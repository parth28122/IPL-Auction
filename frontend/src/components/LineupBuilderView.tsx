"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  RotateCcw, 
  Send, 
  Lock, 
  Globe2, 
  Crosshair, 
  HelpCircle,
  Award,
  Zap,
  Flame,
  ArrowRightLeft,
  Crown
} from "lucide-react";
import { SLOTS_CONFIG, BENCH_SLOTS, getClientCaptainStats } from "@/lib/constants";
import { Player, RoomState, Team } from "@/types";

interface LineupBuilderViewProps {
  roomState: RoomState;
  myTeamId: string;
  onSubmitLineup: (playingXi: string[], bench: string[], captainId?: string) => void;
  onTriggerEvaluation?: () => void;
}

export const LineupBuilderView: React.FC<LineupBuilderViewProps> = ({
  roomState,
  myTeamId,
  onSubmitLineup,
  onTriggerEvaluation
}) => {
  const myTeam = roomState.teams?.[myTeamId];
  const squad = myTeam?.players || [];

  // Playing XI slots: array of length 11 (player IDs or null)
  const [playingXi, setPlayingXi] = useState<(string | null)[]>(Array(11).fill(null));
  // Bench slots: array of length up to 7 (player IDs or null)
  const [bench, setBench] = useState<(string | null)[]>(Array(BENCH_SLOTS.length).fill(null));
  // Crowned Captain ID
  const [captainId, setCaptainId] = useState<string | null>(myTeam?.captain_id || null);

  // Dragging state
  const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
  const [selectedInventoryPlayer, setSelectedInventoryPlayer] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Load existing lineup if already saved in team
  useEffect(() => {
    if (myTeam?.playing_xi && myTeam.playing_xi.length > 0) {
      const xi = Array(11).fill(null);
      myTeam.playing_xi.forEach((pid, idx) => {
        if (idx < 11) xi[idx] = pid;
      });
      setPlayingXi(xi);
    }
    if (myTeam?.bench && myTeam.bench.length > 0) {
      const b = Array(BENCH_SLOTS.length).fill(null);
      myTeam.bench.forEach((pid, idx) => {
        if (idx < BENCH_SLOTS.length) b[idx] = pid;
      });
      setBench(b);
    }
    if (myTeam?.captain_id) {
      setCaptainId(myTeam.captain_id);
    }
  }, [myTeam?.playing_xi, myTeam?.bench, myTeam?.captain_id]);

  // Squad mapping
  const squadMap = new Map<string, Player>(squad.map(p => [p.id, p]));

  // Selected player IDs in XI & bench
  const selectedIds = new Set<string>();
  playingXi.forEach(id => id && selectedIds.add(id));
  bench.forEach(id => id && selectedIds.add(id));

  // Client-side Tactical Validations
  const xiPlayers = playingXi.map(id => id ? squadMap.get(id) : null).filter(Boolean) as Player[];
  const benchPlayers = bench.map(id => id ? squadMap.get(id) : null).filter(Boolean) as Player[];

  // 1. Overseas Count (Max 4)
  const overseasCount = xiPlayers.filter(p => p.is_overseas).length;
  const isOverseasValid = overseasCount <= 4;

  // 2. Wicketkeeper (Exactly 1)
  const wkCount = xiPlayers.filter(p => p.is_wicketkeeper).length;
  const isWkValid = wkCount === 1;

  // 3. Bowling Options (Min 5)
  const bowlingOptionsCount = xiPlayers.filter(p => p.is_bowling_option).length;
  const isBowlingValid = bowlingOptionsCount >= 5;

  // 4. Backup WK on bench (-15 injury risk penalty if 0 backup WK on bench)
  const benchWkCount = benchPlayers.filter(p => p.is_wicketkeeper).length;
  const hasBackupWk = benchWkCount >= 1;

  const isCompleteXi = playingXi.every(id => id !== null);

  const getPrimarySlots = (p: Player): number[] => {
    if (Array.isArray(p.primary_slot)) return p.primary_slot;
    if (typeof p.primary_slot === "number") return [p.primary_slot];
    return [];
  };

  // Auto-Fill Optimal Lineup logic
  const handleAutoFill = () => {
    const available = [...squad];
    const newXi: (string | null)[] = Array(11).fill(null);
    const assigned = new Set<string>();

    // Step 1: Assign 1 keeper
    const bestKeeper = available.find(p => p.is_wicketkeeper || p.is_wk || p.role === "WK");
    if (bestKeeper) {
      const slots = getPrimarySlots(bestKeeper);
      const targetSlot = slots[0] ? slots[0] - 1 : 4;
      const validSlot = targetSlot >= 0 && targetSlot < 11 ? targetSlot : 4;
      newXi[validSlot] = bestKeeper.id;
      assigned.add(bestKeeper.id);
    }

    // Step 2: Assign Openers (Slots 1 & 2)
    const openers = available.filter(p => !assigned.has(p.id) && (getPrimarySlots(p).includes(1) || getPrimarySlots(p).includes(2)));
    if (openers[0] && newXi[0] === null) {
      newXi[0] = openers[0].id;
      assigned.add(openers[0].id);
    }
    if (openers[1] && newXi[1] === null) {
      newXi[1] = openers[1].id;
      assigned.add(openers[1].id);
    }

    // Step 3: Assign Bowlers (Slots 8, 9, 10, 11)
    const bowlers = available.filter(p => !assigned.has(p.id) && (p.category === "Bowler" || p.role === "BOWL" || p.is_bowling_option));
    [10, 9, 8, 7].forEach((slotIdx, i) => {
      if (bowlers[i] && newXi[slotIdx] === null) {
        newXi[slotIdx] = bowlers[i].id;
        assigned.add(bowlers[i].id);
      }
    });

    // Step 4: Fill remaining slots with best available batters & all-rounders
    const remaining = available.filter(p => !assigned.has(p.id));
    for (let i = 0; i < 11; i++) {
      if (newXi[i] === null && remaining.length > 0) {
        const nextP = remaining.shift()!;
        newXi[i] = nextP.id;
        assigned.add(nextP.id);
      }
    }

    // Bench: up to BENCH_SLOTS.length remaining
    const newBench: (string | null)[] = Array(BENCH_SLOTS.length).fill(null);
    const unpicked = available.filter(p => !assigned.has(p.id));
    // Prioritize a backup WK on bench if available!
    const backupWk = unpicked.find(p => p.is_wicketkeeper || p.is_wk || p.role === "WK");
    if (backupWk) {
      newBench[0] = backupWk.id;
      assigned.add(backupWk.id);
    }
    const finalUnpicked = available.filter(p => !assigned.has(p.id));
    for (let b = 0; b < BENCH_SLOTS.length; b++) {
      if (newBench[b] === null && finalUnpicked.length > 0) {
        newBench[b] = finalUnpicked.shift()!.id;
      }
    }

    setPlayingXi(newXi);
    setBench(newBench);

    // Auto-crown highest rated captain from newXi
    const xiPlayerObjs = newXi.map(id => id ? squadMap.get(id) : null).filter(Boolean) as Player[];
    if (xiPlayerObjs.length > 0) {
      const bestLeader = xiPlayerObjs.reduce((prev, curr) => {
        const prevRating = getClientCaptainStats(prev)?.captaincy_rating || 50;
        const currRating = getClientCaptainStats(curr)?.captaincy_rating || 50;
        return currRating > prevRating ? curr : prev;
      });
      setCaptainId(bestLeader.id);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, playerId: string) => {
    e.dataTransfer.setData("text/plain", playerId);
    setDraggedPlayerId(playerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnXi = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
    if (!playerId) return;

    assignPlayerToXi(playerId, targetIndex);
    setDraggedPlayerId(null);
  };

  const handleDropOnBench = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const playerId = e.dataTransfer.getData("text/plain") || draggedPlayerId;
    if (!playerId) return;

    assignPlayerToBench(playerId, targetIndex);
    setDraggedPlayerId(null);
  };

  const assignPlayerToXi = (playerId: string, targetSlotIndex: number) => {
    const newXi = [...playingXi];
    const newBench = [...bench];

    // If player already in XI, swap or move
    const existingXiIdx = newXi.indexOf(playerId);
    const existingBenchIdx = newBench.indexOf(playerId);

    const displacedPlayer = newXi[targetSlotIndex];

    if (existingXiIdx !== -1) {
      // Swap within XI
      newXi[existingXiIdx] = displacedPlayer;
    } else if (existingBenchIdx !== -1) {
      // Move from bench to XI
      newBench[existingBenchIdx] = displacedPlayer;
    }

    newXi[targetSlotIndex] = playerId;
    setPlayingXi(newXi);
    setBench(newBench);
    setSelectedInventoryPlayer(null);
  };

  const assignPlayerToBench = (playerId: string, targetBenchIndex: number) => {
    const newXi = [...playingXi];
    const newBench = [...bench];

    const existingXiIdx = newXi.indexOf(playerId);
    const existingBenchIdx = newBench.indexOf(playerId);

    const displacedPlayer = newBench[targetBenchIndex];

    if (existingBenchIdx !== -1) {
      // Swap within bench
      newBench[existingBenchIdx] = displacedPlayer;
    } else if (existingXiIdx !== -1) {
      // Move from XI to bench
      newXi[existingXiIdx] = displacedPlayer;
    }

    newBench[targetBenchIndex] = playerId;
    setPlayingXi(newXi);
    setBench(newBench);
    setSelectedInventoryPlayer(null);
  };

  const removeFromXi = (index: number) => {
    const newXi = [...playingXi];
    newXi[index] = null;
    setPlayingXi(newXi);
  };

  const removeFromBench = (index: number) => {
    const newBench = [...bench];
    newBench[index] = null;
    setBench(newBench);
  };

  const handleSubmit = () => {
    const validXi = playingXi.filter(Boolean) as string[];
    const validBench = bench.filter(Boolean) as string[];
    const effectiveCaptain = (captainId && validXi.includes(captainId)) ? captainId : validXi[0];
    onSubmitLineup(validXi, validBench, effectiveCaptain);
  };

  const crownedPlayer = (captainId && squadMap.has(captainId)) ? squadMap.get(captainId) : (xiPlayers[0] || null);
  const captainStats = crownedPlayer ? getClientCaptainStats(crownedPlayer) : null;

  const filteredSquad = squad.filter(p => {
    if (categoryFilter === "All") return true;
    return p.category === categoryFilter;
  });

  const lineupTimer = roomState.lineup_timer ?? 150;
  const timerMinutes = Math.floor(lineupTimer / 60);
  const timerSeconds = lineupTimer % 60;
  const formattedTimer = `${timerMinutes}:${timerSeconds < 10 ? '0' : ''}${timerSeconds}`;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* 2-3 Minute Submission Deadline Countdown Banner */}
      <div className={`p-4 rounded-2xl border transition-all ${
        lineupTimer <= 30
          ? "bg-rose-950/40 border-rose-500/70 shadow-lg shadow-rose-500/20 animate-pulse"
          : lineupTimer <= 60
          ? "bg-amber-950/30 border-amber-500/60 shadow-md"
          : "bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border-indigo-500/40"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl font-mono font-black text-sm shrink-0 border ${
              lineupTimer <= 30
                ? "bg-rose-500 text-white border-rose-400 animate-bounce"
                : lineupTimer <= 60
                ? "bg-amber-500 text-slate-950 border-amber-400"
                : "bg-indigo-600/30 text-indigo-300 border-indigo-500/50"
            }`}>
              ⏱️ {formattedTimer}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-950/80 border border-white/10 text-white">
                  Lineup Deadline
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  {myTeam?.lineup_submitted 
                    ? "✓ Your Playing XI is locked and submitted!" 
                    : "Finalize your Playing XI before the timer expires"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Teams that do not submit in time will be auto-submitted. Teams with fewer than 18 players will be <strong className="text-rose-400 font-bold">ELIMINATED</strong>!
              </p>
            </div>
          </div>

          {/* Squad Roster Health Badge */}
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {squad.length < 18 ? (
              <span className="px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 font-bold text-xs flex items-center gap-1.5 animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                🚨 Squad Deficit: {squad.length}/18 (Elimination Risk!)
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ✓ Roster Compliant ({squad.length}/18 Players)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Top Tactical Status Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Phase 2: Tactics
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Playing XI & Bench Architect
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Drag players from your inventory into designated tactical slots. Ensure squad constraints are satisfied!
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAutoFill}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition shadow-sm cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Auto-Fill Optimal XI
            </button>

            <button
              onClick={handleSubmit}
              disabled={!isCompleteXi || myTeam?.lineup_submitted}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition shadow-lg ${
                myTeam?.lineup_submitted
                  ? "bg-emerald-600 text-white cursor-default"
                  : isCompleteXi
                  ? "bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/20 cursor-pointer"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-60"
              }`}
            >
              {myTeam?.lineup_submitted ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  Lineup Locked & Submitted
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Lock & Submit Playing XI
                </>
              )}
            </button>
          </div>
        </div>

        {/* Tactical Rules Validation Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800">
          {/* Overseas Limit */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
            isOverseasValid ? "bg-slate-950/60 border-slate-800" : "bg-rose-950/40 border-rose-600/60"
          }`}>
            <span className="text-xs text-slate-300 flex items-center gap-1.5">
              <Globe2 className="w-3.5 h-3.5 text-blue-400" />
              Overseas in XI:
            </span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              isOverseasValid ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/20 text-rose-300 animate-pulse"
            }`}>
              {overseasCount} / 4 Max
            </span>
          </div>

          {/* Wicketkeeper check */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
            isWkValid ? "bg-slate-950/60 border-slate-800" : "bg-amber-950/40 border-amber-600/60"
          }`}>
            <span className="text-xs text-slate-300">Wicketkeeper:</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              isWkValid ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/20 text-amber-300"
            }`}>
              {wkCount} / Exactly 1
            </span>
          </div>

          {/* Bowling balance check */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
            isBowlingValid ? "bg-slate-950/60 border-slate-800" : "bg-rose-950/40 border-rose-600/60"
          }`}>
            <span className="text-xs text-slate-300">Bowling Options:</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              isBowlingValid ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/20 text-rose-300"
            }`}>
              {bowlingOptionsCount} / Min 5
            </span>
          </div>

          {/* Backup WK on Bench check */}
          <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
            hasBackupWk ? "bg-slate-950/60 border-slate-800" : "bg-amber-950/40 border-amber-500/50"
          }`}>
            <span className="text-xs text-slate-300">Bench Backup WK:</span>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              hasBackupWk ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/20 text-amber-300"
            }`}>
              {hasBackupWk ? "✓ Protected" : "⚠️ -15 Risk"}
            </span>
          </div>
        </div>

        {/* Warning Banners */}
        {(!isOverseasValid || !isWkValid || !isBowlingValid || !hasBackupWk) && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
            {!isOverseasValid && (
              <p className="flex items-center gap-1.5 font-semibold text-rose-400">
                <AlertTriangle className="w-3.5 h-3.5" /> Overseas limit exceeded ({overseasCount}/4). Heavy point penalty will apply!
              </p>
            )}
            {!isWkValid && (
              <p className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Playing XI must contain exactly 1 designated Wicketkeeper (Currently: {wkCount}).
              </p>
            )}
            {!isBowlingValid && (
              <p className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Insufficient bowling options ({bowlingOptionsCount}/5). Need at least 5 bowlers to bowl 20 overs.
              </p>
            )}
            {!hasBackupWk && (
              <p className="flex items-center gap-1.5 text-amber-400 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> ⚠️ Squad has 0 backup Wicketkeeper on the bench! (-15 injury risk penalty will be deducted from your score).
              </p>
            )}
          </div>
        )}
      </div>

      {/* Crowned Captain Intelligence & Leadership Preview Card */}
      {crownedPlayer && captainStats && (
        <div className="bg-gradient-to-r from-slate-900 via-amber-950/20 to-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-300 p-0.5 shadow-md flex items-center justify-center shrink-0">
                <Crown className="w-4 h-4 text-slate-950 fill-slate-950" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <span>Crowned Team Captain:</span>
                  <span className="text-amber-300 font-mono">{crownedPlayer.name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {captainStats.tier}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {captainStats.tactical_style}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-400">Leadership Rating:</span>
              <span className="text-sm font-black font-mono text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-amber-500/30">
                {captainStats.captaincy_rating} / 100
              </span>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 font-mono">
                +{captainStats.leadership_bonus} pts bonus
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Captain Snapshot */}
            <div className="md:col-span-4 flex items-center gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
              <img
                src={crownedPlayer.avatar}
                alt={crownedPlayer.name}
                className="w-12 h-12 rounded-xl object-cover border-2 border-amber-400/50 shadow shrink-0"
              />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">Evaluation Engine</span>
                <span className="text-xs font-bold text-cyan-300 truncate block">
                  {captainStats.experience_source}
                </span>
                <span className="text-[11px] text-slate-400 block truncate">
                  {captainStats.tournament_team ? `${captainStats.tournament_team} • ` : ""}{crownedPlayer.role} • {crownedPlayer.is_overseas ? "Overseas" : "India"}
                </span>
              </div>
            </div>

            {/* Captain Metrics Grid */}
            <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans">IPL Matches Led</span>
                <span className="text-sm font-black text-amber-300">
                  {captainStats.ipl_matches > 0 ? captainStats.ipl_matches : "0 (Untested)"}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5 truncate">
                  {captainStats.ipl_matches > 0 ? `${captainStats.ipl_win_pct}% win rate` : `${captainStats.tournament_name ? captainStats.tournament_name.split(" ")[0] : "League"} fallback`}
                </span>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans truncate" title={captainStats.tournament_name || "Domestic / League Record"}>
                  {captainStats.tournament_name || "SMAT / State T20s"}
                </span>
                <span className="text-sm font-black text-cyan-300">
                  {captainStats.domestic_matches || captainStats.smat_matches} Matches
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {captainStats.domestic_win_pct || captainStats.smat_win_pct}% win rate
                </span>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans">Effective Win %</span>
                <span className="text-sm font-black text-emerald-400">
                  {captainStats.effective_win_pct}%
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  Leadership Index
                </span>
              </div>

              <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block font-sans">Trophy Pedigree</span>
                <span className="text-xs font-bold text-amber-300 truncate block">
                  {captainStats.trophies[0] || "Contender"}
                </span>
                <span className="text-[9px] text-slate-400 block mt-0.5">
                  {captainStats.trophies.length > 1 ? `+${captainStats.trophies.length - 1} honors` : "Knockout exp"}
                </span>
              </div>
            </div>
          </div>

          {captainStats.analysis && (
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-300 flex items-start gap-2">
              <span className="text-amber-400 shrink-0 font-bold font-sans">Scout Intel:</span>
              <span className="leading-relaxed font-sans">{captainStats.analysis}</span>
            </div>
          )}
        </div>
      )}

      {/* Main Split Layout: Left Inventory vs Right Playing XI Board */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Purchased Squad Inventory */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 sticky top-20">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Purchased Squad ({squad.length} Players)
              </h2>
              <span className="text-[11px] text-slate-400">
                Unassigned: {squad.length - selectedIds.size}
              </span>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              {["All", "Batter", "Keeper", "All-Rounder", "Bowler"].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                    categoryFilter === cat
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Inventory Player List */}
            <div className="space-y-2.5 max-h-[620px] overflow-y-auto pr-1">
              {filteredSquad.map(player => {
                const isAssignedToXi = playingXi.includes(player.id);
                const isAssignedToBench = bench.includes(player.id);
                const xiSlot = playingXi.indexOf(player.id);
                const benchSlot = bench.indexOf(player.id);
                const isSelected = selectedInventoryPlayer === player.id;

                return (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={e => handleDragStart(e, player.id)}
                    onClick={() => {
                      if (selectedInventoryPlayer === player.id) {
                        setSelectedInventoryPlayer(null);
                      } else {
                        setSelectedInventoryPlayer(player.id);
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                      isSelected
                        ? "bg-slate-800 border-amber-400 ring-2 ring-amber-400/20"
                        : isAssignedToXi
                        ? "bg-emerald-950/20 border-emerald-500/30 opacity-80"
                        : isAssignedToBench
                        ? "bg-cyan-950/20 border-cyan-500/30 opacity-80"
                        : "bg-slate-950/80 border-slate-800/80 hover:border-slate-700"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={player.avatar}
                          alt={player.name}
                          className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                            {player.name}
                            {player.is_overseas && (
                              <span className="text-[9px] px-1 py-0.2 bg-blue-500/20 text-blue-400 rounded">
                                OS
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">
                            {player.role} • Optimal Slots: {Array.isArray(player.primary_slot) ? player.primary_slot.join(", ") : String(player.primary_slot || "Flex")}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {isAssignedToXi && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                            Slot #{xiSlot + 1}
                          </span>
                        )}
                        {isAssignedToBench && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                            Bench #{benchSlot + 1}
                          </span>
                        )}
                        {!isAssignedToXi && !isAssignedToBench && (
                          <span className="text-[9px] font-semibold text-slate-500">
                            Drag to Slot
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stats pills */}
                    <div className="grid grid-cols-3 gap-1 mt-2 text-[10px] font-mono text-center bg-slate-900/60 p-1.5 rounded-lg">
                      <div>
                        <span className="text-slate-400 block text-[8px]">PP SR</span>
                        <span className="text-amber-300 font-bold">
                          {player.stats?.batting?.powerplay_sr || player.domestic_fallback?.powerplay_sr || 120}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px]">DTH SR</span>
                        <span className="text-emerald-400 font-bold">
                          {player.stats?.batting?.death_sr || player.domestic_fallback?.death_sr || 150}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[8px]">BOWL ECO</span>
                        <span className="text-cyan-400 font-bold">
                          {player.is_bowling_option 
                            ? (player.stats?.bowling?.powerplay_economy || 8.0) 
                            : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {squad.length === 0 && (
                <div className="py-12 text-center text-slate-500 text-xs">
                  Your squad has no players yet. Complete auction drafting first!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Visual Playing XI Board (Slots 1 to 11) + 4 Bench Slots */}
        <div className="lg:col-span-7 space-y-6">
          {/* Playing XI Pitch Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-amber-400" />
                Visual Playing XI (Slots 1 to 11)
              </h2>
              <span className="text-xs font-mono font-bold text-amber-300">
                {xiPlayers.length} / 11 Locked
              </span>
            </div>

            {/* 11 Slots Grid */}
            <div className="space-y-2.5">
              {SLOTS_CONFIG.map((slotConf, idx) => {
                const playerId = playingXi[idx];
                const player = playerId ? squadMap.get(playerId) : null;
                const isOptimal = player && (Array.isArray(player.primary_slot) ? player.primary_slot.includes(slotConf.slot) : player.primary_slot === slotConf.slot);
                const isCaptain = player && ((captainId === player.id) || (!captainId && idx === 0));

                return (
                  <div
                    key={slotConf.slot}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDropOnXi(e, idx)}
                    onClick={() => {
                      if (selectedInventoryPlayer) {
                        assignPlayerToXi(selectedInventoryPlayer, idx);
                      }
                    }}
                    className={`relative rounded-xl border p-3 transition flex items-center justify-between gap-3 ${
                      player
                        ? isCaptain
                          ? "bg-slate-950 border-amber-400 shadow-md shadow-amber-500/10 ring-1 ring-amber-400/30"
                          : "bg-slate-950 border-slate-800 hover:border-slate-700"
                        : "bg-slate-950/40 border-dashed border-slate-800 hover:border-amber-400/50 hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Slot Number Tag */}
                      <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-black text-amber-300 text-xs shrink-0 shadow-inner">
                        #{slotConf.slot}
                      </div>

                      {player ? (
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={player.avatar}
                            alt={player.name}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-700 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-white truncate">{player.name}</h4>
                              {isCaptain && (
                                <span className="text-[9px] font-black px-1.5 py-0.2 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 rounded shadow flex items-center gap-0.5">
                                  👑 (C)
                                </span>
                              )}
                              {player.is_overseas && (
                                <span className="text-[9px] px-1 bg-blue-500/20 text-blue-400 rounded">
                                  OS
                                </span>
                              )}
                              {player.is_wicketkeeper && (
                                <span className="text-[9px] px-1 bg-emerald-500/20 text-emerald-400 rounded">
                                  WK
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              {player.role} • {slotConf.title}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-400">{slotConf.title}</p>
                          <p className="text-[10px] text-slate-500 truncate">{slotConf.description}</p>
                        </div>
                      )}
                    </div>

                    {/* Right side affinity indicator, crown button & clear button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {player ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCaptainId(player.id);
                            }}
                            className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition shadow-sm cursor-pointer ${
                              isCaptain
                                ? "bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black shadow-amber-400/20"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 border border-slate-700"
                            }`}
                            title={isCaptain ? "Current Crowned Captain" : `Crown ${player.name} as Team Captain`}
                          >
                            <Crown className={`w-3 h-3 ${isCaptain ? "fill-slate-950 text-slate-950" : "text-amber-400"}`} />
                            <span>{isCaptain ? "Captain" : "Crown"}</span>
                          </button>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isOptimal
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}>
                            {isOptimal ? "Optimal Fit" : "Displaced"}
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              removeFromXi(idx);
                            }}
                            className="text-slate-500 hover:text-rose-400 text-xs p-1"
                            title="Remove from XI"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">
                          Drop Player Here
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bench Section (Up to 7 Slots for 18-Player Squads) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  Tactical Bench Redundancy ({BENCH_SLOTS.length} Slots)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Adds +20% redundancy score. A backup Wicketkeeper here prevents the -15 injury risk penalty!
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-300">
                {benchPlayers.length} / {BENCH_SLOTS.length}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BENCH_SLOTS.map((benchSlot, bIdx) => {
                const playerId = bench[bIdx];
                const player = playerId ? squadMap.get(playerId) : null;

                return (
                  <div
                    key={benchSlot.slot}
                    onDragOver={handleDragOver}
                    onDrop={e => handleDropOnBench(e, bIdx)}
                    onClick={() => {
                      if (selectedInventoryPlayer) {
                        assignPlayerToBench(selectedInventoryPlayer, bIdx);
                      }
                    }}
                    className={`rounded-xl border p-3 transition flex items-center justify-between gap-2 ${
                      player
                        ? "bg-slate-950 border-slate-800 hover:border-slate-700"
                        : "bg-slate-950/40 border-dashed border-slate-800 hover:border-cyan-400/50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-cyan-400 text-xs shrink-0">
                        B{benchSlot.slot}
                      </div>

                      {player ? (
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-white truncate flex items-center gap-1">
                            {player.name}
                            {player.is_wicketkeeper && (
                              <span className="text-[8px] px-1 bg-emerald-500/20 text-emerald-400 rounded">
                                Backup WK
                              </span>
                            )}
                          </h4>
                          <p className="text-[10px] text-slate-400 truncate">{player.role}</p>
                        </div>
                      ) : (
                        <div className="min-w-0">
                          <p className="text-xs text-slate-400 truncate">{benchSlot.title}</p>
                        </div>
                      )}
                    </div>

                    {player && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          removeFromBench(bIdx);
                        }}
                        className="text-slate-500 hover:text-rose-400 text-xs p-1"
                        title="Remove from Bench"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
