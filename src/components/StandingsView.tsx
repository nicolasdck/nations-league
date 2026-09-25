import { useMemo, useState } from 'react';
import type { Group, LeagueCode, Match, TeamsById } from '../types/competition';
import {
	computeOutcomes,
	computeStandings,
	groupFixtures,
	rankAcrossGroups,
	type StandingRow,
} from '../utils/standings';
import LeagueTabs from './LeagueTabs';
import OutcomeLegend from './OutcomeLegend';
import StandingsTable from './StandingsTable';

type StandingsViewProps = {
	groups: Group[];
	matches: Match[];
	teamsById: TeamsById;
	favoriteTeamId: string | null;
};

export default function StandingsView({ groups, matches, teamsById, favoriteTeamId }: StandingsViewProps) {
	const favoriteLeague = useMemo<LeagueCode | null>(() => {
		const groupId = favoriteTeamId ? teamsById[favoriteTeamId]?.groupId : null;
		return groups.find((g) => g.id === groupId)?.league ?? null;
	}, [favoriteTeamId, teamsById, groups]);

	const [selected, setSelected] = useState<LeagueCode | null>(null);
	const league = selected ?? favoriteLeague ?? 'A';

	// Classement « live » : les matchs en cours comptent avec leur score actuel.
	const standingsByGroup = useMemo(() => {
		const result: Record<string, StandingRow[]> = {};
		for (const group of groups) {
			result[group.id] = computeStandings(group.teamIds, groupFixtures(group, matches, true), teamsById);
		}
		return result;
	}, [groups, matches, teamsById]);

	const outcomes = useMemo(
		() => computeOutcomes(groups, standingsByGroup, teamsById),
		[groups, standingsByGroup, teamsById],
	);

	const leagueGroups = groups.filter((g) => g.league === league);
	const crossTables =
		league === 'A'
			? ([3, 4] as const).map((position) => ({
					position,
					rows: rankAcrossGroups(
						leagueGroups.flatMap((g) => standingsByGroup[g.id]?.filter((r) => r.position === position) ?? []),
						teamsById,
					).map((row, index) => ({ ...row, position: index + 1 })),
				}))
			: [];

	return (
		<div className="flex flex-col gap-4">
			<LeagueTabs value={league} onChange={setSelected} favoriteLeague={favoriteLeague} />
			<OutcomeLegend league={league} />

			<div className="grid gap-3 md:grid-cols-2">
				{leagueGroups.map((group) => (
					<StandingsTable
						key={group.id}
						title={`Groupe ${group.id}`}
						rows={standingsByGroup[group.id] ?? []}
						teamsById={teamsById}
						outcomes={outcomes}
						favoriteTeamId={favoriteTeamId}
					/>
				))}
			</div>

			{crossTables.map(({ position, rows }) => (
				<StandingsTable
					key={position}
					title={`Classement des ${position}es de groupe`}
					subtitle={position === 3 ? '2 derniers → barrages' : '2 premiers → barrages, 2 derniers → relégués'}
					rows={rows}
					teamsById={teamsById}
					outcomes={outcomes}
					favoriteTeamId={favoriteTeamId}
					showForm={false}
				/>
			))}
		</div>
	);
}
