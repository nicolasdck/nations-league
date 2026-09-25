import type { Match, MatchStage } from '../types/competition';
import type { ProjectedTie, ProjectionResult } from './projection';

// Modèle neutre du tableau final de la Ligue A (quarts → demies → finale),
// alimenté soit par les matchs réels (onglet Tableau), soit par la projection
// (onglet Projection). La vue globale ne connaît que ce modèle.

export type BracketSlot = {
	teamId: string | null;
	// Libellé d'attente (« 1er de groupe », « Vainqueur QF 1 »…) ou place de
	// qualification (« 1A2 ») quand l'équipe est connue.
	label: string | null;
};

export type BracketTie = {
	id: string;
	stage: 'QF' | 'SF' | 'F';
	title: string;
	slots: [BracketSlot, BracketSlot];
	// Connu seulement quand la confrontation est terminée (ou projetée).
	winnerId: string | null;
	// Traits pleins (résultat officiel) ou pointillés (en attente / projeté).
	official: boolean;
	// Matchs réels de la confrontation (vide en projection ou avant programmation).
	matches: Match[];
	projected: ProjectedTie | null;
};

export type BracketHalf = { quarterFinals: [BracketTie, BracketTie]; semiFinal: BracketTie };

export type BracketModel = {
	halves: [BracketHalf, BracketHalf];
	final: BracketTie;
	championId: string | null;
};

// ---------------------------------------------------------------------------
// Matchs réels
// ---------------------------------------------------------------------------

const byKickoff = (a: Match, b: Match) => a.kickoffAt.localeCompare(b.kickoffAt) || a.id - b.id;

// Côté d'un match : l'équipe si connue, sinon son libellé d'attente.
const sideKey = (teamId: string | null, placeholder: string | null) => teamId ?? `?${placeholder ?? ''}`;

function tieWinner(legs: Match[], twoLegged: boolean): string | null {
	const last = legs[legs.length - 1];
	if (!last || last.status !== 'FT') return null;
	if (twoLegged && legs.length < 2) return null;
	// winner_id du dernier match = vainqueur de la confrontation (cumul,
	// prolongation, tirs au but — voir la colonne en base).
	if (last.winnerId) return last.winnerId;
	if (!twoLegged && last.homeScore !== null && last.awayScore !== null && last.homeScore !== last.awayScore) {
		return last.homeScore > last.awayScore ? last.homeTeamId : last.awayTeamId;
	}
	return null;
}

function realTies(matches: Match[], stage: MatchStage, twoLegged: boolean): Omit<BracketTie, 'id' | 'stage' | 'title'>[] {
	const ties = new Map<string, Match[]>();
	for (const m of matches.filter((x) => x.stage === stage).sort(byKickoff)) {
		const key = [sideKey(m.homeTeamId, m.placeholderHome), sideKey(m.awayTeamId, m.placeholderAway)].sort().join('|');
		ties.set(key, [...(ties.get(key) ?? []), m]);
	}
	return [...ties.values()].map((legs) => {
		const first = legs[0];
		// Au match aller d'une confrontation, l'hôte est le 2e de groupe : on
		// affiche le vainqueur de groupe en second, comme dans le calendrier UEFA.
		const slots: [BracketSlot, BracketSlot] = [
			{ teamId: first.homeTeamId, label: first.homeTeamId ? null : first.placeholderHome },
			{ teamId: first.awayTeamId, label: first.awayTeamId ? null : first.placeholderAway },
		];
		const winnerId = tieWinner(legs, twoLegged);
		return { slots, winnerId, official: winnerId !== null, matches: legs, projected: null };
	});
}

function placeholderTie(id: string, stage: BracketTie['stage'], title: string, labels: [string, string]): BracketTie {
	return {
		id,
		stage,
		title,
		slots: [
			{ teamId: null, label: labels[0] },
			{ teamId: null, label: labels[1] },
		],
		winnerId: null,
		official: false,
		matches: [],
		projected: null,
	};
}

const QF_PLACEHOLDER: [string, string] = ['2e de groupe', '1er de groupe'];

