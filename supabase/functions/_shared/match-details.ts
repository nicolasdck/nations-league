/**
 * Fiche match : normalisation du « summary » ESPN et règles de fraîcheur du
 * cache. Partagé entre l'Edge Function match-details (Deno) et l'app (types
 * + règle de péremption), sans dépendance d'exécution.
 */

export type DetailSide = 'home' | 'away';

export type MatchStat = { key: string; label: string; home: string; away: string };

export type LineupPlayer = {
	jersey: string | null;
	name: string;
	position: string | null;
	subbedIn: boolean;
	subbedOut: boolean;
	// Minute du remplacement (entrée ou sortie), si connue.
	subMinute: string | null;
};

export type Lineup = { formation: string | null; starters: LineupPlayer[]; bench: LineupPlayer[] };

export type TimelineEventType =
	| 'goal'
	| 'penalty-goal'
	| 'own-goal'
	| 'penalty-missed'
	| 'yellow-card'
	| 'red-card'
	| 'substitution'
	| 'halftime'
	| 'fulltime';

export type TimelineEvent = {
	minute: string;
	type: TimelineEventType;
	side: DetailSide | null;
	// Buteur (+ passeur), ou joueur entrant (+ sortant), ou joueur averti.
	players: string[];
};

export type FormGame = {
	date: string;
	opponent: string;
	opponentAbbr: string | null;
	atVs: string;
	score: string;
	result: 'W' | 'D' | 'L' | null;
	competition: string | null;
};

export type HeadToHeadGame = {
	date: string;
	homeAbbr: string;
	awayAbbr: string;
	homeScore: string;
	awayScore: string;
};

export type MatchDetails = {
	state: 'pre' | 'in' | 'post';
	referee: string | null;
	venue: string | null;
	city: string | null;
	attendance: number | null;
	stats: MatchStat[];
	lineups: Record<DetailSide, Lineup | null>;
	timeline: TimelineEvent[];
	form: Record<DetailSide, FormGame[]>;
	headToHead: HeadToHeadGame[];
};

// ---------------------------------------------------------------------------
// Fraîcheur du cache
// ---------------------------------------------------------------------------

const MINUTE = 60_000;

// Durée de validité d'une fiche selon l'état du match au moment de la lecture.
// Une fiche « post » récupérée plus de 30 min après la fin est définitive.
export function detailsMaxAgeMs(matchStatus: string, kickoffAt: string, fetchedAt: string): number {
	if (matchStatus === 'LIVE' || matchStatus === 'HT') return MINUTE;
	if (matchStatus === 'FT') {
		// Coup d'envoi + ~2 h 30 (prolongations comprises) + 30 min de marge.
		const settledAfter = new Date(kickoffAt).getTime() + 180 * MINUTE;
		return new Date(fetchedAt).getTime() >= settledAfter ? Number.POSITIVE_INFINITY : 5 * MINUTE;
	}
	// Avant-match : les compositions tombent ~1 h avant le coup d'envoi.
	const untilKickoff = new Date(kickoffAt).getTime() - Date.now();
	return untilKickoff < 90 * MINUTE ? 5 * MINUTE : 6 * 60 * MINUTE;
}

export function isDetailsStale(matchStatus: string, kickoffAt: string, fetchedAt: string): boolean {
	return Date.now() - new Date(fetchedAt).getTime() > detailsMaxAgeMs(matchStatus, kickoffAt, fetchedAt);
}

// ---------------------------------------------------------------------------
// Normalisation ESPN
// ---------------------------------------------------------------------------

type EspnAthlete = { displayName?: string; shortName?: string };

type EspnRosterEntry = {
	starter?: boolean;
	jersey?: string;
	athlete?: EspnAthlete;
	position?: { abbreviation?: string };
	subbedIn?: boolean;
	subbedOut?: boolean;
	plays?: { substitution?: boolean; clock?: { displayValue?: string } }[];
};

type EspnSummary = {
	header?: {
		competitions?: {
			status?: { type?: { state?: 'pre' | 'in' | 'post' } };
			competitors?: { id: string; homeAway: DetailSide }[];
		}[];
	};
	gameInfo?: {
		venue?: { fullName?: string; address?: { city?: string } };
		attendance?: number;
		officials?: { displayName?: string; position?: { name?: string } }[];
	};
	boxscore?: {
		teams?: { homeAway?: DetailSide; statistics?: { name: string; displayValue: string }[] }[];
	};
	rosters?: { homeAway?: DetailSide; formation?: string; roster?: EspnRosterEntry[] }[];
	keyEvents?: {
		type?: { type?: string };
		clock?: { displayValue?: string };
		team?: { id?: string };
		participants?: { athlete?: EspnAthlete }[];
		shootout?: boolean;
	}[];
	lastFiveGames?: {
		team?: { id?: string };
		events?: {
			gameDate?: string;
			atVs?: string;
			score?: string;
			gameResult?: string;
			competitionName?: string;
			opponent?: { displayName?: string; abbreviation?: string };
		}[];
	}[];
	seasonseries?: {
		type?: string;
		events?: {
			date?: string;
			competitors?: { homeAway?: DetailSide; score?: string; team?: { abbreviation?: string } }[];
		}[];
	}[];
};

