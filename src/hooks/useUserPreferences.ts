import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { NotificationLevel } from '../types/competition';
import { readString, STORAGE_KEYS, writeString } from '../utils/storage';

const LEVELS: NotificationLevel[] = ['favorite', 'all', 'none'];

function readLevel(): NotificationLevel {
	const raw = readString(STORAGE_KEYS.notificationLevel);
	return LEVELS.find((l) => l === raw) ?? 'favorite';
}

// Session Supabase anonyme : donne un auth.uid() stable à chaque appareil
// sans compte, ce qui permet la RLS sur user_preferences / push_subscriptions.
// (Activer « Anonymous sign-ins » dans Supabase > Authentication > Providers.)
async function ensureSession(): Promise<string | null> {
	const { data } = await supabase.auth.getSession();
	if (data.session) return data.session.user.id;
	const { data: signIn, error } = await supabase.auth.signInAnonymously();
	if (error) {
		console.warn('Connexion anonyme indisponible, préférences locales uniquement :', error.message);
		return null;
	}
	return signIn.user?.id ?? null;
}

// Préférences « local-first » : l'état local (et localStorage) est mis à jour
// immédiatement (optimiste), puis synchronisé vers Supabase. En cas d'échec
// réseau, la valeur locale reste la référence et sera renvoyée au prochain
// changement.
export function useUserPreferences() {
	const [userId, setUserId] = useState<string | null>(null);
	const [favoriteTeamId, setFavoriteTeamIdState] = useState<string | null>(() =>
		readString(STORAGE_KEYS.favoriteTeam),
	);
	const [notificationLevel, setNotificationLevelState] =
		useState<NotificationLevel>(readLevel);

	const latest = useRef({ favoriteTeamId, notificationLevel });
	useEffect(() => {
		latest.current = { favoriteTeamId, notificationLevel };
	}, [favoriteTeamId, notificationLevel]);

	const persistRemote = useCallback(
		async (uid: string | null, next: { favoriteTeamId: string | null; notificationLevel: NotificationLevel }) => {
			if (!uid) return false;
			const { error } = await supabase.from('user_preferences').upsert({
				user_id: uid,
				favorite_team_id: next.favoriteTeamId,
				notification_level: next.notificationLevel,
			});
			if (error) {
				console.error('Synchronisation des préférences impossible :', error.message);
				return false;
			}
			return true;
		},
		[],
	);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const uid = await ensureSession();
			if (cancelled || !uid) return;
			setUserId(uid);

			const { data, error } = await supabase
				.from('user_preferences')
				.select('favorite_team_id, notification_level')
				.eq('user_id', uid)
				.maybeSingle();
			if (cancelled || error) return;

			if (data && latest.current.favoriteTeamId === null && data.favorite_team_id) {
				// La base fait foi si l'appareil n'a encore rien choisi localement
				// (stockage local vidé mais session conservée).
				setFavoriteTeamIdState(data.favorite_team_id);
				setNotificationLevelState(data.notification_level);
				writeString(STORAGE_KEYS.favoriteTeam, data.favorite_team_id);
				writeString(STORAGE_KEYS.notificationLevel, data.notification_level);
				return;
			}
			const remoteDiffers =
				!data ||
				data.favorite_team_id !== latest.current.favoriteTeamId ||
				data.notification_level !== latest.current.notificationLevel;
			// Sinon, les choix locaux (possiblement faits hors ligne) font foi.
			if (remoteDiffers) await persistRemote(uid, latest.current);
		})();
		return () => {
			cancelled = true;
		};
	}, [persistRemote]);

	const setFavoriteTeamId = useCallback(
		(teamId: string | null) => {
			setFavoriteTeamIdState(teamId);
			writeString(STORAGE_KEYS.favoriteTeam, teamId);
			void persistRemote(userId, { ...latest.current, favoriteTeamId: teamId });
		},
		[persistRemote, userId],
	);

	// Renvoie false si la synchro distante a échoué (pour que l'appelant puisse
	// informer l'utilisateur que ses alertes ne suivront pas encore ce réglage).
	const setNotificationLevel = useCallback(
		async (level: NotificationLevel): Promise<boolean> => {
			setNotificationLevelState(level);
			writeString(STORAGE_KEYS.notificationLevel, level);
			return persistRemote(userId, { ...latest.current, notificationLevel: level });
		},
		[persistRemote, userId],
	);

	return {
		userId,
		favoriteTeamId,
		notificationLevel,
		setFavoriteTeamId,
		setNotificationLevel,
	};
}
