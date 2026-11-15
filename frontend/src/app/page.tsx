"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Trophy, 
  Play, 
  Users, 
  Bot, 
  Sparkles, 
  Zap, 
  ArrowRight, 
  DollarSign, 
  Gavel, 
  Mail,
  PlusCircle,
  Hash,
  User
} from "lucide-react";
import { LinkedInIcon } from "@/components/LinkedInIcon";
import { Footer } from "@/components/Footer";
import { getApiBaseUrl } from "@/lib/config";

// Generates memorable 6-character room codes like "IPL842", "WAR791", etc.
const generateMemorableRoomCode = (): string => {
  const prefixes = ["WAR", "IPL", "MEGA", "ARENA", "STAR", "ACE"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${prefix}${num}`.toLowerCase();
};

export default function HomePage() {
  const router = useRouter();
  const [joinRoomId, setJoinRoomId] = useState("");
  const [userName, setUserName] = useState(() => 
    typeof window !== "undefined" ? sessionStorage.getItem("ipl_player_name") || "" : ""
  );
  const [customRoomId, setCustomRoomId] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleNameChange = (val: string) => {
    setUserName(val);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("ipl_player_name", val.trim());
    }
  };

  const createRoom = async (autoAddBots: boolean = false, desiredRoomId?: string) => {
    setLoading(true);
    setErrorMessage(null);
    if (typeof window !== "undefined" && userName.trim()) {
      sessionStorage.setItem("ipl_player_name", userName.trim());
    }
    const chosenRoomId = (desiredRoomId || generateMemorableRoomCode()).trim().toLowerCase();

    try {
      const apiBase = getApiBaseUrl();
      const res = await fetch(`${apiBase}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: "IPL Mega Auction",
          room_id: chosenRoomId
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const finalRoomId = data.room_id || chosenRoomId;

      if (autoAddBots) {
        // Add 3 AI franchises for instant solo battle
        await fetch(`${apiBase}/api/rooms/${finalRoomId}/bots`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 3 })
        }).catch(err => console.warn("Could not pre-add bots:", err));
      }

      router.push(`/room/${finalRoomId}`);
    } catch (err) {
      console.warn("API room creation failed, falling back to direct websocket room:", err);
      // Fallback: router navigation still connects WebSocket directly to backend get_or_create_room!
      router.push(`/room/${chosenRoomId}`);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = joinRoomId.trim().toLowerCase();
    if (cleanId) {
      if (typeof window !== "undefined" && userName.trim()) {
        sessionStorage.setItem("ipl_player_name", userName.trim());
      }
      router.push(`/room/${cleanId}`);
    }
  };

  const handleCustomRoomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = customRoomId.trim().toLowerCase();
    if (cleanId) {
      if (typeof window !== "undefined" && userName.trim()) {
        sessionStorage.setItem("ipl_player_name", userName.trim());
      }
      createRoom(false, cleanId);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950">
      {/* Background ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-amber-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-10 w-[500px] h-[400px] bg-indigo-500/10 rounded-full blur-[140px]" />
        <div className="absolute top-20 right-10 w-[400px] h-[400px] bg-cyan-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-0.5 shadow-lg shadow-amber-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Trophy className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <div>
              <span className="text-lg font-black tracking-tight bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 bg-clip-text text-transparent">
                IPL AUCTION ARENA
              </span>
              <span className="hidden sm:inline-block ml-2 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PRO 2026
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-900/60 border border-slate-800 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              FastAPI + Next.js 15 + Gemini 2.5
            </div>

            {/* Creator Follow / Connect */}
            <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-full pl-2 pr-1 py-1">
              <span className="text-[11px] font-medium text-slate-400">By <strong className="text-slate-200">Parth Dange</strong></span>
              <a
                href="https://www.linkedin.com/in/parth-dange-978087293/"
                target="_blank"
                rel="noopener noreferrer"
                className="w-6 h-6 rounded-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 flex items-center justify-center transition"
                title="Connect on LinkedIn"
              >
                <LinkedInIcon className="w-3 h-3" />
              </a>
              <a
                href="mailto:parthdange680@gmail.com"
                className="w-6 h-6 rounded-full bg-rose-600/20 hover:bg-rose-600/40 text-rose-400 flex items-center justify-center transition"
                title="Contact via Gmail"
              >
                <Mail className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 max-w-5xl mx-auto px-6 py-12 sm:py-16 space-y-12 text-center">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider shadow-sm">
            <Zap className="w-4 h-4" /> Live Multiplayer Cricket Auction Simulator
          </div>

          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-[1.15]">
            Bid Like an IPL Owner. <br />
            <span className="bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent">
              Build Like a Tactician.
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-slate-400 text-sm sm:text-base leading-relaxed">
            Draft marquee superstars across Marquee, Batter, Keeper, All-Rounder, and Bowler pools 
            under the ₹120 Cr budget and ₹80 Cr marquee cap. Drag-and-drop your Playing XI, then run our 
            deterministic evaluation engine with Gemini 2.5 Flash ESPN/Cricinfo match commentary!
          </p>
        </div>

        {errorMessage && (
          <div className="max-w-md mx-auto p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs font-semibold">
            {errorMessage}
          </div>
        )}

        {/* Manager Name / Tag Input Card */}
        <div className="max-w-md mx-auto bg-slate-900/90 border border-slate-800 focus-within:border-amber-400 rounded-2xl p-4 shadow-xl text-left transition">
          <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              Your Manager Name / Tag
            </span>
            <span className="text-[10px] text-amber-400 font-semibold uppercase">
              {userName.trim() ? "✓ Ready" : "Recommended"}
            </span>
          </label>
          <input
            type="text"
            value={userName}
            onChange={e => handleNameChange(e.target.value)}
            placeholder="Write your name (e.g. Parth Dange)"
            maxLength={25}
            className="w-full mt-2 bg-slate-950 border border-slate-700/80 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none transition font-sans"
          />
          <p className="text-[11px] text-slate-400 mt-1.5">
            Your name will be displayed when you claim a franchise, place bids, and appear in breaking news.
          </p>
        </div>

        {/* Action Modes Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
          {/* Solo vs AI Bots */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-2xl p-6 space-y-4 transition shadow-xl group">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition">
              <Bot className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-amber-300 transition">
                Solo Arena vs AI Bots
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Instant play against 3 AI Franchises (CSK, MI, RCB) with real-time bidding algorithms.
              </p>
            </div>

            <button
              onClick={() => createRoom(true)}
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              {loading ? "Initializing..." : "Launch Solo Arena"}
            </button>
          </div>

          {/* Multiplayer Room */}
          <div className="bg-slate-900/80 border border-slate-800 hover:border-cyan-500/50 rounded-2xl p-6 space-y-4 transition shadow-xl group">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition">
              <Users className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white group-hover:text-cyan-300 transition">
                Multiplayer War Room
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Create a room code and invite friends to claim franchises and bid in real-time.
              </p>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => createRoom(false)}
                disabled={loading}
                className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-400 text-cyan-300 font-bold text-xs uppercase tracking-wider transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                {loading ? "Generating..." : "Create Room Code & Host"}
              </button>

              <button
                type="button"
                onClick={() => setShowCustomModal(!showCustomModal)}
                className="w-full text-center text-[11px] text-slate-400 hover:text-cyan-300 transition underline underline-offset-4 cursor-pointer"
              >
                {showCustomModal ? "Hide Custom Code Form" : "Or use your own custom room code"}
              </button>
            </div>
          </div>
        </div>

        {/* Custom Room Code Form Modal / Dropdown */}
        {showCustomModal && (
          <div className="max-w-md mx-auto bg-slate-900/90 border border-cyan-500/30 rounded-xl p-4 shadow-xl animate-fadeIn">
            <form onSubmit={handleCustomRoomSubmit} className="space-y-3">
              <div className="text-left">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-cyan-400" />
                  Choose Your Custom Room Code
                </label>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  e.g., <code className="text-amber-300 font-mono">ipl2026</code>, <code className="text-amber-300 font-mono">cskwarroom</code>, or <code className="text-amber-300 font-mono">champions</code>
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={customRoomId}
                  onChange={e => setCustomRoomId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                  placeholder="Enter code (e.g. ipl2026)"
                  maxLength={20}
                  className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={!customRoomId.trim() || loading}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs uppercase tracking-wide transition cursor-pointer disabled:opacity-50"
                >
                  Create & Enter
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Join by Code Form */}
        <div className="max-w-md mx-auto bg-slate-900/50 border border-slate-800 rounded-xl p-4">
          <form onSubmit={handleJoin} className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={joinRoomId}
                onChange={e => setJoinRoomId(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                placeholder="Enter Room Code (e.g. war482)"
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-white focus:outline-none font-mono"
              />
              <button
                type="submit"
                disabled={!joinRoomId.trim()}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide transition cursor-pointer disabled:opacity-50"
              >
                Join Room
              </button>
            </div>
            {userName && (
              <p className="text-[11px] text-slate-400 text-left">
                Joining as: <strong className="text-amber-300 font-medium">{userName}</strong>
              </p>
            )}
          </form>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left pt-8 border-t border-slate-800/80">
          <div className="space-y-2 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
              <DollarSign className="w-4 h-4" /> ₹120 Cr Budget & ₹80 Cr Cap
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Strict IPL salary cap constraints. Manage purse distributions between Marquee aces and uncapped gems.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Gavel className="w-4 h-4" /> Simultaneous Live Bidding
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time WebSocket concurrency with synchronized countdowns (+20L, +50L, +1Cr) and authentic hammer physics.
            </p>
          </div>

          <div className="space-y-2 p-4 rounded-xl bg-slate-900/40 border border-slate-800/60">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <Sparkles className="w-4 h-4" /> AI Cricinfo Verdict (Gemini)
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Deterministic positional and phase matchup scores, evaluated by Gemini 2.5 Flash for punchy Cricinfo editorial commentary.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
