import time
from typing import Dict, Any, List, Optional

FRANCHISE_SLOGANS: Dict[str, Dict[str, str]] = {
    "gujarat": {"slogan": "Aava De!", "tagline": "Titans Brigade", "verb": "roar 'Aava De!'"},
    "chennai": {"slogan": "Whistle Podu!", "tagline": "Yellow Army", "verb": "strike with 'Whistle Podu!'"},
    "mumbai": {"slogan": "Duniya Hila Denge!", "tagline": "Paltan", "verb": "unleash 'Duniya Hila Denge!'"},
    "bengaluru": {"slogan": "Ee Sala Cup Namde!", "tagline": "Play Bold Army", "verb": "roars 'Ee Sala Cup Namde!'"},
    "bangalore": {"slogan": "Ee Sala Cup Namde!", "tagline": "Play Bold Army", "verb": "roars 'Ee Sala Cup Namde!'"},
    "kolkata": {"slogan": "Korbo Lorbo Jeetbo!", "tagline": "Knights Brigade", "verb": "charge with 'Korbo Lorbo Jeetbo!'"},
    "delhi": {"slogan": "Roar Macha!", "tagline": "Dilli Roar", "verb": "shout 'Roar Macha!'"},
    "rajasthan": {"slogan": "Halla Bol!", "tagline": "Royals Army", "verb": "bellow 'Halla Bol!'"},
    "hyderabad": {"slogan": "Orange Army!", "tagline": "Sunrisers", "verb": "ignite the 'Orange Army!'"},
    "lucknow": {"slogan": "Gazab Andaz!", "tagline": "Super Giants", "verb": "unleash 'Gazab Andaz!'"},
    "punjab": {"slogan": "Sadda Punjab!", "tagline": "Sher Squad", "verb": "roar 'Sadda Punjab!'"}
}

def get_team_slogan(team_name: str) -> Dict[str, str]:
    t_lower = team_name.lower()
    for key, data in FRANCHISE_SLOGANS.items():
        if key in t_lower:
            return data
    return {"slogan": "Victory Chants!", "tagline": "Franchise Unit", "verb": "cheer"}

