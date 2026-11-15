import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from room_manager import RoomManager
from evaluator import evaluate_lineup

def run_tests():
    data_path = Path(__file__).parent / "data" / "players.json"
    with open(data_path, "r", encoding="utf-8") as f:
        players = json.load(f)

    print(f"Loaded {len(players)} players.")
    rm = RoomManager(players)
    room = rm.get_or_create_room("e2e_room")

    # Step 1: Add user and AI franchises
    user_team = room.add_team("user_123", "Delhi Capitals", is_bot=False, color="#004C93")
    added_bots = room.add_bots(3)
    print(f"Franchises in room: {[t.name for t in room.teams.values()]}")
    assert len(room.teams) == 4, "Expected 4 franchises"

    # Step 2: Start auction
    room.start_auction()
    print(f"Auction Status: {room.status}")
    print(f"Queue count: {len(room.players_queue)}")
    assert len(room.players_queue) == 354, "Queue must contain 354 players"
    assert room.current_player is not None, "Current player must not be None"
    print(f"Active player on block: {room.current_player['name']} ({room.current_player['role']}) - Base ₹{room.current_bid/100:.2f} Cr")

    # Step 3: Trigger One-Click Auto-Draft & Build Playing XI
    room.auto_distribute_and_build("user_123")
    print(f"Post Auto-Draft Room Status: {room.status}")
    assert room.status == "LINEUP_PHASE", "Room must transition to LINEUP_PHASE"

    for tid, t in room.teams.items():
        print(f"[{t.name}] Squad: {len(t.players)} | XI: {len(t.playing_xi)} | Bench: {len(t.bench)} | Purse: ₹{t.budget/100:.2f} Cr")
        assert len(t.players) == 18, f"{t.name} must have 18 players"
        assert len(t.playing_xi) == 11, f"{t.name} must have 11 in Playing XI"
        assert len(t.bench) == 7, f"{t.name} must have 7 on Bench"

    # Step 4: Evaluate user lineup
    xi_players = [room.players_map[pid] for pid in user_team.playing_xi]
    bench_players = [room.players_map[pid] for pid in user_team.bench]
    res = evaluate_lineup(user_team.team_id, user_team.name, xi_players, bench_players, room.players_map)

    print("=== Lineup Evaluation Result ===")
    print(f"Total Score: {res['total_score']}")
    print(f"Batting Composite: {res['batting_score']} | Bowling Composite: {res['bowling_score']}")
    print(f"Balance Score: {res['balance_score']} | Bench Score: {res['bench_score']}")
    print(f"Penalties: {res['penalties']}")
    print(f"Warnings: {res['warnings']}")

    assert res['total_score'] > 0, "Score must be positive"
    assert len(res['penalties']) == 0, f"Expected 0 penalties but got {res['penalties']}"
    assert len(res['warnings']) == 0, f"Expected 0 warnings but got {res['warnings']}"

    print(" ALL E2E VERIFICATIONS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
