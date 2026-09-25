import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../lib/database.types';
import {
	mapMatchRow,
	mapTeamRow,
	type Group,
	type Match,
	type Team,
	type TeamsById,
} from '../types/competition';
import { readJson, STORAGE_KEYS, writeJson } from '../utils/storage';

type CompetitionSnapshot = {
	teams: Team[];
	groups: Group[];
	matches: Match[];
	fetchedAt: string;
};

export type LoadStatus = 'loading' | 'ready' | 'error';

function isSnapshot(value: unknown): value is CompetitionSnapshot {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		Array.isArray(v.teams) &&
		Array.isArray(v.groups) &&
		Array.isArray(v.matches) &&
		typeof v.fetchedAt === 'string'
	);
}

function sortMatches(matches: Match[]): Match[] {
	return [...matches].sort(
		(a, b) => a.kickoffAt.localeCompare(b.kickoffAt) || a.id - b.id,
	);
}

async function fetchSnapshot(): Promise<CompetitionSnapshot> {
	const [teamsRes, groupsRes, matchesRes] = await Promise.all([
		supabase.from('teams').select('*'),
		supabase.from('groups').select('*').order('id'),
		supabase.from('matches').select('*').order('kickoff_at'),
	]);
	if (teamsRes.error) throw teamsRes.error;
	if (groupsRes.error) throw groupsRes.error;
	if (matchesRes.error) throw matchesRes.error;

	const teams = teamsRes.data.map(mapTeamRow);
	const groups: Group[] = groupsRes.data.map((g) => ({
		id: g.id,
		league: g.league,
		number: g.number,
		teamIds: teams
			.filter((t) => t.groupId === g.id)
			.sort((a, b) => a.pot - b.pot)
			.map((t) => t.id),
	}));

	return {
		teams,
		groups,
		matches: sortMatches(matchesRes.data.map(mapMatchRow)),
		fetchedAt: new Date().toISOString(),
	};
}

// Au retour au premier plan, on ne refait une lecture complète que si les
// données ont plus de 60 s (le Realtime couvre le reste).
const STALE_AFTER_MS = 60_000;

// Stale-while-revalidate : rendu immédiat depuis le cache local, puis
// rafraîchissement Supabase, puis mises à jour incrémentales via Realtime.
export function useCompetitionData() {
	const [snapshot, setSnapshot] = useState<CompetitionSnapshot | null>(() =>
		readJson(STORAGE_KEYS.competition, isSnapshot),
	);
	const [status, setStatus] = useState<LoadStatus>(() =>
		snapshot ? 'ready' : 'loading',
	);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const lastFetchRef = useRef(0);

	const refresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			const fresh = await fetchSnapshot();
			lastFetchRef.current = Date.now();
			setSnapshot(fresh);
			setStatus('ready');
		} catch (error) {
			console.error('Chargement Supabase impossible :', error);
			setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
		} finally {
			setIsRefreshing(false);
		}
	}, []);

	useEffect(() => {
		// Lecture Supabase au montage : l'état est mis à jour à l'arrivée de la
		// réponse, jamais de façon synchrone.
		// eslint-disable-next-line react-hooks/set-state-in-effect
		void refresh();
	}, [refresh]);

	useEffect(() => {
		if (snapshot) writeJson(STORAGE_KEYS.competition, snapshot);
	}, [snapshot]);

	useEffect(() => {
		const onVisible = () => {
			if (
				document.visibilityState === 'visible' &&
				Date.now() - lastFetchRef.current > STALE_AFTER_MS
			) {
				void refresh();
			}
		};
		document.addEventListener('visibilitychange', onVisible);
		window.addEventListener('online', onVisible);
		return () => {
			document.removeEventListener('visibilitychange', onVisible);
			window.removeEventListener('online', onVisible);
		};
	}, [refresh]);

	useEffect(() => {
		// Le premier SUBSCRIBED suit immédiatement la lecture du montage : seule
		// une REconnexion (événements manqués pendant la coupure) justifie de relire.
		let hasSubscribedOnce = false;
		const channel = supabase
			.channel('matches-live')
			.on<Tables<'matches'>>(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'matches' },
				(payload) => {
					if (payload.eventType === 'DELETE') {
						const removedId = payload.old.id;
						setSnapshot((prev) =>
							prev
								? { ...prev, matches: prev.matches.filter((m) => m.id !== removedId) }
								: prev,
						);
						return;
					}
					const incoming = mapMatchRow(payload.new);
					setSnapshot((prev) => {
						if (!prev) return prev;
						const exists = prev.matches.some((m) => m.id === incoming.id);
						const matches = exists
							? prev.matches.map((m) => (m.id === incoming.id ? incoming : m))
							: [...prev.matches, incoming];
						return { ...prev, matches: sortMatches(matches) };
					});
				},
			)
			.subscribe((channelStatus) => {
				if (channelStatus !== 'SUBSCRIBED') return;
				if (hasSubscribedOnce) void refresh();
				hasSubscribedOnce = true;
			});

		return () => {
			void supabase.removeChannel(channel);
		};
	}, [refresh]);

	const teamsById = useMemo<TeamsById>(() => {
		const map: TeamsById = {};
		for (const team of snapshot?.teams ?? []) map[team.id] = team;
		return map;
	}, [snapshot?.teams]);

	return {
		teams: snapshot?.teams ?? [],
		teamsById,
		groups: snapshot?.groups ?? [],
		matches: snapshot?.matches ?? [],
		fetchedAt: snapshot?.fetchedAt ?? null,
		status,
		isRefreshing,
		refresh,
	};
}
