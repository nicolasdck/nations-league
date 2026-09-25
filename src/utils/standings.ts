import {
	LEAGUE_A_CROSS_GROUP,
	POSITION_OUTCOMES,
	type Outcome,
} from '../data/competition';
import type { Group, Match, TeamsById } from '../types/competition';

export type FormResult = 'W' | 'D' | 'L';

export type StandingRow = {
	teamId: string;
	position: number;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	goalDifference: number;
	points: number;
	awayGoals: number;
	awayWins: number;
	form: FormResult[];
};

// Résultat minimal nécessaire au calcul : un match réel terminé, un match en
// cours (score actuel) ou un match simulé par le moteur de projection.
export type ScoredFixture = {
	homeTeamId: string;
	awayTeamId: string;
	homeScore: number;
	awayScore: number;
	kickoffAt: string;
};

type Stats = Omit<StandingRow, 'position' | 'form'>;

function emptyStats(teamId: string): Stats {
	return {
		teamId,
		played: 0,
		won: 0,
		drawn: 0,
		lost: 0,
		goalsFor: 0,
		goalsAgainst: 0,
		goalDifference: 0,
		points: 0,
		awayGoals: 0,
		awayWins: 0,
	};
}

function accumulate(teamIds: string[], fixtures: ScoredFixture[]): Map<string, Stats> {
	const table = new Map<string, Stats>(teamIds.map((id) => [id, emptyStats(id)]));
	for (const f of fixtures) {
		const home = table.get(f.homeTeamId);
		const away = table.get(f.awayTeamId);
		if (!home || !away) continue;

		home.played += 1;
		away.played += 1;
		home.goalsFor += f.homeScore;
		home.goalsAgainst += f.awayScore;
		away.goalsFor += f.awayScore;
		away.goalsAgainst += f.homeScore;
		away.awayGoals += f.awayScore;

		if (f.homeScore > f.awayScore) {
			home.won += 1;
			home.points += 3;
			away.lost += 1;
		} else if (f.homeScore < f.awayScore) {
			away.won += 1;
			away.awayWins += 1;
			away.points += 3;
			home.lost += 1;
		} else {
			home.drawn += 1;
			away.drawn += 1;
			home.points += 1;
			away.points += 1;
		}
	}
	for (const s of table.values()) s.goalDifference = s.goalsFor - s.goalsAgainst;
	return table;
}

// Découpe une liste déjà triée en paquets d'éléments égaux selon `key`.
function clusters<T>(sorted: T[], key: (item: T) => string): T[][] {
	const result: T[][] = [];
	for (const item of sorted) {
		const last = result[result.length - 1];
		if (last && key(last[0]) === key(item)) last.push(item);
		else result.push([item]);
	}
	return result;
}

// Critères e) à i) du règlement + repli sur la liste d'accès (pot puis force).
function compareOverall(a: Stats, b: Stats, teams: TeamsById): number {
	return (
		b.goalDifference - a.goalDifference ||
		b.goalsFor - a.goalsFor ||
		b.awayGoals - a.awayGoals ||
		b.won - a.won ||
		b.awayWins - a.awayWins ||
		(teams[a.teamId]?.pot ?? 9) - (teams[b.teamId]?.pot ?? 9) ||
		(teams[b.teamId]?.strength ?? 0) - (teams[a.teamId]?.strength ?? 0) ||
		a.teamId.localeCompare(b.teamId)
	);
}

// Critères a) à d) : confrontations directes entre équipes à égalité de points,
// réappliquées au sous-ensemble encore à égalité. Si les confrontations directes
// ne séparent plus personne, on passe aux critères généraux.
function rankTied(
	tiedIds: string[],
	fixtures: ScoredFixture[],
	overall: Map<string, Stats>,
	teams: TeamsById,
): string[] {
	if (tiedIds.length <= 1) return tiedIds;

	const tiedSet = new Set(tiedIds);
	const h2hFixtures = fixtures.filter(
		(f) => tiedSet.has(f.homeTeamId) && tiedSet.has(f.awayTeamId),
	);
	const h2h = accumulate(tiedIds, h2hFixtures);
	const h2hKey = (id: string) => {
		const s = h2h.get(id)!;
		return `${s.points}|${s.goalDifference}|${s.goalsFor}`;
	};
	const sorted = [...tiedIds].sort((a, b) => {
		const sa = h2h.get(a)!;
		const sb = h2h.get(b)!;
		return (
			sb.points - sa.points ||
			sb.goalDifference - sa.goalDifference ||
			sb.goalsFor - sa.goalsFor
		);
	});
	const groups = clusters(sorted, h2hKey);

	if (groups.length === 1) {
		return [...tiedIds].sort((a, b) =>
			compareOverall(overall.get(a)!, overall.get(b)!, teams),
		);
	}
	return groups.flatMap((g) => rankTied(g, fixtures, overall, teams));
}

