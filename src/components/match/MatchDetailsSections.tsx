import type {
	DetailSide,
	FormGame,
	HeadToHeadGame,
	Lineup,
	LineupPlayer,
	MatchDetails,
	TimelineEvent,
	TimelineEventType,
} from '../../lib/matchDetails';
import type { Team } from '../../types/competition';

type Sides = Record<DetailSide, Team | undefined>;

function Empty({ children }: { children: string }) {
	return <p className="text-center text-xs text-slate-500 py-8">{children}</p>;
}

// ---------------------------------------------------------------------------
// Chronologie
// ---------------------------------------------------------------------------

const EVENT_ICONS: Record<TimelineEventType, string> = {
	goal: '⚽',
	'penalty-goal': '⚽',
	'own-goal': '⚽',
	'penalty-missed': '❌',
	'yellow-card': '🟨',
	'red-card': '🟥',
	substitution: '🔄',
	halftime: '',
	fulltime: '',
};

function eventText(event: TimelineEvent): { main: string; sub: string | null } {
	const [first, second] = event.players;
	switch (event.type) {
		case 'goal':
			return { main: first ?? 'But', sub: second ? `passe ${second}` : null };
		case 'penalty-goal':
			return { main: `${first ?? 'But'} (sp)`, sub: null };
		case 'own-goal':
			return { main: `${first ?? 'But'} (c.s.c.)`, sub: null };
		case 'penalty-missed':
			return { main: `${first ?? '?'}`, sub: 'penalty manqué' };
		case 'substitution':
			return { main: `↑ ${first ?? '?'}`, sub: second ? `↓ ${second}` : null };
		default:
			return { main: first ?? '', sub: null };
	}
}

