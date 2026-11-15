import asyncio
import json
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from room_manager import RoomManager, TIMER_DURATION, LINEUP_TIMER_DURATION

async def test_deadline_and_elimination():
    with open("backend/data/players.json", "r") as f:
        players = json.load(f)
    
    print(f"Auction timer duration: {TIMER_DURATION}s (expected: 5s)")
    assert TIMER_DURATION == 5, f"Expected 5s timer, got {TIMER_DURATION}"
    
    print(f"Lineup deadline duration: {LINEUP_TIMER_DURATION}s (expected: 150s)")
    assert LINEUP_TIMER_DURATION == 150, f"Expected 150s timer, got {LINEUP_TIMER_DURATION}"
    
    mgr = RoomManager(players)
    room = mgr.get_or_create_room("deadline_test_room")
    
    # 1. Test Auto-draft creates 18-player squads
    room.add_team("user_1", "CSK Elite", color="#F9CD05")
    room.auto_distribute_and_build("user_1")
    
    assert room.status == "LINEUP_PHASE"
    for tid, team in room.teams.items():
        assert len(team.players) == 18, f"Expected 18 players in squad, got {len(team.players)}"
        assert len(team.playing_xi) == 11, f"Expected 11 in XI, got {len(team.playing_xi)}"
        assert len(team.bench) == 7, f"Expected 7 in bench, got {len(team.bench)}"
        print(f"✓ Team {team.name}: 18 players in squad, 11 in XI, 7 on bench.")
    
    # 2. Test Elimination on timeout for team with < 18 players
    room2 = mgr.get_or_create_room("elimination_test_room")
    t_short = room2.add_team("short_team", "Short Squad", color="#FF0000")
    # Give it only 10 players
    t_short.players = players[:10]
    
    t_full = room2.add_team("full_team", "Full Squad", color="#00FF00")
    # Give it 18 players
    t_full.players = players[10:28]
    
    room2.status = "LINEUP_PHASE"
    # Trigger deadline timeout
    await room2.handle_lineup_deadline_timeout()
    
    assert t_short.is_eliminated == True, "Team with 10 players was not eliminated!"
    assert "Eliminated" in (t_short.elimination_reason or "")
    print(f"✓ Team {t_short.name} was successfully ELIMINATED: {t_short.elimination_reason}")
    
    assert t_full.is_eliminated == False, "Team with 18 players was erroneously eliminated!"
    assert t_full.lineup_submitted == True, "Team with 18 players was not auto-submitted!"
    print(f"✓ Team {t_full.name} with 18 players was successfully auto-submitted and evaluated.")
    
    # 3. Check tournament evaluation results
    assert t_short.evaluation_result is not None
    assert t_short.evaluation_result["total_score"] == 0
    assert t_short.evaluation_result["is_eliminated"] == True
    print(f"✓ Disqualified evaluation confirmed: Total Score = {t_short.evaluation_result['total_score']}")
    
    assert t_full.evaluation_result is not None
    assert t_full.evaluation_result["total_score"] > 0
    print(f"✓ Full squad evaluation confirmed: Total Score = {t_full.evaluation_result['total_score']}")
    
    print("\n🎉 ALL DEADLINE & 5-SECOND TIMER TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_deadline_and_elimination())
