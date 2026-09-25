import type { LeagueCode, MatchStage } from '../types/competition';

// Règles 2026-27 : la compétition prépare le passage à 3 ligues de 18
// équipes en 2028-29, d'où des mouvements différents de l'édition 2024-25
// (toute la Ligue D monte, deux 3es et deux 4es de Ligue A vont en barrages).
export const LEAGUES: LeagueCode[] = ['A', 'B', 'C', 'D'];

export const LEAGUE_LABELS: Record<LeagueCode, string> = {
	A: 'Ligue A',
	B: 'Ligue B',
	C: 'Ligue C',
	D: 'Ligue D',
};

export const STAGE_LABELS: Record<MatchStage, string> = {
	GROUP: 'Phase de ligue',
	QF: 'Quart de finale',
	SF: 'Demi-finale',
	THIRD: 'Match pour la 3e place',
	F: 'Finale',
	PO: 'Barrage promotion/relégation',
};

// Issue sportive d'une place de groupe, avant départage inter-groupes.
export type Outcome =
	| 'quarterFinal'
	| 'promoted'
	| 'playoffUp'
	| 'playoffDown'
	| 'stay'
	| 'relegated'
	| 'crossRanked';

export const OUTCOME_LABELS: Record<Outcome, string> = {
	quarterFinal: 'Quarts de finale',
	promoted: 'Promu',
	playoffUp: 'Barrage (montée)',
	playoffDown: 'Barrage (maintien)',
	stay: 'Maintenu',
	relegated: 'Relégué',
	crossRanked: 'Classement inter-groupes',
};

// Couleur de la pastille dans les classements (classes Tailwind complètes
// pour que le scanner JIT les détecte).
export const OUTCOME_STYLES: Record<Outcome, string> = {
	quarterFinal: 'bg-emerald-500',
	promoted: 'bg-emerald-500',
	playoffUp: 'bg-cyan-500',
	playoffDown: 'bg-amber-500',
	stay: 'bg-slate-600',
	relegated: 'bg-rose-500',
	crossRanked: 'bg-amber-500',
};

// Pastille des points dans les classements (texte + bordure + fond).
export const OUTCOME_BADGE_STYLES: Record<Outcome, string> = {
	quarterFinal: 'border-emerald-500 bg-emerald-950/60 text-emerald-300',
	promoted: 'border-emerald-500 bg-emerald-950/60 text-emerald-300',
	playoffUp: 'border-cyan-500 bg-cyan-950/60 text-cyan-300',
	playoffDown: 'border-amber-500 bg-amber-950/60 text-amber-300',
	stay: 'border-slate-600 bg-slate-800/60 text-slate-200',
	relegated: 'border-rose-500 bg-rose-950/60 text-rose-300',
	crossRanked: 'border-amber-500 bg-amber-950/60 text-amber-300',
};

// Position (1-indexée) → issue, par ligue. En Ligue A, les 3es et 4es sont
// départagés entre groupes (voir LEAGUE_A_CROSS_GROUP) : leur issue finale
// dépend du classement inter-groupes, calculé dans utils/standings.ts.
export const POSITION_OUTCOMES: Record<LeagueCode, Outcome[]> = {
	A: ['quarterFinal', 'quarterFinal', 'crossRanked', 'crossRanked'],
	B: ['promoted', 'playoffUp', 'stay', 'playoffDown'],
	C: ['promoted', 'playoffUp', 'stay', 'stay'],
	D: ['promoted', 'promoted', 'promoted', 'promoted'],
};

// Ligue A : parmi les quatre 3es, les deux meilleurs restent, les deux moins
// bons jouent les barrages A/B. Parmi les quatre 4es, les deux meilleurs
// jouent les barrages A/B, les deux moins bons sont relégués.
export const LEAGUE_A_CROSS_GROUP: Record<3 | 4, [Outcome, Outcome, Outcome, Outcome]> = {
	3: ['stay', 'stay', 'playoffDown', 'playoffDown'],
	4: ['playoffDown', 'playoffDown', 'relegated', 'relegated'],
};

export const QUARTER_FINAL_DATES = '25–30 mars 2027 (aller/retour)';
export const FINALS_DATES = '9–13 juin 2027';

// Appariements projetés des quarts (le tirage UEFA décide des appariements
// réels ; tant que les quarts ne sont pas en base, on utilise ce schéma
// croisé qui respecte la contrainte « vainqueur contre 2e d'un autre groupe »).
export const PROJECTED_QUARTER_FINALS: {
	id: string;
	winnerOf: string;
	runnerUpOf: string;
}[] = [
	{ id: 'QF1', winnerOf: 'A1', runnerUpOf: 'A2' },
	{ id: 'QF2', winnerOf: 'A2', runnerUpOf: 'A1' },
	{ id: 'QF3', winnerOf: 'A3', runnerUpOf: 'A4' },
	{ id: 'QF4', winnerOf: 'A4', runnerUpOf: 'A3' },
];

// Demi-finales : vainqueur QF1 – vainqueur QF3, vainqueur QF2 – vainqueur QF4.
export const PROJECTED_SEMI_FINALS: { id: string; from: [string, string] }[] = [
	{ id: 'SF1', from: ['QF1', 'QF3'] },
	{ id: 'SF2', from: ['QF2', 'QF4'] },
];

// Avantage du terrain utilisé par le modèle de projection (points Elo).
export const HOME_ADVANTAGE = 60;
// En dessous de cet écart (après avantage du terrain), le modèle prédit un nul.
export const DRAW_THRESHOLD = 50;
