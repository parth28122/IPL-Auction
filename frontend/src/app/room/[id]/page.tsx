"use client";

import React, { useEffect, useState, useRef, Suspense } from "react";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { LobbyView } from "@/components/LobbyView";
import { AuctionView } from "@/components/AuctionView";
import { LineupBuilderView } from "@/components/LineupBuilderView";
import { VerdictView } from "@/components/VerdictView";
import { ChatDrawer } from "@/components/ChatDrawer";
import { Footer } from "@/components/Footer";
import { Player, RoomState } from "@/types";
import { sounds } from "@/lib/sounds";
import { getApiBaseUrl, getWsBaseUrl } from "@/lib/config";

function RoomContent() {
  const params = useParams();
  const rawRoomId = (params?.id as string) || "lobby";
  const roomId = rawRoomId.trim().toLowerCase();

  const [clientId, setClientId] = useState<string>("");
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const isChatOpenRef = useRef<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      setUnreadCount(0);
    }
  }, [isChatOpen]);

  // Initialize client id
  useEffect(() => {
    let cid = sessionStorage.getItem("ipl_client_id");
    if (!cid) {
      cid = "user_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("ipl_client_id", cid);
    }
    setClientId(cid);
  }, []);

  // Fetch all players for lobby scouting
  useEffect(() => {
    const apiBase = getApiBaseUrl();
    fetch(`${apiBase}/api/players`)
      .then(res => res.json())
      .then(data => {
        if (data.players) {
          setAllPlayers(data.players);
        }
      })
      .catch(err => {
        console.warn("Could not fetch players via HTTP, will receive via WebSocket", err);
      });
  }, []);

  // WebSocket connection
  useEffect(() => {
    if (!clientId || !roomId || roomId === "lobby") return;

    const wsUrl = getWsBaseUrl(roomId, clientId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type } = data;

        if (type === "INITIAL_STATE" || type === "ROOM_STATE_UPDATE") {
          setRoomState(data.state);
        } else if (type === "TIMER_TICK") {
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              timer: data.timer,
              current_bid: data.current_bid,
              highest_bidder_id: data.highest_bidder_id,
              highest_bidder_name: data.highest_bidder_name
            };
          });
        } else if (type === "BID_ACCEPTED") {
          sounds.playBid();
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              current_bid: data.amount,
              highest_bidder_id: data.team_id,
              highest_bidder_name: data.team_name,
              timer: data.timer,
              bid_history: data.bid_history,
              auction_feed: data.auction_feed
            };
          });
        } else if (type === "PLAYER_SOLD") {
          sounds.playHammerSold();
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              latest_news: data.news || data.latest_news || prev.latest_news,
              auction_feed: data.auction_feed || prev.auction_feed
            };
          });
        } else if (type === "PLAYER_UNSOLD") {
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              latest_news: data.news || data.latest_news || prev.latest_news,
              auction_feed: data.auction_feed || prev.auction_feed
            };
          });
        } else if (type === "SET_TRANSITION") {
          sounds.playHammerSold();
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              current_pool: data.current_set,
              latest_set_transition: {
                previous_set: data.previous_set,
                current_set: data.current_set,
                message: data.message,
                timestamp: data.timestamp || Date.now()
              }
            };
          });
        } else if (type === "AUCTION_END") {
          setRoomState(data.state);
        } else if (type === "LINEUP_TIMER_TICK") {
          setRoomState(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              lineup_timer: data.lineup_timer
            };
          });
        } else if (type === "LINEUP_DEADLINE_EXPIRED") {
          sounds.playWarning();
          if (data.state) {
            setRoomState(data.state);
          }
        } else if (type === "VERDICT") {
          setRoomState(prev => {
            if (!prev) return data.state;
            return {
              ...prev,
              status: "EVALUATED",
              verdict_data: data.verdict,
              ...data.state
            };
          });
        } else if (type === "CHAT_MESSAGE") {
          sounds.playChatPop();
          setRoomState(prev => {
            if (!prev) return prev;
            const currentMsgs = prev.chat_messages || [];
            return {
              ...prev,
              chat_messages: [...currentMsgs, data.message]
            };
          });
          setUnreadCount(prev => (isChatOpenRef.current ? 0 : prev + 1));
        }
      } catch (err) {
        console.error("Error parsing WS message:", err);
      }
    };

    ws.onclose = () => {
      setConnectionStatus("disconnected");
    };

    ws.onerror = (err) => {
      console.error("WS error:", err);
      setConnectionStatus("disconnected");
    };

    return () => {
      ws.close();
    };
  }, [clientId, roomId]);

  // Action Dispatchers
  const sendWs = (type: string, payload: Record<string, unknown> = {}) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  };

  const handleJoinTeam = (teamName: string, color: string, ownerName?: string) => {
    const finalOwner = ownerName?.trim() || (typeof window !== "undefined" ? sessionStorage.getItem("ipl_player_name") : "") || "";
    sendWs("JOIN_ROOM", { team_id: clientId, team_name: teamName, color, owner_name: finalOwner });
  };

  const handleAddBots = (count: number = 3) => {
    sendWs("ADD_BOTS", { count });
  };

  const handleStartAuction = () => {
    sendWs("START_AUCTION");
  };

  const handleBid = (increment: number) => {
    sendWs("BID", { team_id: clientId, increment });
  };

  const handlePass = () => {
    sendWs("PASS", { team_id: clientId });
  };

  const handleSubmitLineup = (playingXi: string[], bench: string[], captainId?: string) => {
    sendWs("SUBMIT_LINEUP", { team_id: clientId, playing_xi: playingXi, bench, captain_id: captainId });
  };

  const handleTriggerEvaluation = () => {
    sendWs("TRIGGER_EVALUATION");
  };

  const handleSendChat = (text: string) => {
    sendWs("SEND_CHAT", { text });
  };

  const handleResetAuction = () => {
    sendWs("RESET_AUCTION");
  };

  if (connectionStatus === "connecting" && !roomState) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-400 animate-spin" />
        <p className="text-sm font-semibold text-slate-400">Connecting to IPL Auction War Room ({roomId})...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative">
      <Navbar
        roomState={roomState}
        myTeamId={clientId}
        onReset={handleResetAuction}
        onToggleChat={() => setIsChatOpen(prev => !prev)}
        unreadChatCount={unreadCount}
      />

      <main className="flex-1 pb-16">
        {!roomState || roomState.status === "LOBBY" ? (
          <LobbyView
            roomState={roomState || {
              room_id: roomId,
              name: "IPL Mega Auction",
              status: "LOBBY",
              teams: {},
              current_player: null,
              current_player_index: -1,
              total_players_in_queue: 0,
              current_bid: 0,
              highest_bidder_id: null,
              highest_bidder_name: null,
              timer: 5,
              bid_history: [],
              auction_feed: [],
              passed_teams: [],
              verdict_data: null
            }}
            myTeamId={clientId}
            allPlayers={allPlayers}
            onJoinTeam={handleJoinTeam}
            onAddBots={handleAddBots}
            onStartAuction={handleStartAuction}
          />
        ) : roomState.status === "AUCTION_ACTIVE" ? (
          <AuctionView
            roomState={roomState}
            myTeamId={clientId}
            allPlayers={allPlayers}
            onBid={handleBid}
            onPass={handlePass}
            onOpenChat={() => setIsChatOpen(prev => !prev)}
          />
        ) : roomState.status === "AUCTION_COMPLETED" || roomState.status === "LINEUP_PHASE" ? (
          <LineupBuilderView
            roomState={roomState}
            myTeamId={clientId}
            onSubmitLineup={handleSubmitLineup}
            onTriggerEvaluation={handleTriggerEvaluation}
          />
        ) : (
          <VerdictView
            roomState={roomState}
            onResetAuction={handleResetAuction}
          />
        )}
      </main>

      <ChatDrawer
        messages={roomState?.chat_messages || []}
        clientId={clientId}
        roomId={roomId}
        onSendMessage={handleSendChat}
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(prev => !prev)}
        unreadCount={unreadCount}
      />

      <Footer />
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500/20 border-t-amber-400 rounded-full animate-spin" />
      </div>
    }>
      <RoomContent />
    </Suspense>
  );
}
