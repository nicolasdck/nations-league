import { useEffect, useState } from 'react';
import { useMatchDetails } from '../../hooks/useMatchDetails';
import type { Match, TeamsById } from '../../types/competition';
import MatchRow from '../MatchRow';
import { HeadToHeadSection, LineupsSection, StatsSection, TimelineSection } from './MatchDetailsSections';

type MatchDetailsSheetProps = {
	match: Match;
	teamsById: TeamsById;
	favoriteTeamId: string | null;
	onClose: () => void;
};

type DetailsTab = 'timeline' | 'stats' | 'lineups' | 'h2h';

const TABS: { id: DetailsTab; label: string }[] = [
	{ id: 'timeline', label: 'Résumé' },
	{ id: 'stats', label: 'Stats' },
	{ id: 'lineups', label: 'Compos' },
	{ id: 'h2h', label: 'Face-à-face' },
];

export default function MatchDetailsSheet({ match, teamsById, favoriteTeamId, onClose }: MatchDetailsSheetProps) {
	const { details, loading, error } = useMatchDetails(match);
	// Avant-match, rien à résumer : on ouvre sur le face-à-face.
	const [tab, setTab] = useState<DetailsTab>(match.status === 'NS' || match.status === 'PST' ? 'h2h' : 'timeline');

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') onClose();
		};
		document.addEventListener('keydown', onKey);
		// Empêche la page de défiler derrière la feuille.
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.removeEventListener('keydown', onKey);
			document.body.style.overflow = previous;
		};
	}, [onClose]);

	const sides = {
		home: match.homeTeamId ? teamsById[match.homeTeamId] : undefined,
		away: match.awayTeamId ? teamsById[match.awayTeamId] : undefined,
	};

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-xs animate-fade-in"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label="Fiche du match"
		>
			<div
				className="bg-slate-900 border-t border-slate-800 rounded-t-2xl w-full max-w-xl max-h-[90dvh] flex flex-col shadow-2xl animate-slide-up"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="relative px-4 pt-3 pb-2 flex flex-col gap-3">
					<div className="flex items-center">
						<span className="w-10 h-1 rounded-full bg-slate-700 mx-auto" />
						<button onClick={onClose} className="absolute right-4 text-slate-500 text-2xl leading-none" aria-label="Fermer">
							×
						</button>
					</div>
					<MatchRow match={match} teamsById={teamsById} favoriteTeamId={favoriteTeamId} />
					<div className="grid grid-cols-4 gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
						{TABS.map((t) => (
							<button
								key={t.id}
								onClick={() => setTab(t.id)}
								className={`rounded-lg py-2 text-[11px] font-black transition-colors ${
									tab === t.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
								}`}
							>
								{t.label}
							</button>
						))}
					</div>
				</div>

				<div className="overflow-y-auto overscroll-contain px-4 pt-2 pb-[max(1.5rem,env(safe-area-inset-bottom))] min-h-48">
					{loading && (
						<div className="flex justify-center py-10">
							<span className="w-7 h-7 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
						</div>
					)}
					{error && <p className="text-center text-xs text-slate-500 py-8">Fiche indisponible pour le moment.</p>}
					{details && tab === 'timeline' && <TimelineSection details={details} />}
					{details && tab === 'stats' && <StatsSection details={details} sides={sides} />}
					{details && tab === 'lineups' && <LineupsSection details={details} sides={sides} />}
					{details && tab === 'h2h' && <HeadToHeadSection details={details} sides={sides} />}
				</div>
			</div>
		</div>
	);
}
