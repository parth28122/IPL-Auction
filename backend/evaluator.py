from typing import List, Dict, Any, Optional
import math

DISCOUNT_FACTOR = 0.75

from data.captaincy_data import CAPTAINCY_DATABASE, get_captaincy_stats

def get_effective_stats(player: Dict[str, Any]) -> Dict[str, Any]:
    """
    Returns player stats, applying the 0.75 discount factor if IPL stats are missing
    or if uncapped/domestic, supporting both flat stats schema and nested stats schema.
    """
    tier = player.get("tier", "")
    pool = player.get("pool", "")
    has_ipl = player.get("has_ipl_stats", True)
    is_uncapped = (tier == "Uncapped" or pool == "Set 4" or pool.startswith("U") or not has_ipl)
    df = DISCOUNT_FACTOR if is_uncapped else 1.0

    stats = player.get("stats", {})

    # 1. Flat Schema (t20_sr, t20_avg, death_sr, spin_sr, econ, wpm, etc.)
    if "t20_sr" in stats or "t20_avg" in stats:
        t20_sr = float(stats.get("t20_sr") or 125.0)
        t20_avg = float(stats.get("t20_avg") or 25.0)
        spin_sr = float(stats.get("spin_sr") or t20_sr)
        death_sr = float(stats.get("death_sr") or (t20_sr * 1.25))

        econ = float(stats.get("econ") or 8.5)
        wpm = float(stats.get("wpm") or 1.0)
        death_econ = float(stats.get("death_econ") or (econ + 1.5))
        pp_econ = float(stats.get("pp_econ") or (econ - 0.8))

        wkt_rate = (24.0 / max(0.4, wpm)) if wpm > 0 else 25.0

        return {
            "is_discounted": is_uncapped,
            "batting": {
                "powerplay_sr": t20_sr * df,
                "middle_sr": spin_sr * df,
                "death_sr": death_sr * df,
                "average": t20_avg * df,
                "runs": int(500 * df)
            },
            "bowling": {
                "powerplay_economy": pp_econ / df,
                "middle_economy": econ / df,
                "death_economy": death_econ / df,
                "wicket_rate": wkt_rate / df,
                "wickets": int(15 * df)
            }
        }

    # 2. Nested Schema (batting / bowling dicts)
    elif "batting" in stats and "bowling" in stats:
        if has_ipl:
            return {
                "is_discounted": False,
                "batting": {
                    "powerplay_sr": float(stats["batting"].get("powerplay_sr", 120.0)),
                    "middle_sr": float(stats["batting"].get("middle_sr", 120.0)),
                    "death_sr": float(stats["batting"].get("death_sr", 150.0)),
                    "average": float(stats["batting"].get("average", 25.0)),
                    "runs": stats["batting"].get("runs", 500)
                },
                "bowling": {
                    "powerplay_economy": float(stats["bowling"].get("powerplay_economy", 9.0)),
                    "middle_economy": float(stats["bowling"].get("middle_economy", 8.5)),
                    "death_economy": float(stats["bowling"].get("death_economy", 11.0)),
                    "wicket_rate": float(stats["bowling"].get("wicket_rate", 28.0)),
                    "wickets": stats["bowling"].get("wickets", 10)
                }
            }
        else:
            domestic = player.get("domestic_fallback", {})
            return {
                "is_discounted": True,
                "batting": {
                    "powerplay_sr": float(domestic.get("powerplay_sr", 125.0)) * df,
                    "middle_sr": float(domestic.get("middle_sr", 130.0)) * df,
                    "death_sr": float(domestic.get("death_sr", 160.0)) * df,
                    "average": float(domestic.get("average", 28.0)) * df,
                    "runs": int(domestic.get("runs", 300) * df)
                },
                "bowling": {
                    "powerplay_economy": float(domestic.get("powerplay_economy", 8.5)) / df,
                    "middle_economy": float(domestic.get("middle_economy", 8.2)) / df,
                    "death_economy": float(domestic.get("death_economy", 10.5)) / df,
                    "wicket_rate": float(domestic.get("wicket_rate", 24.0)) / df,
                    "wickets": int(domestic.get("wickets", 15) * df)
                }
            }

    # Default fallback
    return {
        "is_discounted": False,
        "batting": {
            "powerplay_sr": 125.0,
            "middle_sr": 125.0,
            "death_sr": 155.0,
            "average": 26.0,
            "runs": 450
        },
        "bowling": {
            "powerplay_economy": 8.5,
            "middle_economy": 8.5,
            "death_economy": 10.5,
            "wicket_rate": 24.0,
            "wickets": 12
        }
    }

