import {
	DRAW_THRESHOLD,
	HOME_ADVANTAGE,
	PROJECTED_QUARTER_FINALS,
	PROJECTED_SEMI_FINALS,
	type Outcome,
} from '../data/competition';
import type { Group, Match, MatchStage, TeamsById } from '../types/competition';
import {
	computeOutcomes,
	computeStandings,
	rankAcrossGroups,
	type ScoredFixture,
	type StandingRow,
} from './standings';

// logical   : les matchs à venir sont prédits par l'indice de force des équipes
//             (≈ Elo + avantage du terrain) ; les matchs joués gardent leur score.
// supporter : identique, sauf que l'équipe préférée gagne tous ses matchs à venir
//             (y compris en cours : elle termine avec un but d'avance au minimum).
export type ProjectionMode = 'logical' | 'supporter';

export type ProjectedLeg = {
	homeTeamId: string;
	awayTeamId: string;
	homeScore: number;
	awayScore: number;
	isReal: boolean;
};

export type ProjectedTie = {
	id: string;
	stage: MatchStage;
	teamAId: string;
	teamBId: string;
	legs: ProjectedLeg[];
	aggregateA: number;
	aggregateB: number;
	winnerId: string;
	loserId: string;
	decidedOnPenalties: boolean;
	isPairingReal: boolean;
};

export type PathStep = {
	stage: 'GROUP' | MatchStage;
	title: string;
	detail: string;
	result: 'win' | 'loss' | 'neutral';
};

export type ProjectionResult = {
	mode: ProjectionMode;
	standingsByGroup: Record<string, StandingRow[]>;
	outcomes: Record<string, Outcome>;
	quarterFinals: ProjectedTie[];
	semiFinals: ProjectedTie[];
	thirdPlace: ProjectedTie | null;
	final: ProjectedTie | null;
	playoffsAB: ProjectedTie[];
	playoffsBC: ProjectedTie[];
	championId: string | null;
	favoritePath: PathStep[];
};

type Context = {
	mode: ProjectionMode;
	favoriteTeamId: string | null;
	teams: TeamsById;
};

// ---------------------------------------------------------------------------
// Prédiction d'un match
// ---------------------------------------------------------------------------

function favoriteSide(
	homeTeamId: string,
	awayTeamId: string,
	ctx: Context,
): 'home' | 'away' | null {
	if (ctx.mode !== 'supporter' || !ctx.favoriteTeamId) return null;
	if (homeTeamId === ctx.favoriteTeamId) return 'home';
	if (awayTeamId === ctx.favoriteTeamId) return 'away';
	return null;
}

function scoreFromGap(gap: number): [number, number] {
	const abs = Math.abs(gap);
	if (abs < DRAW_THRESHOLD) return [1, 1];
	const winnerGoals = abs >= 300 ? 3 : abs >= 150 ? 2 : 1;
	const scoreline: [number, number] = [winnerGoals, 0];
	return gap > 0 ? scoreline : [scoreline[1], scoreline[0]];
}

// Score prédit pour un match non joué. `neutral` = pas d'avantage du terrain
// (Final Four).
export function predictScore(
	homeTeamId: string,
	awayTeamId: string,
	ctx: Context,
	neutral = false,
): [number, number] {
	const fav = favoriteSide(homeTeamId, awayTeamId, ctx);
	if (fav === 'home') return [2, 0];
	if (fav === 'away') return [0, 2];

	const home = ctx.teams[homeTeamId]?.strength ?? 1500;
	const away = ctx.teams[awayTeamId]?.strength ?? 1500;
	return scoreFromGap(home + (neutral ? 0 : HOME_ADVANTAGE) - away);
}

// Match en cours : le mode logique fige le score actuel ; le mode supporter
// garantit la victoire de l'équipe préférée.
function finishLiveScore(
	homeTeamId: string,
	awayTeamId: string,
	homeScore: number,
	awayScore: number,
	ctx: Context,
): [number, number] {
	const fav = favoriteSide(homeTeamId, awayTeamId, ctx);
	if (fav === 'home') return [Math.max(homeScore, awayScore + 1), awayScore];
	if (fav === 'away') return [homeScore, Math.max(awayScore, homeScore + 1)];
	return [homeScore, awayScore];
}

