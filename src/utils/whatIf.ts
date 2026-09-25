import type { Match } from '../types/competition';
import { readJson, STORAGE_KEYS, writeJson } from './storage';

// Scores saisis dans le simulateur « Et si ? », par id de match. Une case vide
// vaut null : le match n'est simulé que lorsque les deux scores sont saisis.
export type ScoreEntry = [number | null, number | null];
export type ScoreOverrides = Record<string, ScoreEntry>;

// Matchs simulables : pas encore terminés (ni annulés) et équipes connues.
export function isSimulable(match: Match): boolean {
	return match.status !== 'FT' && match.status !== 'CANC' && match.homeTeamId !== null && match.awayTeamId !== null;
}

const isScore = (v: unknown): v is number | null =>
	v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99);

function isOverrides(value: unknown): value is ScoreOverrides {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	return Object.values(value).every(
		(entry) => Array.isArray(entry) && entry.length === 2 && isScore(entry[0]) && isScore(entry[1]),
	);
}

export function loadOverrides(): ScoreOverrides {
	return readJson(STORAGE_KEYS.whatIf, isOverrides) ?? {};
}

export function saveOverrides(overrides: ScoreOverrides): void {
	writeJson(STORAGE_KEYS.whatIf, overrides);
}

export function completeEntry(entry: ScoreEntry | undefined): entry is [number, number] {
	return entry !== undefined && entry[0] !== null && entry[1] !== null;
}

// Remplace chaque match simulable dont le score est saisi par un match
// « terminé » avec ce score : le moteur de projection le traite alors comme
// un résultat réel. Un vrai résultat (FT) l'emporte toujours sur la saisie.
export function applyOverrides(matches: Match[], overrides: ScoreOverrides): Match[] {
	return matches.map((m) => {
		const entry = overrides[m.id];
		if (!isSimulable(m) || !completeEntry(entry)) return m;
		return {
			...m,
			status: 'FT',
			minute: null,
			homeScore: entry[0],
			awayScore: entry[1],
			homePenaltyScore: null,
			awayPenaltyScore: null,
			winnerId: null,
		};
	});
}

// Nombre de saisies encore actives (matchs pas encore joués en vrai).
export function countActiveOverrides(matches: Match[], overrides: ScoreOverrides): number {
	return matches.filter((m) => isSimulable(m) && completeEntry(overrides[m.id])).length;
}
