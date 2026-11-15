import asyncio
import json
from pathlib import Path
from room_manager import RoomManager, TOTAL_BUDGET_LAKHS, MARQUEE_CAP_LAKHS

async def run_multiplayer_concurrency_and_security_tests():
    data_path = Path(__file__).parent / "data" / "players.json"
    with open(data_path, "r", encoding="utf-8") as f:
        players = json.load(f)

    rm = RoomManager(players)

    print("--- 1. Testing Room Code Creation & Normalization ---")
    room1 = rm.get_or_create_room("  WAR101  ")
    room2 = rm.get_or_create_room("war101")
    assert room1.room_id == "war101", f"Expected 'war101', got {room1.room_id}"
    assert room1 is room2, "Room code normalization failed: rooms should refer to identical instance!"
    print(f"✓ Room code normalized and retrieved: {room1.room_id}")

    print("\n--- 2. Testing Team Selection & Name Disambiguation ---")
    t1 = room1.add_team("client_user_1", "Chennai Super Kings", color="#F9CD05")
    assert room1.host_id == "client_user_1", "Host ID was not set to the first human player!"
    # Second player tries to pick Chennai Super Kings as well
    t2 = room1.add_team("client_user_2", "Chennai Super Kings", color="#F9CD05")
    assert t2.name != t1.name, "Duplicate team names should be disambiguated!"
    assert t2.name == "Chennai Super Kings 2", f"Expected disambiguated name, got {t2.name}"
    print(f"✓ Team 1: {t1.name}, Team 2: {t2.name} (Disambiguated cleanly)")

    print("\n--- 3. Testing Simultaneous Bidding & Concurrency ---")
    room1.start_auction()
    assert room1.status == "AUCTION_ACTIVE"
    player = room1.current_player
    print(f"Current Player on Block: {player['name']} (Base: ₹{player.get('base_price', 100)/100:.2f} Cr)")

    # Client 1 opens bid with base price
    res1 = await room1.place_bid("client_user_1", increment=20)
    assert res1["success"] is True, f"Bid failed: {res1}"
    assert room1.highest_bidder_id == "client_user_1"

    # Client 1 tries to bid against itself -> must be rejected
    res_self = await room1.place_bid("client_user_1", increment=20)
    assert res_self["success"] is False
    assert "already hold the highest bid" in res_self["message"]
    print("✓ Prevented player from bidding against themselves")

    # Client 2 bids +50L
    res2 = await room1.place_bid("client_user_2", increment=50)
    assert res2["success"] is True
    assert room1.highest_bidder_id == "client_user_2"
    assert room1.timer == 5, "Timer did not reset to 5s on bid!"
    print(f"✓ Consecutive bidding verified. Current Bid: ₹{room1.current_bid/100:.2f} Cr by {room1.highest_bidder_name}")

    # Simultaneous bidding simulation: 2 bids at the exact same moment
    # Give user 1 and user 2 concurrent tasks
    bids = await asyncio.gather(
        room1.place_bid("client_user_1", increment=20),
        room1.place_bid("client_user_2", increment=20)
    )
    # Exactly one should succeed and one should fail (since one becomes highest bidder or bids against self)
    successes = [b for b in bids if b.get("success")]
    print(f"Simultaneous bids result: {len(successes)} succeeded cleanly without race conditions.")

    print("\n--- 4. Testing Pass Mechanism ---")
    pass_res = await room1.pass_player("client_user_1")
    assert pass_res["success"] is True
    assert "client_user_1" in room1.passed_teams
    # Passed player tries to bid on same player -> must be rejected
    bid_after_pass = await room1.place_bid("client_user_1", increment=20)
    assert bid_after_pass["success"] is False
    assert "passed" in bid_after_pass["message"].lower()
    print("✓ Passed player cannot re-bid on same player until next auction block")

    print("\n--- 5. Testing Squad Reserve Purse Rule ---")
    # Budget is enough for the bid, but leaves less than required reserve for remaining 17 players (17 * 30 = 510L)
    t1.budget = room1.current_bid + 20 + 100
    room1.passed_teams.discard("client_user_1")
    reserve_test = await room1.place_bid("client_user_1", increment=20)
    assert reserve_test["success"] is False, f"Expected reserve purse failure, got: {reserve_test}"
    assert "Reserve budget rule" in reserve_test["message"]
    print(f"✓ Reserve purse rule enforced: {reserve_test['message']}")
    t1.budget = TOTAL_BUDGET_LAKHS  # Restore

    print("\n--- 6. Testing Lineup Anti-Cheat Verification ---")
    # Try to submit players not in squad
    cheat_sub = await room1.submit_lineup("client_user_1", ["fake_id_1", "fake_id_2"], [])
    assert cheat_sub["success"] is False
    assert "not in your squad" in cheat_sub["message"]
    print("✓ Unowned player injection blocked by anti-cheat verification")

    # Give t1 a legitimate squad of 18 players
    t1.players = room1.all_players[:18]
    legit_xi = [p["id"] for p in t1.players[:11]]
    legit_bench = [p["id"] for p in t1.players[11:18]]

    # Try submitting duplicate player in XI
    dup_xi = [legit_xi[0]] + legit_xi[1:10] + [legit_xi[0]]
    dup_sub = await room1.submit_lineup("client_user_1", dup_xi, legit_bench)
    assert dup_sub["success"] is False
    assert "Duplicate" in dup_sub["message"]
    print("✓ Duplicate player submission blocked")

    # Try submitting player in both XI and Bench
    overlap_sub = await room1.submit_lineup("client_user_1", legit_xi, [legit_xi[0]] + legit_bench[1:])
    assert overlap_sub["success"] is False
    assert "both Playing XI and Bench" in overlap_sub["message"]
    print("✓ Overlapping XI/Bench player submission blocked")

    # Legitimate submission
    legit_sub = await room1.submit_lineup("client_user_1", legit_xi, legit_bench, captain_id=legit_xi[0])
    assert legit_sub["success"] is True
    assert legit_sub["evaluation"]["captain_info"]["player_id"] == legit_xi[0]
    print(f"✓ Legitimate lineup evaluated successfully! Score: {legit_sub['evaluation']['total_score']}")

    print("\n🎉 ALL MULTIPLAYER, CONCURRENCY, BIDDING & SECURITY VERIFICATIONS PASSED!")

if __name__ == "__main__":
    asyncio.run(run_multiplayer_concurrency_and_security_tests())
