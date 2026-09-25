import { OUTCOME_BADGE_STYLES, OUTCOME_LABELS, OUTCOME_STYLES, type Outcome } from '../data/competition';
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
	D: 'bg-slate-500 text-slate-950',
	L: 'bg-rose-600 text-white',
};
const FORM_LABELS: Record<FormResult, string> = { W: 'V', D: 'N', L: 'D' };
const FORM_LENGTH = 5;

const STAT_COLUMNS: { key: keyof StandingRow; label: string; title: string }[] = [
	{ key: 'played', label: 'J', title: 'Matchs joués' },
	{ key: 'won', label: 'G', title: 'Victoires' },
	{ key: 'drawn', label: 'N', title: 'Nuls' },
	{ key: 'lost', label: 'P', title: 'Défaites' },
	{ key: 'goalsFor', label: 'BP', title: 'Buts pour' },
	{ key: 'goalsAgainst', label: 'BC', title: 'Buts contre' },
];

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
				{subtitle && <span className="text-[10px] font-bold text-slate-500 text-right">{subtitle}</span>}
			</header>

			{/* Colonne équipe figée, statistiques défilantes sur petit écran. */}
			<div className="overflow-x-auto no-scrollbar">
				<table className="w-full text-[11px] tabular-nums border-separate border-spacing-0">
					<thead>
						<tr className="text-[9px] uppercase tracking-wide text-slate-500">
							<th className="sticky left-0 z-10 bg-slate-900 text-left font-bold pl-3 pr-2 py-1.5 border-b border-slate-800">
								Équipe
							</th>
							<th className="font-bold px-1 py-1.5 border-b border-slate-800" title="Points">
								Pts
							</th>
							{STAT_COLUMNS.map((c) => (
								<th key={c.key} className="font-bold px-1 py-1.5 w-7 border-b border-slate-800" title={c.title}>
									{c.label}
								</th>
							))}
							<th className="font-bold px-1 py-1.5 w-8 border-b border-slate-800" title="Différence de buts">
								Diff
							</th>
							{showForm && (
								<th className="font-bold pl-2 pr-3 py-1.5 border-b border-slate-800" title="5 derniers matchs">
									Forme
								</th>
							)}
						</tr>
					</thead>
					<tbody>
						{rows.map((row) => {
							const team = teamsById[row.teamId];
							const outcome = outcomes[row.teamId];
							const isFavorite = row.teamId === favoriteTeamId;
							// Fond opaque : la cellule figée doit masquer les colonnes qui défilent dessous.
							const rowBg = isFavorite ? 'bg-emerald-950' : 'bg-slate-900';
							const cell = `border-b border-slate-800/70 ${isFavorite ? 'bg-emerald-950/60' : ''}`;
							const emptyForm = Math.max(0, FORM_LENGTH - row.form.length);
							return (
								<tr key={row.teamId} className="[&:last-child>td]:border-b-0">
									<td className={`sticky left-0 z-10 pl-3 pr-2 py-2 ${rowBg} border-b border-slate-800/70`}>
										<span className="flex items-center gap-2 min-w-0">
											<span
												className={`w-1 h-5 rounded-full shrink-0 ${outcome ? OUTCOME_STYLES[outcome] : 'bg-transparent'}`}
												title={outcome ? OUTCOME_LABELS[outcome] : undefined}
											/>
											<span className="w-3 text-right font-bold text-slate-500 shrink-0">{row.position}</span>
											<span className="flags text-base leading-none shrink-0">{team?.flag}</span>
											<span
												className={`truncate max-w-26 sm:max-w-none ${
													isFavorite ? 'font-black text-emerald-300' : 'font-semibold text-slate-200'
												}`}
											>
												{team?.name ?? row.teamId}
											</span>
										</span>
									</td>
									<td className={`text-center px-1 py-2 ${cell}`}>
										<span
											className={`inline-flex min-w-6 h-6 px-1 items-center justify-center rounded-full border text-xs font-black ${
												outcome ? OUTCOME_BADGE_STYLES[outcome] : 'border-slate-700 text-slate-200'
											}`}
										>
											{row.points}
										</span>
									</td>
									{STAT_COLUMNS.map((c) => (
										<td key={c.key} className={`text-center px-1 py-2 text-slate-300 ${cell}`}>
											{row[c.key] as number}
										</td>
									))}
									<td
										className={`text-center px-1 py-2 font-bold ${cell} ${
											row.goalDifference > 0 ? 'text-emerald-400' : row.goalDifference < 0 ? 'text-rose-400' : 'text-slate-400'
										}`}
									>
										{row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
									</td>
									{showForm && (
										<td className={`pl-2 pr-3 py-2 ${cell}`}>
											<span className="flex gap-0.5 justify-end">
												{row.form.map((r, i) => (
													<span
														key={i}
														className={`w-4 h-4 rounded-sm text-[9px] font-black flex items-center justify-center ${FORM_STYLES[r]}`}
													>
														{FORM_LABELS[r]}
													</span>
												))}
												{Array.from({ length: emptyForm }, (_, i) => (
													<span key={`empty-${i}`} className="w-4 h-4 flex items-center justify-center">
														<span className="w-1.5 h-1.5 rounded-full bg-slate-700" />
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
			</div>
		</section>
	);
}
