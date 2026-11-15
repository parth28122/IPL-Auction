"use client";

import React, { useEffect } from "react";
import confetti from "canvas-confetti";
import { 
  Trophy, 
  Medal, 
  Award, 
  Sparkles, 
  TrendingUp, 
  ShieldCheck, 
  AlertTriangle, 
  RotateCcw, 
  ExternalLink,
  Flame,
  CheckCircle,
  Zap,
  Globe2,
  Crown
} from "lucide-react";
import { sounds } from "@/lib/sounds";
import { RoomState, EvaluationResult } from "@/types";

interface VerdictViewProps {
  roomState: RoomState;
  onResetAuction: () => void;
}

export const VerdictView: React.FC<VerdictViewProps> = ({
  roomState,
  onResetAuction
}) => {
  const { verdict_data, teams } = roomState;
  const evaluations: EvaluationResult[] = Object.values(teams || {})
    .map(t => t.evaluation_result)
    .filter(Boolean) as EvaluationResult[];

  // Sort by total score descending
  const sortedEvaluations = [...evaluations].sort((a, b) => b.total_score - a.total_score);
  const winnerEval = sortedEvaluations[0];
  const runnerUpEval = sortedEvaluations[1];

  useEffect(() => {
    // Fire celebration confetti & victory fanfare
    sounds.playVictory();
    try {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // Ignore
    }
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8 animate-fadeIn">
      {/* Championship Trophy Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-amber-950/40 to-slate-900 border border-amber-500/30 p-8 sm:p-12 text-center shadow-2xl">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-4">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 p-1 shadow-2xl shadow-amber-500/30 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 animate-pulse" />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
              Tournament Champions 2026
            </span>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
              {verdict_data?.winner || winnerEval?.team_name || "Champions"}
            </h1>
            <p className="text-sm font-semibold text-slate-300">
              Runner-Up: <span className="text-amber-200">{verdict_data?.runner_up || runnerUpEval?.team_name || "Runner Up"}</span>
            </p>
          </div>

          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono font-bold text-amber-300 shadow-inner">
            <span>Winning Score: {winnerEval?.total_score || 0} pts</span>
            <span>•</span>
            <span>Batting Index: {winnerEval?.batting_score || 0}</span>
            <span>•</span>
            <span>Bowling Index: {winnerEval?.bowling_score || 0}</span>
          </div>
        </div>
      </div>

      {/* ESPN / Cricinfo Editorial Commentary Box */}
      {verdict_data?.match_verdict && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="px-2.5 py-1 rounded bg-rose-600 text-white font-black text-[11px] tracking-wider uppercase">
                CRICINFO VERDICT
              </div>
              <span className="text-xs text-slate-400 font-medium">
                Official Tactical Tournament Analysis
              </span>
            </div>
            <span className="text-[11px] text-amber-400 flex items-center gap-1 font-mono">
              <Sparkles className="w-3.5 h-3.5" /> Powered by Gemini 2.5 Flash
            </span>
          </div>

          <div className="space-y-4 text-slate-200 text-sm sm:text-base leading-relaxed font-serif">
            {verdict_data.match_verdict.split("\n\n").map((paragraph, idx) => (
              <p key={idx} className="tracking-wide">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Key Performers Cards */}
          {verdict_data.key_performers && verdict_data.key_performers.length > 0 && (
            <div className="pt-4 border-t border-slate-800/80 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Medal className="w-4 h-4 text-amber-400" />
                Key Tournament Impact Performers
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans">
                {verdict_data.key_performers.map((performer, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white truncate">{performer.player_name}</span>
                      <span className="text-[10px] text-amber-400 font-medium">{performer.role}</span>
                    </div>
                    <p className="text-[10px] text-slate-400">{performer.team_name}</p>
                    <p className="text-[11px] text-slate-300 italic pt-1">{performer.impact_reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Captains' Clash & Leadership Breakdown */}
      {(() => {
        const captainMatchup = roomState.captain_matchup || verdict_data?.captain_matchup;
        const captainsList = captainMatchup?.ranked_captains || 
          evaluations.map(e => e.captain_info).filter(Boolean) as any[];

        if (!captainsList || captainsList.length === 0) return null;

        return (
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Crown className="w-5 h-5 text-amber-400 fill-amber-400/20" />
                  </span>
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    The Captains' Duel: Head-to-Head Leadership Matchup
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Objective tactical leadership evaluation comparing IPL captaincy records against Syed Mushtaq Ali Trophy (SMAT) and domestic T20 records.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300">
                <span>{captainsList.length} Skippers Evaluated</span>
              </div>
            </div>

            {/* Captains Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {captainsList.map((cap, idx) => {
                const team = Object.values(teams || {}).find(t => t.team_id === cap.team_id);
                const isBest = idx === 0;

                return (
                  <div
                    key={cap.player_id || idx}
                    className={`relative rounded-2xl p-4 flex flex-col justify-between space-y-3 transition-all ${
                      isBest
                        ? "bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-amber-400 shadow-xl shadow-amber-500/10 ring-1 ring-amber-400/30"
                        : "bg-slate-950/80 border border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    {isBest && (
                      <div className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                        👑 Top Rated Skipper
                      </div>
                    )}

                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img
                            src={cap.avatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80"}
                            alt={cap.name}
                            className="w-12 h-12 rounded-xl object-cover border-2 border-slate-700"
                          />
                          <div
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border border-slate-950"
                            style={{ backgroundColor: team?.color || "#3B82F6" }}
                            title={team?.name}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-bold text-white truncate">{cap.name}</h4>
                            <span className="text-[10px] font-black text-amber-300 font-mono">
                              #{idx + 1}
                            </span>
                          </div>
                          <p className="text-[11px] font-semibold text-slate-400 truncate">
                            {team?.name || cap.team_name}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              {cap.tier}
                            </span>
                            {cap.tournament_team && (
                              <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-800/80 text-cyan-300 border border-slate-700/60 truncate max-w-[130px]">
                                {cap.tournament_team}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-300 italic line-clamp-2 leading-snug">
                        "{cap.tactical_style}"
                      </p>

                      {/* Stats comparison box */}
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 space-y-1.5 text-xs font-mono">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-sans">Tactical Acumen:</span>
                          <span className="font-bold text-amber-300">{cap.captaincy_rating} / 100</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-sans">Eval Source:</span>
                          <span className="text-cyan-400 text-[10px] truncate max-w-[130px] font-sans font-semibold" title={cap.experience_source}>
                            {cap.experience_source}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-sans">Win Index:</span>
                          <span className="font-bold text-emerald-400">{cap.effective_win_pct}%</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-400 font-sans">IPL Matches:</span>
                          <span className="font-bold text-slate-300">
                            {cap.ipl_matches > 0 ? `${cap.ipl_matches} (W: ${cap.ipl_wins})` : `0 (${cap.tournament_name ? cap.tournament_name.split(" ")[0] : "League"} Fallback)`}
                          </span>
                        </div>
                        {(cap.domestic_matches || cap.smat_matches || 0) > 0 && (
                          <div className="flex justify-between items-center text-[11px]">
                            <span className="text-slate-400 font-sans truncate max-w-[110px]" title={cap.tournament_name || "Domestic / Overseas League"}>
                              {cap.tournament_name ? cap.tournament_name.split(" ")[0] : "League"}:
                            </span>
                            <span className="text-slate-300">
                              {cap.domestic_matches || cap.smat_matches} matches ({cap.domestic_win_pct || cap.smat_win_pct}% W)
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Trophies */}
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Key Honors & Experience
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {cap.trophies?.map((t: string, tIdx: number) => (
                            <span
                              key={tIdx}
                              className="text-[9px] font-medium px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800"
                            >
                              🏆 {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Leadership Impact:</span>
                      <span className="font-mono font-bold text-emerald-400">+{cap.leadership_bonus} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Head-to-Head Comparative Notes */}
            {captainMatchup?.head_to_head_notes && captainMatchup.head_to_head_notes.length > 0 && (
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Tactical Leadership Head-to-Head Analysis
                </h4>
                <div className="space-y-2">
                  {captainMatchup.head_to_head_notes.map((note: string, nIdx: number) => (
                    <p key={nIdx} className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-3 border-l-2 border-amber-500/50">
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Official Standings Leaderboard Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              Official Tournament Standings & Scorecard
            </h2>
            <p className="text-xs text-slate-400">
              Deterministic composite score breakdown across batting phases, bowling indexes, bench redundancy, and structural deductions.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Rank</th>
                <th className="py-3 px-4">Franchise</th>
                <th className="py-3 px-3 text-right">Powerplay Bat</th>
                <th className="py-3 px-3 text-right">Middle Bat</th>
                <th className="py-3 px-3 text-right">Death Bat</th>
                <th className="py-3 px-3 text-right">Death Bowl</th>
                <th className="py-3 px-3 text-right">Bench Score</th>
                <th className="py-3 px-3 text-right">Penalties</th>
                <th className="py-3 px-4 text-right">Total Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {sortedEvaluations.map((ev, rankIdx) => {
                const team = Object.values(teams || {}).find(t => t.team_id === ev.team_id);
                const isEliminated = ev.is_eliminated || team?.is_eliminated;

                return (
                  <tr key={ev.team_id} className={`transition ${isEliminated ? "bg-rose-950/20 opacity-70 hover:opacity-100" : "hover:bg-slate-800/30"}`}>
                    <td className="py-3.5 px-4 font-bold font-mono text-slate-300">
                      {isEliminated ? (
                        <span className="text-rose-400 font-bold text-xs">DISQ</span>
                      ) : (
                        rankIdx === 0 ? "🥇 #1" : rankIdx === 1 ? "🥈 #2" : rankIdx === 2 ? "🥉 #3" : `#${rankIdx + 1}`
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: team?.color || "#3B82F6" }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">{ev.team_name}</span>
                            {isEliminated && (
                              <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Eliminated (&lt; 18 Players)
                              </span>
                            )}
                            {team?.is_bot && !isEliminated && (
                              <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400">
                                AI Bot
                              </span>
                            )}
                          </div>
                          {team?.owner_name && team.owner_name !== ev.team_name && (
                            <span className="text-[10px] text-amber-300/90 font-medium block">
                              👤 {team.owner_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                      {isEliminated ? "-" : (ev.phases?.batting?.powerplay || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-slate-300">
                      {isEliminated ? "-" : (ev.phases?.batting?.middle || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-emerald-400 font-bold">
                      {isEliminated ? "-" : (ev.phases?.batting?.death || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-cyan-400 font-bold">
                      {isEliminated ? "-" : (ev.phases?.bowling?.death || 0)}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono text-indigo-300">
                      {isEliminated ? "-" : `+${ev.bench_score || 0}`}
                    </td>
                    <td className="py-3.5 px-3 text-right font-mono">
                      {isEliminated ? (
                        <span className="text-rose-400 font-bold">DISQ</span>
                      ) : ev.penalty_deductions > 0 ? (
                        <span className="text-rose-400 font-bold">-{ev.penalty_deductions}</span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-base font-black">
                      {isEliminated ? (
                        <span className="text-rose-400 text-xs font-bold">0 pts (Disqualified)</span>
                      ) : (
                        <span className="text-amber-300">{ev.total_score}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restart / Rematch Action */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onResetAuction}
          className="flex items-center gap-2 py-3.5 px-8 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-sm uppercase tracking-wider transition shadow-xl shadow-amber-500/20 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Start New Mega Auction
        </button>
      </div>
    </div>
  );
};
