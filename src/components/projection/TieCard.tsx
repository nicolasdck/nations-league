import type { TeamsById } from '../../types/competition';
import type { ProjectedTie } from '../../utils/projection';

type TieCardProps = {
	tie: ProjectedTie;
	label: string;
	teamsById: TeamsById;
	favoriteTeamId: string | null;
};

function TeamLine({
	teamId,
	aggregate,
	isWinner,
	isFavorite,
	teamsById,
}: {
	teamId: string;
	aggregate: number;
	isWinner: boolean;
	isFavorite: boolean;
	teamsById: TeamsById;
}) {
	const team = teamsById[teamId];
	return (
		<div
			className={`flex items-center justify-between gap-2 px-2.5 py-1.5 ${
				isWinner ? 'text-slate-100' : 'text-slate-500'
			} ${isFavorite ? 'bg-emerald-950/60' : ''}`}
		>
			<span className="flex items-center gap-2 min-w-0">
				<span className="flags text-base leading-none">{team?.flag ?? '🏳️'}</span>
				<span className={`text-xs truncate ${isWinner ? 'font-black' : 'font-semibold'} ${isFavorite ? 'text-emerald-300' : ''}`}>
					{team?.name ?? teamId}
				</span>
			</span>
			<span className={`text-sm tabular-nums ${isWinner ? 'font-black' : 'font-bold'}`}>{aggregate}</span>
		</div>
	);
}

export default function TieCard({ tie, label, teamsById, favoriteTeamId }: TieCardProps) {
	const involvesFavorite = tie.teamAId === favoriteTeamId || tie.teamBId === favoriteTeamId;
	const allReal = tie.legs.every((l) => l.isReal);

	return (
		<div
			className={`rounded-lg border overflow-hidden bg-slate-900/80 ${
				involvesFavorite ? 'border-emerald-500/80 shadow-md shadow-emerald-500/10' : 'border-slate-800'
			}`}
		>
			<div className="flex items-center justify-between px-2.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider">
				<span className="text-slate-500">{label}</span>
				<span className={allReal ? 'text-cyan-400' : tie.isPairingReal ? 'text-slate-400' : 'text-amber-400/80'}>
					{allReal ? 'Officiel' : tie.isPairingReal ? 'Tirage officiel' : 'Projeté'}
				</span>
			</div>
			<TeamLine
				teamId={tie.teamAId}
				aggregate={tie.aggregateA}
				isWinner={tie.winnerId === tie.teamAId}
				isFavorite={tie.teamAId === favoriteTeamId}
				teamsById={teamsById}
			/>
			<TeamLine
				teamId={tie.teamBId}
				aggregate={tie.aggregateB}
				isWinner={tie.winnerId === tie.teamBId}
				isFavorite={tie.teamBId === favoriteTeamId}
				teamsById={teamsById}
			/>
			{(tie.legs.length > 1 || tie.decidedOnPenalties) && (
				<p className="px-2.5 pb-1.5 text-[9px] text-slate-500">
					{tie.legs.length > 1 &&
						tie.legs
							.map((l) => `${teamsById[l.homeTeamId]?.id ?? l.homeTeamId} ${l.homeScore}-${l.awayScore} ${teamsById[l.awayTeamId]?.id ?? l.awayTeamId}`)
							.join(' · ')}
					{tie.decidedOnPenalties && ' · qualifié aux t.a.b.'}
				</p>
			)}
		</div>
	);
}
