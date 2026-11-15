import asyncio
import json
import logging
import random
import time
import uuid
from typing import Dict, List, Optional, Set, Any
from fastapi import WebSocket

from evaluator import evaluate_lineup, get_captaincy_stats, generate_captain_matchup_analysis
from gemini_service import generate_verdict_commentary
from auction_news import generate_player_sold_news, generate_player_unsold_news

logger = logging.getLogger("room_manager")

TOTAL_BUDGET_LAKHS = 12000  # ₹120 Crore
MARQUEE_CAP_LAKHS = 8000    # ₹80 Crore
TIMER_DURATION = 5          # 5 seconds auction countdown timer
LINEUP_TIMER_DURATION = 150 # 2.5 minutes (150 seconds) post-auction lineup deadline timer

PORTRAITS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&auto=format&fit=crop&q=80",
]

def normalize_player(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Ensures player objects are fully backwards-compatible across both schemas."""
    p = dict(raw)
    tier = str(p.get("tier", ""))
    role = str(p.get("role", "BAT"))
    is_wk = bool(p.get("is_wk") or p.get("is_wicketkeeper") or role == "WK")

    # Map category
    category = p.get("category")
    if not category:
        if tier == "Marquee":
            category = "Marquee"
        elif is_wk:
            category = "Keeper"
        elif role == "ALL":
            category = "All-Rounder"
        elif role == "BOWL":
            category = "Bowler"
        else:
            category = "Batter"
    p["category"] = category

    # Ensure role is standard: BAT, BOWL, ALL, WK
    if "role" not in p or not p["role"]:
        if is_wk:
            p["role"] = "WK"
        elif category == "Bowler":
            p["role"] = "BOWL"
        elif category == "All-Rounder":
            p["role"] = "ALL"
        else:
            p["role"] = "BAT"

    # Base price in Lakhs and Cr
    base_price_cr = p.get("base_price_cr")
    base_price = p.get("base_price")
    if base_price is None and base_price_cr is not None:
        p["base_price"] = int(round(float(base_price_cr) * 100))
    elif base_price is not None and base_price_cr is None:
        p["base_price_cr"] = round(float(base_price) / 100.0, 2)
    elif base_price is None and base_price_cr is None:
        p["base_price"] = 100
        p["base_price_cr"] = 1.0

    p["is_wicketkeeper"] = is_wk
    p["is_wk"] = is_wk
    p["is_bowling_option"] = bool(p.get("role") in ["BOWL", "ALL"] or category in ["Bowler", "All-Rounder"])
    p["country"] = p.get("country", "Overseas" if p.get("is_overseas") else "India")
    p["bowling_type"] = p.get("bowling_type", "Pace/Spin" if p["is_bowling_option"] else "None")
    p["has_ipl_stats"] = p.get("has_ipl_stats", tier != "Uncapped")

    if not p.get("badges"):
        badges = []
        if tier == "Marquee":
            badges.append("Marquee Star")
        if p.get("is_overseas"):
            badges.append("International")
        if is_wk:
            badges.append("Gloveman")
        if p["role"] == "ALL":
            badges.append("Dual Threat")
        if p["role"] == "BOWL":
            badges.append("Strike Bowler")
        if not badges:
            badges.append("Core Asset")
        p["badges"] = badges

    # Avatar fallback
    if not p.get("avatar"):
        idx = abs(hash(p.get("id", ""))) % len(PORTRAITS)
        p["avatar"] = PORTRAITS[idx]

    # primary_slot
    pslot = p.get("primary_slot")
    if pslot is None:
        if is_wk:
            p["primary_slot"] = [3, 4]
        elif p["role"] == "BOWL":
            p["primary_slot"] = [9, 10, 11]
        elif p["role"] == "ALL":
            p["primary_slot"] = [6, 7]
        else:
            p["primary_slot"] = [1, 2]
    elif isinstance(pslot, int):
        p["primary_slot"] = [pslot]

    return p

def get_primary_slots(player: Optional[Dict[str, Any]]) -> List[int]:
    if not player or not isinstance(player, dict):
        return []
    s = player.get("primary_slot")
    if s is None:
        return []
    if isinstance(s, int):
        return [s]
    if isinstance(s, (list, tuple, set)):
        res = []
        for x in s:
            try:
                res.append(int(x))
            except (ValueError, TypeError):
                pass
        return res
    return []

BOT_FRANCHISES = [
    {"name": "Mumbai Indians", "color": "#004BA0"},
    {"name": "Chennai Super Kings", "color": "#F9CD05"},
    {"name": "Royal Challengers Bengaluru", "color": "#EC1C24"},
    {"name": "Kolkata Knight Riders", "color": "#3A225D"}
]

class Team:
    def __init__(self, team_id: str, name: str, is_bot: bool = False, color: str = "#3B82F6", owner_name: Optional[str] = None):
        self.team_id = team_id
        self.name = name
        self.owner_name = owner_name or ("AI Franchise" if is_bot else name)
        self.is_bot = is_bot
        self.color = color
        self.budget = TOTAL_BUDGET_LAKHS
        self.marquee_spent = 0
        self.players: List[Dict[str, Any]] = []
        self.playing_xi: List[str] = []
        self.bench: List[str] = []
        self.captain_id: Optional[str] = None
        self.lineup_submitted = False
        self.evaluation_result: Optional[Dict[str, Any]] = None
        self.is_eliminated: bool = False
        self.elimination_reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "team_id": self.team_id,
            "name": self.name,
            "owner_name": self.owner_name,
            "is_bot": self.is_bot,
            "color": self.color,
            "budget": self.budget,
            "marquee_spent": self.marquee_spent,
            "players_count": len(self.players),
            "overseas_count": len([p for p in self.players if p.get("is_overseas")]),
            "players": self.players,
            "playing_xi": self.playing_xi,
            "bench": self.bench,
            "captain_id": self.captain_id,
            "captain_info": self.evaluation_result.get("captain_info") if self.evaluation_result else None,
            "lineup_submitted": self.lineup_submitted,
            "evaluation_result": self.evaluation_result,
            "is_eliminated": self.is_eliminated,
            "elimination_reason": self.elimination_reason
        }

class Room:
    def __init__(self, room_id: str, name: str, all_players: List[Dict[str, Any]]):
        self.room_id = room_id.strip().lower()
        self.name = name
        self.all_players = [normalize_player(p) for p in all_players]
        self.players_map = {p["id"]: p for p in self.all_players}
        
        self.teams: Dict[str, Team] = {}
        self.connections: Dict[str, WebSocket] = {}
        self.host_id: Optional[str] = None
        self.bid_lock = asyncio.Lock()
        self.created_at = time.time()
        self.last_active = time.time()
        
        self.status = "LOBBY"  # LOBBY, AUCTION_ACTIVE, AUCTION_COMPLETED, LINEUP_PHASE, EVALUATED
        
        # Auction state
        self.players_queue: List[Dict[str, Any]] = []
        self.current_player_index = -1
        self.current_player: Optional[Dict[str, Any]] = None
        self.current_bid = 0
        self.highest_bidder_id: Optional[str] = None
        self.highest_bidder_name: Optional[str] = None
        self.bid_history: List[Dict[str, Any]] = []
        self.passed_teams: Set[str] = set()
        
        self.timer = TIMER_DURATION
        self.timer_task: Optional[asyncio.Task] = None
        self.lineup_timer = LINEUP_TIMER_DURATION
        self.lineup_timer_task: Optional[asyncio.Task] = None
        self.is_paused = False
        
        self.verdict_data: Optional[Dict[str, Any]] = None
        self.captain_matchup: Optional[Dict[str, Any]] = None
        self.latest_news: Optional[Dict[str, Any]] = None
        self.auction_feed: List[Dict[str, Any]] = []
        self.current_pool: Optional[str] = "Marquee Set 1"
        self.latest_set_transition: Optional[Dict[str, Any]] = None
        self.auctioned_players: Dict[str, Dict[str, Any]] = {}
        self.chat_messages: List[Dict[str, Any]] = []

    def get_pools_summary(self) -> List[Dict[str, Any]]:
        ordered_pool_names = []
        for p in self.all_players:
            pl = p.get("pool", "Standard")
            if pl not in ordered_pool_names:
                ordered_pool_names.append(pl)
        
        cur_pool = self.current_pool or (self.current_player.get("pool") if self.current_player else "Marquee Set 1")
        result = []
        for pl in ordered_pool_names:
            pool_players = [p for p in self.players_queue if p.get("pool") == pl]
            total = len(pool_players)
            if total == 0:
                pool_players = [p for p in self.all_players if p.get("pool") == pl]
                total = len(pool_players)
            
            sold_count = sum(1 for p in pool_players if self.auctioned_players.get(p["id"], {}).get("status") == "SOLD")
            unsold_count = sum(1 for p in pool_players if self.auctioned_players.get(p["id"], {}).get("status") == "UNSOLD")
            done = sold_count + unsold_count
            
            result.append({
                "pool_name": pl,
                "total_players": total,
                "sold_count": sold_count,
                "unsold_count": unsold_count,
                "remaining_count": max(0, total - done),
                "is_current": (pl == cur_pool and self.status == "AUCTION_ACTIVE"),
                "is_completed": (done == total and total > 0)
            })
        return result

    def get_current_set_players(self) -> List[Dict[str, Any]]:
        cur_pool = self.current_pool or (self.current_player.get("pool") if self.current_player else None) or "Marquee Set 1"
        set_players = [p for p in self.players_queue if p.get("pool") == cur_pool]
        if not set_players:
            set_players = [p for p in self.all_players if p.get("pool") == cur_pool]
        
        enriched = []
        for p in set_players:
            cp = dict(p)
            pid = p["id"]
            if self.current_player and pid == self.current_player.get("id"):
                cp["auction_status"] = "ON_BLOCK"
            elif pid in self.auctioned_players:
                info = self.auctioned_players[pid]
                cp["auction_status"] = info.get("status")
                cp["sold_to"] = info.get("buyer_name")
                cp["sold_price"] = info.get("amount")
                cp["sold_price_cr"] = round(info.get("amount", 0) / 100.0, 2) if info.get("amount") else None
            else:
                cp["auction_status"] = "UPCOMING"
            enriched.append(cp)
        return enriched

    def get_state(self) -> Dict[str, Any]:
        return {
            "room_id": self.room_id,
            "name": self.name,
            "host_id": self.host_id,
            "status": self.status,
            "teams": {tid: team.to_dict() for tid, team in self.teams.items()},
            "current_player": self.current_player,
            "current_player_index": self.current_player_index,
            "total_players_in_queue": len(self.players_queue),
            "current_bid": self.current_bid,
            "highest_bidder_id": self.highest_bidder_id,
            "highest_bidder_name": self.highest_bidder_name,
            "timer": self.timer,
            "bid_history": self.bid_history[-10:],
            "auction_feed": self.auction_feed[-15:],
            "passed_teams": list(self.passed_teams),
            "verdict_data": self.verdict_data,
            "captain_matchup": self.captain_matchup,
            "latest_news": self.latest_news,
            "current_pool": self.current_pool or (self.current_player.get("pool") if self.current_player else "Marquee Set 1"),
            "latest_set_transition": self.latest_set_transition,
            "upcoming_players": [p for p in self.players_queue[self.current_player_index + 1 : self.current_player_index + 26]],
            "current_set_players": self.get_current_set_players(),
            "pools_summary": self.get_pools_summary(),
            "lineup_timer": self.lineup_timer,
            "chat_messages": self.chat_messages[-50:]
        }

    async def add_chat_message(self, client_id: str, text: str) -> Dict[str, Any]:
        team = self.teams.get(client_id)
        sender_name = team.owner_name if team and team.owner_name else (team.name if team else "War Room Scout")
        sender_team = team.name if team else None
        sender_color = team.color if team else "#F59E0B"
        is_host = bool(self.host_id and client_id == self.host_id)

        clean_text = str(text).strip()[:300]
        if not clean_text:
            return {}

        msg = {
            "id": f"msg_{uuid.uuid4().hex[:8]}",
            "sender_id": client_id,
            "sender_name": sender_name,
            "sender_team": sender_team,
            "sender_color": sender_color,
            "is_host": is_host,
            "text": clean_text,
            "timestamp": time.time()
        }

        self.chat_messages.append(msg)
        if len(self.chat_messages) > 100:
            self.chat_messages = self.chat_messages[-100:]

        self.last_active = time.time()

        await self.broadcast({
            "type": "CHAT_MESSAGE",
            "message": msg
        })

        return msg

    async def broadcast(self, message: Dict[str, Any]):
        dead_clients = []
        for client_id, ws in list(self.connections.items()):
            try:
                await ws.send_text(json.dumps(message))
            except Exception as e:
                logger.warning(f"Error broadcasting to client {client_id}: {e}")
                dead_clients.append(client_id)
        for client_id in dead_clients:
            self.connections.pop(client_id, None)

    async def broadcast_state(self):
        await self.broadcast({
            "type": "ROOM_STATE_UPDATE",
            "state": self.get_state()
        })

    def add_team(self, team_id: str, name: str, is_bot: bool = False, color: str = "#3B82F6", owner_name: Optional[str] = None) -> Team:
        if not self.host_id and not is_bot:
            self.host_id = team_id

        # Disambiguate duplicate team names
        existing_names = {t.name.strip().lower() for tid, t in self.teams.items() if tid != team_id}
        final_name = name.strip()
        counter = 2
        while final_name.lower() in existing_names:
            final_name = f"{name.strip()} {counter}"
            counter += 1

        clean_owner = (owner_name or "").strip()
        if not clean_owner:
            clean_owner = "AI Franchise" if is_bot else final_name

        if team_id not in self.teams:
            self.teams[team_id] = Team(team_id, final_name, is_bot=is_bot, color=color, owner_name=clean_owner)
        else:
            if self.status == "LOBBY":
                self.teams[team_id].name = final_name
                self.teams[team_id].color = color
                self.teams[team_id].owner_name = clean_owner

        self.last_active = time.time()
        return self.teams[team_id]

    def add_bots(self, count: int = 3):
        existing_bot_names = {t.name for t in self.teams.values() if t.is_bot}
        available_bots = [b for b in BOT_FRANCHISES if b["name"] not in existing_bot_names]
        random.shuffle(available_bots)
        
        added = []
        for bot_info in available_bots[:count]:
            bot_id = f"bot_{bot_info['name'].lower().replace(' ', '_')}"
            team = self.add_team(bot_id, bot_info["name"], is_bot=True, color=bot_info["color"])
            added.append(team.name)
        return added

    def start_auction(self):
        if self.status == "AUCTION_ACTIVE":
            return
        
        # Build queue ordered by authentic IPL sets
        ordered_pool_names = []
        for p in self.all_players:
            pl = p.get("pool", "Standard")
            if pl not in ordered_pool_names:
                ordered_pool_names.append(pl)
        
        queue = []
        for pl in ordered_pool_names:
            pool_players = [p for p in self.all_players if p.get("pool") == pl]
            # Shuffle players within their designated set to keep variety while preserving authentic set boundaries
            random.shuffle(pool_players)
            queue.extend(pool_players)
        
        # Fallback if any unqueued
        queued_ids = {p["id"] for p in queue}
        remaining = [p for p in self.all_players if p["id"] not in queued_ids]
        queue.extend(remaining)

        if not queue:
            queue = list(self.all_players)
            random.shuffle(queue)
        
        self.players_queue = queue
        self.current_player_index = -1
        self.status = "AUCTION_ACTIVE"
        self.current_pool = queue[0].get("pool", "Marquee Set 1") if queue else "Marquee Set 1"
        self.latest_set_transition = {
            "previous_set": None,
            "current_set": self.current_pool,
            "message": f"📢 AUCTION COMMENCED: Starting with {self.current_pool}! 47 world-class marquee superstars on the hammer!",
            "timestamp": time.time()
        }
        self.auction_feed.append({
            "message": self.latest_set_transition["message"],
            "timestamp": time.time()
        })
        self.next_player()

    def next_player(self) -> Optional[Dict[str, Any]]:
        prev_pool = self.current_player.get("pool") if self.current_player else None
        self.current_player_index += 1
        if self.current_player_index >= len(self.players_queue):
            # Auction Finished
            self.finish_auction()
            return None

        self.current_player = self.players_queue[self.current_player_index]
        new_pool = self.current_player.get("pool", "Standard")

        transition_event = None
        if prev_pool and new_pool and prev_pool != new_pool:
            self.current_pool = new_pool
            transition_event = {
                "previous_set": prev_pool,
                "current_set": new_pool,
                "message": f"📢 SET COMPLETED: {prev_pool} has concluded! {new_pool} is now on the auction hammer!",
                "timestamp": time.time()
            }
            self.latest_set_transition = transition_event
            self.auction_feed.append({
                "message": transition_event["message"],
                "timestamp": time.time()
            })
        elif not self.current_pool:
            self.current_pool = new_pool

        self.current_bid = self.current_player.get("base_price", int(self.current_player.get("base_price_cr", 1.0) * 100))
        self.highest_bidder_id = None
        self.highest_bidder_name = None
        self.bid_history = []
        self.passed_teams = set()
        self.timer = TIMER_DURATION

        self.auction_feed.append({
            "message": f"🔥 Up for bids: {self.current_player['name']} ({self.current_player['role']} • {new_pool}) - Base ₹{self.current_bid/100:.2f} Cr",
            "timestamp": time.time()
        })

        if self.timer_task and not self.timer_task.done():
            self.timer_task.cancel()
        try:
            loop = asyncio.get_running_loop()
            self.timer_task = loop.create_task(self.run_timer())
        except RuntimeError:
            pass

        return transition_event

    async def run_timer(self):
        try:
            while self.timer > 0 and self.status == "AUCTION_ACTIVE":
                await asyncio.sleep(1)
                if self.is_paused:
                    continue
                self.timer -= 1

                # Bot logic during countdown
                await self.check_bot_bids()

                # Broadcast timer tick
                await self.broadcast({
                    "type": "TIMER_TICK",
                    "timer": self.timer,
                    "current_bid": self.current_bid,
                    "highest_bidder_id": self.highest_bidder_id,
                    "highest_bidder_name": self.highest_bidder_name
                })

                # Check if all active human/bot teams have passed
                active_teams_count = len(self.teams)
                if active_teams_count > 1 and len(self.passed_teams) >= (active_teams_count - (1 if self.highest_bidder_id else 0)):
                    break

            # Timer reached 0 or all passed
            if self.status == "AUCTION_ACTIVE":
                await self.hammer_player()

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in timer loop: {e}", exc_info=True)

    async def check_bot_bids(self):
        """Simulates realistic AI Franchise bidding strategy."""
        if not self.current_player or self.status != "AUCTION_ACTIVE":
            return

        # Trigger during countdown if bot wants this player
        if self.timer not in [4, 3, 2, 1]:
            return

        bots = [t for t in self.teams.values() if t.is_bot and t.team_id != self.highest_bidder_id and t.team_id not in self.passed_teams]
        if not bots:
            return

        # Prevent bot-only rapid bidding cascades (max 3 consecutive bot bids)
        consecutive_bot_bids = 0
        for b in reversed(self.bid_history):
            if b.get("team_id", "").startswith("bot_"):
                consecutive_bot_bids += 1
            else:
                break
        if consecutive_bot_bids >= 3:
            return

        random.shuffle(bots)
        bot = bots[0]

        # Bid increment
        increment = 20 if random.random() < 0.8 else 50
        new_bid = self.current_bid + increment if self.highest_bidder_id else self.current_player.get("base_price", 100)

        # Check budget
        if bot.budget < new_bid:
            self.passed_teams.add(bot.team_id)
            return

        # Reserve budget check for bot (mandatory 18 player squad)
        needed_after = max(0, 18 - (len(bot.players) + 1))
        min_reserve = needed_after * 30
        if bot.budget - new_bid < min_reserve:
            self.passed_teams.add(bot.team_id)
            return

        # Check marquee cap (Max 80 Cr = 8000 Lakhs)
        is_marquee = self.current_player.get("category") == "Marquee"
        if is_marquee and (bot.marquee_spent + new_bid > MARQUEE_CAP_LAKHS):
            self.passed_teams.add(bot.team_id)
            return

        # Overseas cap check (squad max 8)
        is_overseas = bool(self.current_player.get("is_overseas") or self.current_player.get("country") == "Overseas")
        overseas_in_squad = len([p for p in bot.players if p.get("is_overseas") or p.get("country") == "Overseas"])
        if is_overseas and overseas_in_squad >= 8:
            self.passed_teams.add(bot.team_id)
            return

        # Squad limit check (max 18)
        if len(bot.players) >= 18:
            self.passed_teams.add(bot.team_id)
            return

        # Decision threshold based on player quality & role necessity
        player_price_cr = new_bid / 100.0
        if not is_marquee and player_price_cr > 14.0:
            if random.random() < 0.75:
                self.passed_teams.add(bot.team_id)
                return

        # 45% chance bot bids on this tick
        if random.random() < 0.45:
            await self.place_bid(bot.team_id, increment if self.highest_bidder_id else 0)

    async def place_bid(self, team_id: str, increment: int = 20) -> Dict[str, Any]:
        async with self.bid_lock:
            if self.status != "AUCTION_ACTIVE" or not self.current_player:
                return {"success": False, "message": "Auction is not active"}

            team = self.teams.get(team_id)
            if not team:
                return {"success": False, "message": "Team not found"}

            if self.highest_bidder_id == team_id:
                return {"success": False, "message": "You already hold the highest bid"}

            if team_id in self.passed_teams:
                return {"success": False, "message": "You already passed on this player"}

            # Squad capacity check: max 18 players
            if len(team.players) >= 18:
                return {"success": False, "message": "Squad is full! You have already acquired the maximum 18 players."}

            # Overseas player cap check: max 8 overseas
            is_overseas = bool(self.current_player.get("is_overseas") or self.current_player.get("country") == "Overseas")
            current_overseas = len([p for p in team.players if p.get("is_overseas") or p.get("country") == "Overseas"])
            if is_overseas and current_overseas >= 8:
                return {"success": False, "message": "Overseas limit reached! A squad can have at most 8 overseas players."}

            # Validate increment
            if increment not in [0, 20, 50, 100]:
                return {"success": False, "message": "Invalid bid increment"}

            # Calculate new bid amount
            if self.highest_bidder_id is None:
                new_amount = self.current_player.get("base_price", 100)
            else:
                inc = increment if increment > 0 else 20
                new_amount = self.current_bid + inc

            # 1. Budget validation
            if team.budget < new_amount:
                return {"success": False, "message": f"Insufficient purse! Remaining: ₹{team.budget/100:.2f} Cr, Required: ₹{new_amount/100:.2f} Cr"}

            # 2. Reserve purse check (must keep enough purse to fill 18 players at min base price 30L)
            needed_after = max(0, 18 - (len(team.players) + 1))
            min_reserve = needed_after * 30
            if team.budget - new_amount < min_reserve:
                return {
                    "success": False,
                    "message": f"Reserve budget rule: You must keep at least ₹{min_reserve/100:.2f} Cr to complete your mandatory 18-player squad!"
                }

            # 3. Marquee cap validation (Max ₹80 Cr = 8000 Lakhs)
            is_marquee = self.current_player.get("category") == "Marquee"
            if is_marquee:
                if team.marquee_spent + new_amount > MARQUEE_CAP_LAKHS:
                    remaining_marquee = (MARQUEE_CAP_LAKHS - team.marquee_spent) / 100.0
                    return {
                        "success": False,
                        "message": f"Marquee cap violated! ₹80 Cr limit. You have ₹{remaining_marquee:.2f} Cr remaining in Marquee budget."
                    }

            # Successful bid
            owner = team.owner_name if team.owner_name and team.owner_name != team.name else None
            display_name = f"{owner} ({team.name})" if owner else team.name

            self.current_bid = new_amount
            self.highest_bidder_id = team_id
            self.highest_bidder_name = display_name

            # Reset timer on each new bid
            self.timer = TIMER_DURATION
            self.passed_teams.discard(team_id)
            self.last_active = time.time()

            bid_record = {
                "team_id": team_id,
                "team_name": display_name,
                "amount": new_amount,
                "timestamp": time.time()
            }
            self.bid_history.append(bid_record)
            self.auction_feed.append({
                "message": f"💰 {display_name} bid ₹{new_amount/100:.2f} Cr for {self.current_player['name']}",
                "timestamp": time.time()
            })

            await self.broadcast({
                "type": "BID_ACCEPTED",
                "team_id": team_id,
                "team_name": team.name,
                "amount": new_amount,
                "timer": self.timer,
                "bid_history": self.bid_history[-10:],
                "auction_feed": self.auction_feed[-15:]
            })
            return {"success": True, "amount": new_amount}

    async def pass_player(self, team_id: str) -> Dict[str, Any]:
        if self.status != "AUCTION_ACTIVE" or not self.current_player:
            return {"success": False, "message": "Auction is not active"}

        self.passed_teams.add(team_id)
        team = self.teams.get(team_id)
        name = team.name if team else team_id

        self.auction_feed.append({
            "message": f"✋ {name} passed on {self.current_player['name']}",
            "timestamp": time.time()
        })

        await self.broadcast({
            "type": "TEAM_PASSED",
            "team_id": team_id,
            "passed_teams": list(self.passed_teams),
            "auction_feed": self.auction_feed[-15:]
        })

        # If all teams passed (except possibly highest bidder)
        needed_passes = len(self.teams) if not self.highest_bidder_id else len(self.teams) - 1
        if len(self.passed_teams) >= needed_passes:
            self.timer = 1  # Accelerate hammer

        return {"success": True}

    async def hammer_player(self):
        player = self.current_player
        if not player:
            return

        if self.highest_bidder_id:
            # Player is SOLD
            winner_team = self.teams[self.highest_bidder_id]
            winner_team.budget -= self.current_bid
            if player.get("category") == "Marquee":
                winner_team.marquee_spent += self.current_bid

            # Store purchase details
            player["buy_price"] = self.current_bid
            player["buy_price_cr"] = round(self.current_bid / 100.0, 2)
            player["auction_status"] = "SOLD"
            player["sold_to"] = winner_team.name
            player["sold_price"] = self.current_bid
            player["sold_price_cr"] = round(self.current_bid / 100.0, 2)
            winner_team.players.append(player)

            self.auctioned_players[player["id"]] = {
                "status": "SOLD",
                "buyer_id": winner_team.team_id,
                "buyer_name": winner_team.name,
                "amount": self.current_bid,
                "pool": player.get("pool")
            }

            # Generate dynamic Breaking News story
            news = generate_player_sold_news(
                player=player,
                winner_team=winner_team.to_dict(),
                sold_amount=self.current_bid,
                bid_history=self.bid_history,
                all_teams={tid: t.to_dict() for tid, t in self.teams.items()}
            )
            self.latest_news = news

            self.auction_feed.append({
                "message": news["headline"],
                "news": news,
                "timestamp": time.time()
            })

            await self.broadcast({
                "type": "PLAYER_SOLD",
                "player": player,
                "winner_team_id": winner_team.team_id,
                "winner_team_name": winner_team.name,
                "amount": self.current_bid,
                "news": news,
                "latest_news": news,
                "auction_feed": self.auction_feed[-15:]
            })
        else:
            # Player UNSOLD
            player["auction_status"] = "UNSOLD"
            self.auctioned_players[player["id"]] = {
                "status": "UNSOLD",
                "amount": 0,
                "pool": player.get("pool")
            }

            news = generate_player_unsold_news(player)
            self.latest_news = news
            self.auction_feed.append({
                "message": news["headline"],
                "news": news,
                "timestamp": time.time()
            })

            await self.broadcast({
                "type": "PLAYER_UNSOLD",
                "player": player,
                "news": news,
                "latest_news": news,
                "auction_feed": self.auction_feed[-15:]
            })

        await asyncio.sleep(2.0)
        if self.status == "AUCTION_ACTIVE":
            # Natural completion: all teams recruited full 18-player squads, or no team has budget left to bid
            all_squads_full = len(self.teams) > 0 and all(len(t.players) >= 18 for t in self.teams.values())
            can_anyone_bid = any(len(t.players) < 18 and t.budget >= 30 for t in self.teams.values())

            if all_squads_full or not can_anyone_bid:
                self.finish_auction()
                return

            trans = self.next_player()
            if trans:
                await self.broadcast({
                    "type": "SET_TRANSITION",
                    "previous_set": trans["previous_set"],
                    "current_set": trans["current_set"],
                    "message": trans["message"],
                    "timestamp": trans["timestamp"]
                })
            await self.broadcast_state()

    def finish_auction(self):
        self.status = "LINEUP_PHASE"
        if self.timer_task and not self.timer_task.done():
            self.timer_task.cancel()

        self.auction_feed.append({
            "message": "🏆 Auction phase completed! You have 2.5 minutes to finalize and submit your Playing XI. Mandatory 18-player squad required.",
            "timestamp": time.time()
        })

        # Auto-assemble lineups for bots so they are ready
        for team in self.teams.values():
            if team.is_bot:
                self.build_optimal_xi_and_bench(team)

        # Start 2.5 minute deadline countdown timer!
        self.start_lineup_timer()

        try:
            loop = asyncio.get_running_loop()
            loop.create_task(self.broadcast({
                "type": "AUCTION_END",
                "state": self.get_state()
            }))
        except RuntimeError:
            pass

    def start_lineup_timer(self):
        if self.lineup_timer_task and not self.lineup_timer_task.done():
            self.lineup_timer_task.cancel()
        self.lineup_timer = LINEUP_TIMER_DURATION
        try:
            loop = asyncio.get_running_loop()
            self.lineup_timer_task = loop.create_task(self.run_lineup_timer())
        except RuntimeError:
            pass

    async def run_lineup_timer(self):
        try:
            while self.lineup_timer > 0 and self.status == "LINEUP_PHASE":
                await asyncio.sleep(1)
                self.lineup_timer -= 1
                await self.broadcast({
                    "type": "LINEUP_TIMER_TICK",
                    "lineup_timer": self.lineup_timer
                })

            if self.status == "LINEUP_PHASE":
                await self.handle_lineup_deadline_timeout()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error in lineup timer: {e}", exc_info=True)

    async def handle_lineup_deadline_timeout(self):
        """
        When the 2-3 minute lineup timer expires:
        - Teams with fewer than 18 players are ELIMINATED/DISQUALIFIED.
        - Eligible teams (18+ players) who haven't submitted are auto-submitted with optimal XI.
        - Immediately triggers tournament evaluation.
        """
        self.auction_feed.append({
            "message": "⏰ LINEUP SUBMISSION DEADLINE EXPIRED! Processing mandatory 18-player squad roster checks...",
            "timestamp": time.time()
        })

        for team in self.teams.values():
            if len(team.players) < 18:
                team.is_eliminated = True
                team.elimination_reason = f"Eliminated: Did not meet mandatory 18-player squad roster requirement ({len(team.players)}/18 players acquired)."
                team.lineup_submitted = True
                self.auction_feed.append({
                    "message": f"❌ {team.name} DISQUALIFIED & ELIMINATED! Failed to recruit mandatory 18 players ({len(team.players)}/18).",
                    "timestamp": time.time()
                })
            else:
                if not team.lineup_submitted:
                    self.build_optimal_xi_and_bench(team)
                    team.lineup_submitted = True
                    self.auction_feed.append({
                        "message": f"⚡ {team.name} auto-submitted with optimal Playing XI & Captain upon deadline expiry.",
                        "timestamp": time.time()
                    })

        await self.broadcast({
            "type": "LINEUP_DEADLINE_EXPIRED",
            "message": "⏰ Lineup submission deadline expired! Teams with fewer than 18 players were eliminated. Remaining teams auto-submitted.",
            "state": self.get_state()
        })

        await self.run_tournament_evaluation()

    def build_optimal_xi_and_bench(self, team: Team):
        """Builds an optimal 11-player Playing XI + Bench strictly respecting all rules."""
        squad = [normalize_player(dict(p)) for p in team.players]
        if not squad:
            return

        keepers = [p for p in squad if p.get("is_wicketkeeper")]
        # Reserve backup WK for bench if 2+ keepers exist
        backup_wk = keepers[1] if len(keepers) > 1 else None
        starting_wk = keepers[0] if keepers else None

        # Pool eligible for Playing XI
        pool_for_xi = [p for p in squad if backup_wk is None or p["id"] != backup_wk["id"]]

        xi: List[Optional[Dict[str, Any]]] = [None] * 11
        assigned_ids: Set[str] = set()
        overseas_count = 0

        def can_assign(p: Dict[str, Any]) -> bool:
            if p["id"] in assigned_ids:
                return False
            if p.get("is_overseas") and overseas_count >= 4:
                return False
            return True

        def assign(slot_idx: int, p: Dict[str, Any]):
            nonlocal overseas_count
            xi[slot_idx] = p
            assigned_ids.add(p["id"])
            if p.get("is_overseas"):
                overseas_count += 1

        # 1. Place starting WK at slot 3 or 4
        if starting_wk and can_assign(starting_wk):
            pref_slot = 3
            wk_slots = get_primary_slots(starting_wk)
            if any(s in [1, 2] for s in wk_slots):
                pref_slot = 1
            elif any(s in [5, 6, 7] for s in wk_slots):
                pref_slot = 4
            assign(pref_slot, starting_wk)

        # 2. Assign Openers (Slot 0 and 1)
        openers = [p for p in pool_for_xi if p["id"] not in assigned_ids and any(s in [1, 2] for s in get_primary_slots(p))]
        for slot_idx in [0, 1]:
            if xi[slot_idx] is None:
                cand = next((p for p in openers if can_assign(p)), None)
                if cand:
                    assign(slot_idx, cand)

        # 3. Assign 3 Specialist Bowlers (Slots 10, 9, 8)
        bowlers = [p for p in pool_for_xi if p["id"] not in assigned_ids and p.get("role") == "BOWL"]
        for slot_idx in [10, 9, 8]:
            if xi[slot_idx] is None:
                cand = next((p for p in bowlers if can_assign(p)), None)
                if cand:
                    assign(slot_idx, cand)

        # 4. Assign 2 All-Rounders (Slots 6, 7)
        all_rounders = [p for p in pool_for_xi if p["id"] not in assigned_ids and p.get("role") == "ALL"]
        for slot_idx in [6, 7]:
            if xi[slot_idx] is None:
                cand = next((p for p in all_rounders if can_assign(p)), None)
                if cand:
                    assign(slot_idx, cand)

        # 5. Ensure at least 5 bowling options
        remaining = [p for p in pool_for_xi if p["id"] not in assigned_ids]
        current_bowling = len([p for p in xi if p and p.get("is_bowling_option")])
        if current_bowling < 5:
            bowl_options = [p for p in remaining if p.get("is_bowling_option")]
            for p in bowl_options:
                if can_assign(p):
                    for slot_idx in range(11):
                        if xi[slot_idx] is None:
                            assign(slot_idx, p)
                            break
                if len([p for p in xi if p and p.get("is_bowling_option")]) >= 5:
                    break

        # 6. Fill remaining slots
        remaining = [p for p in pool_for_xi if p["id"] not in assigned_ids]
        for slot_idx in range(11):
            if xi[slot_idx] is None:
                cand = next((p for p in remaining if can_assign(p)), None)
                if not cand and remaining:
                    cand = next((p for p in remaining if not p.get("is_overseas")), None)
                if not cand and remaining:
                    cand = remaining[0]
                if cand:
                    assign(slot_idx, cand)
                    remaining = [p for p in remaining if p["id"] != cand["id"]]

        # Clean xi_final
        xi_final = [p for p in xi if p is not None]
        if len(xi_final) < 11:
            for p in squad:
                if p["id"] not in assigned_ids and len(xi_final) < 11:
                    xi_final.append(p)
                    assigned_ids.add(p["id"])

        # 7. Bench: up to 7 players with backup_wk if available
        bench: List[Dict[str, Any]] = []
        if backup_wk and backup_wk["id"] not in assigned_ids:
            bench.append(backup_wk)
            assigned_ids.add(backup_wk["id"])

        for p in squad:
            if p["id"] not in assigned_ids and len(bench) < 7:
                bench.append(p)
                assigned_ids.add(p["id"])

        team.playing_xi = [p["id"] for p in xi_final[:11]]
        team.bench = [p["id"] for p in bench[:7]]
        
        # Crown optimal Captain if not already set or invalid
        xi_objs = [p for p in xi_final[:11] if p]
        if xi_objs:
            if not team.captain_id or team.captain_id not in team.playing_xi:
                best_leader = max(xi_objs, key=lambda p: get_captaincy_stats(p)["captaincy_rating"])
                team.captain_id = best_leader["id"]

        if team.is_bot:
            team.lineup_submitted = True

    def auto_distribute_and_build(self, user_team_id: Optional[str] = None):
        """One-click autofill: distributes balanced 18-player squads to all franchises and forms optimal Playing XIs."""
        if self.timer_task and not self.timer_task.done():
            self.timer_task.cancel()

        # Ensure user team exists
        if user_team_id and user_team_id not in self.teams:
            self.add_team(user_team_id, "My Franchise", is_bot=False, color="#3B82F6")

        # Ensure at least 4 teams
        if len(self.teams) < 4:
            self.add_bots(4 - len(self.teams))

        # Reset all teams
        for team in self.teams.values():
            team.budget = TOTAL_BUDGET_LAKHS
            team.marquee_spent = 0
            team.players = []
            team.playing_xi = []
            team.bench = []
            team.is_eliminated = False
            team.elimination_reason = None
            team.lineup_submitted = False
            team.evaluation_result = None

        pool = list(self.all_players)
        random.shuffle(pool)

        marquee_pool = [p for p in pool if p.get("category") == "Marquee" or p.get("tier") == "Marquee"]
        keepers_pool = [p for p in pool if p.get("is_wicketkeeper")]
        bowlers_pool = [p for p in pool if p.get("role") == "BOWL"]
        allrounders_pool = [p for p in pool if p.get("role") == "ALL"]
        batters_pool = [p for p in pool if p.get("role") == "BAT"]

        used_ids: Set[str] = set()

        def pick_player(bucket: List[Dict[str, Any]], max_overseas: int, current_overseas: int) -> Optional[Dict[str, Any]]:
            for p in bucket:
                if p["id"] in used_ids:
                    continue
                if p.get("is_overseas") and current_overseas >= max_overseas:
                    continue
                used_ids.add(p["id"])
                return p
            return None

        # Distribute 18 players per team (Mandatory minimum 18-player squad)
        for team in self.teams.values():
            squad: List[Dict[str, Any]] = []
            overseas_count = 0
            MAX_SQUAD_OS = 8

            # 1. 2 Marquee
            for _ in range(2):
                p = pick_player(marquee_pool, MAX_SQUAD_OS, overseas_count)
                if p:
                    squad.append(p)
                    if p.get("is_overseas"): overseas_count += 1

            # 2. 2 Wicketkeepers (1 starting, 1 backup for bench)
            while len([p for p in squad if p.get("is_wicketkeeper")]) < 2:
                p = pick_player(keepers_pool, MAX_SQUAD_OS, overseas_count)
                if p:
                    squad.append(p)
                    if p.get("is_overseas"): overseas_count += 1
                else:
                    break

            # 3. 3 Openers / Top-Order
            opener_candidates = [p for p in batters_pool if any(s in [1, 2] for s in get_primary_slots(p))]
            for _ in range(3):
                p = pick_player(opener_candidates, MAX_SQUAD_OS, overseas_count)
                if not p:
                    p = pick_player(batters_pool, MAX_SQUAD_OS, overseas_count)
                if p:
                    squad.append(p)
                    if p.get("is_overseas"): overseas_count += 1

            # 4. 4 All-rounders
            for _ in range(4):
                p = pick_player(allrounders_pool, MAX_SQUAD_OS, overseas_count)
                if p:
                    squad.append(p)
                    if p.get("is_overseas"): overseas_count += 1

            # 5. 5 Bowlers
            for _ in range(5):
                p = pick_player(bowlers_pool, MAX_SQUAD_OS, overseas_count)
                if p:
                    squad.append(p)
                    if p.get("is_overseas"): overseas_count += 1

            # 6. Fill up to 18
            general_candidates = batters_pool + bowlers_pool + allrounders_pool
            while len(squad) < 18:
                p = pick_player(general_candidates, MAX_SQUAD_OS, overseas_count)
                if not p:
                    p = pick_player(pool, MAX_SQUAD_OS, overseas_count)
                if p:
                    squad.append(p)
                    if p.get("is_overseas"): overseas_count += 1
                else:
                    break

            team.players = squad

            # Realistic budget calculation (~₹98-105 Cr spent)
            total_spend = 0
            marquee_spent = 0
            for p in squad:
                if p.get("category") == "Marquee" or p.get("tier") == "Marquee":
                    price = random.randint(1100, 1650)
                    marquee_spent += price
                elif p.get("base_price", 100) >= 100:
                    price = random.randint(450, 900)
                else:
                    price = random.randint(120, 300)
                p["buy_price"] = price
                p["buy_price_cr"] = round(price / 100.0, 2)
                p["auction_status"] = "SOLD"
                p["sold_to"] = team.name
                p["sold_price"] = price
                p["sold_price_cr"] = round(price / 100.0, 2)
                self.auctioned_players[p["id"]] = {
                    "status": "SOLD",
                    "buyer_id": team.team_id,
                    "buyer_name": team.name,
                    "amount": price,
                    "pool": p.get("pool")
                }
                total_spend += price

            if marquee_spent > MARQUEE_CAP_LAKHS:
                marquee_spent = MARQUEE_CAP_LAKHS - 200
            if total_spend > TOTAL_BUDGET_LAKHS - 500:
                total_spend = TOTAL_BUDGET_LAKHS - random.randint(500, 1500)

            team.budget = TOTAL_BUDGET_LAKHS - total_spend
            team.marquee_spent = marquee_spent

            # Build optimal Playing XI + Bench
            self.build_optimal_xi_and_bench(team)

        self.status = "LINEUP_PHASE"
        self.auction_feed.append({
            "message": "⚡ One-Click Auto-Draft completed! 18-player balanced squads assigned to all teams with optimal Playing XI.",
            "timestamp": time.time()
        })
        self.start_lineup_timer()

    async def submit_lineup(self, team_id: str, playing_xi: List[str], bench: List[str], captain_id: Optional[str] = None) -> Dict[str, Any]:
        team = self.teams.get(team_id)
        if not team:
            return {"success": False, "message": "Team not found"}

        # Validate squad ownership (anti-cheat verification)
        owned_ids = {p["id"] for p in team.players}
        for pid in playing_xi:
            if pid not in owned_ids:
                return {"success": False, "message": f"Player {pid} is not in your squad!"}
        for pid in bench:
            if pid not in owned_ids:
                return {"success": False, "message": f"Bench player {pid} is not in your squad!"}

        if len(set(playing_xi)) != len(playing_xi):
            return {"success": False, "message": "Duplicate players detected in Playing XI!"}

        if set(playing_xi).intersection(set(bench)):
            return {"success": False, "message": "A player cannot be in both Playing XI and Bench!"}

        if captain_id and captain_id not in owned_ids:
            return {"success": False, "message": "Selected captain is not in your squad!"}

        team.playing_xi = playing_xi
        team.bench = bench
        if captain_id:
            team.captain_id = captain_id
        team.lineup_submitted = True

        # Perform evaluation on submitted lineup
        xi_players = [self.players_map[pid] for pid in playing_xi if pid in self.players_map]
        bench_players = [self.players_map[pid] for pid in bench if pid in self.players_map]

        eval_result = evaluate_lineup(
            team_id=team.team_id,
            team_name=team.name,
            playing_xi=xi_players,
            bench=bench_players,
            all_players_map=self.players_map,
            captain_id=team.captain_id
        )
        team.evaluation_result = eval_result

        self.auction_feed.append({
            "message": f"📋 {team.name} locked and submitted their Playing XI & Bench! Captain: {eval_result.get('captain_info', {}).get('name', 'Appointed')}",
            "timestamp": time.time()
        })

        await self.broadcast({
            "type": "LINEUP_SUBMITTED",
            "team_id": team_id,
            "team_name": team.name,
            "evaluation_result": eval_result,
            "auction_feed": self.auction_feed[-15:]
        })

        # Check if all human teams have submitted
        human_teams = [t for t in self.teams.values() if not t.is_bot and not t.is_eliminated]
        all_human_done = all(t.lineup_submitted for t in human_teams) if human_teams else False

        if all_human_done:
            if self.lineup_timer_task and not self.lineup_timer_task.done():
                self.lineup_timer_task.cancel()
            await self.run_tournament_evaluation()

        return {"success": True, "evaluation": eval_result}

    async def run_tournament_evaluation(self):
        """Runs complete tournament evaluation and generates Gemini verdict commentary."""
        if self.lineup_timer_task and not self.lineup_timer_task.done():
            self.lineup_timer_task.cancel()

        evaluations = []
        for team in self.teams.values():
            if team.is_eliminated or len(team.players) < 18:
                team.is_eliminated = True
                team.elimination_reason = team.elimination_reason or f"Eliminated: Did not meet mandatory 18-player squad roster requirement ({len(team.players)}/18 players)."
                disq_ev = {
                    "team_id": team.team_id,
                    "team_name": team.name,
                    "captain_id": None,
                    "captain_info": None,
                    "captain_bonus": 0,
                    "total_score": 0,
                    "batting_score": 0,
                    "bowling_score": 0,
                    "balance_score": 0,
                    "bench_score": 0,
                    "penalty_deductions": 999,
                    "is_eliminated": True,
                    "elimination_reason": team.elimination_reason,
                    "penalties": [{"type": "ROSTER_DEFICIT", "reason": team.elimination_reason, "deduction": 999}],
                    "warnings": ["DISQUALIFIED: Failed to recruit the mandatory 18-player squad roster!"],
                    "phases": {
                        "batting": {"powerplay": 0, "middle": 0, "death": 0},
                        "bowling": {"powerplay": 0, "middle": 0, "death": 0}
                    },
                    "slot_breakdown": [],
                    "strengths": [],
                    "weaknesses": ["Disqualified: Incomplete squad roster (< 18 players)"]
                }
                team.evaluation_result = disq_ev
                evaluations.append(disq_ev)
                continue

            if not team.lineup_submitted or not team.evaluation_result:
                if not team.playing_xi:
                    self.build_optimal_xi_and_bench(team)
                
                xi_players = [self.players_map[pid] for pid in team.playing_xi if pid in self.players_map]
                bench_players = [self.players_map[pid] for pid in team.bench if pid in self.players_map]
                
                ev = evaluate_lineup(
                    team_id=team.team_id,
                    team_name=team.name,
                    playing_xi=xi_players,
                    bench=bench_players,
                    all_players_map=self.players_map,
                    captain_id=team.captain_id
                )
                team.evaluation_result = ev
            evaluations.append(team.evaluation_result)

        # Generate head-to-head captain analysis
        captain_matchup = generate_captain_matchup_analysis(evaluations)
        self.captain_matchup = captain_matchup

        # Generate Cricinfo commentary via Gemini 2.5 Flash
        verdict = generate_verdict_commentary(evaluations, captain_matchup=captain_matchup)
        self.verdict_data = verdict
        self.verdict_data["captain_matchup"] = captain_matchup
        self.status = "EVALUATED"

        await self.broadcast({
            "type": "VERDICT",
            "verdict": verdict,
            "evaluations": evaluations,
            "captain_matchup": captain_matchup,
            "state": self.get_state()
        })
        return self.verdict_data

class RoomManager:
    def __init__(self, all_players: List[Dict[str, Any]]):
        self.rooms: Dict[str, Room] = {}
        self.all_players = [normalize_player(p) for p in all_players]
        self.players_map = {p["id"]: p for p in self.all_players}

    def cleanup_inactive_rooms(self, max_idle_seconds: int = 7200):
        """Removes rooms that have been inactive for more than 2 hours with no active connections."""
        now = time.time()
        to_delete = []
        for rid, room in self.rooms.items():
            last = getattr(room, "last_active", room.created_at)
            if not room.connections and (now - last) > max_idle_seconds:
                to_delete.append(rid)
        for rid in to_delete:
            room = self.rooms.pop(rid, None)
            if room:
                if room.timer_task and not room.timer_task.done():
                    room.timer_task.cancel()
                if room.lineup_timer_task and not room.lineup_timer_task.done():
                    room.lineup_timer_task.cancel()

    def get_or_create_room(self, room_id: str, name: str = "IPL Auction Arena") -> Room:
        self.cleanup_inactive_rooms()
        clean_id = room_id.strip().lower()
        if clean_id not in self.rooms:
            self.rooms[clean_id] = Room(clean_id, name, self.all_players)
        return self.rooms[clean_id]

    def get_room(self, room_id: str) -> Optional[Room]:
        clean_id = room_id.strip().lower()
        return self.rooms.get(clean_id)
