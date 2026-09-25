import { OUTCOME_LABELS, OUTCOME_STYLES, POSITION_OUTCOMES, LEAGUE_A_CROSS_GROUP, type Outcome } from '../data/competition';
import type { LeagueCode } from '../types/competition';

export default function OutcomeLegend({ league }: { league: LeagueCode }) {
	const outcomes = new Set<Outcome>(
		league === 'A'
			? [...POSITION_OUTCOMES.A.filter((o) => o !== 'crossRanked'), ...LEAGUE_A_CROSS_GROUP[3], ...LEAGUE_A_CROSS_GROUP[4]]
			: POSITION_OUTCOMES[league],
	);
	return (
		<ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-slate-400">
			{[...outcomes].map((o) => (
				<li key={o} className="flex items-center gap-1.5">
					<span className={`w-2 h-2 rounded-full ${OUTCOME_STYLES[o]}`} />
					{OUTCOME_LABELS[o]}
				</li>
			))}
		</ul>
	);
}