function formOf(teamId: string, fixtures: ScoredFixture[]): FormResult[] {
	return fixtures
		.filter((f) => f.homeTeamId === teamId || f.awayTeamId === teamId)
		.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))
		.slice(-5)
		.map((f) => {
			const isHome = f.homeTeamId === teamId;
			const own = isHome ? f.homeScore : f.awayScore;
			const other = isHome ? f.awayScore : f.homeScore;
			return own > other ? 'W' : own < other ? 'L' : 'D';
		});
}

export function computeStandings(
	teamIds: string[],
	fixtures: ScoredFixture[],
	teams: TeamsById,
): StandingRow[] {
	const overall = accumulate(teamIds, fixtures);
	const byPoints = [...teamIds].sort(
		(a, b) => overall.get(b)!.points - overall.get(a)!.points,
	);
	const ordered = clusters(byPoints, (id) => String(overall.get(id)!.points)).flatMap(
		(tied) => rankTied(tied, fixtures, overall, teams),
	);
	return ordered.map((teamId, index) => ({
		...overall.get(teamId)!,
		position: index + 1,
		form: formOf(teamId, fixtures),
	}));
}

// Matchs de groupe comptabilisés : terminés, et en cours si `includeLive`
// (classement « live »).
export function groupFixtures(
	group: Group,
	matches: Match[],
	includeLive: boolean,
): ScoredFixture[] {
	return matches.flatMap((m) => {
		if (m.stage !== 'GROUP' || m.groupId !== group.id) return [];
		if (!m.homeTeamId || !m.awayTeamId) return [];
		if (m.homeScore === null || m.awayScore === null) return [];
		const counts =
			m.status === 'FT' || (includeLive && (m.status === 'LIVE' || m.status === 'HT'));
		if (!counts) return [];
		return [
			{
				homeTeamId: m.homeTeamId,
				awayTeamId: m.awayTeamId,
				homeScore: m.homeScore,
				awayScore: m.awayScore,
				kickoffAt: m.kickoffAt,
			},
		];
	});
}

// Classement de rangs identiques issus de groupes différents (critères
// points, différence de buts, buts marqués, buts à l'extérieur, victoires,
// victoires à l'extérieur, puis liste d'accès).
export function rankAcrossGroups(rows: StandingRow[], teams: TeamsById): StandingRow[] {
	return [...rows].sort(
		(a, b) => b.points - a.points || compareOverall(a, b, teams),
	);
}

// Issue de chaque équipe d'une ligue d'après les classements fournis
// (actuels ou projetés).
export function computeOutcomes(
	groups: Group[],
	standingsByGroup: Record<string, StandingRow[]>,
	teams: TeamsById,
): Record<string, Outcome> {
	const outcomes: Record<string, Outcome> = {};

	for (const group of groups) {
		const rows = standingsByGroup[group.id] ?? [];
		rows.forEach((row) => {
			outcomes[row.teamId] =
				POSITION_OUTCOMES[group.league][row.position - 1] ?? 'stay';
		});
	}

	const leagueA = groups.filter((g) => g.league === 'A');
	for (const position of [3, 4] as const) {
		const rows = leagueA.flatMap((g) =>
			(standingsByGroup[g.id] ?? []).filter((r) => r.position === position),
		);
		rankAcrossGroups(rows, teams).forEach((row, index) => {
			outcomes[row.teamId] = LEAGUE_A_CROSS_GROUP[position][index] ?? 'stay';
		});
	}

	return outcomes;
}