def generate_player_sold_news(
    player: Dict[str, Any],
    winner_team: Dict[str, Any],
    sold_amount: int, # in Lakhs
    bid_history: List[Dict[str, Any]],
    all_teams: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generates thrilling Cricinfo / Breaking News headlines and story cards
    accounting for bidding wars, steals (Whistle Podu, Aava De, etc.), rival outbids, and hammer drama.
    """
    player_name = player.get("name", "Unknown Player")
    team_name = winner_team.get("name", "A franchise")
    owner_name = winner_team.get("owner_name")
    if owner_name and owner_name != team_name and owner_name != "AI Franchise":
        buyer_name = f"{owner_name} ({team_name})"
    else:
        buyer_name = team_name
    buyer_id = winner_team.get("team_id")
    base_price = player.get("base_price", 200) # Lakhs
    tier = player.get("tier", "Standard")
    role = player.get("role", "Player")

    amount_cr = round(sold_amount / 100.0, 2)
    base_cr = round(base_price / 100.0, 2)
    price_ratio = sold_amount / max(1, base_price)
    num_bids = len(bid_history)

    # Find the rival franchise that placed the second highest bid
    rival_team_name: Optional[str] = None
    for b in reversed(bid_history):
        if b.get("team_id") != buyer_id:
            rival_team_name = b.get("team_name")
            break

    buyer_meta = get_team_slogan(buyer_name)
    slogan = buyer_meta["slogan"]
    verb = buyer_meta["verb"]

    rival_str = f" from {rival_team_name}'s clutches" if rival_team_name else ""
    rival_vs_str = f" vs {rival_team_name}" if rival_team_name else ""

    # 1. MEGA RECORD BREAKER (>= 15 Cr)
    if sold_amount >= 1500:
        headline = f"💰 RECORD BREAKER: {buyer_name} break the bank shouting '{slogan}' for {player_name} (₹{amount_cr} Cr)!"
        body = (
            f"History created at the auction table! {buyer_name} shattered purse ceilings to secure marquee icon "
            f"{player_name} for an earth-shaking ₹{amount_cr} Cr"
            + (f" after an epic war with {rival_team_name}." if rival_team_name else ".")
        )
        badge = "💰 MEGA RECORD"
        news_type = "RECORD_BREAKER"

    # 2. FIERCE BIDDING WAR (>= 5 bids, or price >= 2.5x base, or sold >= 8 Cr with multiple bids)
    elif num_bids >= 5 or price_ratio >= 2.5 or (sold_amount >= 800 and num_bids >= 3):
        if rival_team_name:
            headline = f"🔥 FIERCE BIDDING WAR: {buyer_name} roar '{slogan}' to conquer {rival_team_name} for {player_name} (₹{amount_cr} Cr)!"
            body = (
                f"In a blistering {num_bids}-round bidding duel that had the entire room on its feet, {buyer_name} "
                f"outmuscled {rival_team_name} to secure {player_name} for a mammoth ₹{amount_cr} Cr!"
            )
        else:
            headline = f"🔥 BIDDING FRENZY: {buyer_name} unleash '{slogan}', capturing {player_name} for ₹{amount_cr} Cr after {num_bids} bids!"
            body = (
                f"Paddles flew in from every corner of the arena before {buyer_name} delivered the knockout bid of "
                f"₹{amount_cr} Cr to lock down {player_name}."
            )
        badge = "🔥 BIDDING WAR"
        news_type = "BIDDING_WAR"

    # 3. STEAL / HEIST (went at base price or very low bids for star/marquee players)
    elif price_ratio <= 1.25 or (num_bids <= 2 and tier in ["Marquee", "Standard"] and sold_amount <= 400):
        slogan_clean = slogan.replace("!", "").upper()
        if rival_team_name:
            headline = f"🚨 {slogan_clean} HEIST! {buyer_name} steal {player_name} for a bargain ₹{amount_cr} Cr right out of {rival_team_name}'s hands!"
            body = (
                f"Daylight robbery in the auction arena! {buyer_name} pounced on the final hammer with '{slogan}', "
                f"snatching {player_name} at an unbelievable cut-price ₹{amount_cr} Cr right after {rival_team_name}'s bid!"
            )
        else:
            headline = f"🚨 TACTICAL STEAL! {buyer_name} chant '{slogan}', bagging {player_name} uncontested for ₹{amount_cr} Cr!"
            body = (
                f"The entire arena was caught sleeping! {buyer_name} walked away with high-impact {role} {player_name} "
                f"at a dream price of ₹{amount_cr} Cr with virtually zero resistance."
            )
        badge = "🚨 BARGAIN HEIST"
        news_type = "STEAL"

    # 4. HAMMER DRAMA / AMBUSH AT 3RD CALL
    elif num_bids >= 3 and rival_team_name:
        headline = f"⚡ HAMMER AMBUSH: {buyer_name} shout '{slogan}', swiping {player_name} from {rival_team_name} at ₹{amount_cr} Cr!"
        body = (
            f"Just as the hammer was descending in favor of {rival_team_name}, {buyer_name} dramatically raised "
            f"their paddle at the final second to secure {player_name} for ₹{amount_cr} Cr!"
        )
        badge = "⚡ HAMMER DRAMA"
        news_type = "HAMMER_DRAMA"

    # 5. TACTICAL SQUAD SIGNING
    else:
        headline = f"📰 SIGNED & SEALED: {buyer_name} chant '{slogan}', adding {player_name} for ₹{amount_cr} Cr."
        body = (
            f"{buyer_name} execute their strategy with military precision, adding {player_name} ({role}) "
            f"to their squad inventory for ₹{amount_cr} Cr after {num_bids} paddle raises."
        )
        badge = "📰 SQUAD SIGNING"
        news_type = "TACTICAL_BUY"

    return {
        "headline": headline,
        "news_body": body,
        "news_type": news_type,
        "badge": badge,
        "buyer_name": buyer_name,
        "buyer_slogan": slogan,
        "rival_name": rival_team_name,
        "amount_cr": amount_cr,
        "player_name": player_name,
        "timestamp": time.time()
    }

def generate_player_unsold_news(player: Dict[str, Any]) -> Dict[str, Any]:
    player_name = player.get("name", "Unknown Player")
    base_cr = round(player.get("base_price", 200) / 100.0, 2)
    role = player.get("role", "Player")

    headline = f"⚠️ UNSOLD SHOCKWAVE: {player_name} (₹{base_cr} Cr) goes unsold in the arena!"
    body = (
        f"Stunned silence swept through the room as no franchise raised the paddle for {player_name} "
        f"at base price ₹{base_cr} Cr. The {role} goes unsold and will re-enter the accelerated pool."
    )

    return {
        "headline": headline,
        "news_body": body,
        "news_type": "UNSOLD",
        "badge": "⚠️ UNSOLD",
        "buyer_name": "None",
        "buyer_slogan": "",
        "rival_name": None,
        "amount_cr": base_cr,
        "player_name": player_name,
        "timestamp": time.time()
    }