// Statistiques retenues, dans l'ordre d'affichage.
const STAT_LABELS: [string, string][] = [
	['possessionPct', 'Possession (%)'],
	['totalShots', 'Tirs'],
	['shotsOnTarget', 'Tirs cadrés'],
	['wonCorners', 'Corners'],
	['saves', 'Arrêts'],
	['foulsCommitted', 'Fautes'],
	['offsides', 'Hors-jeu'],
	['yellowCards', 'Cartons jaunes'],
	['redCards', 'Cartons rouges'],
	['accuratePasses', 'Passes réussies'],
	['totalPasses', 'Passes'],
];

const EVENT_TYPES: Record<string, TimelineEventType> = {
	goal: 'goal',
	'goal---header': 'goal',
	'goal---free-kick': 'goal',
	'goal---volley': 'goal',
	'penalty---scored': 'penalty-goal',
	'own-goal': 'own-goal',
	'penalty---missed': 'penalty-missed',
	'penalty---saved': 'penalty-missed',
	'yellow-card': 'yellow-card',
	'red-card': 'red-card',
	substitution: 'substitution',
	halftime: 'halftime',
	'end-regular-time': 'fulltime',
};

const athleteName = (a: EspnAthlete | undefined) => a?.shortName ?? a?.displayName ?? '?';

function toLineupPlayer(entry: EspnRosterEntry): LineupPlayer {
	return {
		jersey: entry.jersey ?? null,
		name: athleteName(entry.athlete),
		position: entry.position?.abbreviation ?? null,
		subbedIn: entry.subbedIn === true,
		subbedOut: entry.subbedOut === true,
		subMinute: entry.plays?.find((p) => p.substitution)?.clock?.displayValue ?? null,
	};
}

export function normalizeSummary(raw: unknown): MatchDetails {
	const s = (typeof raw === 'object' && raw !== null ? raw : {}) as EspnSummary;
	const competition = s.header?.competitions?.[0];
	const sideByTeamId = new Map<string, DetailSide>(
		(competition?.competitors ?? []).map((c) => [c.id, c.homeAway]),
	);

	const statsBySide: Record<DetailSide, Map<string, string>> = { home: new Map(), away: new Map() };
	for (const team of s.boxscore?.teams ?? []) {
		if (!team.homeAway) continue;
		for (const stat of team.statistics ?? []) statsBySide[team.homeAway].set(stat.name, stat.displayValue);
	}
	const stats: MatchStat[] = STAT_LABELS.flatMap(([key, label]) => {
		const home = statsBySide.home.get(key);
		const away = statsBySide.away.get(key);
		return home !== undefined && away !== undefined ? [{ key, label, home, away }] : [];
	});

	const lineups: Record<DetailSide, Lineup | null> = { home: null, away: null };
	for (const roster of s.rosters ?? []) {
		if (!roster.homeAway || !roster.roster?.length) continue;
		lineups[roster.homeAway] = {
			formation: roster.formation ?? null,
			starters: roster.roster.filter((p) => p.starter).map(toLineupPlayer),
			bench: roster.roster.filter((p) => !p.starter).map(toLineupPlayer),
		};
	}

	const timeline: TimelineEvent[] = (s.keyEvents ?? []).flatMap((event) => {
		const type = EVENT_TYPES[event.type?.type ?? ''];
		if (!type || event.shootout) return [];
		return [
			{
				minute: event.clock?.displayValue ?? '',
				type,
				side: event.team?.id ? (sideByTeamId.get(event.team.id) ?? null) : null,
				players: (event.participants ?? []).map((p) => athleteName(p.athlete)),
			},
		];
	});

	const form: Record<DetailSide, FormGame[]> = { home: [], away: [] };
	for (const entry of s.lastFiveGames ?? []) {
		const side = entry.team?.id ? sideByTeamId.get(entry.team.id) : undefined;
		if (!side) continue;
		form[side] = (entry.events ?? []).map((e) => ({
			date: e.gameDate ?? '',
			opponent: e.opponent?.displayName ?? '?',
			opponentAbbr: e.opponent?.abbreviation ?? null,
			atVs: e.atVs ?? 'vs',
			score: e.score ?? '',
			result: e.gameResult === 'W' || e.gameResult === 'D' || e.gameResult === 'L' ? e.gameResult : null,
			competition: e.competitionName ?? null,
		}));
	}

	const series = (s.seasonseries ?? []).find((x) => x.type === 'head-to-head');
	const headToHead: HeadToHeadGame[] = (series?.events ?? []).flatMap((e) => {
		const home = e.competitors?.find((c) => c.homeAway === 'home');
		const away = e.competitors?.find((c) => c.homeAway === 'away');
		if (!home || !away) return [];
		return [
			{
				date: e.date ?? '',
				homeAbbr: home.team?.abbreviation ?? '?',
				awayAbbr: away.team?.abbreviation ?? '?',
				homeScore: home.score ?? '',
				awayScore: away.score ?? '',
			},
		];
	});

	const referee =
		s.gameInfo?.officials?.find((o) => o.position?.name === 'Referee')?.displayName ??
		s.gameInfo?.officials?.[0]?.displayName ??
		null;

	return {
		state: competition?.status?.type?.state ?? 'pre',
		referee,
		venue: s.gameInfo?.venue?.fullName ?? null,
		city: s.gameInfo?.venue?.address?.city ?? null,
		attendance: s.gameInfo?.attendance ? s.gameInfo.attendance : null,
		stats,
		lineups,
		timeline,
		form,
		headToHead,
	};
}
