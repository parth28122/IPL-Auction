"use client";

import React, { useState } from "react";
import { 
  Users, 
  Bot, 
  Play, 
  PlusCircle, 
  Sparkles, 
  ShieldCheck, 
  UserCheck, 
  User,
  DollarSign, 
  Flame,
  Award,
  Zap,
  Globe2,
  Copy,
  Check,
  Share2
} from "lucide-react";
import { IPL_FRANCHISES, formatPrice } from "@/lib/constants";
import { Player, RoomState } from "@/types";

interface LobbyViewProps {
  roomState: RoomState;
  myTeamId: string;
  allPlayers: Player[];
  onJoinTeam: (teamName: string, color: string, ownerName: string) => void;
  onAddBots: (count: number) => void;
  onStartAuction: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  roomState,
  myTeamId,
  allPlayers,
  onJoinTeam,
  onAddBots,
  onStartAuction
}) => {
  const [ownerName, setOwnerName] = useState(() => 
    typeof window !== "undefined" ? sessionStorage.getItem("ipl_player_name") || "" : ""
  );
  const [nameError, setNameError] = useState("");
  const [selectedFranchise, setSelectedFranchise] = useState(IPL_FRANCHISES[0]);
  const [customName, setCustomName] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("Marquee");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const teams = Object.values(roomState.teams || {});
  const myTeam = roomState.teams?.[myTeamId];

  const getCategory = (p: Player): string => {
    if (p.category) return String(p.category);
    if (p.tier === "Marquee") return "Marquee";
    if (p.is_wk || p.role === "WK" || p.is_wicketkeeper) return "Keeper";
    if (p.role === "ALL") return "All-Rounder";
    if (p.role === "BOWL") return "Bowler";
    return "Batter";
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOwner = ownerName.trim();
    if (!cleanOwner) {
      setNameError("Please write your name / manager tag to join.");
      return;
    }
    setNameError("");

    if (typeof window !== "undefined") {
      sessionStorage.setItem("ipl_player_name", cleanOwner);
    }

    const finalName = isCustom ? customName.trim() || `${cleanOwner}'s Franchise` : selectedFranchise.name;
    const finalColor = isCustom ? "#3B82F6" : selectedFranchise.color;
    onJoinTeam(finalName, finalColor, cleanOwner);
  };

  const copyRoomCode = () => {
    if (typeof window !== "undefined" && roomState?.room_id) {
      navigator.clipboard.writeText(roomState.room_id.toUpperCase());
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const copyInviteLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const categories = ["Marquee", "Batter", "Keeper", "All-Rounder", "Bowler"];
  const filteredPlayers = allPlayers.filter(p => getCategory(p) === activeCategoryTab);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Room Code & Invite Card */}
      <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold block">Room Code to Invite Friends</span>
            <div className="flex items-center gap-2">
              <span className="text-xl sm:text-2xl font-mono font-black text-amber-300 tracking-wider">
                {roomState.room_id ? roomState.room_id.toUpperCase() : "WARROOM"}
              </span>
              <span className="text-xs text-slate-500">|</span>
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Arena
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={copyRoomCode}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-400/60 text-slate-200 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-amber-400" />}
            {copiedCode ? "Code Copied!" : "Copy Code"}
          </button>

          <button
            onClick={copyInviteLink}
            className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 py-2 px-3.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 hover:text-amber-200 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-amber-400" />}
            {copiedLink ? "Link Copied!" : "Copy Invite Link"}
          </button>
        </div>
      </div>

      {/* Top Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-8 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          <div className="lg:col-span-2 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold uppercase tracking-wider">
              <Zap className="w-3.5 h-3.5" /> ₹120 Cr Budget • ₹80 Cr Marquee Cap • Real-Time Multiplayer
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
              IPL Mega Auction <span className="bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">War Room</span>
            </h1>
            <p className="text-slate-300 text-sm sm:text-base max-w-2xl leading-relaxed">
              Assemble your dream squad under rigorous salary caps and auction constraints. 
              Draft marquee stars, deploy tactical bids in real-time, then build your championship 
              Playing XI for objective algorithmic & AI Cricinfo evaluation!
            </p>
          </div>

          {/* Action Card */}
          <div className="bg-slate-950/70 backdrop-blur-md border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Franchises Ready:</span>
              <span className="font-bold text-amber-300 font-mono text-sm">{teams.length} Joined</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => onAddBots(3)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 hover:text-indigo-200 text-xs font-bold transition shadow-sm cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                Add AI Opponents (CSK, MI, RCB)
              </button>

              <button
                onClick={onStartAuction}
                disabled={teams.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-lg bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-sm uppercase tracking-wider transition shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                Launch Live Auction
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Team Selection vs Joined Franchises */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Franchise Claiming Form */}
        <div className="lg:col-span-5 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              {myTeam ? "Your Claimed Franchise" : "Join & Select Franchise"}
            </h2>
            {myTeam && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-medium">
                Active Owner
              </span>
            )}
          </div>

          {!myTeam ? (
            <form onSubmit={handleJoin} className="space-y-5">
              {/* STEP 1: Write Your Name */}
              <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-amber-400" />
                    1. Write Your Name
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold uppercase">Required</span>
                </label>
                <input
                  type="text"
                  value={ownerName}
                  onChange={e => {
                    setOwnerName(e.target.value);
                    if (e.target.value.trim()) setNameError("");
                  }}
                  placeholder="Enter your name (e.g. Parth Dange)"
                  maxLength={25}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition"
                />
                {nameError && (
                  <p className="text-xs text-rose-400 font-medium">{nameError}</p>
                )}
              </div>

              {/* STEP 2: Pick Franchise */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                  2. Select Your Team
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {IPL_FRANCHISES.map(f => {
                    const isTaken = teams.some(t => t.name.toLowerCase() === f.name.toLowerCase());
                    const isSelected = !isCustom && selectedFranchise.name === f.name;
                    return (
                      <button
                        key={f.short}
                        type="button"
                        disabled={isTaken}
                        onClick={() => {
                          setSelectedFranchise(f);
                          setIsCustom(false);
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition ${
                          isSelected
                            ? "bg-slate-800 border-amber-400 shadow-sm"
                            : isTaken
                            ? "opacity-40 cursor-not-allowed border-slate-800 bg-slate-950/40"
                            : "border-slate-800 hover:border-slate-700 bg-slate-950/40 cursor-pointer"
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: f.color }}
                        />
                        <div className="truncate">
                          <p className="text-xs font-bold text-white truncate">{f.short}</p>
                          <p className="text-[10px] text-slate-400 truncate">{f.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Or Custom Franchise */}
              <div className="space-y-2 pt-2 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Or Enter Custom Team Name
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCustom(!isCustom)}
                    className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    {isCustom ? "Use Preset" : "Custom Name"}
                  </button>
                </div>
                {isCustom && (
                  <input
                    type="text"
                    value={customName}
                    onChange={e => setCustomName(e.target.value)}
                    placeholder="e.g. Goa Gladiators"
                    maxLength={30}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                )}
              </div>

              {/* STEP 3: Enter Room Button */}
              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Claim Franchise & Enter War Room
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm shadow-md"
                    style={{ backgroundColor: myTeam.color || "#3B82F6" }}
                  >
                    {myTeam.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{myTeam.name}</h3>
                    <p className="text-xs text-amber-300 font-semibold">
                      👤 {myTeam.owner_name || "Manager"}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Purse: ₹{(myTeam.budget / 100).toFixed(2)} Cr
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                  <div className="bg-slate-900/60 p-2 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Total Budget</span>
                    <span className="font-bold text-slate-200">₹120.00 Cr</span>
                  </div>
                  <div className="bg-slate-900/60 p-2 rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Marquee Cap</span>
                    <span className="font-bold text-amber-300">₹80.00 Cr</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-400 text-center">
                Franchise claimed! Waiting for additional friends to join or launch the live auction.
              </p>
            </div>
          )}
        </div>

        {/* Right: Joined Franchises Roster */}
        <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              Connected War Rooms ({teams.length})
            </h2>
            <span className="text-xs text-slate-400">Min 1 Franchise to start</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {teams.map((t) => (
              <div
                key={t.team_id}
                className="bg-slate-950/60 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white text-xs shadow-sm shrink-0"
                    style={{ backgroundColor: t.color || "#3B82F6" }}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-xs font-bold text-white truncate max-w-[130px]">{t.name}</p>
                      {t.is_bot && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          AI Bot
                        </span>
                      )}
                      {t.team_id === myTeamId && (
                        <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          You
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-amber-300 font-semibold truncate max-w-[140px]">
                      👤 {t.owner_name || (t.is_bot ? "AI Franchise" : "Owner")}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      Purse: ₹{(t.budget / 100).toFixed(1)} Cr
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Ready
                  </span>
                </div>
              </div>
            ))}

            {teams.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 text-sm">
                No franchises have claimed a seat yet. Write your name and claim a team on the left!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player Pool Scout & Preview Tabs */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Auction Pool Scouting Database ({allPlayers.length} Elite Players)
            </h2>
            <p className="text-xs text-slate-400">
              Preview player base prices, T20 strike rates, bowling economies, and tactical badges before bidding begins.
            </p>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategoryTab(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  activeCategoryTab === cat
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {cat} ({allPlayers.filter(p => getCategory(p) === cat).length})
              </button>
            ))}
          </div>
        </div>

        {/* Player Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredPlayers.map(player => {
            const cat = getCategory(player);
            const price = player.base_price || Math.round((player.base_price_cr || 1) * 100);
            const batSr = player.stats?.t20_sr || player.stats?.batting?.powerplay_sr || player.domestic_fallback?.powerplay_sr || 135;
            const deathSr = player.stats?.death_sr || player.stats?.batting?.death_sr || player.domestic_fallback?.death_sr || 170;
            const bowlEco = player.stats?.econ || player.stats?.bowling?.powerplay_economy || (player.is_bowling_option ? 8.2 : null);

            return (
              <div
                key={player.id}
                className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between space-y-3 transition shadow-sm hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-white truncate">{player.name}</h4>
                      <p className="text-[11px] text-slate-400">{player.role}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${
                      cat === "Marquee"
                        ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                        : "bg-slate-800 text-slate-300"
                    }`}>
                      {cat}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Globe2 className="w-3 h-3 text-cyan-400" />
                      {player.country || (player.is_overseas ? "Overseas" : "India")}
                    </span>
                    {player.is_overseas && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 bg-blue-500/10 text-blue-400 rounded">
                        Overseas
                      </span>
                    )}
                  </div>

                  {/* Quick stats snapshot */}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-900/60 p-2 rounded-lg font-mono">
                    <div>
                      <span className="text-slate-400 text-[9px] block">Bat SR (Avg/DTH)</span>
                      <span className="text-emerald-400 font-bold">
                        {batSr} / {deathSr}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 text-[9px] block">Bowling Eco</span>
                      <span className="text-cyan-400 font-bold">
                        {bowlEco !== null ? `${bowlEco} rpo` : "Pure Batter"}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap gap-1">
                    {player.badges?.map(badge => (
                      <span
                        key={badge}
                        className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Base Price:</span>
                  <span className="font-mono font-bold text-amber-300">
                    {formatPrice(price)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
