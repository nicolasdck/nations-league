import { LEAGUE_LABELS, LEAGUES } from '../data/competition';
import type { LeagueCode } from '../types/competition';

type LeagueTabsProps = {
	value: LeagueCode;
	onChange: (league: LeagueCode) => void;
	favoriteLeague: LeagueCode | null;
};

export default function LeagueTabs({ value, onChange, favoriteLeague }: LeagueTabsProps) {
	return (
		<div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
			{LEAGUES.map((league) => (
				<button
					key={league}
					onClick={() => onChange(league)}
					className={`relative rounded-lg py-2 text-xs font-black transition-colors ${
						value === league ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
					}`}
				>
					{LEAGUE_LABELS[league]}
					{favoriteLeague === league && (
						<span className="absolute -top-1 -right-0.5 text-[10px]" aria-label="Ligue de mon équipe">
							⭐
						</span>
					)}
				</button>
			))}
		</div>
	);
}
