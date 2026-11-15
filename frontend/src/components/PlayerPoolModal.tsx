"use client";

import React, { useState, useMemo } from "react";
import { 
  X, 
  Search, 
  Filter, 
  Layers, 
  Flame, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Globe2, 
  TrendingUp,
  Sparkles,
  ChevronRight,
  Gavel
} from "lucide-react";
import { RoomState, Player, PoolSummary } from "@/types";
import { formatPrice } from "@/lib/constants";

interface PlayerPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomState: RoomState;
  allPlayers?: Player[];
}

export const PlayerPoolModal: React.FC<PlayerPoolModalProps> = ({
  isOpen,
  onClose,
  roomState,
  allPlayers = []
}) => {
  const [activeTab, setActiveTab] = useState<"current_set" | "queue" | "all_sets">("current_set");
  const [selectedPoolName, setSelectedPoolName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [overseasOnly, setOverseasOnly] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentPoolName = roomState.current_pool || roomState.current_player?.pool || "Marquee Set 1";
  const displayedPoolName = selectedPoolName || currentPoolName;

  // Pools summary from backend or computed
  const poolsSummary: PoolSummary[] = roomState.pools_summary || [];

  // Current pool summary
  const currentPoolStats = poolsSummary.find(p => p.pool_name === displayedPoolName) || {
    pool_name: displayedPoolName,
    total_players: 0,
    sold_count: 0,
    unsold_count: 0,
    remaining_count: 0,
    is_current: displayedPoolName === currentPoolName,
    is_completed: false
  };

  // Players belonging to the displayed pool
  const poolPlayers: Player[] = useMemo(() => {
    // If the displayed pool is the active set and backend provided current_set_players, use it
    if (displayedPoolName === currentPoolName && roomState.current_set_players && roomState.current_set_players.length > 0) {
      return roomState.current_set_players;
    }
    // Otherwise fallback to filtering allPlayers
    return allPlayers.filter(p => (p.pool || "Standard") === displayedPoolName).map(p => {
      const isCurrent = roomState.current_player?.id === p.id;
      let status: "ON_BLOCK" | "SOLD" | "UPCOMING" | "UNSOLD" = isCurrent ? "ON_BLOCK" : "UPCOMING";
      let soldTo: string | undefined = undefined;
      let soldPrice: number | undefined = undefined;

      // Check if sold to any team
      for (const team of Object.values(roomState.teams || {})) {
        const found = team.players?.find(tp => tp.id === p.id);
        if (found) {
          status = "SOLD";
          soldTo = team.name;
          soldPrice = found.buy_price || found.base_price;
          break;
        }
      }

      return {
        ...p,
        auction_status: status,
        sold_to: soldTo,
        sold_price: soldPrice,
        sold_price_cr: soldPrice ? roundCr(soldPrice) : undefined
      };
    });
  }, [displayedPoolName, currentPoolName, roomState.current_set_players, allPlayers, roomState.current_player, roomState.teams]);

  // Upcoming queue from roomState
  const upcomingQueue: Player[] = roomState.upcoming_players || [];

  // Filter players by search and role
  const filteredPlayers = useMemo(() => {
    let list = activeTab === "queue" ? upcomingQueue : poolPlayers;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        (p.country || "").toLowerCase().includes(q) ||
        (p.role || "").toLowerCase().includes(q)
      );
    }

    if (roleFilter !== "ALL") {
      if (roleFilter === "WK") {
        list = list.filter(p => p.role === "WK" || p.is_wicketkeeper || p.is_wk);
      } else {
        list = list.filter(p => p.role === roleFilter);
      }
    }

    if (overseasOnly) {
      list = list.filter(p => p.is_overseas);
    }

    return list;
  }, [activeTab, poolPlayers, upcomingQueue, searchQuery, roleFilter, overseasOnly]);

  const totalInCurrentSet = poolPlayers.length;
  const soldInCurrentSet = poolPlayers.filter(p => p.auction_status === "SOLD").length;
  const unsoldInCurrentSet = poolPlayers.filter(p => p.auction_status === "UNSOLD").length;
  const remainingInCurrentSet = Math.max(0, totalInCurrentSet - soldInCurrentSet - unsoldInCurrentSet);
  const completionPercent = totalInCurrentSet > 0 ? Math.round(((soldInCurrentSet + unsoldInCurrentSet) / totalInCurrentSet) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-6xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Player Pool & Upcoming Sets
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono">
                  {currentPoolName}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Track ongoing set progress, explore all 29 auction pools, and scout upcoming stars
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Ongoing Set Showcase Banner */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-extrabold uppercase tracking-wide">
                <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                Active Auction Set
              </span>
              <h3 className="text-lg font-black text-white">
                {displayedPoolName}
              </h3>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>{soldInCurrentSet} Sold</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 font-bold">
                <XCircle className="w-4 h-4 text-slate-500" />
                <span>{unsoldInCurrentSet} Unsold</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Clock className="w-4 h-4 text-amber-500" />
                <span>{remainingInCurrentSet} Remaining</span>
              </div>
              <div className="text-slate-500 font-sans">
                ({totalInCurrentSet} Total)
              </div>
            </div>
          </div>

          {/* Progress Bar of Current Set */}
          <div className="mt-3 w-full bg-slate-800/80 rounded-full h-2 overflow-hidden border border-slate-700/50">
            <div 
              className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-500 rounded-full"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </div>

        {/* Navigation Tabs & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 border-b border-slate-800 bg-slate-950/40">
          {/* Main Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setActiveTab("current_set");
                setSelectedPoolName("");
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                activeTab === "current_set" && !selectedPoolName
                  ? "bg-amber-500/15 border-amber-500/50 text-amber-300 shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              🔥 Ongoing: {currentPoolName}
            </button>

            <button
              onClick={() => setActiveTab("queue")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                activeTab === "queue"
                  ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-300 shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              ⏳ On Deck (Next {upcomingQueue.length} Up)
            </button>

            <button
              onClick={() => setActiveTab("all_sets")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                activeTab === "all_sets"
                  ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300 shadow-sm"
                  : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              📋 All Sets Directory ({poolsSummary.length || 29} Pools)
            </button>
          </div>

          {/* Quick Search & Filters */}
          {activeTab !== "all_sets" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search player, role..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 w-44 sm:w-56"
                />
              </div>

              {/* Role filter buttons */}
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
              >
                <option value="ALL">All Roles</option>
                <option value="BAT">Batters</option>
                <option value="WK">Keepers</option>
                <option value="ALL">All-Rounders</option>
                <option value="BOWL">Bowlers</option>
              </select>

              <button
                onClick={() => setOverseasOnly(!overseasOnly)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  overseasOnly
                    ? "bg-blue-500/20 border-blue-500 text-blue-300"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
                title="Filter overseas only"
              >
                ✈️ OS
              </button>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "all_sets" ? (
            /* All Sets Directory Grid */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                <span className="font-semibold text-white">Full IPL Auction Pools Schedule (In Running Sequence)</span>
                <span>Click any set to view all players in that pool</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {poolsSummary.map((pool, idx) => {
                  const isCurrent = pool.pool_name === currentPoolName;
                  const isSelected = pool.pool_name === selectedPoolName;
                  return (
                    <div
                      key={pool.pool_name}
                      onClick={() => {
                        setSelectedPoolName(pool.pool_name);
                        setActiveTab("current_set");
                      }}
                      className={`p-4 rounded-xl border transition-all cursor-pointer text-left space-y-2.5 ${
                        isCurrent
                          ? "bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10 hover:border-amber-400"
                          : isSelected
                          ? "bg-blue-500/10 border-blue-500/50 shadow-md"
                          : pool.is_completed
                          ? "bg-slate-950/60 border-slate-800/80 opacity-75 hover:opacity-100 hover:border-slate-700"
                          : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-slate-500">#{idx + 1}</span>
                          <h4 className="text-sm font-extrabold text-white tracking-tight">{pool.pool_name}</h4>
                        </div>
                        {isCurrent ? (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                            Active Set
                          </span>
                        ) : pool.is_completed ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            ✓ Concluded
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                            Upcoming
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono pt-1 border-t border-slate-800/60">
                        <span className="text-slate-400">{pool.total_players} Players</span>
                        <div className="flex items-center gap-2 text-[11px]">
                          <span className="text-emerald-400">{pool.sold_count} Sold</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400">{pool.remaining_count} Left</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Players Grid (Active Set or Queue) */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  Showing <strong className="text-white">{filteredPlayers.length}</strong> players in {activeTab === "queue" ? "Upcoming Queue" : displayedPoolName}
                </span>
                {selectedPoolName && (
                  <button
                    onClick={() => setSelectedPoolName("")}
                    className="text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    ← Back to Active Set ({currentPoolName})
                  </button>
                )}
              </div>

              {filteredPlayers.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {filteredPlayers.map((player) => (
                    <PoolPlayerCard 
                      key={player.id} 
                      player={player} 
                      isHammerPlayer={roomState.current_player?.id === player.id}
                      currentBid={roomState.current_bid}
                      highestBidder={roomState.highest_bidder_name}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center space-y-3">
                  <p className="text-slate-400 text-sm font-medium">No players match the selected filters.</p>
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setRoleFilter("ALL");
                      setOverseasOnly(false);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 transition"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400">
            Current Hammer: <strong className="text-white">{roomState.current_player?.name || "None"}</strong> • Set: <strong className="text-amber-400">{currentPoolName}</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow"
          >
            Close Explorer
          </button>
        </div>
      </div>
    </div>
  );
};

function roundCr(lakhs: number): number {
  return Math.round((lakhs / 100.0) * 100) / 100;
}

// Individual Player Card in Pool Explorer
const PoolPlayerCard: React.FC<{ 
  player: Player; 
  isHammerPlayer: boolean;
  currentBid: number;
  highestBidder: string | null;
}> = ({
  player,
  isHammerPlayer,
  currentBid,
  highestBidder
}) => {
  const isSold = player.auction_status === "SOLD";
  const isUnsold = player.auction_status === "UNSOLD";
  const basePriceCr = player.base_price_cr || (player.base_price ? (player.base_price / 100).toFixed(2) : 1.0);
  const primarySlot = Array.isArray(player.primary_slot) ? player.primary_slot.join(", ") : player.primary_slot || "1-11";

  return (
    <div className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between space-y-3 relative overflow-hidden ${
      isHammerPlayer
        ? "bg-amber-950/20 border-amber-500 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40"
        : isSold
        ? "bg-slate-950/80 border-emerald-500/40"
        : isUnsold
        ? "bg-slate-950/50 border-slate-800 opacity-60"
        : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
    }`}>
      {/* Top Tag & Status */}
      <div className="flex items-center justify-between gap-1">
        {isHammerPlayer ? (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse">
            <Flame className="w-3 h-3" /> Live Hammer
          </span>
        ) : isSold ? (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Sold
          </span>
        ) : isUnsold ? (
          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            <XCircle className="w-3 h-3" /> Unsold
          </span>
        ) : (
          <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            Upcoming
          </span>
        )}

        <span className="text-[10px] font-mono text-slate-400">
          Base: ₹{Number(basePriceCr).toFixed(2)} Cr
        </span>
      </div>

      {/* Player Header */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
            <img
              src={player.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
              alt={player.name}
              className="w-full h-full object-cover"
            />
          </div>
          {player.is_overseas && (
            <span className="absolute -bottom-1 -right-1 px-1 rounded bg-blue-950 border border-blue-600 text-[9px] font-black text-blue-300">
              OS
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-bold text-white truncate">{player.name}</h4>
          <p className="text-[10px] text-slate-400 truncate">
            {player.role} • Slot {primarySlot}
          </p>
          <p className="text-[9px] text-slate-500 truncate mt-0.5">
            {player.pool || "Standard"}
          </p>
        </div>
      </div>

      {/* Price / Outcome Banner */}
      <div className="pt-2 border-t border-slate-800/80 text-[11px] font-mono flex items-center justify-between">
        {isHammerPlayer ? (
          <>
            <span className="text-slate-400 text-[10px]">Current Bid:</span>
            <span className="font-bold text-amber-300">
              {formatPrice(currentBid)}
            </span>
          </>
        ) : isSold ? (
          <>
            <span className="text-emerald-400 text-[10px] font-sans truncate">
              {player.sold_to || "Bought"}
            </span>
            <span className="font-bold text-emerald-400">
              ₹{player.sold_price_cr ? player.sold_price_cr.toFixed(2) : (player.sold_price ? (player.sold_price / 100).toFixed(2) : basePriceCr)} Cr
            </span>
          </>
        ) : isUnsold ? (
          <span className="text-slate-500 text-[10px] italic">Passed without bids</span>
        ) : (
          <>
            <span className="text-slate-500 text-[10px]">Set Queue</span>
            <span className="text-slate-400 text-[10px]">Ready for Hammer</span>
          </>
        )}
      </div>
    </div>
  );
};
