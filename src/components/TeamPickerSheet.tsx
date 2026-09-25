import { useMemo, useState } from 'react';
import { LEAGUE_LABELS, LEAGUES } from '../data/competition';
import type { Group, Team, TeamsById } from '../types/competition';

type TeamPickerSheetProps = {
	groups: Group[];
	teamsById: TeamsById;
	selectedTeamId: string | null;
	onSelect: (teamId: string | null) => void;
	onClose: () => void;
};

const normalize = (value: string) =>
	value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function TeamPickerSheet({
	groups,
	teamsById,
	selectedTeamId,
	onSelect,
	onClose,
}: TeamPickerSheetProps) {
	const [query, setQuery] = useState('');

	const sections = useMemo(() => {
		const q = normalize(query.trim());
		return LEAGUES.map((league) => ({
			league,
			teams: groups
				.filter((g) => g.league === league)
				.flatMap((g) => g.teamIds.map((id) => teamsById[id]))
				.filter((t): t is Team => Boolean(t))
				.filter((t) => !q || normalize(t.name).includes(q) || t.id.toLowerCase().includes(q))
				.sort((a, b) => a.name.localeCompare(b.name, 'fr')),
		})).filter((s) => s.teams.length > 0);
	}, [groups, teamsById, query]);

	return (
		<div
			className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-xs animate-fade-in"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label="Choisir mon équipe"
		>
			<div
				className="bg-slate-900 border-t border-slate-800 rounded-t-2xl w-full max-w-xl max-h-[85dvh] flex flex-col shadow-2xl animate-slide-up"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="p-4 pb-2">
					<div className="w-10 h-1 rounded-full bg-slate-700 mx-auto mb-3" />
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-black text-slate-100">Mon équipe préférée</h2>
						{selectedTeamId && (
							<button
								onClick={() => {
									onSelect(null);
									onClose();
								}}
								className="text-xs font-bold text-rose-400"
							>
								Aucune
							</button>
						)}
					</div>
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Rechercher un pays…"
						className="w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-hidden focus:border-emerald-500"
					/>
				</div>

				<div className="overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
					{sections.length === 0 && (
						<p className="text-center text-sm text-slate-500 py-8">Aucune équipe trouvée.</p>
					)}
					{sections.map(({ league, teams }) => (
						<section key={league} className="mb-4">
							<h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
								{LEAGUE_LABELS[league]}
							</h3>
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
								{teams.map((team) => {
									const selected = team.id === selectedTeamId;
									return (
										<button
											key={team.id}
											onClick={() => {
												onSelect(team.id);
												onClose();
											}}
											className={`flex items-center gap-2 rounded-lg px-3 py-3 text-left border transition-colors ${
												selected
													? 'bg-emerald-950/60 border-emerald-400'
													: 'bg-slate-950 border-slate-800 active:border-slate-600'
											}`}
											style={{ boxShadow: `inset 3px 0 0 ${team.primaryColor}` }}
										>
											<span className="flags text-2xl leading-none">{team.flag}</span>
											<span className="text-xs font-bold text-slate-200 truncate">{team.name}</span>
										</button>
									);
								})}
							</div>
						</section>
					))}
				</div>
			</div>
		</div>
	);
}
