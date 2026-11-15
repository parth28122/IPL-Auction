import json
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from room_manager import RoomManager
from evaluator import get_captaincy_stats, evaluate_lineup, generate_captain_matchup_analysis
from gemini_service import generate_verdict_commentary

import asyncio

async def test_captaincy_system():
    print("--- 1. Testing Player Captaincy Profiles & Domestic Fallbacks ---")
    data_path = Path(__file__).parent / "data" / "players.json"
    with open(data_path, "r", encoding="utf-8") as f:
        players = json.load(f)
    players_map = {p["id"]: p for p in players}

    # Test Ishan Kishan (0 IPL matches as captain, fallback to SMAT & U-19)
    ishan = players_map["ishan_kishan"]
    ishan_cap = get_captaincy_stats(ishan)
    print("Ishan Kishan Captaincy Profile:")
    print(f"  Name: {ishan_cap['name']}")
    print(f"  Rating: {ishan_cap['captaincy_rating']}/100")
    print(f"  IPL Record: {ishan_cap['ipl_matches']} matches, {ishan_cap['ipl_wins']} wins ({ishan_cap['ipl_win_pct']}%)")
    print(f"  Domestic SMAT: {ishan_cap['smat_matches']} matches, {ishan_cap['smat_wins']} wins ({ishan_cap['smat_win_pct']}%)")
    print(f"  Fallback Applied: {ishan_cap['domestic_fallback_applied']}")
    print(f"  Tactical Style: {ishan_cap['tactical_style']}")
    print(f"  Analysis: {ishan_cap['analysis']}")

    assert ishan_cap["ipl_matches"] == 0, "Ishan Kishan must have 0 IPL captaincy matches"
    assert ishan_cap["domestic_fallback_applied"] is True, "Ishan Kishan must have domestic fallback applied"
    assert ishan_cap["smat_matches"] == 16, "Ishan Kishan SMAT matches must be 16"
    assert ishan_cap["smat_win_pct"] == 62.5, "Ishan Kishan SMAT win pct must be 62.5%"
    assert ishan_cap["captaincy_rating"] == 76, "Ishan Kishan captaincy rating must be 76"

    # Test Pat Cummins (17 IPL matches, World Cup 2023, WTC)
    cummins = players_map["pat_cummins"]
    cummins_cap = get_captaincy_stats(cummins)
    print("\nPat Cummins Captaincy Profile:")
    print(f"  Name: {cummins_cap['name']}")
    print(f"  Rating: {cummins_cap['captaincy_rating']}/100")
    print(f"  IPL Record: {cummins_cap['ipl_matches']} matches, {cummins_cap['ipl_wins']} wins ({cummins_cap['ipl_win_pct']}%)")
    print(f"  Trophies: {cummins_cap['trophies']}")
    print(f"  Tactical Style: {cummins_cap['tactical_style']}")

    assert cummins_cap["ipl_matches"] == 17, "Pat Cummins must have 17 IPL captaincy matches"
    assert cummins_cap["captaincy_rating"] == 95, "Pat Cummins captaincy rating must be 95"
    assert any("World Cup 2023" in t for t in cummins_cap["trophies"])

    # Test Algorithmic Fallback for uncapped player with no curated record
    uncapped_sample = next(p for p in players if p.get("tier") == "Uncapped")
    uncapped_cap = get_captaincy_stats(uncapped_sample)
    print(f"\nUncapped Player Fallback ({uncapped_sample['name']}):")
    print(f"  Rating: {uncapped_cap['captaincy_rating']}/100")
    print(f"  Domestic SMAT: {uncapped_cap['smat_matches']} matches ({uncapped_cap['smat_win_pct']}%)")
    assert uncapped_cap["domestic_fallback_applied"] is True
    assert 35 <= uncapped_cap["captaincy_rating"] <= 78

    print("\n--- 2. Testing Lineup Evaluation with Captaincy Bonus ---")
    rm = RoomManager(players)
    room = rm.get_or_create_room("captain_test_room")
    team1 = room.add_team("user_ishan", "Mumbai Champions", is_bot=False)
    team2 = room.add_team("bot_cummins", "Sunrisers Hyderabad", is_bot=True)

    # Distribute players
    room.auto_distribute_and_build("user_ishan")

    # Force ishan_kishan into team1 squad & playing_xi and pat_cummins into team2 squad & playing_xi
    old_p1 = team1.playing_xi[0]
    team1.playing_xi[0] = "ishan_kishan"
    team1.players = [room.players_map["ishan_kishan"] if p["id"] == old_p1 else p for p in team1.players]

    old_p2 = team2.playing_xi[0]
    team2.playing_xi[0] = "pat_cummins"
    team2.players = [room.players_map["pat_cummins"] if p["id"] == old_p2 else p for p in team2.players]

    # Submit lineups with explicit captains
    sub1 = await room.submit_lineup("user_ishan", team1.playing_xi, team1.bench, captain_id="ishan_kishan")
    sub2 = await room.submit_lineup("bot_cummins", team2.playing_xi, team2.bench, captain_id="pat_cummins")

    eval1 = sub1["evaluation"]
    eval2 = sub2["evaluation"]

    assert eval1["captain_info"]["player_id"] == "ishan_kishan"
    assert eval2["captain_info"]["player_id"] == "pat_cummins"
    print(f"Team 1 Captain: {eval1['captain_info']['name']} (Rating: {eval1['captain_info']['captaincy_rating']})")
    print(f"Team 2 Captain: {eval2['captain_info']['name']} (Rating: {eval2['captain_info']['captaincy_rating']})")

    print("\n--- 3. Testing Head-to-Head Captains Duel Analysis ---")
    matchup = generate_captain_matchup_analysis([eval1, eval2])
    print(f"Best Captain: {matchup['best_captain']['name']} (Rating: {matchup['best_captain']['captaincy_rating']})")
    print(f"Head to Head Notes: {matchup['head_to_head_notes']}")
    assert matchup["best_captain"]["player_id"] == "pat_cummins"
    assert len(matchup["ranked_captains"]) == 2
    assert any("Pat Cummins" in n and "Ishan Kishan" in n for n in matchup["head_to_head_notes"])

    print("\n--- 4. Testing Tournament Evaluation & Cricinfo Verdict Generation ---")
    verdict = await room.run_tournament_evaluation()
    assert verdict is not None
    assert "captain_matchup" in verdict
    print(f"Winner: {verdict['winner']}")
    print(f"Runner Up: {verdict['runner_up']}")
    print("\nVerdict Commentary Excerpt:")
    print(verdict["match_verdict"][:300] + "...")

    # Check that deterministic fallback commentary discusses the captains
    fallback_res = generate_verdict_commentary([eval1, eval2], matchup)
    fallback_commentary = fallback_res["match_verdict"]
    assert "Pat Cummins" in fallback_commentary or "Ishan Kishan" in fallback_commentary or "captain" in fallback_commentary.lower()
    print("\nDeterministic Captain Duel commentary generated:")
    print([line for line in fallback_commentary.split("\n\n") if "Captain" in line or "captain" in line.lower() or "Cummins" in line or "Kishan" in line][0])

    print("\n ALL CAPTAINCY TESTS & HEAD-TO-HEAD MATCHUP VERIFICATIONS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_captaincy_system())
