import { useMemo, useState } from 'react';
import { FINALS_DATES, QUARTER_FINAL_DATES } from '../../data/competition';
import type { Group, LeagueCode, Match, TeamsById } from '../../types/competition';
import { buildProjectedBracket } from '../../utils/bracketModel';
import { projectCompetition, type ProjectedTie, type ProjectionMode } from '../../utils/projection';
import LeagueTabs from '../LeagueTabs';
import OutcomeLegend from '../OutcomeLegend';
import StandingsTable from '../StandingsTable';
import { readString, STORAGE_KEYS, writeString } from '../../utils/storage';
import FavoritePath from './FavoritePath';
import GlobalBracket from './GlobalBracket';
import TieCard from './TieCard';
import WhatIfPanel from './WhatIfPanel';
import {
	applyOverrides,
	countActiveOverrides,
	loadOverrides,
	saveOverrides,
	type ScoreEntry,
	type ScoreOverrides,
} from '../../utils/whatIf';

type ProjectionViewProps = {
	groups: Group[];
	matches: Match[];
	teamsById: TeamsById;
	favoriteTeamId: string | null;
	onPickTeam: () => void;
};

type BracketLayout = 'global' | 'columns';
// « Et si ? » = mode théorique appliqué aux scores saisis par l'utilisateur.
type ViewMode = ProjectionMode | 'whatif';

const MODES: { id: ViewMode; icon: string; label: string; help: string }[] = [
	{
		id: 'logical',
		icon: '🧮',
		label: 'Théorique',
		help: "Matchs joués : score réel. Matchs à venir : l'équipe la mieux classée (indice ≈ Elo + avantage du terrain) l'emporte, nul si l'écart est faible.",
	},
	{
		id: 'supporter',
		icon: '📣',
		label: 'Supporter',
		help: 'Même modèle, mais votre équipe gagne tous ses matchs restants (et les tirs au but).',
	},
	{
		id: 'whatif',
		icon: '🎛️',
		label: 'Et si ?',
		help: 'Saisissez vos scores sur les matchs restants : classements, qualifiés, barrages et tableau se recalculent en direct. Les matchs non saisis suivent la projection théorique (score grisé).',
	},
];

function TieColumn({
	title,
	ties,
	labelPrefix,
	teamsById,
	favoriteTeamId,
}: {
	title: string;
	ties: ProjectedTie[];
	labelPrefix: string;
	teamsById: TeamsById;
	favoriteTeamId: string | null;
}) {
	return (
		<div className="flex flex-col gap-2 min-w-0">
			<h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">{title}</h4>
			<div className="flex flex-col justify-around gap-2 flex-1">
				{ties.map((tie, i) => (
					<TieCard
						key={tie.id}
						tie={tie}
						label={`${labelPrefix} ${i + 1}`}
						teamsById={teamsById}
						favoriteTeamId={favoriteTeamId}
					/>
				))}
			</div>
		</div>
	);
}

