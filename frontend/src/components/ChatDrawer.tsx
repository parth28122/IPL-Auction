"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  MessageSquare, 
  X, 
  Send, 
  Crown, 
  Sparkles, 
  Flame, 
  ChevronDown, 
  Smile,
  Volume2,
  Users
} from "lucide-react";
import { ChatMessage } from "@/types";

interface ChatDrawerProps {
  messages: ChatMessage[];
  clientId: string;
  roomId: string;
  onSendMessage: (text: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  unreadCount: number;
}

const QUICK_BANTER = [
  "🦁 Whistle Podu!",
  "💥 Duniya Hila Denge!",
  "🔥 Ee Sala Cup Namde!",
  "👑 Korbo Lorbo Jeetbo!",
  "💰 Outbid you!",
  "🏳️ Passing on this one!",
  "👀 What a steal!",
  "🔨 Hammer falling!",
  "🎯 Tactical masterpiece!"
];

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  clientId,
  roomId,
  onSendMessage,
  isOpen,
  onToggle,
  unreadCount
}) => {
  const [inputText, setInputText] = useState("");
  const [showQuickBanter, setShowQuickBanter] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = inputText.trim();
    if (cleanText) {
      onSendMessage(cleanText);
      setInputText("");
      setShowQuickBanter(false);
    }
  };

  const handleQuickSend = (banterText: string) => {
    onSendMessage(banterText);
    setShowQuickBanter(false);
  };

  const formatTime = (ts: number): string => {
    try {
      const date = new Date(ts * 1000);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <>
      {/* Floating Toggle Pill Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-4 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition shadow-2xl cursor-pointer border ${
            isOpen
              ? "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
              : unreadCount > 0
              ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-amber-400 animate-bounce shadow-amber-500/30"
              : "bg-slate-900/95 text-amber-300 border-amber-500/40 hover:border-amber-400 hover:scale-105 shadow-black/50"
          }`}
          title="Open War Room Live Chat"
        >
          <div className="relative">
            <MessageSquare className="w-4 h-4 text-inherit" />
            {unreadCount > 0 && !isOpen && (
              <span className="absolute -top-2 -right-2.5 px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[9px] font-black font-mono animate-pulse border border-slate-950">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="font-extrabold">{isOpen ? "Hide Chat" : "War Room Chat"}</span>
        </button>
      </div>

      {/* Floating Chat Drawer Window */}
      {isOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-40 w-[330px] sm:w-[380px] h-[500px] max-h-[78vh] bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden animate-fadeIn">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-800/80 bg-slate-900/90 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-1.5">
                  War Room Live Chat
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </h3>
                <p className="text-[10px] text-slate-400 font-mono">
                  Room: <strong className="text-amber-300 uppercase">{roomId}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              title="Close chat window"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Scroll Container */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-2 text-slate-500">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p className="text-xs font-medium">No messages yet in this war room.</p>
                <p className="text-[11px] text-slate-600">
                  Drop some banter, discuss tactical bids, or celebrate star signings!
                </p>
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.sender_id === clientId;
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-0.5`}
                  >
                    {/* Sender Tag */}
                    <div className="flex items-center gap-1.5 px-1">
                      <span className="text-[10px] font-bold text-slate-300 truncate max-w-[120px]">
                        {msg.sender_name}
                      </span>
                      {msg.is_host && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-0.5">
                          <Crown className="w-2.5 h-2.5 text-amber-400" /> Host
                        </span>
                      )}
                      {msg.sender_team && (
                        <span
                          className="text-[9px] px-1.5 py-0.2 rounded-full font-bold text-white shadow-sm truncate max-w-[110px]"
                          style={{ backgroundColor: msg.sender_color || "#3B82F6" }}
                        >
                          {msg.sender_team}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-500 font-mono">
                        {formatTime(msg.timestamp)}
                      </span>
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs max-w-[85%] break-words leading-relaxed shadow-sm ${
                        isMe
                          ? "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30 text-amber-100 rounded-tr-none"
                          : "bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Banter Shortcuts Drawer */}
          {showQuickBanter && (
            <div className="p-2 bg-slate-900/90 border-t border-slate-800/80 animate-fadeIn">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5 px-1">
                ⚡ Quick Banter & Chants
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                {QUICK_BANTER.map((b, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQuickSend(b)}
                    className="px-2 py-1 rounded-lg bg-slate-800/80 hover:bg-amber-500/20 hover:text-amber-300 border border-slate-700 hover:border-amber-400/50 text-[11px] text-slate-300 transition cursor-pointer"
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input & Action Bar */}
          <div className="p-2.5 border-t border-slate-800 bg-slate-900/60">
            <form onSubmit={handleSend} className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowQuickBanter(!showQuickBanter)}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  showQuickBanter
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                }`}
                title="Quick IPL Banter & Chants"
              >
                <Flame className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                placeholder="Type banter or message..."
                maxLength={250}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition font-sans"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
