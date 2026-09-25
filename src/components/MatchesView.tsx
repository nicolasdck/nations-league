import { useEffect, useMemo, useRef, useState } from 'react';
import { LEAGUE_LABELS, LEAGUES } from '../data/competition';
import { isLive, type Group, type LeagueCode, type Match, type TeamsById } from '../types/competition';
import { formatDayLabel, formatDayTab, localDayKey, todayKey } from '../utils/format';
import MatchRow from './MatchRow';

type Filter = 'all' | 'live' | 'favorite' | LeagueCode;

type MatchesViewProps = {
	matches: Match[];
	groups: Group[];
	teamsById: TeamsById;
	favoriteTeamId: string | null;
};

function leagueOf(match: Match, groups: Group[], teamsById: TeamsById): LeagueCode | null {
	if (match.groupId) return groups.find((g) => g.id === match.groupId)?.league ?? null;
	// Quarts / Final Four = Ligue A ; barrages rattachés à la ligue supérieure.
	if (match.stage === 'QF' || match.stage === 'SF' || match.stage === 'F' || match.stage === 'THIRD') {
		return 'A';
	}
	const leagues = [match.homeTeamId, match.awayTeamId]
		.map((id) => (id ? teamsById[id]?.groupId : null))
		.map((gid) => groups.find((g) => g.id === gid)?.league)
		.filter((l): l is LeagueCode => Boolean(l))
		.sort();
	return leagues[0] ?? null;
}