export function buildRealBracket(matches: Match[]): BracketModel {
	const qfReal = realTies(matches, 'QF', true);
	const quarterFinals: BracketTie[] = Array.from({ length: 4 }, (_, i) =>
		qfReal[i]
			? { ...qfReal[i], id: `QF${i + 1}`, stage: 'QF', title: `Quart de finale ${i + 1}` }
			: placeholderTie(`QF${i + 1}`, 'QF', `Quart de finale ${i + 1}`, QF_PLACEHOLDER),
	);

	const sfReal = realTies(matches, 'SF', false);
	const semiFinals: BracketTie[] = Array.from({ length: 2 }, (_, i) =>
		sfReal[i]
			? { ...sfReal[i], id: `SF${i + 1}`, stage: 'SF', title: `Demi-finale ${i + 1}` }
			: placeholderTie(`SF${i + 1}`, 'SF', `Demi-finale ${i + 1}`, [
					`Vainqueur QF ${2 * i + 1}`,
					`Vainqueur QF ${2 * i + 2}`,
				]),
	);

	// Chaque demie est reliée aux quarts dont les vainqueurs y figurent ; à
	// défaut (tableau pas encore connu), dans l'ordre QF1-QF2 / QF3-QF4.
	const remaining = [...quarterFinals];
	const feeders = semiFinals.map((sf) => {
		const picked: BracketTie[] = [];
		for (const slot of sf.slots) {
			const index = remaining.findIndex((qf) => slot.teamId !== null && qf.winnerId === slot.teamId);
			if (index >= 0) picked.push(...remaining.splice(index, 1));
		}
		return picked;
	});
	feeders.forEach((picked) => {
		while (picked.length < 2 && remaining.length > 0) picked.push(remaining.shift()!);
	});

	const finalReal = realTies(matches, 'F', false)[0];
	const final: BracketTie = finalReal
		? { ...finalReal, id: 'F', stage: 'F', title: 'Finale' }
		: placeholderTie('F', 'F', 'Finale', ['Vainqueur demie 1', 'Vainqueur demie 2']);

	return {
		halves: [
			{ quarterFinals: [feeders[0][0], feeders[0][1]], semiFinal: semiFinals[0] },
			{ quarterFinals: [feeders[1][0], feeders[1][1]], semiFinal: semiFinals[1] },
		],
		final,
		championId: final.winnerId,
	};
}

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

function fromProjected(tie: ProjectedTie, stage: BracketTie['stage'], title: string, seedOf: (id: string) => string | null): BracketTie {
	return {
		id: tie.id,
		stage,
		title,
		slots: [
			{ teamId: tie.teamAId, label: seedOf(tie.teamAId) },
			{ teamId: tie.teamBId, label: seedOf(tie.teamBId) },
		],
		winnerId: tie.winnerId,
		official: tie.legs.length > 0 && tie.legs.every((l) => l.isReal),
		matches: [],
		projected: tie,
	};
}

export function buildProjectedBracket(projection: ProjectionResult): BracketModel | null {
	const { quarterFinals, semiFinals, final } = projection;
	if (quarterFinals.length !== 4 || semiFinals.length !== 2 || !final) return null;

	// « 1A1 » = 1er du groupe A1 dans les classements projetés.
	const seeds = new Map<string, string>();
	for (const [groupId, rows] of Object.entries(projection.standingsByGroup)) {
		if (!groupId.startsWith('A')) continue;
		for (const row of rows) if (row.position <= 2) seeds.set(row.teamId, `${row.position}${groupId}`);
	}
	const seedOf = (id: string) => seeds.get(id) ?? null;

	const halves = semiFinals.map((sf, i) => {
		const feeders = [sf.teamAId, sf.teamBId]
			.map((teamId) => quarterFinals.find((qf) => qf.winnerId === teamId))
			.filter((qf): qf is ProjectedTie => Boolean(qf))
			.map((qf) => fromProjected(qf, 'QF', `Quart de finale ${qf.id.replace('QF', '')}`, seedOf));
		return {
			quarterFinals: [feeders[0], feeders[1]] as [BracketTie, BracketTie],
			semiFinal: fromProjected(sf, 'SF', `Demi-finale ${i + 1}`, () => null),
		};
	});
	if (halves.some((h) => !h.quarterFinals[0] || !h.quarterFinals[1])) return null;

	return {
		halves: [halves[0], halves[1]],
		final: fromProjected(final, 'F', 'Finale', () => null),
		championId: final.winnerId,
	};
}
