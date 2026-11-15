"use client";

import React, { useState } from "react";
import { Mail, Copy, Check, ExternalLink, ShieldCheck, Heart, Sparkles, Trophy } from "lucide-react";
import { LinkedInIcon } from "./LinkedInIcon";

export const Footer: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const email = "parthdange680@gmail.com";
  const linkedinUrl = "https://www.linkedin.com/in/parth-dange-978087293/";

  const handleCopyEmail = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <footer className="mt-auto border-t border-slate-800/80 bg-slate-950/90 backdrop-blur-md py-8 px-4 lg:px-8 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Left: Brand & Tagline */}
        <div className="flex items-center gap-3 text-center md:text-left">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-md shadow-amber-500/10 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="font-extrabold text-white tracking-tight">IPL Auction Arena</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                PRO 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Competitive Auction Simulator & Algorithmic Tactician Engine
            </p>
          </div>
        </div>

        {/* Center / Right: Creator Profile Card */}
        <div className="flex flex-wrap items-center justify-center gap-3 bg-slate-900/80 border border-slate-800 rounded-2xl px-4 py-2.5 shadow-inner">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-500 via-indigo-500 to-cyan-400 p-0.5 flex items-center justify-center font-black text-white text-[10px] shadow">
              PD
            </div>
            <div className="text-left">
              <span className="text-[11px] font-bold text-slate-200 block leading-tight">Parth Dange</span>
              <span className="text-[10px] text-slate-500 leading-tight">Full-Stack & Systems Architect</span>
            </div>
          </div>

          <div className="h-4 w-px bg-slate-800 hidden sm:block" />

          {/* Social Links */}
          <div className="flex items-center gap-2">
            {/* LinkedIn Follow Button */}
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-400 hover:text-blue-300 font-semibold text-xs transition shadow-sm"
              title="Connect & Follow Parth Dange on LinkedIn"
            >
              <LinkedInIcon className="w-3.5 h-3.5" />
              <span>Follow on LinkedIn</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </a>

            {/* Email Button */}
            <a
              href={`mailto:${email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-400 hover:text-rose-300 font-semibold text-xs transition shadow-sm"
              title="Send email to Parth Dange"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </a>

            {/* Copy Email Button */}
            <button
              onClick={handleCopyEmail}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
              title={copied ? "Email copied!" : "Copy email address"}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};
