import type { Team } from '../types/competition';

type TeamLabelProps = {
	team: Team | undefined;
	placeholder?: string | null;
	align?: 'left' | 'right';
	compact?: boolean;
	highlight?: boolean;
};

// Drapeau + nom (ou code FIFA en mode compact). Le drapeau est toujours du
// côté du score pour que les deux équipes restent symétriques.
export default function TeamLabel({
	team,
	placeholder,
	align = 'left',
	compact = false,
	highlight = false,
}: TeamLabelProps) {
	const name = team ? (compact ? team.id : team.name) : (placeholder ?? 'À déterminer');
	const flag = <span className="flags text-lg leading-none shrink-0">{team?.flag ?? '🏳️'}</span>;
	const text = (
		<span
			className={`text-xs truncate ${highlight ? 'font-black text-emerald-300' : 'font-semibold text-slate-200'} ${
				team ? '' : 'italic text-slate-500'
			}`}
		>
			{name}
		</span>
	);

	return (
		<span
			className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'justify-end' : 'justify-start'}`}
		>
			{align === 'right' ? (
				<>
					{text}
					{flag}
				</>
			) : (
				<>
					{flag}
					{text}
				</>
			)}
		</span>
	);
}
