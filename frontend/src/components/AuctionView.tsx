"use client";

import React, { useEffect, useState } from "react";
import { 
  Flame, 
  Timer, 
  Gavel, 
  CheckCircle2, 
  XCircle, 
  Globe2, 
  ShieldAlert, 
  TrendingUp, 
  ArrowUpRight, 
  DollarSign, 
  Volume2, 
  AlertTriangle,
  History,
  Sparkles,
  Users,
  Layers,
  Eye,
  Megaphone,
  X,
  MessageSquare
} from "lucide-react";
import { formatPrice, MARQUEE_CAP_LAKHS, TOTAL_BUDGET_LAKHS } from "@/lib/constants";
import { sounds } from "@/lib/sounds";
import { Player, RoomState } from "@/types";
import { MidwaySquadModal } from "@/components/MidwaySquadModal";
import { PlayerPoolModal } from "@/components/PlayerPoolModal";

interface AuctionViewProps {
  roomState: RoomState;
  myTeamId: string;
  allPlayers?: Player[];
  onBid: (increment: number) => void;
  onPass: () => void;
  onOpenChat?: () => void;
}

export const AuctionView: React.FC<AuctionViewProps> = ({
  roomState,
  myTeamId,
  allPlayers = [],
  onBid,
  onPass,
  onOpenChat
}) => {
  const { current_player, current_bid, highest_bidder_id, highest_bidder_name, timer, teams } = roomState;
  const myTeam = teams?.[myTeamId];

  // Modal States for Mid-Auction Inspection
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);
  const [squadModalTeamId, setSquadModalTeamId] = useState<string>(myTeamId);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [dismissedTransitionTime, setDismissedTransitionTime] = useState<number | null>(null);

  // Play audio on low timer or bids
  useEffect(() => {
    if (timer <= 2 && timer > 0) {
      sounds.playWarning();
    } else if (timer > 0) {
      sounds.playTick();
    }
  }, [timer]);

  // Check bidding constraints for user
  const isMyHighestBid = highest_bidder_id === myTeamId;
  const hasPassed = roomState.passed_teams?.includes(myTeamId);

  const checkBidValidity = (increment: number) => {
    if (!myTeam || !current_player) return { valid: false, reason: "No active player" };
    if (isMyHighestBid) return { valid: false, reason: "You hold the highest bid" };
    if (hasPassed) return { valid: false, reason: "You passed on this player" };

    const squadSize = myTeam.players?.length || 0;
    if (squadSize >= 18) {
      return { valid: false, reason: "Squad is full (18/18 players acquired)" };
    }

    const isOverseas = Boolean(current_player.is_overseas || current_player.country === "Overseas");
    const currentOverseas = myTeam.players ? myTeam.players.filter(p => p.is_overseas || p.country === "Overseas").length : 0;
    if (isOverseas && currentOverseas >= 8) {
      return { valid: false, reason: "Overseas limit reached (8/8 in squad)" };
    }

    const newBid = highest_bidder_id ? current_bid + increment : current_bid;

    // Budget check
    if (myTeam.budget < newBid) {
      return { valid: false, reason: `Insufficient purse (₹${(myTeam.budget / 100).toFixed(2)} Cr remaining)` };
    }

    // Squad reserve purse check (must reserve ₹30L per remaining player needed to fill 18)
    const neededRemaining = Math.max(0, 18 - (squadSize + 1));
    const minReserve = neededRemaining * 30; // ₹30 Lakhs base price
    if (myTeam.budget - newBid < minReserve) {
      return { valid: false, reason: `Must reserve ₹${(minReserve / 100).toFixed(2)} Cr to complete 18-player squad` };
    }

    // Marquee cap check (Max 80 Cr)
    if (current_player.category === "Marquee") {
      if (myTeam.marquee_spent + newBid > MARQUEE_CAP_LAKHS) {
        const remainingCap = (MARQUEE_CAP_LAKHS - myTeam.marquee_spent) / 100;
        return { valid: false, reason: `Exceeds ₹80 Cr Marquee cap (₹${remainingCap.toFixed(2)} Cr left)` };
      }
    }

    return { valid: true, reason: "" };
  };

  const bid20 = checkBidValidity(20);
  const bid50 = checkBidValidity(50);
  const bid100 = checkBidValidity(100);

  const marqueeSpentCr = myTeam ? (myTeam.marquee_spent / 100) : 0;
  const marqueeCapCr = 80;
  const marqueePercent = Math.min(100, (marqueeSpentCr / marqueeCapCr) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6">
      {/* Top Banner with Quick Actions & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 rounded-xl px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-white">Live Hammer In Session</span>
          <span className="text-slate-500">•</span>
          <span className="text-amber-400 font-mono font-bold">
            {roomState.current_pool || "Marquee Set 1"}
          </span>
          <span className="text-slate-500">•</span>
          <span className="text-slate-400">Player {roomState.current_player_index + 1} of {roomState.total_players_in_queue}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View Squad Button */}
          <button
            onClick={() => {
              setSquadModalTeamId(myTeamId);
              setIsSquadModalOpen(true);
            }}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 hover:text-blue-200 text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
            title="Inspect your active squad or check rival squads midway in the auction"
          >
            <Users className="w-3.5 h-3.5 text-blue-400" />
            📋 View Squad ({myTeam?.players?.length || 0}/18)
          </button>

          {/* Player Pool Button */}
          <button
            onClick={() => setIsPoolModalOpen(true)}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
            title="Explore active set players, upcoming sets, and full player pool"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            📦 Player Pool & Sets
          </button>

          {/* Open Chat Button */}
          {onOpenChat && (
            <button
              onClick={onOpenChat}
              className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition shadow-sm cursor-pointer whitespace-nowrap"
              title="Open War Room Live Chat to banter with other managers"
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              💬 War Room Chat
            </button>
          )}
        </div>
      </div>

      {/* Official Set Transition TV-Broadcast Banner */}
      {roomState.latest_set_transition && dismissedTransitionTime !== roomState.latest_set_transition.timestamp && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-indigo-950/80 border-2 border-amber-500/60 p-4 sm:p-5 shadow-2xl animate-fadeIn">
          <div className="absolute top-0 right-0 w-80 h-full bg-amber-400/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="flex items-start sm:items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 font-black shrink-0 shadow-lg shadow-amber-500/30 animate-bounce">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 tracking-wider">
                    Official Set Announcement
                  </span>
                  {roomState.latest_set_transition.previous_set && (
                    <span className="text-[10px] font-medium text-slate-400">
                      Concluded: <strong className="text-slate-300">{roomState.latest_set_transition.previous_set}</strong>
                    </span>
                  )}
                </div>
                <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {roomState.latest_set_transition.message}
                </h3>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
              <button
                onClick={() => setIsPoolModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow flex items-center gap-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                Explore {roomState.latest_set_transition.current_set}
              </button>
              <button
                onClick={() => setDismissedTransitionTime(roomState.latest_set_transition?.timestamp || null)}
                className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
                title="Dismiss announcement"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Breaking News Ticker / Live Flashcard */}
      {roomState.latest_news && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950/30 to-slate-900 border border-amber-500/40 p-4 shadow-xl animate-fadeIn">
          <div className="absolute top-0 right-0 w-64 h-full bg-amber-500/10 blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 relative z-10">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider shadow-md shrink-0 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                Breaking News
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                roomState.latest_news.news_type === "STEAL"
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : roomState.latest_news.news_type === "BIDDING_WAR"
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                  : roomState.latest_news.news_type === "RECORD_BREAKER"
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
              }`}>
                {roomState.latest_news.badge}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400">
              <span>{roomState.latest_news.player_name}</span>
              <span className="text-slate-500">•</span>
              <span className="text-emerald-400">₹{roomState.latest_news.amount_cr.toFixed(2)} Cr</span>
            </div>
          </div>

          <div className="mt-2 space-y-0.5 relative z-10">
            <h4 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-snug">
              {roomState.latest_news.headline}
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {roomState.latest_news.news_body}
            </p>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2 text-[10px] relative z-10">
            {roomState.latest_news.buyer_slogan && (
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold">
                📢 {roomState.latest_news.buyer_name}: "{roomState.latest_news.buyer_slogan}"
              </span>
            )}
            {roomState.latest_news.rival_name && (
              <span className="px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300 font-medium">
                ⚔️ Rival Outbid: {roomState.latest_news.rival_name}
              </span>
            )}
            <span className="text-slate-500 ml-auto font-mono text-[9px]">
              Live Arena Bulletin
            </span>
          </div>
        </div>
      )}

      {/* Top Stats Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* User Purse Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
            Your Purse Remaining
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
              ₹{myTeam ? (myTeam.budget / 100).toFixed(2) : "120.00"} Cr
            </span>
            <span className="text-xs text-slate-500">/ ₹120 Cr</span>
          </div>
          {/* Purse bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${myTeam ? (myTeam.budget / TOTAL_BUDGET_LAKHS) * 100 : 100}%` }}
            />
          </div>
        </div>

        {/* Marquee Cap Card */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Marquee Pool Cap
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              marqueePercent >= 80 ? "bg-rose-500/20 text-rose-300" : "bg-amber-500/20 text-amber-300"
            }`}>
              Max ₹80 Cr
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-amber-400">
              ₹{marqueeSpentCr.toFixed(2)} Cr
            </span>
            <span className="text-xs text-slate-500">/ ₹80 Cr</span>
          </div>
          {/* Cap bar */}
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-300 ${
                marqueePercent >= 80 ? "bg-rose-500" : "bg-amber-400"
              }`}
              style={{ width: `${marqueePercent}%` }}
            />
          </div>
        </div>

        {/* Squad Count - Clickable to View Squad Modal */}
        <div 
          onClick={() => {
            setSquadModalTeamId(myTeamId);
            setIsSquadModalOpen(true);
          }}
          className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900/90 rounded-xl p-3.5 transition-all cursor-pointer group shadow-sm"
          title="Click to inspect your squad categorized by dedicated role slots"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider group-hover:text-cyan-300 transition">
              Squad Composition
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 group-hover:bg-cyan-500/25 transition">
              View Slots →
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-cyan-400">
              {myTeam ? myTeam.players.length : 0}
            </span>
            <span className="text-xs text-slate-400">/ 18 Min Req</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 truncate flex items-center justify-between">
            <span>OS: {myTeam ? myTeam.players.filter(p => p.is_overseas).length : 0} / 8 Max</span>
            <span className={`${myTeam && myTeam.players.length < 18 ? "text-amber-400" : "text-emerald-400"} font-semibold text-[9px] group-hover:underline`}>
              {myTeam && myTeam.players.length < 18 ? "Need 18" : "Eligible"}
            </span>
          </p>
        </div>

        {/* Player Queue Status - Clickable to Player Pool Modal */}
        <div 
          onClick={() => setIsPoolModalOpen(true)}
          className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90 rounded-xl p-3.5 transition-all cursor-pointer group shadow-sm"
          title="Click to explore active set players and upcoming pools"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider group-hover:text-amber-300 transition">
              Pool Progress
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 group-hover:bg-amber-500/25 transition">
              Explore Pool →
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl sm:text-2xl font-black font-mono text-indigo-400">
              {roomState.current_player_index + 1}
            </span>
            <span className="text-xs text-slate-500">/ {roomState.total_players_in_queue}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 truncate flex items-center justify-between">
            <span>Set: <strong className="text-amber-400">{roomState.current_pool || current_player?.pool || "Marquee Set 1"}</strong></span>
            <span className="text-amber-400 font-semibold text-[9px] group-hover:underline">View Sets</span>
          </p>
        </div>
      </div>

      {/* Main Auction Block */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: All Teams Live Purse Tracker */}
        <div className="hidden lg:block lg:col-span-3 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-400" />
              Franchise Purses
            </h3>

            <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
              {Object.values(teams || {}).map(team => {
                const isLeader = highest_bidder_id === team.team_id;
                const hasPassedThis = roomState.passed_teams?.includes(team.team_id);
                return (
                  <div
                    key={team.team_id}
                    onClick={() => {
                      setSquadModalTeamId(team.team_id);
                      setIsSquadModalOpen(true);
                    }}
                    className={`p-2.5 rounded-xl border transition cursor-pointer hover:scale-[1.01] group ${
                      isLeader
                        ? "bg-amber-500/10 border-amber-500/40 shadow-sm"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                    }`}
                    title={`Click to inspect ${team.name} squad slots`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: team.color || "#3B82F6" }}
                        />
                        <div className="truncate">
                          <span className="text-xs font-bold text-white truncate max-w-[110px] group-hover:text-amber-300 transition block">
                            {team.name}
                          </span>
                          {team.owner_name && team.owner_name !== team.name && (
                            <span className="text-[10px] text-amber-300/90 truncate block font-medium">
                              👤 {team.owner_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isLeader && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 animate-pulse">
                            Leader
                          </span>
                        )}
                        {hasPassedThis && !isLeader && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                            Passed
                          </span>
                        )}
                        <span className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-500 group-hover:text-amber-400 transition" title="Inspect Squad">
                          <Eye className="w-3 h-3" />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1 text-[11px]">
                      <span className="font-mono font-bold text-emerald-400">
                        ₹{(team.budget / 100).toFixed(1)} Cr
                      </span>
                      <span className="text-slate-400">
                        {team.players.length} squad ({team.players.filter(p => p.is_overseas).length} OS)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Center Spotlight: Current Player on the Hammer */}
        <div className="lg:col-span-6 space-y-4">
          {current_player ? (
            <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-6">
              {/* Top Accent Light */}
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500" />

              {/* Player Header Card */}
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                {/* Avatar with Glow */}
                <div className="relative shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-lg shadow-amber-500/10 bg-slate-950">
                    <img
                      src={current_player.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                      alt={current_player.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-full bg-slate-950 border border-slate-700 text-[10px] font-bold text-amber-300 shadow">
                    {current_player.country || (current_player.is_overseas ? "Overseas" : "India")}
                  </div>
                </div>

                {/* Player Metadata */}
                <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 tracking-wider">
                      {current_player.category || current_player.tier || "Standard"} Pool
                    </span>
                    {current_player.is_overseas && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300">
                        ✈️ Overseas
                      </span>
                    )}
                    {(current_player.is_wicketkeeper || current_player.is_wk || current_player.role === "WK") && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                        🧤 Wicketkeeper
                      </span>
                    )}
                  </div>

                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
                    {current_player.name}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 font-medium">
                    {current_player.role} • {current_player.bowling_type && current_player.bowling_type !== "None" ? current_player.bowling_type : (current_player.is_bowling_option ? "Bowler / All-Rounder" : "Specialist Batter")}
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1 justify-center sm:justify-start">
                    {current_player.badges?.map(b => (
                      <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* T20 Performance Radar Metrics */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                    T20 Matchup Metrics
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {current_player.has_ipl_stats ? "IPL Official Stats" : "Domestic SMAT (0.75x Discount)"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block font-sans">Powerplay SR</span>
                    <span className="text-sm font-bold text-amber-300">
                      {current_player.stats?.t20_sr || current_player.stats?.batting?.powerplay_sr || current_player.domestic_fallback?.powerplay_sr || 135}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block font-sans">Middle SR</span>
                    <span className="text-sm font-bold text-emerald-400">
                      {current_player.stats?.spin_sr || current_player.stats?.batting?.middle_sr || current_player.domestic_fallback?.middle_sr || 130}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block font-sans">Death SR</span>
                    <span className="text-sm font-bold text-rose-400">
                      {current_player.stats?.death_sr || current_player.stats?.batting?.death_sr || current_player.domestic_fallback?.death_sr || 165}
                    </span>
                  </div>

                  <div className="bg-slate-900/60 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[10px] text-slate-400 block font-sans">
                      {current_player.is_bowling_option ? "Bowl Eco" : "Bat Avg"}
                    </span>
                    <span className="text-sm font-bold text-cyan-400">
                      {current_player.is_bowling_option 
                        ? `${current_player.stats?.econ || current_player.stats?.bowling?.powerplay_economy || 8.2} eco`
                        : `${current_player.stats?.t20_avg || current_player.stats?.batting?.average || 35.0} avg`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Live Hammer Banner & Countdown Timer */}
              <div className="bg-gradient-to-br from-slate-950 to-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-inner">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Current Bid */}
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Current Bid</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black font-mono text-amber-300">
                        {formatPrice(current_bid)}
                      </span>
                      <span className="text-xs text-slate-500">
                        (Base: {formatPrice(current_player.base_price || Math.round((current_player.base_price_cr || 1) * 100))})
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-slate-400">Leading Bidder:</span>
                      {highest_bidder_name ? (
                        <span className="text-xs font-bold text-white bg-slate-800 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          {highest_bidder_name}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">No bids yet</span>
                      )}
                    </div>
                  </div>

                  {/* Circular Timer Display */}
                  <div className="flex flex-col items-center justify-center">
                    <div
                      className={`w-16 h-16 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-300 ${
                        timer <= 2
                          ? "border-rose-500 bg-rose-500/10 text-rose-400 animate-pulse scale-105 shadow-lg shadow-rose-500/20"
                          : timer <= 3
                          ? "border-amber-400 bg-amber-500/10 text-amber-300"
                          : "border-cyan-500 bg-cyan-500/10 text-cyan-300"
                      }`}
                    >
                      <span className="text-2xl font-black font-mono leading-none">{timer}</span>
                      <span className="text-[9px] uppercase tracking-wider font-bold">SEC</span>
                    </div>
                  </div>
                </div>

                {/* Linear Timer Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    className={`h-full transition-all duration-1000 linear ${
                      timer <= 2 ? "bg-rose-500" : timer <= 3 ? "bg-amber-400" : "bg-cyan-500"
                    }`}
                    style={{ width: `${(timer / 5) * 100}%` }}
                  />
                </div>
              </div>

              {/* Interactive Bidding Action Controls */}
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    onClick={() => {
                      sounds.playBid();
                      onBid(20);
                    }}
                    disabled={!bid20.valid}
                    title={bid20.reason || "Raise bid by ₹20 Lakhs"}
                    className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition flex flex-col items-center justify-center gap-0.5 border ${
                      bid20.valid
                        ? "bg-slate-800 hover:bg-slate-700 border-amber-500/40 text-amber-300 hover:text-white shadow-md cursor-pointer hover:scale-[1.02]"
                        : "bg-slate-950/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <span>+ ₹20 Lakhs</span>
                    <span className="text-[10px] font-normal opacity-70 font-mono">
                      (Total: {formatPrice(current_bid + (highest_bidder_id ? 20 : 0))})
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.playBid();
                      onBid(50);
                    }}
                    disabled={!bid50.valid}
                    title={bid50.reason || "Raise bid by ₹50 Lakhs"}
                    className={`py-3.5 px-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition flex flex-col items-center justify-center gap-0.5 border ${
                      bid50.valid
                        ? "bg-slate-800 hover:bg-slate-700 border-amber-500/60 text-amber-300 hover:text-white shadow-md cursor-pointer hover:scale-[1.02]"
                        : "bg-slate-950/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <span>+ ₹50 Lakhs</span>
                    <span className="text-[10px] font-normal opacity-70 font-mono">
                      (Total: {formatPrice(current_bid + (highest_bidder_id ? 50 : 0))})
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      sounds.playBid();
                      onBid(100);
                    }}
                    disabled={!bid100.valid}
                    title={bid100.reason || "Raise bid by ₹1.00 Crore"}
                    className={`py-3.5 px-3 rounded-xl font-black text-xs sm:text-sm tracking-wide transition flex flex-col items-center justify-center gap-0.5 border ${
                      bid100.valid
                        ? "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 border-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-[1.02]"
                        : "bg-slate-950/40 border-slate-800 text-slate-600 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <span>+ ₹1.00 Cr</span>
                    <span className="text-[10px] font-semibold opacity-80 font-mono">
                      (Total: {formatPrice(current_bid + (highest_bidder_id ? 100 : 0))})
                    </span>
                  </button>
                </div>

                {/* Pass Button & Validation Tooltip */}
                <div className="flex items-center justify-between gap-4 pt-1">
                  <div className="text-xs text-slate-400 truncate">
                    {!bid20.valid && (
                      <span className="text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        {bid20.reason}
                      </span>
                    )}
                    {isMyHighestBid && (
                      <span className="text-emerald-400 font-medium">
                        ✓ You currently hold the highest bid!
                      </span>
                    )}
                  </div>

                  <button
                    onClick={onPass}
                    disabled={hasPassed || isMyHighestBid}
                    className={`py-2 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition ${
                      hasPassed
                        ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                        : isMyHighestBid
                        ? "opacity-40 cursor-not-allowed bg-slate-800 text-slate-400"
                        : "bg-rose-950/60 hover:bg-rose-900 border border-rose-800/80 text-rose-300 cursor-pointer"
                    }`}
                  >
                    {hasPassed ? "Passed" : "Pass Player"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <Gavel className="w-12 h-12 text-amber-400 mx-auto animate-bounce" />
              <h3 className="text-xl font-bold text-white">Auction in Transition</h3>
              <p className="text-sm text-slate-400">
                Fetching next player or finalizing auction pools...
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Live Feed & Bid History */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              Live Auction Feed
            </h3>

            <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
              {roomState.auction_feed && roomState.auction_feed.length > 0 ? (
                roomState.auction_feed.slice().reverse().map((item, idx) => {
                  const news = item.news;
                  if (news) {
                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all shadow-md ${
                          news.news_type === "STEAL"
                            ? "bg-amber-950/25 border-amber-500/40 text-amber-200"
                            : news.news_type === "BIDDING_WAR"
                            ? "bg-rose-950/30 border-rose-500/40 text-rose-200"
                            : news.news_type === "RECORD_BREAKER"
                            ? "bg-emerald-950/25 border-emerald-500/40 text-emerald-200"
                            : news.news_type === "HAMMER_DRAMA"
                            ? "bg-cyan-950/25 border-cyan-500/40 text-cyan-200"
                            : news.news_type === "UNSOLD"
                            ? "bg-slate-900 border-slate-700 text-slate-400"
                            : "bg-slate-950/80 border-slate-800 text-slate-300"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-950/80 border border-white/10">
                            {news.badge}
                          </span>
                          <span className="font-mono font-bold text-[11px] text-amber-300">
                            ₹{news.amount_cr.toFixed(2)} Cr
                          </span>
                        </div>
                        <p className="font-bold text-white text-[11px] leading-tight">
                          {news.headline}
                        </p>
                        <p className="text-[10px] text-slate-300 leading-snug">
                          {news.news_body}
                        </p>
                        {news.buyer_slogan && (
                          <div className="pt-1 flex items-center justify-between text-[9px] text-slate-400 border-t border-white/5">
                            <span className="font-bold text-amber-400">
                              "{news.buyer_slogan}"
                            </span>
                            {news.rival_name && (
                              <span className="text-slate-400 font-medium">
                                Outbid: {news.rival_name}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300 leading-snug animate-fadeIn"
                    >
                      {item.message}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-slate-500 text-center py-8">
                  Live commentary will stream here as bids happen.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mid-Auction Squad Inspection Modal (4 Dedicated Role Slots) */}
      <MidwaySquadModal
        isOpen={isSquadModalOpen}
        onClose={() => setIsSquadModalOpen(false)}
        roomState={roomState}
        myTeamId={myTeamId}
        initialTeamId={squadModalTeamId}
      />

      {/* Player Pool & Upcoming Explorer Modal */}
      <PlayerPoolModal
        isOpen={isPoolModalOpen}
        onClose={() => setIsPoolModalOpen(false)}
        roomState={roomState}
        allPlayers={allPlayers}
      />
    </div>
  );
};