export default function ProjectionView({
	groups,
	matches,
	teamsById,
	favoriteTeamId,
	onPickTeam,
}: ProjectionViewProps) {
	const [mode, setMode] = useState<ViewMode>('logical');
	const [overrides, setOverrides] = useState<ScoreOverrides>(loadOverrides);
	const changeScore = (matchId: number, entry: ScoreEntry) => {
		setOverrides((prev) => {
			const next = { ...prev };
			if (entry[0] === null && entry[1] === null) delete next[matchId];
			else next[matchId] = entry;
			saveOverrides(next);
			return next;
		});
	};
	const resetScores = () => {
		setOverrides({});
		saveOverrides({});
	};
	const [layout, setLayout] = useState<BracketLayout>(() =>
		readString(STORAGE_KEYS.bracketLayout) === 'columns' ? 'columns' : 'global',
	);
	const changeLayout = (next: BracketLayout) => {
		setLayout(next);
		writeString(STORAGE_KEYS.bracketLayout, next);
	};
	const favoriteTeam = favoriteTeamId ? teamsById[favoriteTeamId] : undefined;
	const favoriteLeague = useMemo<LeagueCode | null>(
		() => groups.find((g) => g.id === favoriteTeam?.groupId)?.league ?? null,
		[groups, favoriteTeam?.groupId],
	);
	const [selectedLeague, setSelectedLeague] = useState<LeagueCode | null>(null);
	const league = selectedLeague ?? favoriteLeague ?? 'A';

	const effectiveMatches = useMemo(
		() => (mode === 'whatif' ? applyOverrides(matches, overrides) : matches),
		[mode, matches, overrides],
	);
	const activeOverrides = useMemo(() => countActiveOverrides(matches, overrides), [matches, overrides]);

	const projection = useMemo(
		() =>
			groups.length > 0
				? projectCompetition(
						groups,
						effectiveMatches,
						teamsById,
						mode === 'supporter' ? 'supporter' : 'logical',
						favoriteTeamId,
					)
				: null,
		[groups, effectiveMatches, teamsById, mode, favoriteTeamId],
	);

	const bracketModel = useMemo(() => (projection ? buildProjectedBracket(projection) : null), [projection]);

	const supporterUnavailable = mode === 'supporter' && !favoriteTeam;
	const champion = projection?.championId ? teamsById[projection.championId] : undefined;

	return (
		<div className="flex flex-col gap-4">
			<div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
				{MODES.map((m) => (
					<button
						key={m.id}
						onClick={() => setMode(m.id)}
						className={`rounded-lg py-2.5 text-xs font-black transition-colors ${
							mode === m.id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
						}`}
					>
						{m.icon} {m.label}
					</button>
				))}
			</div>
			<p className="text-[11px] text-slate-400 leading-snug -mt-2">
				{MODES.find((m) => m.id === mode)?.help}
			</p>

			{supporterUnavailable ? (
				<div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
					<p className="text-sm text-slate-300 mb-3">Choisissez votre équipe pour activer le mode supporter.</p>
					<button
						onClick={onPickTeam}
						className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950"
					>
						⭐ Choisir mon équipe
					</button>
				</div>
			) : (
				projection && (
					<>
						{mode === 'whatif' && (
							<WhatIfPanel
								groups={groups}
								matches={matches}
								teamsById={teamsById}
								favoriteTeamId={favoriteTeamId}
								league={league}
								favoriteLeague={favoriteLeague}
								onLeagueChange={setSelectedLeague}
								standingsByGroup={projection.standingsByGroup}
								outcomes={projection.outcomes}
								overrides={overrides}
								activeCount={activeOverrides}
								onChange={changeScore}
								onReset={resetScores}
							/>
						)}

						{favoriteTeam && projection.favoritePath.length > 0 && (
							<FavoritePath team={favoriteTeam} steps={projection.favoritePath} />
						)}

						<section className="flex flex-col gap-3">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<h3 className="text-sm font-black text-slate-100">Tableau final · Ligue A</h3>
									<p className="text-[10px] text-slate-500">
										QF {QUARTER_FINAL_DATES} · Finales {FINALS_DATES}
									</p>
								</div>
								<div className="flex shrink-0 gap-0.5 rounded-lg border border-slate-800 bg-slate-900 p-0.5">
									{(
										[
											['global', 'Globale'],
											['columns', 'Colonnes'],
										] as const
									).map(([id, label]) => (
										<button
											key={id}
											onClick={() => changeLayout(id)}
											className={`rounded-md px-2.5 py-1 text-[10px] font-black transition-colors ${
												layout === id ? 'bg-emerald-500 text-slate-950' : 'text-slate-400'
											}`}
										>
											{label}
										</button>
									))}
								</div>
							</div>

							{layout === 'global' && (
								bracketModel && (
									<GlobalBracket
										model={bracketModel}
										teamsById={teamsById}
										favoriteTeamId={favoriteTeamId}
										championCaption={(name) => `${name} — vainqueur projeté`}
										renderDetail={(tie) =>
											tie.projected ? (
												<TieCard tie={tie.projected} label={tie.title} teamsById={teamsById} favoriteTeamId={favoriteTeamId} />
											) : null
										}
									/>
								)
							)}

							{layout === 'columns' && champion && (
								<div className="rounded-xl bg-linear-to-r from-emerald-500 to-cyan-500 p-px">
									<div className="rounded-xl bg-slate-950/90 px-4 py-3 flex items-center gap-3">
										<span className="text-3xl">🏆</span>
										<div>
											<p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
												Vainqueur projeté
											</p>
											<p className="text-lg font-black text-slate-100">
												<span className="flags">{champion.flag}</span> {champion.name}
											</p>
										</div>
									</div>
								</div>
							)}

							{layout === 'columns' && (
								<div className="-mx-4 px-4 overflow-x-auto bracket-scroll pb-2">
									<div className="grid grid-cols-[repeat(3,minmax(10.5rem,1fr))] gap-3 min-w-136">
										<TieColumn
											title="Quarts (A/R)"
											ties={projection.quarterFinals}
											labelPrefix="QF"
											teamsById={teamsById}
											favoriteTeamId={favoriteTeamId}
										/>
										<TieColumn
											title="Demi-finales"
											ties={projection.semiFinals}
											labelPrefix="Demie"
											teamsById={teamsById}
											favoriteTeamId={favoriteTeamId}
										/>
										<div className="flex flex-col gap-2 min-w-0">
											<h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500">Finale</h4>
											<div className="flex flex-col justify-center gap-3 flex-1">
												{projection.final && (
													<TieCard tie={projection.final} label="Finale" teamsById={teamsById} favoriteTeamId={favoriteTeamId} />
												)}
												{projection.thirdPlace && (
													<TieCard
														tie={projection.thirdPlace}
														label="3e place"
														teamsById={teamsById}
														favoriteTeamId={favoriteTeamId}
													/>
												)}
											</div>
										</div>
									</div>
								</div>
							)}

							{layout === 'global' && projection.thirdPlace && (
								<div className="max-w-xs w-full mx-auto">
									<TieCard
										tie={projection.thirdPlace}
										label="Match pour la 3e place"
										teamsById={teamsById}
										favoriteTeamId={favoriteTeamId}
									/>
								</div>
							)}
							<p className="text-[10px] text-slate-500 leading-snug">
								Appariements « Projeté » : schéma croisé (1er d'un groupe contre 2e d'un autre) en attendant le
								tirage UEFA ; dès que les matchs officiels sont connus, ils remplacent la projection.
							</p>
						</section>

						{(projection.playoffsAB.length > 0 || projection.playoffsBC.length > 0) && (
							<section className="flex flex-col gap-3">
								<h3 className="text-sm font-black text-slate-100">Barrages promotion/relégation (mars 2027)</h3>
								<div className="grid gap-3 sm:grid-cols-2">
									<TieColumn
										title="Ligue A / Ligue B"
										ties={projection.playoffsAB}
										labelPrefix="Barrage A/B"
										teamsById={teamsById}
										favoriteTeamId={favoriteTeamId}
									/>
									<TieColumn
										title="Ligue B / Ligue C"
										ties={projection.playoffsBC}
										labelPrefix="Barrage B/C"
										teamsById={teamsById}
										favoriteTeamId={favoriteTeamId}
									/>
								</div>
							</section>
						)}

						{mode !== 'whatif' && (
							<section className="flex flex-col gap-3">
								<h3 className="text-sm font-black text-slate-100">Classements finaux projetés</h3>
								<LeagueTabs value={league} onChange={setSelectedLeague} favoriteLeague={favoriteLeague} />
								<OutcomeLegend league={league} />
								<div className="grid gap-3 md:grid-cols-2">
									{groups
										.filter((g) => g.league === league)
										.map((group) => (
											<StandingsTable
												key={group.id}
												title={`Groupe ${group.id}`}
												subtitle="projection"
												rows={projection.standingsByGroup[group.id] ?? []}
												teamsById={teamsById}
												outcomes={projection.outcomes}
												favoriteTeamId={favoriteTeamId}
												showForm={false}
											/>
										))}
								</div>
							</section>
						)}
					</>
				)
			)}
		</div>
	);
}
