import { STAGE_LABELS } from '../data/competition';
import { isLive, type Match, type TeamsById } from '../types/competition';
import { formatTime } from '../utils/format';
import TeamLabel from './TeamLabel';

type MatchRowProps = {
	match: Match;
	teamsById: TeamsById;
	favoriteTeamId: string | null;
};

function StatusBadge({ match }: { match: Match }) {
	if (isLive(match)) {
		return (
			<span className="text-[10px] font-black text-rose-400 flex items-center gap-1">
				<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
				{match.status === 'HT' ? 'MI-TEMPS' : match.minute ? `${match.minute}'` : 'LIVE'}
			</span>
		);
	}
	if (match.status === 'FT') return <span className="text-[10px] font-bold text-slate-500">Terminé</span>;
	if (match.status === 'PST') return <span className="text-[10px] font-bold text-amber-400">Reporté</span>;
	if (match.status === 'CANC') return <span className="text-[10px] font-bold text-rose-400">Annulé</span>;
	return <span className="text-[10px] font-bold text-cyan-400">{formatTime(match.kickoffAt)}</span>;
}

function stageLabel(match: Match): string {
	if (match.stage === 'GROUP') {
		return `Groupe ${match.groupId ?? '?'}${match.matchday ? ` · J${match.matchday}` : ''}`;
	}
	return `${STAGE_LABELS[match.stage]}${match.leg ? ` · ${match.leg === 1 ? 'aller' : 'retour'}` : ''}`;
}

export default function MatchRow({ match, teamsById, favoriteTeamId }: MatchRowProps) {
	const home = match.homeTeamId ? teamsById[match.homeTeamId] : undefined;
	const away = match.awayTeamId ? teamsById[match.awayTeamId] : undefined;
	const isFavorite =
		favoriteTeamId !== null &&
		(match.homeTeamId === favoriteTeamId || match.awayTeamId === favoriteTeamId);
	const live = isLive(match);
	const hasScore = match.homeScore !== null && match.awayScore !== null;
	const hasPenalties = match.homePenaltyScore !== null && match.awayPenaltyScore !== null;

	return (
		<article
			className={`p-3 rounded-lg flex flex-col gap-2 transition-all ${
				isFavorite
					? 'bg-emerald-950/40 border border-emerald-500/70 shadow-md shadow-emerald-500/10'
					: live
						? 'bg-slate-900/80 border border-rose-500/40'
						: 'bg-slate-900/70 border border-slate-800'
			}`}
		>
			<div className="flex items-center justify-between gap-2">
				<span className="text-[10px] font-bold text-slate-500 truncate">
					{stageLabel(match)}
					{match.venue ? ` · 🏟️ ${match.venue}` : ''}
				</span>
				<StatusBadge match={match} />
			</div>

			<div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
				<TeamLabel
					team={home}
					placeholder={match.placeholderHome}
					align="right"
					highlight={match.homeTeamId === favoriteTeamId}
				/>
				<div
					className={`min-w-16 text-center rounded-lg px-2 py-1 font-black text-base tabular-nums ${
						live
							? 'bg-rose-950/50 text-rose-300'
							: hasScore
								? 'bg-slate-950 text-slate-100'
								: 'text-slate-600 text-xs'
					}`}
				>
					{hasScore ? `${match.homeScore} - ${match.awayScore}` : 'vs'}
					{hasPenalties && (
						<span className="block text-[9px] font-bold text-slate-400">
							t.a.b. {match.homePenaltyScore}-{match.awayPenaltyScore}
						</span>
					)}
				</div>
				<TeamLabel
					team={away}
					placeholder={match.placeholderAway}
					align="left"
					highlight={match.awayTeamId === favoriteTeamId}
				/>
			</div>

			{(match.homeScorers.length > 0 || match.awayScorers.length > 0) && (
				<div className="grid grid-cols-[1fr_auto_1fr] gap-3 text-[10px] text-slate-400 leading-snug">
					<ul className="text-right">
						{match.homeScorers.map((s, i) => (
							<li key={`${s}-${i}`}>⚽ {s}</li>
						))}
					</ul>
					<span className="min-w-16" />
					<ul>
						{match.awayScorers.map((s, i) => (
							<li key={`${s}-${i}`}>⚽ {s}</li>
						))}
					</ul>
				</div>
			)}
		</article>
	);
}
