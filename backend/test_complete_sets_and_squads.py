import asyncio
import json
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from room_manager import RoomManager

async def test_complete_sets_and_squads():
    with open("backend/data/players.json", "r") as f:
        players = json.load(f)
    
    assert len(players) == 354, f"Expected 354 players, got {len(players)}"
    
    mgr = RoomManager(players)
    room = mgr.get_or_create_room("e2e_room_sets")
    
    user_team = room.add_team("user_alpha", "Super Kings", color="#F9CD05")
    room.add_bots(3)
    
    # 1. Start Auction
    room.start_auction()
    assert room.status == "AUCTION_ACTIVE"
    assert room.current_pool == "Marquee Set 1"
    
    # Verify pool summary structure
    pools_sum = room.get_pools_summary()
    assert len(pools_sum) >= 20, f"Expected >=20 pools in summary, got {len(pools_sum)}"
    assert pools_sum[0]["pool_name"] == "Marquee Set 1"
    assert pools_sum[0]["total_players"] == 47
    assert pools_sum[0]["is_current"] == True
    
    # Verify current set players
    set_players = room.get_current_set_players()
    assert len(set_players) == 47
    assert set_players[0]["auction_status"] == "ON_BLOCK"
    
    # 2. Simulate bidding & selling player
    await room.place_bid("user_alpha", 50)
    await room.hammer_player()
    
    assert len(user_team.players) == 1
    bought_p = user_team.players[0]
    assert bought_p.get("buy_price") is not None
    assert bought_p.get("buy_price_cr") is not None
    print(f"✓ Player {bought_p['name']} bought by {user_team.name} for ₹{bought_p['buy_price_cr']} Cr")
    
    # 3. Test slot separation logic
    squad = user_team.players
    wk_slot = [p for p in squad if p.get("role") == "WK" or p.get("is_wicketkeeper")]
    bat_slot = [p for p in squad if p.get("role") == "BAT" and not p.get("is_wicketkeeper")]
    all_slot = [p for p in squad if p.get("role") == "ALL"]
    bowl_slot = [p for p in squad if p.get("role") == "BOWL"]
    
    print(f"✓ Squad slot counts - WK: {len(wk_slot)}, BAT: {len(bat_slot)}, ALL: {len(all_slot)}, BOWL: {len(bowl_slot)}")
    
    # 4. Fast forward through remaining Marquee Set 1 players to test Set Transition
    marquee_count = len([p for p in room.players_queue if p.get("pool") == "Marquee Set 1"])
    transition_found = False
    
    for _ in range(marquee_count + 5):
        t = room.next_player()
        if t and t.get("previous_set") == "Marquee Set 1":
            transition_found = True
            print(f"✓ Successfully triggered Set Transition: {t['message']}")
            assert room.current_pool == t["current_set"]
            break
            
    assert transition_found, "Set transition was not triggered when Marquee Set 1 concluded!"
    
    # 5. Test Auto-draft with 18-player squad and optimal Playing XI
    room.auto_distribute_and_build("user_alpha")
    assert room.status == "LINEUP_PHASE"
    for tid, t in room.teams.items():
        assert len(t.players) == 18
        assert len(t.playing_xi) == 11
        assert len(t.bench) == 7
        # Verify slot distribution
        team_wk = [p for p in t.players if p.get("role") == "WK" or p.get("is_wicketkeeper")]
        team_bat = [p for p in t.players if p.get("role") == "BAT" and not p.get("is_wicketkeeper")]
        team_all = [p for p in t.players if p.get("role") == "ALL"]
        team_bowl = [p for p in t.players if p.get("role") == "BOWL"]
        assert len(team_wk) >= 1, f"Team {t.name} has no wicketkeeper!"
        assert len(team_bowl) >= 3, f"Team {t.name} has insufficient bowlers!"
        print(f"✓ Team {t.name} squad: {len(t.players)} players (WK: {len(team_wk)}, BAT: {len(team_bat)}, ALL: {len(team_all)}, BOWL: {len(team_bowl)})")

    print("\n🎉 ALL SET TRANSITION AND SQUAD SLOTS VERIFICATIONS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_complete_sets_and_squads())
