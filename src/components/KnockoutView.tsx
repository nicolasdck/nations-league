import { useMemo } from 'react';
import { FINALS_DATES, QUARTER_FINAL_DATES } from '../data/competition';
import type { Group, LeagueCode, Match, MatchStage, TeamsById } from '../types/competition';
import { buildRealBracket } from '../utils/bracketModel';
import MatchRow from './MatchRow';
import GlobalBracket from './projection/GlobalBracket';

type KnockoutViewProps = {
	groups: Group[];
	matches: Match[];
	teamsById: TeamsById;
	favoriteTeamId: string | null;
	onOpenMatch: (match: Match) => void;
};

type Section = {
	id: string;
	title: string;
	dates: string;
	pending: string;
	matches: Match[];
};

const byKickoff = (a: Match, b: Match) => a.kickoffAt.localeCompare(b.kickoffAt) || a.id - b.id;

// Tableau final réel uniquement : emplacements vides en attendant les
// résultats, puis mise à jour au fil des matchs (tirage, scores, qualifiés).
// Aucune projection ici (voir l'onglet Projection).
export default function KnockoutView({ groups, matches, teamsById, favoriteTeamId, onOpenMatch }: KnockoutViewProps) {
	const model = useMemo(() => buildRealBracket(matches), [matches]);

	const sections = useMemo<Section[]>(() => {
		const leagueOf = (teamId: string | null): LeagueCode | null => {
			const groupId = teamId ? teamsById[teamId]?.groupId : null;
			return groups.find((g) => g.id === groupId)?.league ?? null;
		};
		const ofStage = (stage: MatchStage) => matches.filter((m) => m.stage === stage).sort(byKickoff);
		// Barrage A/B : une équipe de Ligue A y participe ; sinon B/C.
		const isAB = (m: Match) => leagueOf(m.homeTeamId) === 'A' || leagueOf(m.awayTeamId) === 'A';
		const playoffs = ofStage('PO');
		const drawPending = 'Affiches connues après la phase de ligue et le tirage au sort UEFA.';

		return [
			{ id: 'qf', title: 'Quarts de finale · Ligue A', dates: QUARTER_FINAL_DATES, pending: drawPending, matches: ofStage('QF') },
			{ id: 'sf', title: 'Demi-finales', dates: FINALS_DATES, pending: 'Entre les vainqueurs des quarts.', matches: ofStage('SF') },
			{ id: 'third', title: 'Match pour la 3e place', dates: '13 juin 2027', pending: 'Entre les perdants des demi-finales.', matches: ofStage('THIRD') },
			{ id: 'final', title: 'Finale', dates: '13 juin 2027', pending: 'Entre les vainqueurs des demi-finales.', matches: ofStage('F') },
			{ id: 'po-ab', title: 'Barrages Ligue A / Ligue B', dates: '25–30 mars 2027 (aller/retour)', pending: drawPending, matches: playoffs.filter(isAB) },
			{ id: 'po-bc', title: 'Barrages Ligue B / Ligue C', dates: '25–30 mars 2027 (aller/retour)', pending: drawPending, matches: playoffs.filter((m) => !isAB(m)) },
		];
	}, [matches, groups, teamsById]);

	return (
		<div className="flex flex-col gap-5">
			<section className="flex flex-col">
				<div className="flex items-center justify-center gap-3">
					<div className="h-px bg-slate-800 flex-1" />
					<h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Vue globale</h2>
					<div className="h-px bg-slate-800 flex-1" />
				</div>
				<GlobalBracket
					model={model}
					teamsById={teamsById}
					favoriteTeamId={favoriteTeamId}
					championCaption={(name) => `${name} — vainqueur de la Ligue des Nations`}
					renderDetail={(tie) =>
						tie.matches.length > 0 ? (
							tie.matches.map((m) => <MatchRow key={m.id} match={m} teamsById={teamsById} favoriteTeamId={favoriteTeamId} onOpen={onOpenMatch} />)
						) : (
							<p className="text-center text-xs text-slate-500">À déterminer.</p>
						)
					}
				/>
			</section>

			{sections.map((section) => (
				<section key={section.id} className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between gap-2">
						<h3 className="text-sm font-black text-slate-100">{section.title}</h3>
						<span className="text-[10px] text-slate-500 shrink-0">{section.dates}</span>
					</div>
					{section.matches.length > 0 ? (
						section.matches.map((m) => (
							<MatchRow key={m.id} match={m} teamsById={teamsById} favoriteTeamId={favoriteTeamId} onOpen={onOpenMatch} />
						))
					) : (
						<p className="rounded-lg border border-dashed border-slate-800 px-3 py-3 text-xs text-slate-500">
							À déterminer · {section.pending}
						</p>
					)}
				</section>
			))}
		</div>
	);
}
