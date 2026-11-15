"use client";

import React, { useState } from "react";
import { 
  X, 
  Users, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Globe2, 
  Crown, 
  Sparkles,
  DollarSign
} from "lucide-react";
import { RoomState, Team, Player } from "@/types";
import { formatPrice } from "@/lib/constants";

interface MidwaySquadModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomState: RoomState;
  myTeamId: string;
  initialTeamId?: string;
}

export const MidwaySquadModal: React.FC<MidwaySquadModalProps> = ({
  isOpen,
  onClose,
  roomState,
  myTeamId,
  initialTeamId
}) => {
  const [selectedTeamId, setSelectedTeamId] = useState<string>(initialTeamId || myTeamId);

  if (!isOpen) return null;

  const teams = roomState.teams || {};
  const currentTeam: Team | undefined = teams[selectedTeamId] || teams[myTeamId];
  const isMyTeam = selectedTeamId === myTeamId;

  const players: Player[] = currentTeam?.players || [];

  // Group players into 4 dedicated slots
  const wkPlayers = players.filter(p => p.role === "WK" || p.is_wicketkeeper || p.is_wk);
  const batPlayers = players.filter(p => (p.role === "BAT" || p.category === "Batter") && !p.is_wicketkeeper && !p.is_wk);
  const allPlayers = players.filter(p => p.role === "ALL" || p.category === "All-Rounder");
  const bowlPlayers = players.filter(p => p.role === "BOWL" || p.category === "Bowler");

  const overseasCount = players.filter(p => p.is_overseas).length;
  const remainingBudgetCr = currentTeam ? (currentTeam.budget / 100).toFixed(2) : "0.00";
  const marqueeSpentCr = currentTeam ? (currentTeam.marquee_spent / 100).toFixed(2) : "0.00";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div 
        className="relative w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Live Squad Inventory
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full font-mono border ${
                  players.length < 18 
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300" 
                    : "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                }`}>
                  {players.length} / 18 Players (Min 18 Req)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Categorized by dedicated role slots • Teams with &lt; 18 players are eliminated upon timer expiry
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

        {/* Franchise Switcher Tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Franchises:
          </span>
          {Object.values(teams).map(t => {
            const isSelected = t.team_id === selectedTeamId;
            const isMe = t.team_id === myTeamId;
            return (
              <button
                key={t.team_id}
                onClick={() => setSelectedTeamId(t.team_id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer border ${
                  isSelected
                    ? "bg-amber-500/15 border-amber-500/60 text-amber-300 shadow-sm"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                <div 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: t.color || "#3B82F6" }} 
                />
                <span>{t.name}</span>
                {t.owner_name && t.owner_name !== t.name && (
                  <span className="text-[10px] text-amber-300 font-medium max-w-[70px] truncate hidden sm:inline-block">
                    ({t.owner_name})
                  </span>
                )}
                {isMe && (
                  <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300">
                    YOU
                  </span>
                )}
                <span className="text-[10px] font-mono opacity-80">
                  ({t.players?.length || 0})
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Franchise Summary Ribbon */}
        {currentTeam && (
          <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-3.5 h-3.5 rounded-full shrink-0 shadow"
                style={{ backgroundColor: currentTeam.color || "#3B82F6" }}
              />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block uppercase font-semibold">Franchise</span>
                <span className="font-extrabold text-white text-sm truncate block">{currentTeam.name}</span>
                {currentTeam.owner_name && (
                  <span className="text-[10px] text-amber-300 font-medium truncate block">
                    👤 {currentTeam.owner_name}
                  </span>
                )}
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Remaining Purse</span>
              <span className="font-extrabold font-mono text-emerald-400 text-sm">
                ₹{remainingBudgetCr} Cr <span className="text-[10px] text-slate-500 font-sans font-normal">/ ₹120 Cr</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Squad Capacity</span>
              <div className="flex items-center gap-2">
                <span className={`font-extrabold font-mono text-sm ${players.length < 18 ? "text-amber-400" : "text-emerald-400"}`}>
                  {players.length} / 18 Min
                </span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                  overseasCount > 4 ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400"
                }`}>
                  ✈️ {overseasCount}/8 OS
                </span>
              </div>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block uppercase font-semibold">Marquee Spent</span>
              <span className="font-extrabold font-mono text-amber-400 text-sm">
                ₹{marqueeSpentCr} Cr <span className="text-[10px] text-slate-500 font-sans font-normal">/ Max ₹80 Cr</span>
              </span>
            </div>
          </div>
        )}

        {/* Slot-by-Slot Squad Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Slot 1: Wicketkeepers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🧤</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Wicketkeepers (WK)
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {wkPlayers.length} Acquired
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {wkPlayers.length >= 2 ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Backup WK secured (0 risk)
                  </span>
                ) : wkPlayers.length === 1 ? (
                  <span className="text-amber-400 flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" /> 1 Starting WK (Need backup for bench)
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1 font-semibold">
                    <ShieldAlert className="w-3.5 h-3.5" /> Urgent: No Wicketkeeper yet (-15 penalty risk)
                  </span>
                )}
              </span>
            </div>

            {wkPlayers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {wkPlayers.map((player) => (
                  <SquadPlayerCard key={player.id} player={player} />
                ))}
              </div>
            ) : (
              <EmptySlotPlaceholder 
                icon="🧤" 
                slotName="Wicketkeeper" 
                hint="Essential: Exactly 1 WK must play in the Playing XI, plus 1 recommended for bench."
              />
            )}
          </div>

          {/* Slot 2: Specialist Batters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🏏</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Specialist Batters (BAT)
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {batPlayers.length} Acquired
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Openers (Slots 1-2) & Middle-Order Anchors (Slots 3-5)
              </span>
            </div>

            {batPlayers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {batPlayers.map((player) => (
                  <SquadPlayerCard key={player.id} player={player} />
                ))}
              </div>
            ) : (
              <EmptySlotPlaceholder 
                icon="🏏" 
                slotName="Specialist Batters" 
                hint="Need top-order anchors and aggressive powerplay batsmen to set competitive totals."
              />
            )}
          </div>

          {/* Slot 3: All-Rounders */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">⚡</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  All-Rounders (ALL)
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {allPlayers.length} Acquired
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Dual threats providing crucial middle-overs spin/pace and death finishing
              </span>
            </div>

            {allPlayers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allPlayers.map((player) => (
                  <SquadPlayerCard key={player.id} player={player} />
                ))}
              </div>
            ) : (
              <EmptySlotPlaceholder 
                icon="⚡" 
                slotName="All-Rounders" 
                hint="Dual-threat assets provide crucial bowling quota and depth down to Slot 8."
              />
            )}
          </div>

          {/* Slot 4: Frontline Bowlers */}
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-base">🎯</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Frontline Bowlers (BOWL)
                </h3>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  {bowlPlayers.length} Acquired
                </span>
              </div>
              <span className="text-xs text-slate-400">
                Pace & Spin Strike Specialists for Powerplay & Death Overs (Slots 8-11)
              </span>
            </div>

            {bowlPlayers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {bowlPlayers.map((player) => (
                  <SquadPlayerCard key={player.id} player={player} />
                ))}
              </div>
            ) : (
              <EmptySlotPlaceholder 
                icon="🎯" 
                slotName="Frontline Bowlers" 
                hint="FRONT-LINE ATTACK: Target express pace spearheads and mystery spinners for Slots 9-11."
              />
            )}
          </div>
        </div>

        {/* Footer with Close Button */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-800 bg-slate-950/60">
          <div className="text-xs text-slate-400">
            Total Squad Value: <span className="font-mono font-bold text-white">₹{(TOTAL_BUDGET_CALC(currentTeam)).toFixed(2)} Cr</span> spent
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow"
          >
            Return to Live Hammer
          </button>
        </div>
      </div>
    </div>
  );
};

function TOTAL_BUDGET_CALC(team?: Team): number {
  if (!team) return 0;
  return Math.max(0, (12000 - team.budget) / 100);
}

// Individual Player Card in the Slot
const SquadPlayerCard: React.FC<{ player: Player }> = ({ player }) => {
  const buyPriceCr = player.buy_price_cr || (player.buy_price ? (player.buy_price / 100).toFixed(2) : player.base_price_cr || 1.0);
  const primarySlot = Array.isArray(player.primary_slot) ? player.primary_slot.join(", ") : player.primary_slot || "Slot 1-11";

  return (
    <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-slate-700 transition flex items-center gap-3">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-700 bg-slate-900">
          <img
            src={player.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
            alt={player.name}
            className="w-full h-full object-cover"
          />
        </div>
        {player.is_overseas && (
          <span 
            className="absolute -bottom-1 -right-1 px-1 rounded bg-blue-950 border border-blue-600 text-[9px] font-black text-blue-300"
            title="Overseas Player"
          >
            OS
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center justify-between gap-1">
          <h4 className="text-xs font-bold text-white truncate">{player.name}</h4>
          <span className="font-mono font-extrabold text-xs text-emerald-400 shrink-0">
            ₹{Number(buyPriceCr).toFixed(2)} Cr
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
          <span className="px-1.5 py-0.2 rounded bg-slate-800 font-semibold text-slate-300">
            {player.role}
          </span>
          <span>•</span>
          <span className="text-slate-400 truncate">
            Pref: Slot {primarySlot}
          </span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-2 pt-0.5 text-[10px] font-mono text-slate-400">
          {player.is_bowling_option ? (
            <>
              <span>Eco: <strong className="text-cyan-300">{player.stats?.econ || 8.2}</strong></span>
              <span>•</span>
              <span>WPM: <strong className="text-rose-300">{player.stats?.wpm || 1.3}</strong></span>
            </>
          ) : (
            <>
              <span>SR: <strong className="text-amber-300">{player.stats?.t20_sr || 138}</strong></span>
              <span>•</span>
              <span>Avg: <strong className="text-emerald-300">{player.stats?.t20_avg || 36}</strong></span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Empty slot placeholder
const EmptySlotPlaceholder: React.FC<{ icon: string; slotName: string; hint: string }> = ({
  icon,
  slotName,
  hint
}) => (
  <div className="p-4 rounded-xl border border-dashed border-slate-800 bg-slate-950/30 flex items-center gap-3 text-slate-500">
    <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-lg shrink-0">
      {icon}
    </div>
    <div className="text-xs space-y-0.5">
      <p className="font-semibold text-slate-400">No {slotName} acquired yet</p>
      <p className="text-[11px] text-slate-500 leading-snug">{hint}</p>
    </div>
  </div>
);
