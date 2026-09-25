/**
 * Cœur de la synchronisation Ligue des Nations (API publique ESPN → Supabase).
 * Sans dépendance d'exécution : utilisé tel quel par l'Edge Function Deno
 * `sync-nations-league` (pg_cron) et par le script Node `scripts/sync-nations-league.ts`.
 *
 * Seules les lignes réellement modifiées sont écrites : chaque UPDATE déclenche
 * un événement Realtime chez tous les clients et, si un score augmente, le
 * trigger SQL matches_goal_alert (notification push).
 *
 * Sofascore n'est pas utilisable : il renvoie HTTP 403 à tout client
 * non-navigateur (empreinte TLS), y compris depuis une IP résidentielle.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, MatchStage, MatchStatus, Tables, TablesInsert } from './database.types.ts';

export type SyncClient = SupabaseClient<Database>;
// full : tout le calendrier de la saison + classements (groupes).
// live : seulement les matchs de la veille et du jour (UTC), sans classements —
//        1 à 2 appels ESPN au lieu de 6, suffisant pendant les matchs.
export type SyncScope = 'full' | 'live';
export type SyncOptions = {
	scope?: SyncScope;
	dryRun?: boolean;
	log?: (line: string) => void;
	warn?: (line: string) => void;
};
export type SyncSummary = { fetched: number; changed: number; errors: number };

const ESPN_API = 'https://site.api.espn.com/apis';
const LEAGUE_SLUG = 'uefa.nations';
// Mois couvrant la saison 2026-27 : phase de ligue (sept.–nov. 2026),
// quarts et barrages (mars 2027), Final Four (juin 2027).
const SEASON_MONTHS = ['202609', '202610', '202611', '202703', '202706'];

// Fenêtres officielles des 6 journées (dates UTC incluses). Un match reporté
// hors fenêtre n'a pas de numéro de journée.
const MATCHDAY_WINDOWS: [string, string][] = [
	['2026-09-24', '2026-09-26'],
	['2026-09-27', '2026-09-29'],
	['2026-10-01', '2026-10-03'],
	['2026-10-04', '2026-10-06'],
	['2026-11-12', '2026-11-14'],
	['2026-11-15', '2026-11-17'],
];

// Mode « live » : on ne sollicite ESPN que si un match est en cours, commence
// dans moins de 15 min, ou aurait dû commencer il y a moins de 3 h sans être
// encore passé LIVE/FT en base.
const PRE_KICKOFF_MS = 15 * 60_000;
const POST_KICKOFF_MS = 3 * 60 * 60_000;

// ---------------------------------------------------------------------------
// Types ESPN (sous-ensemble utilisé)
// ---------------------------------------------------------------------------

type EspnTeam = {
	id: string;
	displayName: string;
	shortDisplayName?: string;
	abbreviation?: string;
};

type EspnCompetitor = {
	homeAway: 'home' | 'away';
	winner?: boolean;
	score?: string;
	shootoutScore?: number;
	team: EspnTeam;
};

type EspnDetail = {
	scoringPlay?: boolean;
	shootout?: boolean;
	ownGoal?: boolean;
	penaltyKick?: boolean;
	clock?: { displayValue?: string };
	team?: { id: string };
	athletesInvolved?: { displayName?: string; shortName?: string }[];
};

type EspnStatus = {
	displayClock?: string;
	type: { name: string; state: 'pre' | 'in' | 'post'; completed?: boolean };
};

type EspnEvent = {
	id: string;
	date: string;
	season?: { slug?: string };
	competitions: {
		status: EspnStatus;
		venue?: { fullName?: string };
		competitors: EspnCompetitor[];
		details?: EspnDetail[];
	}[];
};

type EspnScoreboard = { events?: EspnEvent[] };

type EspnStandings = {
	children?: {
		name: string;
		standings?: { entries?: { team: EspnTeam }[] };
	}[];
};

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function getJson<T>(path: string, warn: (line: string) => void, maxRetries = 3): Promise<T> {
	const url = `${ESPN_API}${path}`;
	for (let attempt = 1; ; attempt++) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15_000);
		try {
			const res = await fetch(url, {
				signal: controller.signal,
				headers: { Accept: 'application/json', 'User-Agent': 'NationsLeaguePWA/1.0' },
			});
			if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
			return (await res.json()) as T;
		} catch (error) {
			if (attempt >= maxRetries) throw error;
			const delay = 1000 * 2 ** (attempt - 1);
			warn(`Tentative ${attempt}/${maxRetries} échouée (${String(error)}), nouvel essai dans ${delay} ms`);
			await sleep(delay);
		} finally {
			clearTimeout(timeout);
		}
	}
}

const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

// `dates` accepte un mois (YYYYMM) ou un jour (YYYYMMDD), pas une plage.
async function fetchEvents(scope: SyncScope, warn: (line: string) => void): Promise<EspnEvent[]> {
	const now = Date.now();
	const dates = scope === 'full' ? SEASON_MONTHS : [...new Set([utcDay(now - 24 * 60 * 60_000), utcDay(now)])];
	const pages = await Promise.all(
		dates.map((date) =>
			getJson<EspnScoreboard>(`/site/v2/sports/soccer/${LEAGUE_SLUG}/scoreboard?dates=${date}&limit=300`, warn),
		),
	);
	const byId = new Map<string, EspnEvent>();
	for (const page of pages) for (const event of page.events ?? []) byId.set(event.id, event);
	return [...byId.values()];
}

// ---------------------------------------------------------------------------
// Résolution des équipes
// ---------------------------------------------------------------------------

type TeamRow = Tables<'teams'>;
type MatchRow = Tables<'matches'>;
type MatchPayload = TablesInsert<'matches'> & {
	stage: MatchStage;
	status: MatchStatus;
	kickoff_at: string;
};

const normalize = (value: string) =>
	value
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, 'and')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();

function buildTeamResolver(teams: TeamRow[]) {
	const byEspnId = new Map<number, TeamRow>();
	const byName = new Map<string, TeamRow>();
	for (const team of teams) {
		if (team.espn_id) byEspnId.set(team.espn_id, team);
		for (const name of [team.id, team.name_en, team.name, ...team.aliases]) byName.set(normalize(name), team);
	}
	const learned = new Map<string, number>();
	const unresolved = new Set<string>();

	const resolve = (espn: EspnTeam): TeamRow | null => {
		const espnId = Number(espn.id);
		const known = byEspnId.get(espnId);
		if (known) return known;
		const match =
			[espn.displayName, espn.shortDisplayName, espn.abbreviation]
				.filter((n): n is string => Boolean(n))
				.map((n) => byName.get(normalize(n)))
				.find(Boolean) ?? null;
		if (match) {
			if (match.espn_id !== espnId) learned.set(match.id, espnId);
			byEspnId.set(espnId, match);
		} else {
			unresolved.add(`${espn.displayName} (${espn.abbreviation ?? '?'})`);
		}
		return match;
	};
	return { resolve, learned, unresolved };
}

// ---------------------------------------------------------------------------
// Transformation
// ---------------------------------------------------------------------------

const STAGE_BY_SLUG: Record<string, MatchStage> = {
	'group-stage': 'GROUP',
	quarterfinals: 'QF',
	semifinals: 'SF',
	'3rd-place-match': 'THIRD',
	final: 'F',
	'relegation-playoffs': 'PO',
};

function mapStatus(status: EspnStatus): MatchStatus {
	const name = status.type.name;
	if (name === 'STATUS_POSTPONED' || name === 'STATUS_DELAYED') return 'PST';
	if (name === 'STATUS_CANCELED' || name === 'STATUS_ABANDONED' || name === 'STATUS_FORFEIT') return 'CANC';
	if (status.type.state === 'pre') return 'NS';
	if (status.type.state === 'post') return 'FT';
	return name === 'STATUS_HALFTIME' ? 'HT' : 'LIVE';
}

// "63'" ou "45'+2'" → 63 / 45
function parseMinute(displayClock: string | undefined): number | null {
	const match = displayClock ? /^(\d+)/.exec(displayClock) : null;
	return match ? Number(match[1]) : null;
}

function parseScore(value: string | undefined): number | null {
	if (value === undefined || value === '') return null;
	const n = Number(value);
	return Number.isInteger(n) ? n : null;
}

function scorerLabel(detail: EspnDetail): string {
	const athlete = detail.athletesInvolved?.[0];
	const name = athlete?.shortName ?? athlete?.displayName ?? 'But';
	const minute = detail.clock?.displayValue ?? '';
	const suffix = detail.ownGoal ? ' (c.s.c.)' : detail.penaltyKick ? ' (sp)' : '';
	return `${name} ${minute}${suffix}`.trim();
}

function matchdayOf(kickoffIso: string): number | null {
	const day = kickoffIso.slice(0, 10);
	const index = MATCHDAY_WINDOWS.findIndex(([from, to]) => day >= from && day <= to);
	return index >= 0 ? index + 1 : null;
}

// Numéro de manche des confrontations aller/retour (quarts, barrages).
function computeLegs(events: EspnEvent[]): Map<string, number> {
	const ties = new Map<string, EspnEvent[]>();
	for (const event of events) {
		const stage = STAGE_BY_SLUG[event.season?.slug ?? ''];
		if (stage !== 'QF' && stage !== 'PO') continue;
		const key = event.competitions[0].competitors
			.map((c) => c.team.id)
			.sort()
			.join('-');
		ties.set(key, [...(ties.get(key) ?? []), event]);
	}
	const legs = new Map<string, number>();
	for (const tie of ties.values()) {
		tie
			.sort((a, b) => a.date.localeCompare(b.date))
			.forEach((event, index) => legs.set(event.id, index + 1));
	}
	return legs;
}

function toPayload(
	event: EspnEvent,
	resolve: (team: EspnTeam) => TeamRow | null,
	groupOf: (teamId: string) => string | null,
	legs: Map<string, number>,
	warn: (line: string) => void,
): MatchPayload | null {
	const competition = event.competitions[0];
	const homeC = competition.competitors.find((c) => c.homeAway === 'home');
	const awayC = competition.competitors.find((c) => c.homeAway === 'away');
	if (!homeC || !awayC) return null;

	const stage = STAGE_BY_SLUG[event.season?.slug ?? ''];
	if (!stage) {
		warn(`Événement ${event.id} ignoré : phase inconnue (${event.season?.slug ?? 'aucune'})`);
		return null;
	}

	const home = resolve(homeC.team);
	const away = resolve(awayC.team);
	const kickoffAt = new Date(event.date).toISOString();

	let groupId: string | null = null;
	if (stage === 'GROUP') {
		const homeGroup = home ? groupOf(home.id) : null;
		groupId = homeGroup && away && groupOf(away.id) === homeGroup ? homeGroup : null;
		if (!groupId) {
			warn(`Événement ${event.id} ignoré : groupe introuvable (${homeC.team.displayName} - ${awayC.team.displayName})`);
			return null;
		}
	}

	const status = mapStatus(competition.status);
	const started = status === 'LIVE' || status === 'HT' || status === 'FT';
	const isLive = status === 'LIVE' || status === 'HT';

	const goals = (competition.details ?? []).filter((d) => d.scoringPlay && !d.shootout);
	const scorersOf = (c: EspnCompetitor) => goals.filter((d) => d.team?.id === c.team.id).map(scorerLabel);

	// Au match retour, ESPN met `winner` sur l'équipe qualifiée (cumul, t.a.b.).
	const winner = status === 'FT' ? competition.competitors.find((c) => c.winner) : undefined;
	const winnerId = winner ? (resolve(winner.team)?.id ?? null) : null;

	return {
		external_id: Number(event.id),
		stage,
		group_id: groupId,
		matchday: stage === 'GROUP' ? matchdayOf(kickoffAt) : null,
		leg: legs.get(event.id) ?? null,
		home_team_id: home?.id ?? null,
		away_team_id: away?.id ?? null,
		placeholder_home: home ? null : homeC.team.displayName,
		placeholder_away: away ? null : awayC.team.displayName,
		kickoff_at: kickoffAt,
		venue: competition.venue?.fullName ?? null,
		status,
		minute: isLive ? (status === 'HT' ? 45 : parseMinute(competition.status.displayClock)) : null,
		home_score: started ? parseScore(homeC.score) : null,
		away_score: started ? parseScore(awayC.score) : null,
		home_penalty_score: started ? (homeC.shootoutScore ?? null) : null,
		away_penalty_score: started ? (awayC.shootoutScore ?? null) : null,
		home_scorers: started ? scorersOf(homeC) : [],
		away_scorers: started ? scorersOf(awayC) : [],
		winner_id: winnerId,
	};
}

const COMPARED_FIELDS = [
	'stage',
	'group_id',
	'matchday',
	'leg',
	'home_team_id',
	'away_team_id',
	'placeholder_home',
	'placeholder_away',
	'venue',
	'status',
	'minute',
	'home_score',
	'away_score',
	'home_penalty_score',
	'away_penalty_score',
	'winner_id',
] as const satisfies readonly (keyof MatchPayload & keyof MatchRow)[];

function hasChanged(next: MatchPayload, current: MatchRow | undefined): boolean {
	if (!current) return true;
	if (new Date(current.kickoff_at).getTime() !== new Date(next.kickoff_at).getTime()) return true;
	if ((next.home_scorers ?? []).join('|') !== current.home_scorers.join('|')) return true;
	if ((next.away_scorers ?? []).join('|') !== current.away_scorers.join('|')) return true;
	return COMPARED_FIELDS.some((field) => (next[field] ?? null) !== (current[field] ?? null));
}

function describe(change: MatchPayload): string {
	const home = change.home_team_id ?? change.placeholder_home;
	const away = change.away_team_id ?? change.placeholder_away;
	const scorers = [...(change.home_scorers ?? []), ...(change.away_scorers ?? [])];
	return `${change.stage}${change.group_id ? ` ${change.group_id}` : ''}${change.matchday ? ` J${change.matchday}` : ''}${
		change.leg ? ` (manche ${change.leg})` : ''
	} ${change.kickoff_at.slice(0, 16)} ${home} ${change.home_score ?? '-'}-${change.away_score ?? '-'} ${away} [${change.status}${
		change.minute ? ` ${change.minute}'` : ''
	}]${scorers.length ? ` ⚽ ${scorers.join(', ')}` : ''}`;
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

// Vrai si un appel à ESPN est utile maintenant (mode « live » du cron).
export async function hasActiveOrImminentMatch(supabase: SyncClient): Promise<boolean> {
	const now = Date.now();
	const { count, error } = await supabase
		.from('matches')
		.select('id', { count: 'exact', head: true })
		.or(
			[
				'status.in.(LIVE,HT)',
				`and(status.eq.NS,kickoff_at.gte.${new Date(now - POST_KICKOFF_MS).toISOString()},kickoff_at.lte.${new Date(now + PRE_KICKOFF_MS).toISOString()})`,
			].join(','),
		);
	if (error) throw error;
	return (count ?? 0) > 0;
}

export async function runSync(supabase: SyncClient, options: SyncOptions = {}): Promise<SyncSummary> {
	const scope = options.scope ?? 'full';
	const dryRun = options.dryRun ?? false;
	const log = options.log ?? console.log;
	const warn = options.warn ?? console.warn;
	const prefix = dryRun ? '[dry-run] ' : '';
	let errors = 0;

	const [{ data: teams, error: teamsError }, { data: existing, error: matchesError }] = await Promise.all([
		supabase.from('teams').select('*'),
		supabase.from('matches').select('*'),
	]);
	if (teamsError) throw teamsError;
	if (matchesError) throw matchesError;

	const [events, standings] = await Promise.all([
		fetchEvents(scope, warn),
		scope === 'full'
			? getJson<EspnStandings>(`/v2/sports/soccer/${LEAGUE_SLUG}/standings`, warn)
			: Promise.resolve<EspnStandings>({}),
	]);
	log(`${events.length} matchs ESPN récupérés`);

	const { resolve, learned, unresolved } = buildTeamResolver(teams);

	// Groupes : les classements ESPN font foi.
	const groupByTeam = new Map(teams.map((t) => [t.id, t.group_id ?? '']));
	for (const child of standings.children ?? []) {
		const match = /group\s*([a-d])\s*(\d)/i.exec(child.name);
		if (!match) continue;
		const groupId = `${match[1].toUpperCase()}${match[2]}`;
		for (const entry of child.standings?.entries ?? []) {
			const team = resolve(entry.team);
			if (!team || groupByTeam.get(team.id) === groupId) continue;
			log(`${prefix}Groupe de ${team.id} : ${team.group_id ?? '-'} → ${groupId}`);
			groupByTeam.set(team.id, groupId);
			if (!dryRun) {
				const { error } = await supabase.from('teams').update({ group_id: groupId }).eq('id', team.id);
				if (error) {
					errors++;
					warn(`Mise à jour du groupe de ${team.id} impossible : ${error.message}`);
				}
			}
		}
	}
	const groupOf = (teamId: string) => groupByTeam.get(teamId) || null;

	const legs = computeLegs(events);
	const existingByExternal = new Map(existing.map((m) => [m.external_id, m]));
	const changes = events
		.map((event) => toPayload(event, resolve, groupOf, legs, warn))
		.filter((p): p is MatchPayload => p !== null)
		.map((p) => {
			// En mode live, l'aller d'une confrontation n'est pas dans la fenêtre
			// lue : le numéro de manche calculé serait faux, on garde celui en base.
			const stored = existingByExternal.get(p.external_id)?.leg;
			return scope === 'live' && stored != null ? { ...p, leg: stored } : p;
		})
		.filter((p) => hasChanged(p, existingByExternal.get(p.external_id)));

	for (const [teamId, espnId] of learned) {
		log(`${prefix}Association équipe ${teamId} ↔ ESPN #${espnId}`);
		if (!dryRun) {
			const { error } = await supabase.from('teams').update({ espn_id: espnId }).eq('id', teamId);
			if (error) {
				errors++;
				warn(`Mise à jour espn_id de ${teamId} impossible : ${error.message}`);
			}
		}
	}
	if (unresolved.size > 0) warn(`Équipes ESPN non reconnues : ${[...unresolved].join(', ')}`);

	if (changes.length === 0) {
		log('Aucun changement.');
		return { fetched: events.length, changed: 0, errors };
	}

	for (const change of changes) log(`${prefix}${describe(change)}`);

	if (!dryRun) {
		// Une ligne à la fois : chaque UPDATE doit passer par le trigger « but »
		// avec sa propre ancienne valeur, et une erreur n'empêche pas les autres.
		for (const change of changes) {
			const { error } = await supabase.from('matches').upsert(change, { onConflict: 'external_id' });
			if (error) {
				errors++;
				warn(`Écriture du match ${change.external_id} impossible : ${error.message}`);
			}
		}
	}
	log(`${changes.length} match(s) ${dryRun ? 'à écrire' : 'écrits'}${errors ? `, ${errors} erreur(s)` : ''}.`);
	return { fetched: events.length, changed: changes.length, errors };
}
