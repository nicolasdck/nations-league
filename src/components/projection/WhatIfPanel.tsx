import { STAGE_LABELS, type Outcome } from '../../data/competition';
import type { Group, LeagueCode, Match, TeamsById } from '../../types/competition';
import type { StandingRow } from '../../utils/standings';
import { isSimulable, type ScoreEntry, type ScoreOverrides } from '../../utils/whatIf';
import LeagueTabs from '../LeagueTabs';
import OutcomeLegend from '../OutcomeLegend';
import StandingsTable from '../StandingsTable';
import WhatIfMatchInput from './WhatIfMatchInput';

type WhatIfPanelProps = {
	groups: Group[];
	matches: Match[];
	teamsById: TeamsById;
	favoriteTeamId: string | null;
	league: LeagueCode;
	favoriteLeague: LeagueCode | null;
	onLeagueChange: (league: LeagueCode) => void;
	standingsByGroup: Record<string, StandingRow[]>;
	outcomes: Record<string, Outcome>;
	overrides: ScoreOverrides;
	activeCount: number;
	onChange: (matchId: number, entry: ScoreEntry) => void;
	onReset: () => void;
};

const byKickoff = (a: Match, b: Match) => a.kickoffAt.localeCompare(b.kickoffAt) || a.id - b.id;

// Saisie des scores des matchs restants, groupe par groupe, avec le
// classement simulé juste au-dessus pour voir l'effet de chaque saisie.
export default function WhatIfPanel({
	groups,
	matches,
	teamsById,
	favoriteTeamId,
	league,
	favoriteLeague,
	onLeagueChange,
	standingsByGroup,
	outcomes,
	overrides,
	activeCount,
	onChange,
	onReset,
}: WhatIfPanelProps) {
	const remaining = matches.filter(isSimulable).sort(byKickoff);
	const knockout = remaining.filter((m) => m.stage !== 'GROUP');

	const renderInputs = (list: Match[]) =>
		list.map((m) => (
			<WhatIfMatchInput
				key={m.id}
				match={m}
				teamsById={teamsById}
				entry={overrides[m.id]}
				favoriteTeamId={favoriteTeamId}
				onChange={(entry) => onChange(m.id, entry)}
			/>
		));

	return (
		<section className="flex flex-col gap-3">
			<div className="flex items-center justify-between gap-3">
				<h3 className="text-sm font-black text-slate-100">Vos scores</h3>
				{activeCount > 0 && (
					<button onClick={onReset} className="text-[11px] font-bold text-rose-400">
						Effacer mes {activeCount} score{activeCount > 1 ? 's' : ''}
					</button>
				)}
			</div>

			<LeagueTabs value={league} onChange={onLeagueChange} favoriteLeague={favoriteLeague} />
			<OutcomeLegend league={league} />

			<div className="grid gap-3 md:grid-cols-2">
				{groups
					.filter((g) => g.league === league)
					.map((group) => {
						const groupRemaining = remaining.filter((m) => m.stage === 'GROUP' && m.groupId === group.id);
						return (
							<div key={group.id} className="flex flex-col gap-1.5">
								<StandingsTable
									title={`Groupe ${group.id}`}
									subtitle="simulation"
									rows={standingsByGroup[group.id] ?? []}
									teamsById={teamsById}
									outcomes={outcomes}
									favoriteTeamId={favoriteTeamId}
									showForm={false}
								/>
								<div className="rounded-xl border border-slate-800 bg-slate-900/40 p-1.5 flex flex-col gap-0.5">
									{groupRemaining.length > 0 ? (
										renderInputs(groupRemaining)
									) : (
										<p className="text-center text-[11px] text-slate-500 py-2">Tous les matchs du groupe sont joués.</p>
									)}
								</div>
							</div>
						);
					})}
			</div>

			{knockout.length > 0 && (
				<div className="flex flex-col gap-1.5">
					<h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Phase finale & barrages</h4>
					<div className="rounded-xl border border-slate-800 bg-slate-900/40 p-1.5 flex flex-col gap-0.5">
						{knockout.map((m) => (
							<div key={m.id}>
								<p className="px-2 pt-1 text-[9px] font-bold text-slate-500">
									{STAGE_LABELS[m.stage]}
									{m.leg ? ` · ${m.leg === 1 ? 'aller' : 'retour'}` : ''}
								</p>
								{renderInputs([m])}
							</div>
						))}
					</div>
					<p className="text-[10px] text-slate-500">
						En cas d'égalité sur l'ensemble d'une confrontation, l'équipe la plus forte sur le papier est qualifiée
						(tirs au but non simulés).
					</p>
				</div>
			)}
		</section>
	);
}
