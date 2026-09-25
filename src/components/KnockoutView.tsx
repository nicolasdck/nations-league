import { useMemo } from 'react';
import { FINALS_DATES, QUARTER_FINAL_DATES } from '../data/competition';
import type { Group, LeagueCode, Match, MatchStage, TeamsById } from '../types/competition';
import { projectCompetition, type ProjectedTie } from '../utils/projection';
import MatchRow from './MatchRow';
import GlobalBracket from './projection/GlobalBracket';
import TieCard from './projection/TieCard';

type KnockoutViewProps = {
	groups: Group[];
	matches: Match[];
	teamsById: TeamsById;
	favoriteTeamId: string | null;
};

type Section = {
	id: string;
	title: string;
	dates: string;
	real: Match[];
	projected: ProjectedTie[];
	projectedLabel: (index: number) => string;
};

const byKickoff = (a: Match, b: Match) => a.kickoffAt.localeCompare(b.kickoffAt) || a.id - b.id;

// Tableau final réel : vrais matchs quand ils existent en base (appariements,
// scores, buteurs, direct), sinon projection « théorique » d'après les
// classements actuels — sans biais pour l'équipe préférée.
export default function KnockoutView({ groups, matches, teamsById, favoriteTeamId }: KnockoutViewProps) {
	const projection = useMemo(
		() => (groups.length > 0 ? projectCompetition(groups, matches, teamsById, 'logical', null) : null),
		[groups, matches, teamsById],
	);

	const sections = useMemo<Section[]>(() => {
		if (!projection) return [];
		const leagueOf = (teamId: string | null): LeagueCode | null => {
			const groupId = teamId ? teamsById[teamId]?.groupId : null;
			return groups.find((g) => g.id === groupId)?.league ?? null;
		};
		const ofStage = (stage: MatchStage) => matches.filter((m) => m.stage === stage).sort(byKickoff);
		// Barrage A/B : une équipe de Ligue A y participe ; sinon B/C.
		const playoffs = ofStage('PO');
		const isAB = (m: Match) => leagueOf(m.homeTeamId) === 'A' || leagueOf(m.awayTeamId) === 'A';

		return [
			{
				id: 'qf',
				title: 'Quarts de finale · Ligue A',
				dates: QUARTER_FINAL_DATES,
				real: ofStage('QF'),
				projected: projection.quarterFinals,
				projectedLabel: (i) => `Quart ${i + 1}`,
			},
			{
				id: 'sf',
				title: 'Demi-finales',
				dates: FINALS_DATES,
				real: ofStage('SF'),
				projected: projection.semiFinals,
				projectedLabel: (i) => `Demi-finale ${i + 1}`,
			},
			{
				id: 'third',
				title: 'Match pour la 3e place',
				dates: '13 juin 2027',
				real: ofStage('THIRD'),
				projected: projection.thirdPlace ? [projection.thirdPlace] : [],
				projectedLabel: () => '3e place',
			},
			{
				id: 'final',
				title: 'Finale',
				dates: '13 juin 2027',
				real: ofStage('F'),
				projected: projection.final ? [projection.final] : [],
				projectedLabel: () => 'Finale',
			},
			{
				id: 'po-ab',
				title: 'Barrages Ligue A / Ligue B',
				dates: '25–30 mars 2027 (aller/retour)',
				real: playoffs.filter(isAB),
				projected: projection.playoffsAB,
				projectedLabel: (i) => `Barrage A/B ${i + 1}`,
			},
			{
				id: 'po-bc',
				title: 'Barrages Ligue B / Ligue C',
				dates: '25–30 mars 2027 (aller/retour)',
				real: playoffs.filter((m) => !isAB(m)),
				projected: projection.playoffsBC,
				projectedLabel: (i) => `Barrage B/C ${i + 1}`,
			},
		];
	}, [projection, matches, groups, teamsById]);

	if (!projection) return null;

	const hasRealQuarterFinals = projection.quarterFinals.some((t) => t.isPairingReal);

	return (
		<div className="flex flex-col gap-5">
			<section className="flex flex-col">
				<div className="flex items-center justify-center gap-3">
					<div className="h-px bg-slate-800 flex-1" />
					<h2 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Vue globale</h2>
					<div className="h-px bg-slate-800 flex-1" />
				</div>
				<p className="text-center text-[10px] text-slate-500 mt-1">
					{hasRealQuarterFinals
						? 'Tableau officiel · résultats en direct'
						: "Projection d'après les classements actuels (en attendant le tirage des quarts)"}
				</p>
				<GlobalBracket
					quarterFinals={projection.quarterFinals}
					semiFinals={projection.semiFinals}
					final={projection.final}
					standingsByGroup={projection.standingsByGroup}
					teamsById={teamsById}
					favoriteTeamId={favoriteTeamId}
				/>
			</section>

			{sections.map((section) => (
				<section key={section.id} className="flex flex-col gap-2">
					<div className="flex items-baseline justify-between gap-2">
						<h3 className="text-sm font-black text-slate-100">{section.title}</h3>
						<span className="text-[10px] text-slate-500 shrink-0">{section.dates}</span>
					</div>

					{section.real.length > 0 ? (
						section.real.map((m) => (
							<MatchRow key={m.id} match={m} teamsById={teamsById} favoriteTeamId={favoriteTeamId} />
						))
					) : section.projected.length > 0 ? (
						<>
							<p className="text-[10px] text-amber-400/80">Affiches projetées — matchs pas encore programmés</p>
							<div className="grid gap-2 sm:grid-cols-2">
								{section.projected.map((tie, i) => (
									<TieCard
										key={tie.id}
										tie={tie}
										label={section.projectedLabel(i)}
										teamsById={teamsById}
										favoriteTeamId={favoriteTeamId}
									/>
								))}
							</div>
						</>
					) : (
						<p className="text-xs text-slate-500">À déterminer.</p>
					)}
				</section>
			))}
		</div>
	);
}
