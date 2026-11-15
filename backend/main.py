import json
import logging
import os
import uuid
from pathlib import Path
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from room_manager import RoomManager, TOTAL_BUDGET_LAKHS, MARQUEE_CAP_LAKHS

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

app = FastAPI(title="IPL Auction Arena API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Players Data
DATA_PATH = Path(__file__).parent / "data" / "players.json"
try:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        PLAYERS_DATA = json.load(f)
    logger.info(f"Loaded {len(PLAYERS_DATA)} players from {DATA_PATH}")
except Exception as e:
    logger.error(f"Failed to load players data: {e}")
    PLAYERS_DATA = []

room_manager = RoomManager(PLAYERS_DATA)

# Request Models
class CreateRoomRequest(BaseModel):
    name: Optional[str] = "IPL Mega Auction"
    room_id: Optional[str] = None

class AddBotsRequest(BaseModel):
    count: Optional[int] = 3

class SubmitLineupRequest(BaseModel):
    team_id: str
    playing_xi: List[str]
    bench: List[str]
    captain_id: Optional[str] = None

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "IPL Auction Arena Backend",
        "players_count": len(PLAYERS_DATA),
        "active_rooms": len(room_manager.rooms)
    }

@app.get("/api/players")
def get_players():
    return {
        "count": len(room_manager.all_players),
        "players": room_manager.all_players
    }

@app.post("/api/rooms")
def create_room(req: CreateRoomRequest):
    room_id = req.room_id or str(uuid.uuid4())[:8]
    room = room_manager.get_or_create_room(room_id, req.name or "IPL Mega Auction")
    return {
        "room_id": room.room_id,
        "name": room.name,
        "state": room.get_state()
    }

@app.get("/api/rooms/{room_id}")
def get_room_details(room_id: str):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    return room.get_state()

@app.post("/api/rooms/{room_id}/bots")
def add_bots_to_room(room_id: str, req: AddBotsRequest):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    added = room.add_bots(req.count or 3)
    return {"success": True, "added_bots": added, "state": room.get_state()}

@app.post("/api/rooms/{room_id}/auto-distribute")
async def auto_distribute_room(room_id: str, team_id: Optional[str] = None):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    room.auto_distribute_and_build(team_id)
    await room.broadcast_state()
    return {"success": True, "state": room.get_state()}

@app.get("/api/captains/{player_id}")
def get_captain_profile(player_id: str):
    player = room_manager.players_map.get(player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    from evaluator import get_captaincy_stats
    return get_captaincy_stats(player)

@app.get("/api/rooms/{room_id}/pool/{pool_name}")
def get_room_pool_players(room_id: str, pool_name: str):
    room = room_manager.get_room(room_id)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    pool_players = [p for p in room.all_players if p.get("pool") == pool_name]
    enriched = []
    for p in pool_players:
        cp = dict(p)
        pid = p["id"]
        if room.current_player and pid == room.current_player.get("id"):
            cp["auction_status"] = "ON_BLOCK"
        elif pid in room.auctioned_players:
            info = room.auctioned_players[pid]
            cp["auction_status"] = info.get("status")
            cp["sold_to"] = info.get("buyer_name")
            cp["sold_price"] = info.get("amount")
            cp["sold_price_cr"] = round(info.get("amount", 0) / 100.0, 2) if info.get("amount") else 0
        else:
            cp["auction_status"] = "UPCOMING"
        enriched.append(cp)
    return {
        "pool_name": pool_name,
        "count": len(enriched),
        "players": enriched
    }

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await websocket.accept()
    room = room_manager.get_or_create_room(room_id)
    room.connections[client_id] = websocket
    logger.info(f"Client {client_id} connected to room {room_id}")

    # Immediately push current room state
    await websocket.send_text(json.dumps({
        "type": "INITIAL_STATE",
        "client_id": client_id,
        "state": room.get_state(),
        "constants": {
            "total_budget": TOTAL_BUDGET_LAKHS,
            "marquee_cap": MARQUEE_CAP_LAKHS
        }
    }))

    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
            except Exception:
                continue

            event_type = data.get("type")
            payload = data.get("payload", {})

            logger.info(f"Room {room_id} | Event: {event_type} | Client: {client_id}")

            if event_type == "JOIN_ROOM":
                team_id = payload.get("team_id", client_id)
                team_name = payload.get("team_name", f"Team {client_id[:4]}")
                color = payload.get("color", "#3B82F6")
                room.add_team(team_id, team_name, is_bot=False, color=color)
                await room.broadcast_state()

            elif event_type == "ADD_BOTS":
                count = int(payload.get("count", 3))
                room.add_bots(count)
                await room.broadcast_state()

            elif event_type == "START_AUCTION":
                room.start_auction()
                await room.broadcast_state()

            elif event_type == "AUTO_DISTRIBUTE":
                team_id = payload.get("team_id", client_id)
                room.auto_distribute_and_build(team_id)
                await room.broadcast_state()

            elif event_type == "BID":
                team_id = payload.get("team_id", client_id)
                increment = int(payload.get("increment", 20))
                res = await room.place_bid(team_id, increment)
                if not res.get("success"):
                    await websocket.send_text(json.dumps({
                        "type": "BID_REJECTED",
                        "reason": res.get("message")
                    }))

            elif event_type == "PASS":
                team_id = payload.get("team_id", client_id)
                await room.pass_player(team_id)

            elif event_type == "SUBMIT_LINEUP":
                team_id = payload.get("team_id", client_id)
                playing_xi = payload.get("playing_xi", [])
                bench = payload.get("bench", [])
                captain_id = payload.get("captain_id")
                res = await room.submit_lineup(team_id, playing_xi, bench, captain_id)
                await websocket.send_text(json.dumps({
                    "type": "LINEUP_RESPONSE",
                    "result": res
                }))
                await room.broadcast_state()

            elif event_type == "CROWN_CAPTAIN":
                team_id = payload.get("team_id", client_id)
                captain_id = payload.get("captain_id")
                team = room.teams.get(team_id)
                if team and captain_id:
                    team.captain_id = captain_id
                    await room.broadcast_state()

            elif event_type == "TRIGGER_EVALUATION":
                await room.run_tournament_evaluation()

            elif event_type == "RESET_AUCTION":
                room.status = "LOBBY"
                for t in room.teams.values():
                    t.budget = TOTAL_BUDGET_LAKHS
                    t.marquee_spent = 0
                    t.players = []
                    t.playing_xi = []
                    t.bench = []
                    t.captain_id = None
                    t.lineup_submitted = False
                    t.evaluation_result = None
                room.current_player = None
                room.current_player_index = -1
                room.highest_bidder_id = None
                room.highest_bidder_name = None
                room.bid_history = []
                room.passed_teams = set()
                room.verdict_data = None
                room.captain_matchup = None
                room.latest_news = None
                room.auction_feed = []
                room.current_pool = "Marquee Set 1"
                room.latest_set_transition = None
                room.auctioned_players = {}
                if room.timer_task and not room.timer_task.done():
                    room.timer_task.cancel()
                await room.broadcast_state()

    except WebSocketDisconnect:
        logger.info(f"Client {client_id} disconnected from room {room_id}")
        room.connections.pop(client_id, None)
    except Exception as e:
        logger.error(f"WebSocket error for client {client_id}: {e}", exc_info=True)
        room.connections.pop(client_id, None)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