function resolveMatch(match: Match, ctx: Context, neutral: boolean): ProjectedLeg | null {
	if (!match.homeTeamId || !match.awayTeamId) return null;
	const { homeTeamId, awayTeamId } = match;

	if (match.status === 'FT' && match.homeScore !== null && match.awayScore !== null) {
		return { homeTeamId, awayTeamId, homeScore: match.homeScore, awayScore: match.awayScore, isReal: true };
	}
	if (
		(match.status === 'LIVE' || match.status === 'HT') &&
		match.homeScore !== null &&
		match.awayScore !== null
	) {
		const [homeScore, awayScore] = finishLiveScore(
			homeTeamId,
			awayTeamId,
			match.homeScore,
			match.awayScore,
			ctx,
		);
		return { homeTeamId, awayTeamId, homeScore, awayScore, isReal: false };
	}
	if (match.status === 'CANC') return null;
	const [homeScore, awayScore] = predictScore(homeTeamId, awayTeamId, ctx, neutral);
	return { homeTeamId, awayTeamId, homeScore, awayScore, isReal: false };
}

// ---------------------------------------------------------------------------
// Phase de ligue
// ---------------------------------------------------------------------------

function projectGroup(group: Group, matches: Match[], ctx: Context): StandingRow[] {
	const groupMatches = matches.filter(
		(m) => m.stage === 'GROUP' && m.groupId === group.id,
	);
	const fixtures: ScoredFixture[] = [];
	const seenPairs = new Set<string>();

	for (const m of groupMatches) {
		const leg = resolveMatch(m, ctx, false);
		if (!leg) continue;
		seenPairs.add(`${leg.homeTeamId}-${leg.awayTeamId}`);
		fixtures.push({ ...leg, kickoffAt: m.kickoffAt });
	}

	// Calendrier incomplet en base : on complète l'aller-retour intégral pour
	// que la projection couvre toute la phase de ligue.
	for (const home of group.teamIds) {
		for (const away of group.teamIds) {
			if (home === away || seenPairs.has(`${home}-${away}`)) continue;
			const [homeScore, awayScore] = predictScore(home, away, ctx);
			fixtures.push({
				homeTeamId: home,
				awayTeamId: away,
				homeScore,
				awayScore,
				kickoffAt: '9999-12-31T00:00:00Z',
			});
		}
	}

	return computeStandings(group.teamIds, fixtures, ctx.teams);
}

// ---------------------------------------------------------------------------
// Confrontations à élimination directe
// ---------------------------------------------------------------------------

// Tirs au but (non modélisables) : l'équipe préférée en mode supporter, sinon
// la plus forte sur le papier.
function penaltyWinner(teamAId: string, teamBId: string, ctx: Context): string {
	if (ctx.mode === 'supporter' && ctx.favoriteTeamId) {
		if (teamAId === ctx.favoriteTeamId) return teamAId;
		if (teamBId === ctx.favoriteTeamId) return teamBId;
	}
	const a = ctx.teams[teamAId]?.strength ?? 0;
	const b = ctx.teams[teamBId]?.strength ?? 0;
	return a >= b ? teamAId : teamBId;
}

function buildTie(
	id: string,
	stage: MatchStage,
	teamAId: string,
	teamBId: string,
	legs: ProjectedLeg[],
	isPairingReal: boolean,
	realMatches: Match[],
	ctx: Context,
): ProjectedTie {
	const goalsOf = (teamId: string) =>
		legs.reduce(
			(sum, leg) =>
				sum +
				(leg.homeTeamId === teamId ? leg.homeScore : 0) +
				(leg.awayTeamId === teamId ? leg.awayScore : 0),
			0,
		);
	const aggregateA = goalsOf(teamAId);
	const aggregateB = goalsOf(teamBId);

	// Vainqueur officiel déjà connu (prolongation/tirs au but compris).
	const decisive = [...realMatches]
		.reverse()
		.find((m) => m.status === 'FT' && m.winnerId);
	const allLegsReal = legs.length > 0 && legs.every((l) => l.isReal);

	let winnerId: string;
	let decidedOnPenalties = false;
	if (allLegsReal && decisive?.winnerId) {
		winnerId = decisive.winnerId;
		decidedOnPenalties =
			aggregateA === aggregateB && decisive.homePenaltyScore !== null;
	} else if (aggregateA !== aggregateB) {
		winnerId = aggregateA > aggregateB ? teamAId : teamBId;
	} else {
		winnerId = penaltyWinner(teamAId, teamBId, ctx);
		decidedOnPenalties = true;
	}

	return {
		id,
		stage,
		teamAId,
		teamBId,
		legs,
		aggregateA,
		aggregateB,
		winnerId,
		loserId: winnerId === teamAId ? teamBId : teamAId,
		decidedOnPenalties,
		isPairingReal,
	};
}