export default function MatchesView({ matches, groups, teamsById, favoriteTeamId }: MatchesViewProps) {
	const [filter, setFilter] = useState<Filter>('all');
	const todayRef = useRef<HTMLElement | null>(null);
	const today = todayKey();

	const liveCount = useMemo(() => matches.filter(isLive).length, [matches]);

	const days = useMemo(() => {
		const filtered = matches.filter((m) => {
			switch (filter) {
				case 'all':
					return true;
				case 'live':
					return isLive(m);
				case 'favorite':
					return favoriteTeamId !== null && (m.homeTeamId === favoriteTeamId || m.awayTeamId === favoriteTeamId);
				default:
					return leagueOf(m, groups, teamsById) === filter;
			}
		});
		const byDay = new Map<string, Match[]>();
		for (const m of filtered) {
			const key = localDayKey(m.kickoffAt);
			byDay.set(key, [...(byDay.get(key) ?? []), m]);
		}
		return [...byDay.entries()].map(([key, dayMatches]) => ({ key, matches: dayMatches }));
	}, [matches, filter, favoriteTeamId, groups, teamsById]);

	// Filtre « Tous » : un jour précis peut être sélectionné (null = tous les
	// jours). À l'ouverture : le jour même s'il y a des matchs aujourd'hui.
	const [selectedDay, setSelectedDay] = useState<string | null>(() =>
		matches.some((m) => localDayKey(m.kickoffAt) === today) ? today : null,
	);
	const visibleDays =
		filter === 'all' && selectedDay ? days.filter((d) => d.key === selectedDay) : days;

	// Premier jour à venir (ou aujourd'hui) : point d'ancrage du défilement.
	const anchorKey = visibleDays.find((d) => d.key >= today)?.key ?? visibleDays[visibleDays.length - 1]?.key;
	const defaultDayKey = days.find((d) => d.key >= today)?.key ?? days[days.length - 1]?.key;

	useEffect(() => {
		todayRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
	}, [anchorKey, filter, selectedDay]);

	// Centre la bande des jours sur le jour sélectionné, ou sur aujourd'hui /
	// le prochain jour de match (défilement horizontal de la bande uniquement).
	const dayStripRef = useRef<HTMLDivElement | null>(null);
	const focusDayKey = selectedDay ?? defaultDayKey;
	useEffect(() => {
		const strip = dayStripRef.current;
		const tab = strip?.querySelector<HTMLElement>(`[data-day="${focusDayKey}"]`);
		if (!strip || !tab) return;
		strip.scrollTo({ left: tab.offsetLeft - strip.clientWidth / 2 + tab.clientWidth / 2, behavior: 'smooth' });
	}, [focusDayKey, filter]);

	const selectFilter = (next: Filter) => {
		setFilter(next);
		setSelectedDay(null);
	};

	const chips: { id: Filter; label: string }[] = [
		{ id: 'all', label: 'Tous' },
		{ id: 'live', label: liveCount > 0 ? `🔴 En direct (${liveCount})` : 'En direct' },
		...(favoriteTeamId ? [{ id: 'favorite' as const, label: `⭐ ${teamsById[favoriteTeamId]?.name ?? 'Mon équipe'}` }] : []),
		...LEAGUES.map((l) => ({ id: l, label: LEAGUE_LABELS[l] })),
	];

	return (
		<div className="flex flex-col gap-4">
			<div className="-mx-4 sticky top-14 z-30 bg-slate-950/95 backdrop-blur">
				<div className="px-4 flex gap-2 overflow-x-auto no-scrollbar py-2">
					{chips.map((chip) => (
						<button
							key={chip.id}
							onClick={() => selectFilter(chip.id)}
							className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-colors ${
								filter === chip.id
									? 'bg-emerald-500 border-emerald-500 text-slate-950'
									: 'bg-slate-900 border-slate-800 text-slate-300'
							}`}
						>
							{chip.label}
						</button>
					))}
				</div>

				{filter === 'all' && days.length > 0 && (
					<div ref={dayStripRef} className="px-4 flex gap-1.5 overflow-x-auto no-scrollbar pb-2">
						<button
							onClick={() => setSelectedDay(null)}
							className={`shrink-0 rounded-lg border px-3 text-[11px] font-black transition-colors ${
								selectedDay === null
									? 'bg-cyan-500 border-cyan-500 text-slate-950'
									: 'bg-slate-900 border-slate-800 text-slate-400'
							}`}
						>
							Tous les
							<br />
							jours
						</button>
						{days.map((day) => {
							const { weekday, day: dayNumber, month } = formatDayTab(day.matches[0].kickoffAt);
							const selected = selectedDay === day.key;
							const hasLive = day.matches.some(isLive);
							const isToday = day.key === today;
							return (
								<button
									key={day.key}
									data-day={day.key}
									onClick={() => setSelectedDay(selected ? null : day.key)}
									aria-pressed={selected}
									title={`${formatDayLabel(day.matches[0].kickoffAt)} · ${day.matches.length} match${day.matches.length > 1 ? 's' : ''}`}
									className={`relative shrink-0 w-13 rounded-lg border py-1 flex flex-col items-center leading-tight transition-colors ${
										selected
											? 'bg-cyan-500 border-cyan-500 text-slate-950'
											: isToday
												? 'bg-slate-900 border-emerald-500 text-emerald-300'
												: day.key < today
													? 'bg-slate-900/60 border-slate-800 text-slate-500'
													: 'bg-slate-900 border-slate-800 text-slate-300'
									}`}
								>
									<span className="text-[9px] font-bold uppercase">{isToday ? 'auj.' : weekday}</span>
									<span className="text-base font-black tabular-nums">{dayNumber}</span>
									<span className="text-[9px] font-bold">{month}</span>
									{hasLive && (
										<span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
									)}
								</button>
							);
						})}
					</div>
				)}
			</div>

			{visibleDays.length === 0 && (
				<p className="text-center text-sm text-slate-500 py-12">
					{filter === 'live' ? 'Aucun match en cours.' : 'Aucun match pour ce filtre.'}
				</p>
			)}

			{visibleDays.map((day) => (
				<section
					key={day.key}
					ref={day.key === anchorKey ? todayRef : undefined}
					className="scroll-mt-44 flex flex-col gap-2"
				>
					<h2
						className={`text-xs font-black uppercase tracking-wider ${
							day.key === today ? 'text-emerald-400' : 'text-slate-400'
						}`}
					>
						{day.key === today ? "Aujourd'hui · " : ''}
						{formatDayLabel(day.matches[0].kickoffAt)}
					</h2>
					{day.matches.map((m) => (
						<MatchRow key={m.id} match={m} teamsById={teamsById} favoriteTeamId={favoriteTeamId} />
					))}
				</section>
			))}
		</div>
	);
}
