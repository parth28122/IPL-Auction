export type PlayerCategory = "Marquee" | "Batter" | "Keeper" | "All-Rounder" | "Bowler";

export interface BattingStats {
  powerplay_sr: number;
  middle_sr: number;
  death_sr: number;
  average: number;
  boundary_rate?: number;
  runs: number;
}

export interface BowlingStats {
  powerplay_economy: number;
  middle_economy: number;
  death_economy: number;
  wicket_rate: number;
  wickets: number;
}

export interface PlayerStats {
  batting: BattingStats;
  bowling: BowlingStats;
}

export interface DomesticFallback {
  powerplay_sr: number;
  middle_sr: number;
  death_sr: number;
  average: number;
  powerplay_economy: number;
  middle_economy: number;
  death_economy: number;
  wicket_rate: number;
  runs?: number;
  wickets?: number;
}

export interface Player {
  id: string;
  name: string;
  category?: PlayerCategory | string;
  tier?: string;
  pool?: string;
  country?: string;
  is_overseas: boolean;
  is_wk?: boolean;
  base_price?: number; // in Lakhs
  base_price_cr?: number; // in Crores
  buy_price?: number; // in Lakhs (when bought)
  buy_price_cr?: number; // in Crores (when bought)
  auction_status?: "ON_BLOCK" | "SOLD" | "UPCOMING" | "UNSOLD";
  sold_to?: string;
  sold_price?: number;
  sold_price_cr?: number;
  primary_slot?: number | number[];
  role?: string;
  is_wicketkeeper?: boolean;
  is_bowling_option?: boolean;
  bowling_type?: string;
  has_ipl_stats?: boolean;
  stats?: any;
  domestic_fallback?: DomesticFallback;
  badges?: string[];
  avatar?: string;
}

export interface SlotBreakdown {
  slot: number;
  player_id: string;
  player_name: string;
  category: string;
  role: string;
  is_overseas: boolean;
  is_discounted: boolean;
  affinity: number;
  slot_score: number;
}

export interface Penalty {
  type: string;
  reason: string;
  deduction: number;
}

export interface CaptainInfo {
  player_id: string;
  name: string;
  avatar?: string;
  ipl_matches: number;
  ipl_wins: number;
  ipl_win_pct: number;
  smat_matches: number;
  smat_wins: number;
  smat_win_pct: number;
  effective_win_pct: number;
  experience_source: string;
  captaincy_rating: number; // 0 to 100
  tier: string;
  trophies: string[];
  tactical_style: string;
  leadership_bonus: number;
  analysis: string;
  team_id?: string;
  team_name?: string;
  tournament_name?: string;
  tournament_team?: string;
  domestic_matches?: number;
  domestic_wins?: number;
  domestic_win_pct?: number;
  domestic_fallback_applied?: boolean;
}

export interface CaptainMatchup {
  ranked_captains: CaptainInfo[];
  best_captain?: CaptainInfo;
  head_to_head_notes: string[];
}

export interface EvaluationResult {
  team_id: string;
  team_name: string;
  captain_id?: string | null;
  captain_info?: CaptainInfo | null;
  captain_bonus?: number;
  total_score: number;
  batting_score: number;
  bowling_score: number;
  balance_score: number;
  bench_score: number;
  penalty_deductions: number;
  penalties: Penalty[];
  warnings: string[];
  is_eliminated?: boolean;
  elimination_reason?: string | null;
  phases: {
    batting: {
      powerplay: number;
      middle: number;
      death: number;
    };
    bowling: {
      powerplay: number;
      middle: number;
      death: number;
    };
  };
  slot_breakdown: SlotBreakdown[];
  strengths: string[];
  weaknesses: string[];
}

export interface Team {
  team_id: string;
  name: string;
  owner_name?: string;
  is_bot: boolean;
  color: string;
  budget: number; // in Lakhs
  marquee_spent: number; // in Lakhs
  players_count: number;
  overseas_count: number;
  players: Player[];
  playing_xi: string[]; // player IDs (11 slots)
  bench: string[]; // player IDs (up to 7 slots)
  captain_id?: string | null;
  captain_info?: CaptainInfo | null;
  lineup_submitted: boolean;
  evaluation_result?: EvaluationResult | null;
  is_eliminated?: boolean;
  elimination_reason?: string | null;
}

export interface BidRecord {
  team_id: string;
  team_name: string;
  amount: number;
  timestamp: number;
}

export interface NewsItem {
  headline: string;
  news_body: string;
  news_type: "STEAL" | "BIDDING_WAR" | "RECORD_BREAKER" | "HAMMER_DRAMA" | "TACTICAL_BUY" | "UNSOLD";
  badge: string;
  buyer_name: string;
  buyer_slogan: string;
  rival_name?: string | null;
  amount_cr: number;
  player_name: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_team?: string | null;
  sender_color: string;
  is_host: boolean;
  text: string;
  timestamp: number;
}

export interface FeedMessage {
  message: string;
  timestamp: number;
  news?: NewsItem;
}

export interface RankingItem {
  team_name: string;
  rank: number;
  score: number;
  verdict_tagline?: string;
  is_eliminated?: boolean;
}

export interface KeyPerformer {
  player_name: string;
  team_name: string;
  role: string;
  impact_reason: string;
}

export interface VerdictData {
  winner: string;
  runner_up: string;
  rankings: RankingItem[];
  match_verdict: string;
  key_performers: KeyPerformer[];
  captain_matchup?: CaptainMatchup;
}

export interface PoolSummary {
  pool_name: string;
  total_players: number;
  sold_count: number;
  unsold_count: number;
  remaining_count: number;
  is_current: boolean;
  is_completed: boolean;
}

export interface SetTransition {
  previous_set: string | null;
  current_set: string;
  message: string;
  timestamp: number;
}

export interface RoomState {
  room_id: string;
  name: string;
  status: "LOBBY" | "AUCTION_ACTIVE" | "AUCTION_COMPLETED" | "LINEUP_PHASE" | "EVALUATED";
  teams: Record<string, Team>;
  current_player: Player | null;
  current_player_index: number;
  total_players_in_queue: number;
  current_bid: number;
  highest_bidder_id: string | null;
  highest_bidder_name: string | null;
  timer: number;
  bid_history: BidRecord[];
  auction_feed: FeedMessage[];
  passed_teams: string[];
  verdict_data: VerdictData | null;
  captain_matchup?: CaptainMatchup | null;
  latest_news?: NewsItem | null;
  current_pool?: string;
  latest_set_transition?: SetTransition | null;
  upcoming_players?: Player[];
  current_set_players?: Player[];
  pools_summary?: PoolSummary[];
  lineup_timer?: number;
  chat_messages?: ChatMessage[];
}