def calculate_positional_affinity(player: Dict[str, Any], slot: int) -> float:
    """
    Returns a multiplier (0.3 to 1.0) based on how well the player matches the assigned slot (1 to 11).
    """
    primary_slots = player.get("primary_slot", [])
    if isinstance(primary_slots, int):
        primary_slots = [primary_slots]

    if slot in primary_slots:
        return 1.0

    category = player.get("category", "")
    role = player.get("role", "")
    is_bowler = (player.get("is_bowling_option", False) or role in ["BOWL", "ALL"] or category == "Bowler")

    if slot in [1, 2]:
        if 3 in primary_slots or "Batter" in category or role == "BAT":
            return 0.88
        if "All-Rounder" in category or role == "ALL":
            return 0.75
        if category == "Bowler" or role == "BOWL":
            return 0.30

    elif slot in [3, 4]:
        if any(s in [1, 2, 5] for s in primary_slots):
            return 0.90
        if "All-Rounder" in category or role == "ALL":
            return 0.82
        if category == "Bowler" or role == "BOWL":
            return 0.35

    elif slot in [5, 6, 7]:
        if any(s in [4, 8] for s in primary_slots):
            return 0.90
        if "All-Rounder" in category or role == "ALL":
            return 0.95
        if "Batter" in category or role == "BAT":
            return 0.85
        if category == "Bowler" or role == "BOWL":
            return 0.50

    else:
        if is_bowler or category == "Bowler" or role == "BOWL":
            return 1.0
        if "All-Rounder" in category or role == "ALL":
            return 0.92
        return 0.40

    min_dist = min(abs(slot - s) for s in primary_slots) if primary_slots else 3
    return max(0.4, 1.0 - (min_dist * 0.12))

