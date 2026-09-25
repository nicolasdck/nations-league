import type {
	LeagueCode,
	MatchStage,
	MatchStatus,
	NotificationLevel,
	Tables,
} from '../lib/database.types';

export type { LeagueCode, MatchStage, MatchStatus, NotificationLevel };

export type Team = {
	id: string;
	name: string;
	flag: string;
	primaryColor: string;
	secondaryColor: string;
	darkColor: string;
	groupId: string | null;
	pot: number;
	strength: number;
};

export type Group = {
	id: string;
	league: LeagueCode;
	number: number;
	teamIds: string[];
};

export type Match = {
	id: number;
	stage: MatchStage;
	groupId: string | null;
	matchday: number | null;
	leg: number | null;
	homeTeamId: string | null;
	awayTeamId: string | null;
	placeholderHome: string | null;
	placeholderAway: string | null;
	kickoffAt: string;
	venue: string | null;
	status: MatchStatus;
	minute: number | null;
	homeScore: number | null;
	awayScore: number | null;
	homePenaltyScore: number | null;
	awayPenaltyScore: number | null;
	homeScorers: string[];
	awayScorers: string[];
	winnerId: string | null;
	updatedAt: string;
};

export type TeamsById = Record<string, Team>;

export function mapTeamRow(row: Tables<'teams'>): Team {
	return {
		id: row.id,
		name: row.name,
		flag: row.flag,
		primaryColor: row.primary_color,
		secondaryColor: row.secondary_color,
		darkColor: row.dark_color,
		groupId: row.group_id,
		pot: row.pot,
		strength: row.strength,
	};
}

export function mapMatchRow(row: Tables<'matches'>): Match {
	return {
		id: row.id,
		stage: row.stage,
		groupId: row.group_id,
		matchday: row.matchday,
		leg: row.leg,
		homeTeamId: row.home_team_id,
		awayTeamId: row.away_team_id,
		placeholderHome: row.placeholder_home,
		placeholderAway: row.placeholder_away,
		kickoffAt: row.kickoff_at,
		venue: row.venue,
		status: row.status,
		minute: row.minute,
		homeScore: row.home_score,
		awayScore: row.away_score,
		homePenaltyScore: row.home_penalty_score,
		awayPenaltyScore: row.away_penalty_score,
		homeScorers: row.home_scorers,
		awayScorers: row.away_scorers,
		winnerId: row.winner_id,
		updatedAt: row.updated_at,
	};
}

export function isLive(match: Match): boolean {
	return match.status === 'LIVE' || match.status === 'HT';
}

export function isPlayed(match: Match): boolean {
	return (
		match.status === 'FT' && match.homeScore !== null && match.awayScore !== null
	);
}
