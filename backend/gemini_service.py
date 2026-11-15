import os
import json
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("gemini_service")

def generate_verdict_commentary(
    evaluations: List[Dict[str, Any]], 
    captain_matchup: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Calls Gemini 2.5 Flash using the google-genai SDK to generate a punchy,
    ESPN/Cricinfo style tournament verdict and analysis based on deterministic evaluations,
    including an in-depth tactical clash between crowned captains.
    Falls back to a structured deterministic analysis if API key is not present or API call fails.
    """
    if not evaluations:
        return {
            "winner": "None",
            "runner_up": "None",
            "rankings": [],
            "match_verdict": "No teams submitted lineups for evaluation.",
            "key_performers": []
        }

    # Sort evaluations by total_score descending
    sorted_teams = sorted(evaluations, key=lambda x: x["total_score"], reverse=True)
    winner = sorted_teams[0]
    runner_up = sorted_teams[1] if len(sorted_teams) > 1 else sorted_teams[0]

    api_key = os.getenv("GEMINI_API_KEY")

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key, http_options=types.HttpOptions(timeout=12000))

            # Build a crisp payload for Gemini
            prompt_context = {
                "tournament_summary": {
                    "teams_count": len(sorted_teams),
                    "highest_score": winner["total_score"],
                    "winner_name": winner["team_name"],
                    "runner_up_name": runner_up["team_name"]
                },
                "team_breakdowns": [
                    {
                        "name": t["team_name"],
                        "total_score": t["total_score"],
                        "batting_score": t["batting_score"],
                        "bowling_score": t["bowling_score"],
                        "captain": t.get("captain_info", {}),
                        "phases": t["phases"],
                        "strengths": t["strengths"],
                        "weaknesses": t["weaknesses"],
                        "penalties": t["penalties"],
                        "top_players": [
                            {"name": s["player_name"], "role": s["role"], "slot": s["slot"], "score": s["slot_score"]}
                            for s in t.get("slot_breakdown", [])[:5]
                        ]
                    }
                    for t in sorted_teams
                ],
                "captains_duel": captain_matchup or {}
            }

            system_instruction = (
                "You are an elite, sharp-tongued cricket analyst and lead editor for ESPNcricinfo. "
                "Analyze the provided IPL Auction Arena tournament lineup scores. "
                "You must return ONLY a valid JSON object matching the exact schema:\n"
                "{\n"
                '  "winner": "<winning team name>",\n'
                '  "runner_up": "<runner up team name>",\n'
                '  "rankings": [\n'
                '    {"team_name": "...", "rank": 1, "score": 850.5, "verdict_tagline": "..."}\n'
                "  ],\n"
                '  "match_verdict": "A 2-paragraph punchy ESPN/Cricinfo style match verdict explaining why the winning team triumphed. In the second paragraph, specifically compare the opposing captains in depth (contrasting proven IPL/World Cup winners like Pat Cummins, MS Dhoni, or Rohit Sharma with leaders who forged their captaincy in overseas leagues like SA20, BBL, The Hundred, CPL, Super Smash or Indian tournaments like Syed Mushtaq Ali Trophy (SMAT), Maharaja T20 (MPT20), TNPL, DPL, or UPT20). Cite their specific tournament pedigree, effective win percentages, and how bowling rotations or tactical adjustments tipped the championship balance.",\n'
                '  "key_performers": [\n'
                '    {"player_name": "...", "team_name": "...", "role": "...", "impact_reason": "..."}\n'
                "  ]\n"
                "}\n"
                "Rules:\n"
                "1. Keep match_verdict strictly 2 paragraphs. Tone must be authentic cricket journalism: energetic, tactical, citing powerplay intent, death yorkers, and captaincy maneuvers.\n"
                "2. Explicitly analyze the captains' duel and leadership credentials."
            )

            model_name = os.getenv("GEMINI_MODEL", "models/gemini-3.1-flash-lite")
            response = client.models.generate_content(
                model=model_name,
                contents=f"Tournament Data:\n{json.dumps(prompt_context, indent=2)}\n\nGenerate the ESPN/Cricinfo style tournament report with captaincy clash analysis.",
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    temperature=0.7
                )
            )

            if response and response.text:
                result_json = json.loads(response.text)
                return result_json

        except Exception as e:
            logger.error(f"Gemini API call failed or timed out: {e}. Falling back to deterministic Cricinfo commentary.")

    # Deterministic fallback commentary (ESPN / Cricinfo style)
    winner_name = winner["team_name"]
    runner_name = runner_up["team_name"]
    w_phases = winner.get("phases", {})
    w_bat = w_phases.get("batting", {})
    w_bowl = w_phases.get("bowling", {})
    r_bowl = runner_up.get("phases", {}).get("bowling", {})

    w_cap = winner.get("captain_info") or {}
    r_cap = runner_up.get("captain_info") or {}

    w_cap_name = w_cap.get("name", "The winning skipper")
    r_cap_name = r_cap.get("name", "the opposing skipper")
    w_cap_style = w_cap.get("tactical_style", "proactive bowling changes")
    r_cap_source = r_cap.get("experience_source", "domestic T20 experience")

    p1 = (
        f"In a high-octane tactical showdown, {winner_name} stormed to the championship title with a comprehensive "
        f"squad score of {winner['total_score']}, edging out {runner_name} ({runner_up['total_score']}). The foundation "
        f"was laid in the trenches of the auction room, where {winner_name} prioritized high-leverage phases. "
        f"Their death overs bowling index ({w_bowl.get('death', 65.0)}) proved to be the ultimate differentiator, "
        f"choking boundary options at the back end while their powerplay strike weapons provided immediate breakthroughs."
    )

    w_tourney = w_cap.get("tournament_name") or ("IPL" if w_cap.get("ipl_matches", 0) > 0 else "Franchise T20")
    r_tourney = r_cap.get("tournament_name") or ("IPL" if r_cap.get("ipl_matches", 0) > 0 else "League T20")

    cap_comparison = ""
    if w_cap and r_cap:
        if r_cap.get("ipl_matches", 0) == 0 and w_cap.get("ipl_matches", 0) > 0:
            cap_comparison = (
                f"The captaincy duel was equally riveting: while {r_cap_name} led with tremendous courage and "
                f"relied on his stellar {r_tourney} leadership ({r_cap.get('effective_win_pct', 60.0)}% win index), "
                f"{w_cap_name}'s battle-tested IPL pedigree and {w_cap_style} made all the difference in crunch moments. "
            )
        elif r_cap.get("ipl_matches", 0) == 0 and w_cap.get("ipl_matches", 0) == 0:
            cap_comparison = (
                f"The captaincy clash pitted two premier league tacticians against each other: {w_cap_name} directing troops "
                f"through his formidable {w_tourney} pedigree ({w_cap.get('effective_win_pct', 65.0)}% win index) versus "
                f"{r_cap_name} executing bold strategies from {r_tourney} ({r_cap.get('effective_win_pct', 60.0)}% win index). "
            )
        else:
            cap_comparison = (
                f"At the helm, the tactical clash between {w_cap_name} ({w_cap.get('captaincy_rating', 85)}/100 rating) and "
                f"{r_cap_name} ({r_cap.get('captaincy_rating', 80)}/100 rating) dictated the tempo of the contest. "
            )

    p2 = (
        f"{cap_comparison}While {runner_name} mounted serious pressure through their top order, their tactical balance fell short when "
        f"stress-tested against {winner_name}'s middle-overs squeeze ({w_bowl.get('middle', 60.0)} bowling index). "
        f"Combined with a reliable bench depth redundancy that mitigated injury vulnerabilities, {winner_name} emerged "
        f"as the complete T20 package—a masterclass in squad geometry and modern franchise construction."
    )

    rankings = []
    for rank_idx, t in enumerate(sorted_teams, 1):
        is_elim = t.get("is_eliminated", False)
        tagline = t.get("elimination_reason", "Eliminated (< 18 players)") if is_elim else (t["strengths"][0] if t.get("strengths") else "Solid tactical unit")
        rankings.append({
            "team_name": t["team_name"],
            "rank": rank_idx,
            "score": t["total_score"],
            "is_eliminated": is_elim,
            "verdict_tagline": tagline
        })

    key_performers = []
    for s in winner.get("slot_breakdown", [])[:2]:
        key_performers.append({
            "player_name": s["player_name"],
            "team_name": winner_name,
            "role": s["role"],
            "impact_reason": f"Anchor of Slot #{s['slot']} with an elite performance rating of {s['slot_score']}"
        })
    if runner_up.get("slot_breakdown"):
        ru_star = runner_up["slot_breakdown"][0]
        key_performers.append({
            "player_name": ru_star["player_name"],
            "team_name": runner_name,
            "role": ru_star["role"],
            "impact_reason": f"Valiant solo resistance with {ru_star['slot_score']} efficiency"
        })

    return {
        "winner": winner_name,
        "runner_up": runner_name,
        "rankings": rankings,
        "match_verdict": f"{p1}\n\n{p2}",
        "key_performers": key_performers
    }
