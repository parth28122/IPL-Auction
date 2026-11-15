"use client";

import React, { useState } from "react";
import { Trophy, Volume2, VolumeX, Copy, Check, Users, Sparkles, Mail, MessageSquare } from "lucide-react";
import { LinkedInIcon } from "./LinkedInIcon";
import { sounds } from "@/lib/sounds";
import { RoomState } from "@/types";

interface NavbarProps {
  roomState: RoomState | null;
  myTeamId?: string;
  onReset?: () => void;
  onToggleChat?: () => void;
  unreadChatCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  roomState, 
  myTeamId, 
  onReset,
  onToggleChat,
  unreadChatCount = 0
}) => {
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    sounds.setSoundEnabled(next);
  };

  const copyRoomLink = () => {
    if (typeof window !== "undefined" && roomState?.room_id) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const myTeam = myTeamId && roomState?.teams ? roomState.teams[myTeamId] : null;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/80 border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-orange-600 to-amber-300 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                IPL AUCTION ARENA
              </span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PRO 2026
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium hidden sm:block">
              Real-Time Multiplayer Auction & Playing XI Tactician
            </p>
          </div>
        </div>

        {/* Center: Status & Room details */}
        {roomState && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 shadow-inner">
              <span className="text-xs text-slate-400 font-medium">Room:</span>
              <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                {roomState.room_id}
              </span>
              <button
                onClick={copyRoomLink}
                title="Copy Room Link"
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <div className="hidden md:flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-medium text-slate-300">
                {Object.keys(roomState.teams).length} Franchises
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-slate-900 border border-slate-700">
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  roomState.status === "AUCTION_ACTIVE"
                    ? "bg-rose-500 shadow-rose-500 shadow-sm"
                    : roomState.status === "AUCTION_COMPLETED" || roomState.status === "LINEUP_PHASE"
                    ? "bg-amber-400"
                    : roomState.status === "EVALUATED"
                    ? "bg-emerald-400"
                    : "bg-cyan-400"
                }`}
              />
              <span className="text-[11px] text-slate-300">
                {roomState.status === "AUCTION_ACTIVE"
                  ? "Live Auction"
                  : roomState.status === "AUCTION_COMPLETED" || roomState.status === "LINEUP_PHASE"
                  ? "Lineup Phase"
                  : roomState.status === "EVALUATED"
                  ? "Final Verdict"
                  : "Lobby"}
              </span>
            </div>
          </div>
        )}

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          {/* Creator Pill */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-[10px] text-slate-500 font-medium">By Parth Dange</span>
            <a
              href="https://www.linkedin.com/in/parth-dange-978087293/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 transition p-0.5"
              title="Follow Parth Dange on LinkedIn"
            >
              <LinkedInIcon className="w-3.5 h-3.5" />
            </a>
            <a
              href="mailto:parthdange680@gmail.com"
              className="text-rose-400 hover:text-rose-300 transition p-0.5"
              title="Email Parth Dange (parthdange680@gmail.com)"
            >
              <Mail className="w-3.5 h-3.5" />
            </a>
          </div>

          {myTeam && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: myTeam.color || "#3B82F6" }}
              />
              <div className="flex flex-col truncate max-w-[130px]">
                <span className="text-xs font-bold text-slate-200 truncate">
                  {myTeam.name}
                </span>
                {myTeam.owner_name && (
                  <span className="text-[10px] text-amber-300 font-medium truncate">
                    👤 {myTeam.owner_name}
                  </span>
                )}
              </div>
              <span className="text-xs font-mono font-bold text-emerald-400 shrink-0">
                ₹{(myTeam.budget / 100).toFixed(1)} Cr
              </span>
            </div>
          )}

          {onToggleChat && (
            <button
              onClick={onToggleChat}
              title="Open War Room Live Chat"
              className="relative p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-amber-400 text-slate-400 hover:text-amber-300 transition cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black font-mono animate-pulse">
                  {unreadChatCount > 9 ? "9+" : unreadChatCount}
                </span>
              )}
            </button>
          )}

          <button
            onClick={toggleSound}
            title={soundOn ? "Mute Arena Audio" : "Unmute Arena Audio"}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-amber-400" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {onReset && (
            <button
              onClick={() => {
                if (typeof window !== "undefined" && window.confirm("Are you sure you want to reset the auction session back to lobby? All current squads and bids will be reset.")) {
                  onReset();
                }
              }}
              title="Reset Auction Session"
              className="text-xs font-medium text-slate-400 hover:text-rose-400 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