export function TimelineSection({ details }: { details: MatchDetails }) {
	if (details.timeline.length === 0) {
		return <Empty>{details.state === 'pre' ? 'La chronologie démarre au coup d’envoi.' : 'Aucun événement pour le moment.'}</Empty>;
	}
	return (
		<ol className="flex flex-col gap-1.5">
			{details.timeline.map((event, i) => {
				if (event.type === 'halftime' || event.type === 'fulltime') {
					return (
						<li key={i} className="flex items-center gap-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
							<span className="h-px flex-1 bg-slate-800" />
							{event.type === 'halftime' ? 'Mi-temps' : 'Fin du temps réglementaire'}
							<span className="h-px flex-1 bg-slate-800" />
						</li>
					);
				}
				const { main, sub } = eventText(event);
				const isGoal = event.type === 'goal' || event.type === 'penalty-goal' || event.type === 'own-goal';
				const content = (
					<span className={`flex items-center gap-1.5 min-w-0 ${event.side === 'away' ? 'flex-row-reverse text-right' : ''}`}>
						<span className="text-sm shrink-0">{EVENT_ICONS[event.type]}</span>
						<span className="min-w-0">
							<span className={`block truncate text-xs ${isGoal ? 'font-black text-slate-100' : 'font-semibold text-slate-300'}`}>
								{main}
							</span>
							{sub && <span className="block truncate text-[10px] text-slate-500">{sub}</span>}
						</span>
					</span>
				);
				return (
					<li key={i} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-lg px-2 py-1.5 ${isGoal ? 'bg-emerald-950/40' : ''}`}>
						<span>{event.side !== 'away' && content}</span>
						<span className="text-[10px] font-black text-cyan-400 tabular-nums w-10 text-center">{event.minute}</span>
						<span>{event.side === 'away' && content}</span>
					</li>
				);
			})}
		</ol>
	);
}

// ---------------------------------------------------------------------------
// Statistiques
// ---------------------------------------------------------------------------

export function StatsSection({ details, sides }: { details: MatchDetails; sides: Sides }) {
	if (details.stats.length === 0) {
		return <Empty>Statistiques disponibles pendant le match.</Empty>;
	}
	return (
		<div className="flex flex-col gap-3">
			<div className="flex justify-between text-xs font-black text-slate-300">
				<span className="flags">{sides.home?.flag} {sides.home?.id}</span>
				<span className="flags">{sides.away?.id} {sides.away?.flag}</span>
			</div>
			{details.stats.map((stat) => {
				const home = Number.parseFloat(stat.home) || 0;
				const away = Number.parseFloat(stat.away) || 0;
				const total = home + away;
				const homePct = total > 0 ? (home / total) * 100 : 50;
				return (
					<div key={stat.key} className="flex flex-col gap-1">
						<div className="flex justify-between text-xs tabular-nums">
							<span className={`font-black ${home > away ? 'text-emerald-300' : 'text-slate-300'}`}>{stat.home}</span>
							<span className="text-[10px] font-bold text-slate-500">{stat.label}</span>
							<span className={`font-black ${away > home ? 'text-cyan-300' : 'text-slate-300'}`}>{stat.away}</span>
						</div>
						<div className="flex h-1.5 gap-0.5 rounded-full overflow-hidden bg-slate-800">
							<span className="bg-emerald-500 rounded-l-full" style={{ width: `${homePct}%` }} />
							<span className="bg-cyan-500 rounded-r-full flex-1" />
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Compositions
// ---------------------------------------------------------------------------

function PlayerLine({ player, align }: { player: LineupPlayer; align: 'left' | 'right' }) {
	return (
		<li className={`flex items-center gap-1.5 text-[11px] ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
			<span className="w-5 shrink-0 text-center font-black text-slate-500 tabular-nums">{player.jersey}</span>
			<span className="min-w-0 truncate font-semibold text-slate-200">{player.name}</span>
			{player.subbedOut && <span className="shrink-0 text-[9px] text-rose-400">↓{player.subMinute}</span>}
			{player.subbedIn && <span className="shrink-0 text-[9px] text-emerald-400">↑{player.subMinute}</span>}
		</li>
	);
}

function LineupColumn({ lineup, team, align }: { lineup: Lineup | null; team: Team | undefined; align: 'left' | 'right' }) {
	return (
		<div className="flex flex-col gap-2 min-w-0">
			<p className={`text-xs font-black text-slate-100 ${align === 'right' ? 'text-right' : ''}`}>
				<span className="flags">{team?.flag}</span> {team?.id}
				{lineup?.formation && <span className="ml-1 text-[10px] font-bold text-cyan-400">{lineup.formation}</span>}
			</p>
			{lineup ? (
				<>
					<ul className="flex flex-col gap-1">
						{lineup.starters.map((p, i) => (
							<PlayerLine key={`${p.name}-${i}`} player={p} align={align} />
						))}
					</ul>
					{lineup.bench.length > 0 && (
						<>
							<p className={`mt-1 text-[9px] font-black uppercase tracking-widest text-slate-500 ${align === 'right' ? 'text-right' : ''}`}>
								Remplaçants
							</p>
							<ul className="flex flex-col gap-1 opacity-80">
								{lineup.bench.map((p, i) => (
									<PlayerLine key={`${p.name}-${i}`} player={p} align={align} />
								))}
							</ul>
						</>
					)}
				</>
			) : (
				<p className={`text-[11px] text-slate-500 ${align === 'right' ? 'text-right' : ''}`}>Non communiquée</p>
			)}
		</div>
	);
}

export function LineupsSection({ details, sides }: { details: MatchDetails; sides: Sides }) {
	if (!details.lineups.home && !details.lineups.away) {
		return <Empty>Compositions publiées environ 1 h avant le coup d’envoi.</Empty>;
	}
	return (
		<div className="grid grid-cols-2 gap-4">
			<LineupColumn lineup={details.lineups.home} team={sides.home} align="left" />
			<LineupColumn lineup={details.lineups.away} team={sides.away} align="right" />
		</div>
	);
}

// ---------------------------------------------------------------------------
// Face-à-face et forme
// ---------------------------------------------------------------------------

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDate = (iso: string) => (iso ? dateFormatter.format(new Date(iso)) : '');

const RESULT_STYLES: Record<NonNullable<FormGame['result']>, string> = {
	W: 'bg-emerald-500 text-slate-950',
	D: 'bg-slate-500 text-slate-950',
	L: 'bg-rose-600 text-white',
};
const RESULT_LABELS: Record<NonNullable<FormGame['result']>, string> = { W: 'V', D: 'N', L: 'D' };

function FormList({ games, team }: { games: FormGame[]; team: Team | undefined }) {
	return (
		<div className="flex flex-col gap-1.5 min-w-0">
			<p className="text-xs font-black text-slate-100">
				<span className="flags">{team?.flag}</span> {team?.name}
			</p>
			{games.length === 0 && <p className="text-[11px] text-slate-500">—</p>}
			{games.map((g, i) => (
				<div key={i} className="flex items-center gap-2 text-[11px]">
					<span
						className={`w-4 h-4 shrink-0 rounded-sm text-[9px] font-black flex items-center justify-center ${
							g.result ? RESULT_STYLES[g.result] : 'bg-slate-800'
						}`}
					>
						{g.result ? RESULT_LABELS[g.result] : '?'}
					</span>
					<span className="font-bold text-slate-200 tabular-nums">{g.score}</span>
					<span className="truncate text-slate-400">
						{g.atVs === '@' ? 'à' : 'vs'} {g.opponent}
					</span>
					<span className="ml-auto shrink-0 text-[9px] text-slate-600">{shortDate(g.date)}</span>
				</div>
			))}
		</div>
	);
}

function HeadToHeadList({ games }: { games: HeadToHeadGame[] }) {
	if (games.length === 0) return <p className="text-[11px] text-slate-500">Aucune confrontation récente.</p>;
	return (
		<ul className="flex flex-col gap-1">
			{games.map((g, i) => (
				<li key={i} className="grid grid-cols-[4.5rem_1fr_auto_1fr] items-center gap-2 text-xs">
					<span className="text-[10px] text-slate-500 tabular-nums">{shortDate(g.date)}</span>
					<span className="text-right font-bold text-slate-300">{g.homeAbbr}</span>
					<span className="rounded bg-slate-950 px-2 py-0.5 font-black tabular-nums text-slate-100">
						{g.homeScore} - {g.awayScore}
					</span>
					<span className="font-bold text-slate-300">{g.awayAbbr}</span>
				</li>
			))}
		</ul>
	);
}

export function HeadToHeadSection({ details, sides }: { details: MatchDetails; sides: Sides }) {
	return (
		<div className="flex flex-col gap-5">
			<section className="flex flex-col gap-2">
				<h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Dernières confrontations</h4>
				<HeadToHeadList games={details.headToHead} />
			</section>
			<section className="flex flex-col gap-2">
				<h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Forme (5 derniers matchs)</h4>
				<div className="grid gap-4 sm:grid-cols-2">
					<FormList games={details.form.home} team={sides.home} />
					<FormList games={details.form.away} team={sides.away} />
				</div>
			</section>
			{(details.referee || details.venue) && (
				<section className="flex flex-col gap-1 text-[11px] text-slate-400">
					{details.venue && (
						<p>
							🏟️ {details.venue}
							{details.city ? `, ${details.city}` : ''}
							{details.attendance ? ` · ${details.attendance.toLocaleString('fr-FR')} spectateurs` : ''}
						</p>
					)}
					{details.referee && <p>🧑‍⚖️ Arbitre : {details.referee}</p>}
				</section>
			)}
		</div>
	);
}
