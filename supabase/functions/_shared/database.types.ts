// Mirrors supabase/migrations/*.sql, in the shape produced by
// `supabase gen types typescript`. Partagé entre l'app (src/lib), le script
// Node (scripts/) et les Edge Functions (Deno).
// Régénérer avec `npx supabase gen types typescript --linked` après chaque
// changement de schéma (en conservant ce chemin).

export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export type LeagueCode = 'A' | 'B' | 'C' | 'D';
export type MatchStatus = 'NS' | 'LIVE' | 'HT' | 'FT' | 'PST' | 'CANC';
export type MatchStage = 'GROUP' | 'QF' | 'SF' | 'THIRD' | 'F' | 'PO';
export type NotificationLevel = 'favorite' | 'all' | 'none';

export type Database = {
	public: {
		Tables: {
			groups: {
				Row: {
					id: string;
					league: LeagueCode;
					number: number;
				};
				Insert: {
					id: string;
					league: LeagueCode;
					number: number;
				};
				Update: {
					id?: string;
					league?: LeagueCode;
					number?: number;
				};
				Relationships: [];
			};
			teams: {
				Row: {
					id: string;
					name: string;
					name_en: string;
					aliases: string[];
					flag: string;
					primary_color: string;
					secondary_color: string;
					dark_color: string;
					group_id: string | null;
					pot: number;
					strength: number;
					espn_id: number | null;
				};
				Insert: {
					id: string;
					name: string;
					name_en: string;
					aliases?: string[];
					flag: string;
					primary_color: string;
					secondary_color: string;
					dark_color?: string;
					group_id?: string | null;
					pot: number;
					strength: number;
					espn_id?: number | null;
				};
				Update: {
					id?: string;
					name?: string;
					name_en?: string;
					aliases?: string[];
					flag?: string;
					primary_color?: string;
					secondary_color?: string;
					dark_color?: string;
					group_id?: string | null;
					pot?: number;
					strength?: number;
					espn_id?: number | null;
				};
				Relationships: [
					{
						foreignKeyName: 'teams_group_id_fkey';
						columns: ['group_id'];
						isOneToOne: false;
						referencedRelation: 'groups';
						referencedColumns: ['id'];
					},
				];
			};
			matches: {
				Row: {
					id: number;
					external_id: number;
					stage: MatchStage;
					group_id: string | null;
					matchday: number | null;
					leg: number | null;
					home_team_id: string | null;
					away_team_id: string | null;
					placeholder_home: string | null;
					placeholder_away: string | null;
					kickoff_at: string;
					venue: string | null;
					status: MatchStatus;
					minute: number | null;
					home_score: number | null;
					away_score: number | null;
					home_penalty_score: number | null;
					away_penalty_score: number | null;
					home_scorers: string[];
					away_scorers: string[];
					winner_id: string | null;
					updated_at: string;
				};
				Insert: {
					id?: never;
					external_id: number;
					stage: MatchStage;
					group_id?: string | null;
					matchday?: number | null;
					leg?: number | null;
					home_team_id?: string | null;
					away_team_id?: string | null;
					placeholder_home?: string | null;
					placeholder_away?: string | null;
					kickoff_at: string;
					venue?: string | null;
					status?: MatchStatus;
					minute?: number | null;
					home_score?: number | null;
					away_score?: number | null;
					home_penalty_score?: number | null;
					away_penalty_score?: number | null;
					home_scorers?: string[];
					away_scorers?: string[];
					winner_id?: string | null;
					updated_at?: string;
				};
				Update: {
					id?: never;
					external_id?: number;
					stage?: MatchStage;
					group_id?: string | null;
					matchday?: number | null;
					leg?: number | null;
					home_team_id?: string | null;
					away_team_id?: string | null;
					placeholder_home?: string | null;
					placeholder_away?: string | null;
					kickoff_at?: string;
					venue?: string | null;
					status?: MatchStatus;
					minute?: number | null;
					home_score?: number | null;
					away_score?: number | null;
					home_penalty_score?: number | null;
					away_penalty_score?: number | null;
					home_scorers?: string[];
					away_scorers?: string[];
					winner_id?: string | null;
					updated_at?: string;
				};
				Relationships: [
					{
						foreignKeyName: 'matches_group_id_fkey';
						columns: ['group_id'];
						isOneToOne: false;
						referencedRelation: 'groups';
						referencedColumns: ['id'];
					},
				];
			};
			user_preferences: {
				Row: {
					user_id: string;
					favorite_team_id: string | null;
					notification_level: NotificationLevel;
					updated_at: string;
				};
				Insert: {
					user_id: string;
					favorite_team_id?: string | null;
					notification_level?: NotificationLevel;
					updated_at?: string;
				};
				Update: {
					user_id?: string;
					favorite_team_id?: string | null;
					notification_level?: NotificationLevel;
					updated_at?: string;
				};
				Relationships: [];
			};
			push_subscriptions: {
				Row: {
					id: number;
					user_id: string;
					endpoint: string;
					subscription: Json;
					user_agent: string | null;
					created_at: string;
				};
				Insert: {
					id?: never;
					user_id: string;
					endpoint: string;
					subscription: Json;
					user_agent?: string | null;
					created_at?: string;
				};
				Update: {
					id?: never;
					user_id?: string;
					endpoint?: string;
					subscription?: Json;
					user_agent?: string | null;
					created_at?: string;
				};
				Relationships: [];
			};
			sync_status: {
				Row: {
					id: string;
					last_attempt_at: string | null;
					last_success_at: string | null;
					last_full_success_at: string | null;
					consecutive_failures: number;
					last_error: string | null;
					alerted_at: string | null;
					updated_at: string;
				};
				Insert: {
					id?: string;
					last_attempt_at?: string | null;
					last_success_at?: string | null;
					last_full_success_at?: string | null;
					consecutive_failures?: number;
					last_error?: string | null;
					alerted_at?: string | null;
					updated_at?: string;
				};
				Update: {
					id?: string;
					last_attempt_at?: string | null;
					last_success_at?: string | null;
					last_full_success_at?: string | null;
					consecutive_failures?: number;
					last_error?: string | null;
					alerted_at?: string | null;
					updated_at?: string;
				};
				Relationships: [];
			};
		};
		Views: { [_ in never]: never };
		Functions: {
			goal_alert_recipients: {
				Args: { p_home_team_id: string; p_away_team_id: string };
				Returns: { endpoint: string; subscription: Json }[];
			};
		};
		Enums: {
			league_code: LeagueCode;
			match_status: MatchStatus;
			match_stage: MatchStage;
			notification_level: NotificationLevel;
		};
		CompositeTypes: { [_ in never]: never };
	};
};

export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Insert'];
