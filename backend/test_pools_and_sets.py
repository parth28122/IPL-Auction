import asyncio
import json
from room_manager import RoomManager

def test_room_pools():
    with open("backend/data/players.json", "r") as f:
        players = json.load(f)
    
    mgr = RoomManager(players)
    room = mgr.get_or_create_room("test_room_1")
    
    # Add teams
    t1 = room.add_team("user_1", "CSK Fanatics", color="#F9CD05")
    room.add_bots(3)
    
    # Start auction
    room.start_auction()
    assert room.status == "AUCTION_ACTIVE"
    assert room.current_pool == "Marquee Set 1"
    assert room.current_player is not None
    assert room.current_player.get("pool") == "Marquee Set 1"
    
    state = room.get_state()
    assert state["current_pool"] == "Marquee Set 1"
    assert len(state["upcoming_players"]) > 0
    assert len(state["current_set_players"]) == 47
    assert len(state["pools_summary"]) > 0
    
    print("✓ Initial auction state verified. Active pool:", state["current_pool"])
    print("✓ Pools count in summary:", len(state["pools_summary"]))
    print("✓ First pool summary:", state["pools_summary"][0])

    # Test auto distribute to verify buy_price and slots
    room.auto_distribute_and_build("user_1")
    assert room.status == "LINEUP_PHASE"
    for tid, team in room.teams.items():
        assert len(team.players) == 18
        assert all(p.get("buy_price") is not None for p in team.players)
        assert len(team.playing_xi) == 11
        assert len(team.bench) == 7
        print(f"✓ Team {team.name} has 18 players with buy_price and optimal XI formed.")

    print("\nAll Backend Pool & Set Tests Passed Successfully!")

if __name__ == "__main__":
    test_room_pools()