def evaluate_lineup(
    team_id: str,
    team_name: str,
    playing_xi: List[Dict[str, Any]],
    bench: List[Dict[str, Any]],
    all_players_map: Optional[Dict[str, Dict[str, Any]]] = None,
    captain_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates a team's Playing XI (11 players), Bench, and Crowned Captain.
    """
    warnings = []
    penalties = []
    penalty_points = 0.0

    xi = []
    for item in playing_xi:
        if isinstance(item, dict) and "id" in item:
            xi.append(item)
        elif isinstance(item, str) and all_players_map and item in all_players_map:
            xi.append(all_players_map[item])

    bench_players = []
    for item in bench:
        if isinstance(item, dict) and "id" in item:
            bench_players.append(item)
        elif isinstance(item, str) and all_players_map and item in all_players_map:
            bench_players.append(all_players_map[item])

    # 1. Structural Checks
    overseas_xi = [p for p in xi if p.get("is_overseas", False)]
    if len(overseas_xi) > 4:
        excess = len(overseas_xi) - 4
        deduction = excess * 30.0
        penalties.append({
            "type": "OVERSEAS_VIOLATION",
            "reason": f"Overseas limit exceeded ({len(overseas_xi)}/4 overseas players in XI)",
            "deduction": deduction
        })
        penalty_points += deduction
        warnings.append(f"Overseas limit exceeded: {len(overseas_xi)} in XI (max 4 allowed).")

    wk_xi = [p for p in xi if p.get("is_wicketkeeper", False) or p.get("is_wk", False) or p.get("role") == "WK"]
    if len(wk_xi) == 0:
        deduction = 35.0
        penalties.append({
            "type": "NO_WICKETKEEPER",
            "reason": "No designated Wicketkeeper in Playing XI",
            "deduction": deduction
        })
        penalty_points += deduction
        warnings.append("No Wicketkeeper in Playing XI (-35 penalty)!")
    elif len(wk_xi) > 2:
        deduction = 10.0
        penalties.append({
            "type": "EXCESS_WICKETKEEPERS",
            "reason": f"Too many Wicketkeepers ({len(wk_xi)} in XI causing role conflict)",
            "deduction": deduction
        })
        penalty_points += deduction
        warnings.append(f"{len(wk_xi)} Wicketkeepers in Playing XI.")

    bowling_options = [
        p for p in xi 
        if p.get("is_bowling_option", False) or p.get("role") in ["BOWL", "ALL"] or p.get("category") == "Bowler"
    ]
    if len(bowling_options) < 5:
        deficit = 5 - len(bowling_options)
        deduction = deficit * 25.0
        penalties.append({
            "type": "INSUFFICIENT_BOWLERS",
            "reason": f"Only {len(bowling_options)} bowling options (minimum 5 required for 20 overs)",
            "deduction": deduction
        })
        penalty_points += deduction
        warnings.append(f"Only {len(bowling_options)} bowling options! Teams must have at least 5 bowlers.")

    bench_wk = [
        p for p in bench_players 
        if p.get("is_wicketkeeper", False) or p.get("is_wk", False) or p.get("role") == "WK"
    ]
    if len(bench_wk) == 0:
        deduction = 15.0
        penalties.append({
            "type": "NO_BACKUP_WK",
            "reason": "Squad has 0 backup Wicketkeeper on bench (-15 injury risk penalty)",
            "deduction": deduction
        })
        penalty_points += deduction
        warnings.append("⚠️ No backup WK on bench! (-15 injury risk penalty)")

    # 2. Positional Matchups & Slot Breakdown
    slot_breakdown = []
    slot_scores = []

    for idx, player in enumerate(xi):
        slot_number = idx + 1
        eff = get_effective_stats(player)
        affinity = calculate_positional_affinity(player, slot_number)
        
        bat = eff["batting"]
        bowl = eff["bowling"]

        bat_val = (bat["powerplay_sr"] * 0.25 + bat["middle_sr"] * 0.35 + bat["death_sr"] * 0.40) * 0.35 + (bat["average"] * 1.5)
        
        bowl_val = 0.0
        is_bowler_p = player.get("is_bowling_option", False) or player.get("role") in ["BOWL", "ALL"]
        if is_bowler_p:
            eco_score = max(0.0, (11.0 - ((bowl["powerplay_economy"] + bowl["middle_economy"] + bowl["death_economy"]) / 3.0)) * 12.0)
            wkt_score = max(0.0, (35.0 - bowl["wicket_rate"]) * 1.8)
            bowl_val = eco_score + wkt_score

        if player.get("role") == "BOWL" or player.get("category") == "Bowler":
            raw_rating = bowl_val * 0.8 + bat_val * 0.2
        elif player.get("role") == "ALL" or player.get("category") == "All-Rounder":
            raw_rating = bat_val * 0.55 + bowl_val * 0.45
        else:
            raw_rating = bat_val

        adjusted_slot_score = raw_rating * affinity
        slot_scores.append(adjusted_slot_score)

        slot_breakdown.append({
            "slot": slot_number,
            "player_id": player.get("id"),
            "player_name": player.get("name"),
            "category": player.get("category", player.get("role")),
            "role": player.get("role"),
            "is_overseas": player.get("is_overseas", False),
            "is_discounted": eff["is_discounted"],
            "affinity": round(affinity, 2),
            "slot_score": round(adjusted_slot_score, 1)
        })

    # 3. Composite Phase Metrics
    pp_bat_weights = [0.4, 0.4, 0.2]
    pp_bat_sr = 0.0
    pp_bat_avg = 0.0
    for i in range(min(3, len(xi))):
        s = get_effective_stats(xi[i])["batting"]
        pp_bat_sr += s["powerplay_sr"] * pp_bat_weights[i]
        pp_bat_avg += s["average"] * pp_bat_weights[i]
    powerplay_batting_score = round((pp_bat_sr * 0.45) + (pp_bat_avg * 1.0), 1)

    mid_bat_weights = [0.25, 0.35, 0.25, 0.15]
    mid_bat_sr = 0.0
    mid_bat_avg = 0.0
    for i, slot_idx in enumerate(range(2, min(6, len(xi)))):
        s = get_effective_stats(xi[slot_idx])["batting"]
        w = mid_bat_weights[i] if i < len(mid_bat_weights) else 0.1
        mid_bat_sr += s["middle_sr"] * w
        mid_bat_avg += s["average"] * w
    middle_batting_score = round((mid_bat_sr * 0.45) + (mid_bat_avg * 1.0), 1)

    death_bat_weights = [0.35, 0.35, 0.20, 0.10]
    death_bat_sr = 0.0
    death_bat_avg = 0.0
    for i, slot_idx in enumerate(range(4, min(8, len(xi)))):
        s = get_effective_stats(xi[slot_idx])["batting"]
        w = death_bat_weights[i] if i < len(death_bat_weights) else 0.1
        death_bat_sr += s["death_sr"] * w
        death_bat_avg += s["average"] * w
    death_batting_score = round((death_bat_sr * 0.50) + (death_bat_avg * 0.8), 1)

    batting_score = round((powerplay_batting_score * 0.32) + (middle_batting_score * 0.38) + (death_batting_score * 0.30), 1)

    bowlers = [
        p for p in xi 
        if p.get("is_bowling_option", False) or p.get("role") in ["BOWL", "ALL"] or p.get("category") == "Bowler"
    ]
    if len(bowlers) == 0:
        bowling_score = 10.0
        pp_bowling_score = 10.0
        mid_bowling_score = 10.0
        death_bowling_score = 10.0
    else:
        def bowler_strength(b):
            st = get_effective_stats(b)["bowling"]
            return (12.0 - st["powerplay_economy"]) + (12.0 - st["death_economy"]) + (40.0 - st["wicket_rate"])

        sorted_bowlers = sorted(bowlers, key=bowler_strength, reverse=True)[:5]

        pp_ecos = [get_effective_stats(b)["bowling"]["powerplay_economy"] for b in sorted_bowlers[:3]]
        avg_pp_eco = sum(pp_ecos) / len(pp_ecos) if pp_ecos else 9.5
        pp_bowling_score = round(max(15.0, (11.5 - avg_pp_eco) * 20.0), 1)

        mid_ecos = [get_effective_stats(b)["bowling"]["middle_economy"] for b in sorted_bowlers]
        avg_mid_eco = sum(mid_ecos) / len(mid_ecos) if mid_ecos else 9.0
        mid_bowling_score = round(max(15.0, (11.0 - avg_mid_eco) * 20.0), 1)

        death_ecos = [get_effective_stats(b)["bowling"]["death_economy"] for b in sorted_bowlers[:3]]
        avg_death_eco = sum(death_ecos) / len(death_ecos) if death_ecos else 12.0
        death_bowling_score = round(max(15.0, (13.0 - avg_death_eco) * 22.0), 1)

        bowling_score = round((pp_bowling_score * 0.30) + (mid_bowling_score * 0.35) + (death_bowling_score * 0.35), 1)

    # 4. Bench Redundancy Score
    bench_quality = 0.0
    for bp in bench_players:
        bp_eff = get_effective_stats(bp)
        bp_bat = (bp_eff["batting"]["powerplay_sr"] + bp_eff["batting"]["middle_sr"] + bp_eff["batting"]["death_sr"]) / 3.0
        bp_bowl = 0.0
        is_bp_bowler = bp.get("is_bowling_option", False) or bp.get("role") in ["BOWL", "ALL"]
        if is_bp_bowler:
            bp_bowl = max(0.0, (11.0 - bp_eff["bowling"]["middle_economy"]) * 10.0)
        bench_quality += (bp_bat * 0.4 + bp_bowl * 0.4)

    bench_score = round(bench_quality * 0.20, 1)

    # 5. Balance Score
    balance_points = 50.0
    if len(bowling_options) >= 6:
        balance_points += 15.0
    if len(wk_xi) == 1:
        balance_points += 15.0
    if len(overseas_xi) == 4:
        balance_points += 10.0
    elif len(overseas_xi) <= 3:
        balance_points += 5.0
    balance_score = round(balance_points, 1)

    # 6. Crowned Captain Evaluation & Leadership Impact
    captain_player = None
    if captain_id:
        captain_player = next((p for p in xi if p.get("id") == captain_id), None)
    
    # Auto-crown highest rated if none crowned or invalid
    if not captain_player and xi:
        xi_ratings = [(p, get_captaincy_stats(p)["captaincy_rating"]) for p in xi]
        captain_player = max(xi_ratings, key=lambda x: x[1])[0]

    captain_info = get_captaincy_stats(captain_player) if captain_player else None
    captain_bonus = float(captain_info.get("leadership_bonus", 15.0)) if captain_info else 15.0

    # 7. Total Combined Score
    positional_sum = sum(slot_scores) / max(1, len(slot_scores))
    raw_total = (batting_score * 2.8) + (bowling_score * 2.8) + (positional_sum * 1.5) + (balance_score * 0.8) + bench_score + captain_bonus
    final_score = max(10.0, round(raw_total - penalty_points, 1))

    strengths = []
    weaknesses = []

    if captain_info and captain_info["captaincy_rating"] >= 88:
        strengths.append(f"Masterclass Captaincy: {captain_info['name']} ({captain_info['tier']})")
    elif captain_info and captain_info["captaincy_rating"] <= 65:
        weaknesses.append(f"Inexperienced Captaincy: {captain_info['name']} (Tested mainly in domestic SMAT/Junior formats)")

    if death_bowling_score > 70.0:
        strengths.append("Lethal Death Bowling Unit (Tight Yorker Execution)")
    elif death_bowling_score < 45.0:
        weaknesses.append("Vulnerable Death Bowling (High Leaking Economy)")

    if powerplay_batting_score > 75.0:
        strengths.append("Explosive Powerplay Opening Blast")
    elif powerplay_batting_score < 50.0:
        weaknesses.append("Slow Powerplay Starts / Tentative Openers")

    if middle_batting_score > 75.0:
        strengths.append("Dominant Middle-Overs Spin Punishment")
    
    if len(bowling_options) >= 6:
        strengths.append(f"Flexible Bowling Attack ({len(bowling_options)} Options available)")
    elif len(bowling_options) < 5:
        weaknesses.append(f"Severe Bowling Shortage ({len(bowling_options)} bowlers, needed 5)")

    if bench_score > 25.0:
        strengths.append("Deep Quality Bench (Reliable Redundancy)")
    elif len(bench_wk) == 0:
        weaknesses.append("High Injury Fragility (Zero Backup Wicketkeepers on Bench)")

    return {
        "team_id": team_id,
        "team_name": team_name,
        "captain_id": captain_player.get("id") if captain_player else None,
        "captain_info": captain_info,
        "captain_bonus": captain_bonus,
        "total_score": final_score,
        "batting_score": batting_score,
        "bowling_score": bowling_score,
        "balance_score": balance_score,
        "bench_score": bench_score,
        "penalty_deductions": penalty_points,
        "penalties": penalties,
        "warnings": warnings,
        "phases": {
            "batting": {
                "powerplay": powerplay_batting_score,
                "middle": middle_batting_score,
                "death": death_batting_score
            },
            "bowling": {
                "powerplay": pp_bowling_score,
                "middle": mid_bowling_score,
                "death": death_bowling_score
            }
        },
        "slot_breakdown": slot_breakdown,
        "strengths": strengths[:3] if strengths else ["Balanced Team Composition"],
        "weaknesses": weaknesses[:3] if weaknesses else ["Minor Inefficiencies in Batting Depth"]
    }

def generate_captain_matchup_analysis(evaluations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compares all team captains head-to-head, producing rankings, metrics,
    and a sharp journalistic comparison between captains (IPL, BBL, SA20, MPT20, TNPL, DPL, UPT20, CPL, The Hundred, SMAT).
    """
    captains_list = []
    for ev in evaluations:
        c_info = ev.get("captain_info")
        if c_info:
            captains_list.append({
                "team_id": ev["team_id"],
                "team_name": ev["team_name"],
                **c_info
            })

    if not captains_list:
        return {}

    ranked_captains = sorted(captains_list, key=lambda x: x["captaincy_rating"], reverse=True)
    best_captain = ranked_captains[0]

    comparison_notes = []
    for c in ranked_captains:
        if c["team_id"] != best_captain["team_id"]:
            diff = best_captain["captaincy_rating"] - c["captaincy_rating"]
            best_tourney = best_captain.get("tournament_name") or ("IPL" if best_captain.get("ipl_matches", 0) > 0 else "Franchise T20")
            c_tourney = c.get("tournament_name") or ("IPL" if c.get("ipl_matches", 0) > 0 else "Domestic / Franchise League")

            if c.get("ipl_matches", 0) == 0 and best_captain.get("ipl_matches", 0) > 0:
                note = (
                    f"{best_captain['name']} ({best_captain['team_name']}) holds an established IPL & international leadership pedigree advantage "
                    f"over {c['name']} ({c['team_name']}), who counters with his exceptional record in {c_tourney} ({c['effective_win_pct']}% win index). "
                    f"While {c['name']} utilizes {c.get('tactical_style', 'tactical energy')}, {best_captain['name']}'s proven big-stage execution "
                    f"gives {best_captain['team_name']} a +{diff} tactical leadership edge."
                )
            elif c.get("ipl_matches", 0) == 0 and best_captain.get("ipl_matches", 0) == 0:
                note = (
                    f"Fascinating battle between non-IPL skippers: {best_captain['name']} ({best_captain['team_name']}) leading via {best_tourney} "
                    f"({best_captain['effective_win_pct']}% win rate) vs {c['name']} ({c['team_name']}) leading via {c_tourney} ({c['effective_win_pct']}% win rate). "
                    f"{best_captain['name']} holds a +{diff} rating advantage with {best_captain.get('tactical_style', 'proactive tactics')}."
                )
            else:
                note = (
                    f"Heavyweight IPL tactical clash: {best_captain['name']} ({best_captain['team_name']} - {best_captain['captaincy_rating']}/100) vs "
                    f"{c['name']} ({c['team_name']} - {c['captaincy_rating']}/100). {best_captain['name']} leads with {best_captain.get('tactical_style', 'structured bowling rotations')}, "
                    f"while {c['name']} counters with {c.get('tactical_style', 'bold adjustments')}."
                )
            comparison_notes.append(note)

    return {
        "ranked_captains": ranked_captains,
        "best_captain": best_captain,
        "head_to_head_notes": comparison_notes
    }
