import { OUTCOME_LABELS, OUTCOME_STYLES, type Outcome } from '../data/competition';
import type { TeamsById } from '../types/competition';
import type { FormResult, StandingRow } from '../utils/standings';

type StandingsTableProps = {
	title: string;
	rows: StandingRow[];
	teamsById: TeamsById;
	outcomes: Record<string, Outcome>;
	favoriteTeamId: string | null;
	showForm?: boolean;
	subtitle?: string;
};

const FORM_STYLES: Record<FormResult, string> = {
	W: 'bg-emerald-500 text-slate-950',
	D: 'bg-slate-600 text-slate-100',
	L: 'bg-rose-600 text-white',
};
const FORM_LABELS: Record<FormResult, string> = { W: 'V', D: 'N', L: 'D' };

export default function StandingsTable({
	title,
	rows,
	teamsById,
	outcomes,
	favoriteTeamId,
	showForm = true,
	subtitle,
}: StandingsTableProps) {
	return (
		<section className="bg-slate-900/70 border border-slate-800 rounded-xl overflow-hidden">
			<header className="flex items-baseline justify-between px-3 pt-3 pb-2">
				<h3 className="text-sm font-black text-slate-100">{title}</h3>
				{subtitle && <span className="text-[10px] font-bold text-slate-500">{subtitle}</span>}
			</header>
			<table className="w-full text-xs tabular-nums">
				<thead>
					<tr className="text-[10px] uppercase text-slate-500 border-b border-slate-800">
						<th className="text-left font-bold pl-3 py-1.5 w-6">#</th>
						<th className="text-left font-bold py-1.5">Équipe</th>
						<th className="font-bold w-7" title="Matchs joués">J</th>
						<th className="font-bold w-9" title="Différence de buts">Diff</th>
						<th className="font-bold w-8 pr-1" title="Points">Pts</th>
						{showForm && <th className="hidden sm:table-cell font-bold pr-3 w-24">Forme</th>}
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const team = teamsById[row.teamId];
						const outcome = outcomes[row.teamId];
						const isFavorite = row.teamId === favoriteTeamId;
						return (
							<tr
								key={row.teamId}
								className={`border-b border-slate-800/60 last:border-0 ${
									isFavorite ? 'bg-emerald-950/50' : ''
								}`}
							>
								<td className="pl-3 py-2">
									<span className="flex items-center gap-1.5">
										<span
											className={`w-1 h-4 rounded-full ${outcome ? OUTCOME_STYLES[outcome] : 'bg-transparent'}`}
											title={outcome ? OUTCOME_LABELS[outcome] : undefined}
										/>
										<span className="font-bold text-slate-400">{row.position}</span>
									</span>
								</td>
								<td className="py-2 pr-1">
									<span className="flex items-center gap-2 min-w-0">
										<span className="flags text-base leading-none">{team?.flag}</span>
										<span
											className={`truncate ${isFavorite ? 'font-black text-emerald-300' : 'font-semibold text-slate-200'}`}
										>
											{team?.name ?? row.teamId}
										</span>
									</span>
								</td>
								<td className="text-center text-slate-400">{row.played}</td>
								<td className="text-center text-slate-400">
									{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
								</td>
								<td className="text-center font-black text-slate-100 pr-1">{row.points}</td>
								{showForm && (
									<td className="hidden sm:table-cell pr-3">
										<span className="flex gap-0.5 justify-end">
											{row.form.map((r, i) => (
												<span
													key={i}
													className={`w-4 h-4 rounded-sm text-[9px] font-black flex items-center justify-center ${FORM_STYLES[r]}`}
												>
													{FORM_LABELS[r]}
												</span>
											))}
										</span>
									</td>
								)}
							</tr>
						);
					})}
				</tbody>
			</table>
		</section>
	);
}
