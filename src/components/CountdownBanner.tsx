import { useEffect, useMemo, useState } from 'react';
import { STAGE_LABELS } from '../data/competition';
import { isLive, type Match, type TeamsById } from '../types/competition';
import { formatDayLabel, formatTime } from '../utils/format';

type CountdownBannerProps = {
	matches: Match[];
	teamsById: TeamsById;
	favoriteTeamId: string;
	onOpen: () => void;
};

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// Au-delà, un match NS dont l'heure est passée est considéré comme reporté ou
// oublié par la source : on passe au suivant.
const STALE_KICKOFF_MS = 3 * HOUR;

function splitDuration(ms: number) {
	return {
		days: Math.floor(ms / DAY),
		hours: Math.floor((ms % DAY) / HOUR),
		minutes: Math.floor((ms % HOUR) / MINUTE),
		seconds: Math.floor((ms % MINUTE) / SECOND),
	};
}

function stageLabel(match: Match): string {
	if (match.stage === 'GROUP')
		return `Groupe ${match.groupId ?? '?'}${match.matchday ? ` · J${match.matchday}` : ''}`;
	return `${STAGE_LABELS[match.stage]}${match.leg ? ` · ${match.leg === 1 ? 'aller' : 'retour'}` : ''}`;
}

function Unit({
	value,
	unit,
	accent = false,
}: {
	value: string;
	unit: string;
	accent?: boolean;
}) {
	return (
		<span className="bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-md shadow-sm min-w-11 text-center">
			<span
				className={`font-black ${accent ? 'text-amber-400' : 'text-emerald-400'}`}
			>
				{value}
			</span>
			<span className="text-[10px] text-slate-500 uppercase ml-0.5">
				{unit}
			</span>
		</span>
	);
}

// Prochain match (ou match en cours) de l'équipe préférée, sous l'en-tête.
export default function CountdownBanner({
	matches,
	teamsById,
	favoriteTeamId,
	onOpen,
}: CountdownBannerProps) {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const interval = setInterval(() => setNow(Date.now()), SECOND);
		return () => clearInterval(interval);
	}, []);

	const favoriteMatches = useMemo(
		() =>
			matches
				.filter(
					(m) =>
						m.homeTeamId === favoriteTeamId || m.awayTeamId === favoriteTeamId,
				)
				.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt)),
		[matches, favoriteTeamId],
	);

	// Match en cours en priorité, sinon le prochain coup d'envoi.
	const match =
		favoriteMatches.find(isLive) ??
		favoriteMatches.find(
			(m) =>
				m.status === 'NS' &&
				new Date(m.kickoffAt).getTime() > now - STALE_KICKOFF_MS,
		);
	if (!match) return null;

	const isHome = match.homeTeamId === favoriteTeamId;
	const opponentId = isHome ? match.awayTeamId : match.homeTeamId;
	const opponent = opponentId ? teamsById[opponentId] : undefined;
	const opponentName =
		opponent?.name ??
		(isHome ? match.placeholderAway : match.placeholderHome) ??
		'à déterminer';
	const live = isLive(match);
	const remaining = new Date(match.kickoffAt).getTime() - now;
	const home = match.homeTeamId ? teamsById[match.homeTeamId] : undefined;
	const away = match.awayTeamId ? teamsById[match.awayTeamId] : undefined;
	const favoriteTeam = teamsById[favoriteTeamId];
	const favoriteFlag = (
		<span className="flags text-base leading-none" title={favoriteTeam?.name}>
			{favoriteTeam?.flag}
		</span>
	);

	return (
		<button
			onClick={onOpen}
			className={`w-full border-b py-2.5 px-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-center shadow-md ${
				live
					? 'bg-linear-to-r from-slate-950 via-rose-950/40 to-slate-950 border-rose-500/40'
					: 'bg-linear-to-r from-slate-950 via-emerald-950/40 to-slate-950 border-emerald-500/30'
			}`}
			aria-label={`Prochain match contre ${opponentName}`}
		>
			<span className="flex flex-col items-center sm:items-start gap-0.5 min-w-0">
				<span className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
					{live ? (
						<span className="flex items-center gap-1 text-rose-400 font-black">
							<span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
							EN DIRECT
						</span>
					) : (
						<span>Prochain match</span>
					)}
					{/* Ordre du match : l'équipe qui reçoit d'abord. */}
					{isHome && favoriteFlag}
					<span className="text-emerald-400 font-black truncate">
						{opponentName}
					</span>
					<span className="flags text-base leading-none">
						{opponent?.flag ?? '🏳️'}
					</span>
					{!isHome && favoriteFlag}- {isHome ? 'à domicile' : "à l'extérieur"}
				</span>
				<span className="text-[10px] text-slate-500 truncate max-w-full">
					{formatDayLabel(match.kickoffAt)} · {formatTime(match.kickoffAt)} ·{' '}
					{stageLabel(match)}
					{match.venue ? ` · ${match.venue}` : ''}
				</span>
			</span>

			{live ? (
				<span className="flex items-center gap-2 font-black text-slate-100">
					<span className="flags text-lg leading-none">{home?.flag}</span>
					<span className="bg-rose-950/60 border border-rose-500/40 rounded-md px-2.5 py-1 tabular-nums text-rose-200">
						{match.homeScore ?? 0} - {match.awayScore ?? 0}
					</span>
					<span className="flags text-lg leading-none">{away?.flag}</span>
					<span className="text-xs text-rose-400">
						{match.status === 'HT'
							? 'MT'
							: match.minute
								? `${match.minute}'`
								: ''}
					</span>
				</span>
			) : remaining > 0 ? (
				<span className="flex items-center gap-1.5 text-white font-mono text-sm tabular-nums">
					{(() => {
						const t = splitDuration(remaining);
						return (
							<>
								{t.days > 0 && <Unit value={String(t.days)} unit="j" />}
								<Unit value={String(t.hours).padStart(2, '0')} unit="h" />
								<Unit value={String(t.minutes).padStart(2, '0')} unit="m" />
								<Unit
									value={String(t.seconds).padStart(2, '0')}
									unit="s"
									accent
								/>
							</>
						);
					})()}
				</span>
			) : (
				<span className="text-xs font-black text-amber-400 animate-pulse">
					Coup d'envoi imminent
				</span>
			)}
		</button>
	);
}
