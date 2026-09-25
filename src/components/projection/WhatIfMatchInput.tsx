import type { Match, TeamsById } from '../../types/competition';
import { formatDayTab, formatTime } from '../../utils/format';
import { predictedScore } from '../../utils/projection';
import type { ScoreEntry } from '../../utils/whatIf';

type WhatIfMatchInputProps = {
	match: Match;
	teamsById: TeamsById;
	entry: ScoreEntry | undefined;
	favoriteTeamId: string | null;
	onChange: (entry: ScoreEntry) => void;
};

function parseScore(raw: string): number | null {
	const digits = raw.replace(/\D/g, '').slice(0, 2);
	return digits === '' ? null : Number(digits);
}

// Ligne de saisie d'un match restant : les cases vides affichent en grisé le
// score prédit par le modèle théorique (utilisé tant que rien n'est saisi).
export default function WhatIfMatchInput({ match, teamsById, entry, favoriteTeamId, onChange }: WhatIfMatchInputProps) {
	const home = match.homeTeamId ? teamsById[match.homeTeamId] : undefined;
	const away = match.awayTeamId ? teamsById[match.awayTeamId] : undefined;
	if (!home || !away) return null;

	const neutral = match.stage === 'SF' || match.stage === 'F' || match.stage === 'THIRD';
	const [predHome, predAway] = predictedScore(home.id, away.id, teamsById, neutral);
	const [homeScore, awayScore] = entry ?? [null, null];
	const edited = homeScore !== null || awayScore !== null;
	const complete = homeScore !== null && awayScore !== null;
	const live = match.status === 'LIVE' || match.status === 'HT';
	const day = formatDayTab(match.kickoffAt);
	const isFav = (id: string) => id === favoriteTeamId;

	const input = (value: number | null, placeholder: number, label: string, set: (v: number | null) => void) => (
		<input
			type="text"
			inputMode="numeric"
			pattern="[0-9]*"
			maxLength={2}
			aria-label={label}
			value={value ?? ''}
			placeholder={String(placeholder)}
			onChange={(e) => set(parseScore(e.target.value))}
			onFocus={(e) => e.target.select()}
			className={`w-8 h-8 rounded-md border text-center text-sm font-black tabular-nums bg-slate-950 placeholder:text-slate-600 focus:outline-hidden focus:border-cyan-400 ${
				complete ? 'border-cyan-500 text-cyan-200' : 'border-slate-700 text-slate-100'
			}`}
		/>
	);

	return (
		<div className={`grid grid-cols-[2.6rem_1fr_auto_1fr] items-center gap-2 rounded-lg px-2 py-1.5 ${complete ? 'bg-cyan-950/30' : ''}`}>
			<span className="text-[9px] leading-tight text-slate-500 text-center">
				{live ? (
					<span className="font-black text-rose-400">
						EN DIRECT
						<br />
						{match.homeScore}-{match.awayScore}
					</span>
				) : (
					<>
						{day.weekday} {day.day}
						<br />
						{formatTime(match.kickoffAt)}
					</>
				)}
			</span>
			<span className={`flex items-center justify-end gap-1.5 min-w-0 text-xs ${isFav(home.id) ? 'font-black text-emerald-300' : 'font-semibold text-slate-200'}`}>
				<span className="truncate">{home.id}</span>
				<span className="flags text-base leading-none">{home.flag}</span>
			</span>
			<span className="flex items-center gap-1">
				{input(homeScore, predHome, `Buts ${home.name}`, (v) => onChange([v, awayScore]))}
				<span className="text-slate-600 text-xs font-bold">-</span>
				{input(awayScore, predAway, `Buts ${away.name}`, (v) => onChange([homeScore, v]))}
				<button
					onClick={() => onChange([null, null])}
					className={`w-5 text-slate-500 hover:text-rose-400 text-sm ${edited ? '' : 'invisible'}`}
					aria-label="Effacer ce score"
					tabIndex={edited ? 0 : -1}
				>
					×
				</button>
			</span>
			<span className={`flex items-center gap-1.5 min-w-0 text-xs ${isFav(away.id) ? 'font-black text-emerald-300' : 'font-semibold text-slate-200'}`}>
				<span className="flags text-base leading-none">{away.flag}</span>
				<span className="truncate">{away.id}</span>
			</span>
		</div>
	);
}
