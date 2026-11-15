# 🏏 IPL Auction Arena

A real-time multiplayer cricket auction simulator with post-auction drag-and-drop Playing XI formation and an objective tactical evaluation engine.

---

## ⚡ Tech Stack

- **Backend**: FastAPI (Python 3.11), WebSockets, Pydantic, `google-genai` SDK, `python-dotenv`, `uvicorn`.
- **Frontend**: Next.js 15 (App Router), Tailwind CSS v4, Lucide React, HTML5 Drag & Drop, Canvas Confetti.
- **Evaluation Engine**: Deterministic composite phase evaluator (Powerplay, Middle, Death) + SMAT/T20 fallback with $0.75\times$ discount factor + Bench depth redundancy.
- **AI Commentary**: Google Gemini 2.5 Flash via `google-genai` SDK providing ESPN/Cricinfo-style tournament verdicts.

---

## 📋 Core Business Logic

### 1. Auction Phase
- **Budget**: ₹120 Crore (`12,000` Lakhs) per team.
- **Marquee Cap**: Maximum ₹80 Crore (`8,000` Lakhs) allowed on the Marquee pool. Exceeding this cap is blocked in real-time.
- **Bidding System**:
  - Live 10-second hammer timer countdown that **resets back to 10s** on every valid bid.
  - Bid increments: `+ ₹20 Lakhs`, `+ ₹50 Lakhs`, `+ ₹1.00 Crore`.
  - Pass button allows teams to opt out of the active player; if all teams pass or timer expires, the player is sold to the highest bidder or marked unsold.
  - Once all players across active pools are completed, transitions to `AUCTION_COMPLETED`.

### 2. Lineup Builder (Drag & Drop)
- Split screen:
  - **Left**: Purchased squad inventory with player cards, role indicators, and stats.
  - **Right**: Visual Playing XI pitch board (Slots 1 to 11) + 4 Bench slots.
- **Real-Time Client Validations**:
  - **Overseas Limit**: Maximum 4 overseas players in Playing XI.
  - **Wicketkeeper**: Exactly 1 designated Wicketkeeper in Playing XI.
  - **Bowling Balance**: Minimum 5 bowling options required to bowl 20 overs.
  - **Backup WK Penalty**: If the squad has 0 backup WK on the bench, a warning is raised and a **-15 injury risk penalty** is deducted from the final score.
- **Tactical Slot Affinities**:
  - Slots 1-2: Openers (Powerplay batting weight).
  - Slots 3-4: Top-order / Anchor.
  - Slots 5-7: Middle-order Finishers & All-Rounders.
  - Slots 8-11: Specialist Bowlers & Tailenders.

### 3. Deterministic Evaluation Engine (`backend/evaluator.py`)
- Positional Matchup Scores: Compares player at each slot against their optimal `primary_slot`.
- Missing IPL Stats: Uncapped/domestic players fall back to SMAT/T20 stats with a **$0.75$ discount factor**.
- Composite Phase Metrics:
  - Batting: Powerplay index, Middle overs spin/pace acceleration, Death overs striking.
  - Bowling: Powerplay swing/economy, Middle overs squeeze, Death overs yorker index.
- Bench Depth: Adds **+20% bench depth redundancy score**.
- Penalties: Subtracts structural violations (e.g. excess overseas, missing bowlers, -15 no backup WK).

### 4. AI Verdict Commentary (`backend/gemini_service.py`)
- Evaluates tournament lineups and scores using Gemini 2.5 Flash (`google-genai` SDK).
- Generates structured JSON:
  - Tournament Winner & Runner-Up.
  - Official rankings and scores.
  - A 2-paragraph punchy ESPN/Cricinfo style editorial verdict explaining why the winning team triumphed (e.g., death bowling edge or middle-overs spin power).
  - Key tournament performers and impacts.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create virtual environment (if not already done)
python -m venv venv

# Activate virtual environment
# Windows:
.\venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Set your Gemini API key in backend/.env
# GEMINI_API_KEY=your_gemini_api_key_here

# Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
The backend will run on `http://localhost:8000` with interactive docs at `http://localhost:8000/docs`.

### 3. Frontend Setup
```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install dependencies (already initialized)
npm install

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 WebSocket API Protocol

Endpoint: `ws://localhost:8000/ws/{room_id}/{client_id}`

| Event Type | Direction | Payload Example | Description |
|---|---|---|---|
| `JOIN_ROOM` | Client ➔ Server | `{"team_id": "u1", "team_name": "CSK", "color": "#F9CD05"}` | Register franchise to room |
| `ADD_BOTS` | Client ➔ Server | `{"count": 3}` | Add AI franchises (MI, CSK, RCB) |
| `START_AUCTION` | Client ➔ Server | `{}` | Commences live auction queue |
| `BID` | Client ➔ Server | `{"team_id": "u1", "increment": 50}` | Place bid (+20L, +50L, +100L) |
| `PASS` | Client ➔ Server | `{"team_id": "u1"}` | Pass on active player |
| `TIMER_TICK` | Server ➔ Client | `{"timer": 7, "current_bid": 350}` | Broadcast every 1s during auction |
| `PLAYER_SOLD` | Server ➔ Client | `{"player": {...}, "winner_team_id": "u1"}` | Player hammered & sold |
| `AUCTION_END` | Server ➔ Client | `{"state": {...}}` | Transition to Lineup Builder |
| `SUBMIT_LINEUP` | Client ➔ Server | `{"team_id": "u1", "playing_xi": [...], "bench": [...]}` | Lock and submit XI & Bench |
| `VERDICT` | Server ➔ Client | `{"verdict": {...}, "evaluations": [...]}` | Final Cricinfo AI verdict |