// Matchs réels d'une confrontation (même paire d'équipes, même tour).
function realTieMatches(
	matches: Match[],
	stage: MatchStage,
	teamAId: string,
	teamBId: string,
): Match[] {
	return matches
		.filter(
			(m) =>
				m.stage === stage &&
				((m.homeTeamId === teamAId && m.awayTeamId === teamBId) ||
					(m.homeTeamId === teamBId && m.awayTeamId === teamAId)),
		)
		.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

// Paires réelles d'un tour à partir des matchs en base (équipes connues).
function realPairs(matches: Match[], stage: MatchStage): [string, string][] {
	const pairs = new Map<string, [string, string]>();
	for (const m of matches) {
		if (m.stage !== stage || !m.homeTeamId || !m.awayTeamId) continue;
		const key = [m.homeTeamId, m.awayTeamId].sort().join('-');
		if (!pairs.has(key)) pairs.set(key, [m.homeTeamId, m.awayTeamId]);
	}
	return [...pairs.values()];
}

// Aller/retour : `secondLegHostId` reçoit au retour (vainqueur de groupe en
// quarts, équipe de la ligue supérieure en barrages).
function projectTwoLeggedTie(
	id: string,
	stage: MatchStage,
	firstLegHostId: string,
	secondLegHostId: string,
	matches: Match[],
	isPairingReal: boolean,
	ctx: Context,
): ProjectedTie {
	const real = realTieMatches(matches, stage, firstLegHostId, secondLegHostId);
	const legs: ProjectedLeg[] = [];

	if (real.length > 0) {
		for (const m of real.slice(0, 2)) {
			const leg = resolveMatch(m, ctx, false);
			if (leg) legs.push(leg);
		}
	}
	const scheduledHosts = new Set(legs.map((l) => l.homeTeamId));
	for (const [host, visitor] of [
		[firstLegHostId, secondLegHostId],
		[secondLegHostId, firstLegHostId],
	] as const) {
		if (legs.length >= 2 || scheduledHosts.has(host)) continue;
		const [homeScore, awayScore] = predictScore(host, visitor, ctx);
		legs.push({ homeTeamId: host, awayTeamId: visitor, homeScore, awayScore, isReal: false });
	}
	return buildTie(id, stage, firstLegHostId, secondLegHostId, legs, isPairingReal, real, ctx);
}

function projectSingleMatch(
	id: string,
	stage: MatchStage,
	teamAId: string,
	teamBId: string,
	matches: Match[],
	isPairingReal: boolean,
	ctx: Context,
): ProjectedTie {
	const real = realTieMatches(matches, stage, teamAId, teamBId);
	const realLeg = real[0] ? resolveMatch(real[0], ctx, true) : null;
	const leg: ProjectedLeg = realLeg ?? (() => {
		const [homeScore, awayScore] = predictScore(teamAId, teamBId, ctx, true);
		return { homeTeamId: teamAId, awayTeamId: teamBId, homeScore, awayScore, isReal: false };
	})();
	return buildTie(id, stage, leg.homeTeamId, leg.awayTeamId, [leg], isPairingReal, real, ctx);
}

// ---------------------------------------------------------------------------
// Tableau final de la Ligue A
// ---------------------------------------------------------------------------

function teamAt(standings: Record<string, StandingRow[]>, groupId: string, position: number) {
	return standings[groupId]?.find((r) => r.position === position)?.teamId ?? null;
}

function projectQuarterFinals(
	standings: Record<string, StandingRow[]>,
	matches: Match[],
	ctx: Context,
): ProjectedTie[] {
	const pairs = realPairs(matches, 'QF');
	if (pairs.length === 4) {
		return pairs.map(([a, b], index) => {
			const first = realTieMatches(matches, 'QF', a, b)[0];
			const firstHost = first?.homeTeamId ?? a;
			const secondHost = firstHost === a ? b : a;
			return projectTwoLeggedTie(`QF${index + 1}`, 'QF', firstHost, secondHost, matches, true, ctx);
		});
	}
	return PROJECTED_QUARTER_FINALS.flatMap(({ id, winnerOf, runnerUpOf }) => {
		const winner = teamAt(standings, winnerOf, 1);
		const runnerUp = teamAt(standings, runnerUpOf, 2);
		if (!winner || !runnerUp) return [];
		// Le 2e reçoit à l'aller, le vainqueur de groupe au retour.
		return [projectTwoLeggedTie(id, 'QF', runnerUp, winner, matches, false, ctx)];
	});
}

function projectFinalFour(
	quarterFinals: ProjectedTie[],
	matches: Match[],
	ctx: Context,
): Pick<ProjectionResult, 'semiFinals' | 'thirdPlace' | 'final' | 'championId'> {
	const qfWinner = new Map(quarterFinals.map((t) => [t.id, t.winnerId]));

	const realSemis = realPairs(matches, 'SF');
	const semiPairs: { id: string; teams: [string, string]; real: boolean }[] =
		realSemis.length === 2
			? realSemis.map((teams, i) => ({ id: `SF${i + 1}`, teams, real: true }))
			: PROJECTED_SEMI_FINALS.flatMap(({ id, from }) => {
					const a = qfWinner.get(from[0]);
					const b = qfWinner.get(from[1]);
					return a && b ? [{ id, teams: [a, b] as [string, string], real: false }] : [];
				});

	const semiFinals = semiPairs.map(({ id, teams, real }) =>
		projectSingleMatch(id, 'SF', teams[0], teams[1], matches, real, ctx),
	);
	if (semiFinals.length !== 2) {
		return { semiFinals, thirdPlace: null, final: null, championId: null };
	}

	const [sf1, sf2] = semiFinals;
	const finalPair = realPairs(matches, 'F')[0];
	const final = projectSingleMatch(
		'F',
		'F',
		finalPair?.[0] ?? sf1.winnerId,
		finalPair?.[1] ?? sf2.winnerId,
		matches,
		Boolean(finalPair),
		ctx,
	);
	const thirdPair = realPairs(matches, 'THIRD')[0];
	const thirdPlace = projectSingleMatch(
		'THIRD',
		'THIRD',
		thirdPair?.[0] ?? sf1.loserId,
		thirdPair?.[1] ?? sf2.loserId,
		matches,
		Boolean(thirdPair),
		ctx,
	);
	return { semiFinals, thirdPlace, final, championId: final.winnerId };
}

// ---------------------------------------------------------------------------
// Barrages promotion/relégation
// ---------------------------------------------------------------------------

// Appariement projeté : meilleure équipe de la ligue supérieure contre moins
// bonne de la ligue inférieure, etc. L'équipe de la ligue supérieure reçoit
// au retour.
function projectPlayoffs(
	prefix: string,
	upperTeamIds: string[],
	lowerTeamIds: string[],
	matches: Match[],
	ctx: Context,
): ProjectedTie[] {
	const upperSet = new Set(upperTeamIds);
	const lowerSet = new Set(lowerTeamIds);
	const real = realPairs(matches, 'PO').filter(
		([a, b]) => (upperSet.has(a) && lowerSet.has(b)) || (upperSet.has(b) && lowerSet.has(a)),
	);

	if (real.length === upperTeamIds.length && real.length > 0) {
		return real.map(([a, b], i) => {
			const upper = upperSet.has(a) ? a : b;
			const lower = upper === a ? b : a;
			return projectTwoLeggedTie(`${prefix}${i + 1}`, 'PO', lower, upper, matches, true, ctx);
		});
	}
	const pairs = Math.min(upperTeamIds.length, lowerTeamIds.length);
	return Array.from({ length: pairs }, (_, i) => {
		const upper = upperTeamIds[i];
		const lower = lowerTeamIds[lowerTeamIds.length - 1 - i];
		return projectTwoLeggedTie(`${prefix}${i + 1}`, 'PO', lower, upper, matches, false, ctx);
	});
}

function rowsWithOutcome(
	groups: Group[],
	standings: Record<string, StandingRow[]>,
	outcomes: Record<string, Outcome>,
	league: Group['league'],
	outcome: Outcome,
	teams: TeamsById,
): string[] {
	const rows = groups
		.filter((g) => g.league === league)
		.flatMap((g) => standings[g.id] ?? [])
		.filter((r) => outcomes[r.teamId] === outcome);
	// Classement par rang de groupe d'abord (un 3e passe devant un 4e), puis
	// critères inter-groupes.
	const byPosition = new Map<number, StandingRow[]>();
	for (const row of rows) {
		byPosition.set(row.position, [...(byPosition.get(row.position) ?? []), row]);
	}
	return [...byPosition.keys()]
		.sort((a, b) => a - b)
		.flatMap((p) => rankAcrossGroups(byPosition.get(p)!, teams))
		.map((r) => r.teamId);
}

// ---------------------------------------------------------------------------
// Parcours de l'équipe préférée
// ---------------------------------------------------------------------------

const OUTCOME_SENTENCES: Record<Outcome, string> = {
	quarterFinal: 'qualifiée pour les quarts de finale',
	promoted: 'promue dans la ligue supérieure',
	playoffUp: 'en barrage pour la montée',
	playoffDown: 'en barrage pour le maintien',
	stay: 'maintenue dans sa ligue',
	relegated: 'reléguée',
	crossRanked: 'départagée au classement inter-groupes',
};

function tieStep(tie: ProjectedTie, teamId: string, title: string, teams: TeamsById): PathStep {
	const opponentId = tie.teamAId === teamId ? tie.teamBId : tie.teamAId;
	const opponent = teams[opponentId];
	const own = tie.teamAId === teamId ? tie.aggregateA : tie.aggregateB;
	const other = tie.teamAId === teamId ? tie.aggregateB : tie.aggregateA;
	const won = tie.winnerId === teamId;
	const scoreLabel = tie.legs.length > 1 ? `${own}-${other} sur l'ensemble des deux matchs` : `${own}-${other}`;
	return {
		stage: tie.stage,
		title,
		detail: `${opponent ? `${opponent.flag} ${opponent.name}` : opponentId} · ${scoreLabel}${
			tie.decidedOnPenalties ? ' (t.a.b.)' : ''
		} → ${won ? 'qualifiée' : 'éliminée'}`,
		result: won ? 'win' : 'loss',
	};
}

function buildFavoritePath(
	favoriteTeamId: string | null,
	result: Omit<ProjectionResult, 'favoritePath' | 'mode'>,
	groups: Group[],
	teams: TeamsById,
): PathStep[] {
	if (!favoriteTeamId) return [];
	const group = groups.find((g) => g.teamIds.includes(favoriteTeamId));
	if (!group) return [];
	const row = result.standingsByGroup[group.id]?.find((r) => r.teamId === favoriteTeamId);
	if (!row) return [];

	const outcome = result.outcomes[favoriteTeamId];
	const steps: PathStep[] = [
		{
			stage: 'GROUP',
			title: `Groupe ${group.id}`,
			detail: `${row.position}${row.position === 1 ? 're' : 'e'} place · ${row.points} pts (${row.won}V ${row.drawn}N ${row.lost}D) → ${OUTCOME_SENTENCES[outcome]}`,
			result:
				outcome === 'quarterFinal' || outcome === 'promoted'
					? 'win'
					: outcome === 'relegated'
						? 'loss'
						: 'neutral',
		},
	];

	const playoff = [...result.playoffsAB, ...result.playoffsBC].find(
		(t) => t.teamAId === favoriteTeamId || t.teamBId === favoriteTeamId,
	);
	if (playoff) steps.push(tieStep(playoff, favoriteTeamId, 'Barrage', teams));

	const stages: [ProjectedTie[], string][] = [
		[result.quarterFinals, 'Quart de finale'],
		[result.semiFinals, 'Demi-finale'],
		[result.final ? [result.final] : [], 'Finale'],
		[result.thirdPlace ? [result.thirdPlace] : [], 'Match pour la 3e place'],
	];
	for (const [ties, title] of stages) {
		const tie = ties.find((t) => t.teamAId === favoriteTeamId || t.teamBId === favoriteTeamId);
		if (tie) steps.push(tieStep(tie, favoriteTeamId, title, teams));
	}
	if (result.championId === favoriteTeamId) {
		steps.push({
			stage: 'F',
			title: 'Vainqueur de la Ligue des Nations',
			detail: '🏆 Trophée soulevé en juin 2027',
			result: 'win',
		});
	}
	return steps;
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export function projectCompetition(
	groups: Group[],
	matches: Match[],
	teams: TeamsById,
	mode: ProjectionMode,
	favoriteTeamId: string | null,
): ProjectionResult {
	const ctx: Context = { mode, favoriteTeamId, teams };

	const standingsByGroup: Record<string, StandingRow[]> = {};
	for (const group of groups) standingsByGroup[group.id] = projectGroup(group, matches, ctx);
	const outcomes = computeOutcomes(groups, standingsByGroup, teams);

	const quarterFinals = projectQuarterFinals(standingsByGroup, matches, ctx);
	const finalFour =
		quarterFinals.length === 4
			? projectFinalFour(quarterFinals, matches, ctx)
			: { semiFinals: [], thirdPlace: null, final: null, championId: null };

	const pick = (league: Group['league'], outcome: Outcome) =>
		rowsWithOutcome(groups, standingsByGroup, outcomes, league, outcome, teams);
	const playoffsAB = projectPlayoffs('AB', pick('A', 'playoffDown'), pick('B', 'playoffUp'), matches, ctx);
	const playoffsBC = projectPlayoffs('BC', pick('B', 'playoffDown'), pick('C', 'playoffUp'), matches, ctx);

	const partial = {
		standingsByGroup,
		outcomes,
		quarterFinals,
		...finalFour,
		playoffsAB,
		playoffsBC,
	};
	return {
		mode,
		...partial,
		favoritePath: buildFavoritePath(favoriteTeamId, partial, groups, teams),
	};
}
