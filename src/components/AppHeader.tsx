import type { Team } from '../types/competition';

type AppHeaderProps = {
	favoriteTeam: Team | null;
	isRefreshing: boolean;
	onOpenTeamPicker: () => void;
	onRefresh: () => void;
};

export default function AppHeader({
	favoriteTeam,
	isRefreshing,
	onOpenTeamPicker,
	onRefresh,
}: AppHeaderProps) {
	return (
		<header className="bg-slate-950 border-b border-slate-800 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 shadow-md">
			<div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
				<div className="min-w-0">
					<p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
						UEFA · 2026-27
					</p>
					<h1 className="text-2xl font-black bg-clip-text text-transparent bg-linear-to-r from-emerald-400 to-cyan-400 uppercase tracking-wide leading-tight truncate">
						Nations League
					</h1>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<button
						onClick={onRefresh}
						disabled={isRefreshing}
						className="w-10 h-10 text-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
						title="Actualiser"
						aria-label="Actualiser les scores"
					>
						<span className={isRefreshing ? 'animate-spin' : ''}>🔄</span>
					</button>
					<button
						onClick={onOpenTeamPicker}
						className="h-10 pl-2 pr-3 flex items-center gap-2 active:scale-95 transition-transform"
						title="Choisir mon équipe"
						aria-label="Choisir mon équipe préférée"
					>
						<span className="flags text-2xl leading-none">
							{favoriteTeam?.flag ?? '⭐'}
						</span>
						<span className="text-xs font-black text-emerald-400">
							{favoriteTeam ? favoriteTeam.id : 'Mon équipe'}
						</span>
					</button>
				</div>
			</div>
		</header>
	);
}
