import asyncio
import json
from pathlib import Path
from room_manager import RoomManager, Room

DATA_PATH = Path(__file__).parent / "data" / "players.json"
with open(DATA_PATH, "r", encoding="utf-8") as f:
    PLAYERS_DATA = json.load(f)

async def test_chat():
    print("\n--- 1. Testing Chat Messaging in Auction Room ---")
    manager = RoomManager(PLAYERS_DATA)
    room = manager.get_or_create_room("chat_war_room", "IPL Mega Auction")
    room.host_id = "user_parth"

    # Add teams
    room.add_team("user_parth", "Chennai Super Kings", is_bot=False, color="#FFFF00", owner_name="Parth")
    room.add_team("user_rahul", "Mumbai Indians", is_bot=False, color="#004BA0", owner_name="Rahul")

    # Send chat 1
    msg1 = await room.add_chat_message("user_parth", "Whistle Podu! Ready for the auction! 🦁")
    assert msg1["sender_name"] == "Parth"
    assert msg1["sender_team"] == "Chennai Super Kings"
    assert msg1["sender_color"] == "#FFFF00"
    assert msg1["is_host"] is True
    assert "🦁" in msg1["text"]
    print("✓ Message 1 verified:", msg1["sender_name"], f"({msg1['sender_team']}):", msg1["text"])

    # Send chat 2
    msg2 = await room.add_chat_message("user_rahul", "Duniya Hila Denge! Going all out for Bumrah! 💥")
    assert msg2["sender_name"] == "Rahul"
    assert msg2["sender_team"] == "Mumbai Indians"
    assert msg2["is_host"] is False
    print("✓ Message 2 verified:", msg2["sender_name"], f"({msg2['sender_team']}):", msg2["text"])

    # Send chat 3 from unassigned spectator
    msg3 = await room.add_chat_message("spectator_99", "Excited to watch this live!")
    assert msg3["sender_name"] == "War Room Scout"
    assert msg3["sender_team"] is None
    print("✓ Message 3 (Spectator) verified:", msg3["sender_name"], ":", msg3["text"])

    # Verify get_state includes chat_messages
    state = room.get_state()
    assert "chat_messages" in state
    assert len(state["chat_messages"]) == 3
    assert state["chat_messages"][0]["text"] == msg1["text"]
    assert state["chat_messages"][1]["text"] == msg2["text"]
    assert state["chat_messages"][2]["text"] == msg3["text"]
    print("✓ Room state chat_messages persistence verified (3 messages in state)")

    # Verify empty message rejection
    empty_res = await room.add_chat_message("user_parth", "   ")
    assert empty_res == {}
    assert len(room.chat_messages) == 3
    print("✓ Whitespace-only message ignored cleanly")

    # Verify long message truncation (max 300 chars)
    long_text = "A" * 400
    msg_long = await room.add_chat_message("user_parth", long_text)
    assert len(msg_long["text"]) == 300
    print("✓ 300-char message boundary truncation verified")

    print("\n🎉 ALL CHAT SYSTEM TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_chat())
