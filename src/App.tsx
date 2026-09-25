import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import AppHeader from './components/AppHeader';
import CountdownBanner from './components/CountdownBanner';
import MatchDetailsSheet from './components/match/MatchDetailsSheet';
import InstallBanner from './components/InstallBanner';
import KnockoutView from './components/KnockoutView';
import MatchesView from './components/MatchesView';
import SettingsView from './components/SettingsView';
import StandingsView from './components/StandingsView';
import TabNav from './components/TabNav';
import TeamPickerSheet from './components/TeamPickerSheet';
import UpdateBanner from './components/UpdateBanner';
import { useCompetitionData } from './hooks/useCompetitionData';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useServiceWorkerUpdate } from './hooks/useServiceWorkerUpdate';
import { useTeamTheme } from './hooks/useTeamTheme';
import { useUserPreferences } from './hooks/useUserPreferences';
import { TABS, type ActiveTab } from './data/tabs';
import { isLive, type Match } from './types/competition';
import { readString, STORAGE_KEYS, writeString } from './utils/storage';

// Chargée à la demande : le moteur de projection et ses vues ne pèsent pas
// sur le premier affichage (onglet Matchs).
const ProjectionView = lazy(() => import('./components/projection/ProjectionView'));

function readActiveTab(): ActiveTab {
	const saved = readString(STORAGE_KEYS.activeTab);
	return TABS.find((t) => t.id === saved)?.id ?? 'matches';
}

export default function App() {
	const { teamsById, groups, matches, status, isRefreshing, refresh, fetchedAt } = useCompetitionData();
	const { userId, favoriteTeamId, setFavoriteTeamId, notificationLevel, setNotificationLevel } =
		useUserPreferences();
	const push = usePushNotifications(userId);
	const install = useInstallPrompt();
	const update = useServiceWorkerUpdate();

	const [activeTab, setActiveTab] = useState<ActiveTab>(readActiveTab);
	const [showTeamPicker, setShowTeamPicker] = useState(false);
	// Fiche match ouverte : on garde l'id pour suivre les mises à jour Realtime.
	const [openMatchId, setOpenMatchId] = useState<number | null>(null);
	const openMatch = useCallback((match: Match) => setOpenMatchId(match.id), []);
	const closeMatch = useCallback(() => setOpenMatchId(null), []);

	useEffect(() => {
		writeString(STORAGE_KEYS.activeTab, activeTab);
		window.scrollTo({ top: 0 });
	}, [activeTab]);

	const favoriteTeam = favoriteTeamId ? (teamsById[favoriteTeamId] ?? null) : null;
	useTeamTheme(favoriteTeam);

	const openedMatch = openMatchId !== null ? matches.find((m) => m.id === openMatchId) : undefined;

	const liveCount = useMemo(() => matches.filter(isLive).length, [matches]);

	return (
		<div className="min-h-dvh bg-slate-950 text-slate-100 flex flex-col">
			<Toaster
				position="top-center"
				toastOptions={{
					style: { background: '#0f172a', color: '#f1f5f9', border: '1px solid #1e293b', fontSize: '13px' },
				}}
			/>
			{update.needRefresh && <UpdateBanner onRefresh={() => void update.applyUpdate()} onDismiss={update.dismiss} />}

			<AppHeader
				favoriteTeam={favoriteTeam}
				isRefreshing={isRefreshing}
				onOpenTeamPicker={() => setShowTeamPicker(true)}
				onRefresh={() => void refresh()}
			/>
			{favoriteTeamId && status === 'ready' && (
				<CountdownBanner
					matches={matches}
					teamsById={teamsById}
					favoriteTeamId={favoriteTeamId}
					onOpen={openMatch}
				/>
			)}
			<TabNav activeTab={activeTab} onTabChange={setActiveTab} liveCount={liveCount} />

			<main className="flex-1 w-full max-w-3xl mx-auto px-4 pt-4 pb-32">
				{status === 'loading' && (
					<div className="flex flex-col items-center gap-3 py-20 text-slate-500">
						<span className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
						<p className="text-sm">Chargement de la compétition…</p>
					</div>
				)}
				{status === 'error' && (
					<div className="flex flex-col items-center gap-3 py-20 text-center">
						<p className="text-sm text-slate-300">Impossible de charger les données. Vérifiez votre connexion.</p>
						<button
							onClick={() => void refresh()}
							className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950"
						>
							Réessayer
						</button>
					</div>
				)}
				{status === 'ready' && (
					<>
						{activeTab === 'matches' && (
							<MatchesView
								matches={matches}
								onOpenMatch={openMatch}
								groups={groups}
								teamsById={teamsById}
								favoriteTeamId={favoriteTeamId}
							/>
						)}
						{activeTab === 'standings' && (
							<StandingsView
								groups={groups}
								matches={matches}
								teamsById={teamsById}
								favoriteTeamId={favoriteTeamId}
							/>
						)}
						{activeTab === 'knockout' && (
							<KnockoutView
								groups={groups}
								onOpenMatch={openMatch}
								matches={matches}
								teamsById={teamsById}
								favoriteTeamId={favoriteTeamId}
							/>
						)}
						{activeTab === 'projection' && (
							<Suspense
								fallback={
									<div className="flex justify-center py-20">
										<span className="w-8 h-8 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin" />
									</div>
								}
							>
								<ProjectionView
									groups={groups}
									matches={matches}
									teamsById={teamsById}
									favoriteTeamId={favoriteTeamId}
									onPickTeam={() => setShowTeamPicker(true)}
								/>
							</Suspense>
						)}
						{activeTab === 'settings' && (
							<SettingsView
								favoriteTeam={favoriteTeam}
								onPickTeam={() => setShowTeamPicker(true)}
								notificationLevel={notificationLevel}
								onChangeNotificationLevel={setNotificationLevel}
								push={push}
								fetchedAt={fetchedAt}
							/>
						)}
					</>
				)}
			</main>

			{openedMatch && (
				<MatchDetailsSheet match={openedMatch} teamsById={teamsById} favoriteTeamId={favoriteTeamId} onClose={closeMatch} />
			)}

			{showTeamPicker && (
				<TeamPickerSheet
					groups={groups}
					teamsById={teamsById}
					selectedTeamId={favoriteTeamId}
					onSelect={setFavoriteTeamId}
					onClose={() => setShowTeamPicker(false)}
				/>
			)}

			{install.mode && !showTeamPicker && (
				<InstallBanner mode={install.mode} onInstall={() => void install.install()} onDismiss={install.dismiss} />
			)}
		</div>
	);
}
