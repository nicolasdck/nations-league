import { useCallback, useEffect, useRef, useState } from 'react';
import type { GoalEvent } from '../components/GoalCelebration';
import type { Match, NotificationLevel } from '../types/competition';

type Scores = Map<number, [number, number]>;

function readGoalFromUrl(): GoalEvent | null {
	const params = new URLSearchParams(window.location.search);
	const matchId = Number(params.get('goal'));
	const side = params.get('side');
	if (!Number.isSafeInteger(matchId) || matchId <= 0 || (side !== 'home' && side !== 'away')) return null;
	// Nettoie l'URL : un rechargement ne doit pas rejouer la célébration.
	params.delete('goal');
	params.delete('side');
	const query = params.toString();
	window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
	return { key: `url-${matchId}-${side}`, matchId, side };
}

function wantsCelebration(
	match: Match,
	side: 'home' | 'away',
	level: NotificationLevel,
	favoriteTeamId: string | null,
): boolean {
	if (level === 'all') return true;
	if (level === 'none' || !favoriteTeamId) return false;
	// Niveau « équipe préférée » : on ne célèbre que ses propres buts.
	return (side === 'home' ? match.homeTeamId : match.awayTeamId) === favoriteTeamId;
}

// File des célébrations de but :
// - en direct : hausse d'un score d'un match en cours reçue par Realtime ;
// - app fermée : notification push touchée → URL ?goal=<id>&side=<home|away>
//   (ouverture) ou message du service worker (app déjà ouverte en fond).
// `snapshotVersion` change à chaque relecture complète (démarrage, retour au
// premier plan, reconnexion) : ces relectures rattrapent des buts anciens, qui
// ne déclenchent pas de célébration. Seules les mises à jour Realtime le font.
export function useGoalCelebrations(
	matches: Match[],
	snapshotVersion: string | null,
	favoriteTeamId: string | null,
	level: NotificationLevel,
) {
	const [queue, setQueue] = useState<GoalEvent[]>(() => {
		const fromUrl = readGoalFromUrl();
		return fromUrl ? [fromUrl] : [];
	});
	const previous = useRef<{ scores: Scores; version: string | null } | null>(null);

	const enqueue = useCallback((goal: GoalEvent) => {
		setQueue((q) => (q.some((g) => g.key === goal.key) ? q : [...q, goal]));
	}, []);

	useEffect(() => {
		const current: Scores = new Map(
			matches.map((m) => [m.id, [m.homeScore ?? 0, m.awayScore ?? 0]]),
		);
		const before = previous.current;
		previous.current = { scores: current, version: snapshotVersion };
		// Premier rendu ou relecture complète : nouvel état de référence, pas de but.
		if (!before || before.version !== snapshotVersion) return;

		for (const m of matches) {
			if (m.status !== 'LIVE' && m.status !== 'HT') continue;
			const old = before.scores.get(m.id);
			if (!old) continue;
			const now = current.get(m.id)!;
			for (const [side, index] of [['home', 0], ['away', 1]] as const) {
				if (now[index] > old[index] && wantsCelebration(m, side, level, favoriteTeamId)) {
					enqueue({ key: `${m.id}-${side}-${now[0]}-${now[1]}`, matchId: m.id, side });
				}
			}
		}
	}, [matches, snapshotVersion, favoriteTeamId, level, enqueue]);

	// Notification touchée alors que l'app était déjà ouverte en arrière-plan.
	useEffect(() => {
		if (!('serviceWorker' in navigator)) return;
		const onMessage = (event: MessageEvent<unknown>) => {
			const data = event.data as { type?: unknown; matchId?: unknown; side?: unknown } | null;
			if (data?.type !== 'GOAL_NOTIFICATION_CLICK') return;
			const matchId = Number(data.matchId);
			if (!Number.isSafeInteger(matchId) || (data.side !== 'home' && data.side !== 'away')) return;
			enqueue({ key: `sw-${matchId}-${data.side}-${Date.now()}`, matchId, side: data.side });
		};
		navigator.serviceWorker.addEventListener('message', onMessage);
		return () => navigator.serviceWorker.removeEventListener('message', onMessage);
	}, [enqueue]);

	// Par clé : le toucher et la fin d'animation peuvent tous deux fermer la
	// même célébration sans retirer la suivante de la file.
	const dismiss = useCallback((key: string) => setQueue((q) => q.filter((g) => g.key !== key)), []);

	return { current: queue[0] ?? null, dismiss };
}
