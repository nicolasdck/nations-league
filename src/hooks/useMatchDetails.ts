import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isDetailsStale, type MatchDetails } from '../lib/matchDetails';
import { isLive, type Match } from '../types/competition';

type DetailsState = {
	matchId: number | null;
	details: MatchDetails | null;
	fetchedAt: string | null;
	error: boolean;
};

const EMPTY: DetailsState = { matchId: null, details: null, fetchedAt: null, error: false };
const LIVE_REFRESH_MS = 60_000;

function isMatchDetails(value: unknown): value is MatchDetails {
	if (typeof value !== 'object' || value === null) return false;
	const v = value as Record<string, unknown>;
	return Array.isArray(v.stats) && Array.isArray(v.timeline) && Array.isArray(v.headToHead);
}

// Fiche match : lecture directe du cache Supabase (match_details) et, s'il est
// absent ou périmé, appel à l'Edge Function match-details qui interroge ESPN.
// En direct, relecture chaque minute tant que la fiche est ouverte.
export function useMatchDetails(match: Match | null) {
	const [state, setState] = useState<DetailsState>(EMPTY);
	const matchId = match?.id ?? null;
	const status = match?.status ?? null;
	const kickoffAt = match?.kickoffAt ?? null;
	const live = match ? isLive(match) : false;

	useEffect(() => {
		if (matchId === null || status === null || kickoffAt === null) return;
		let cancelled = false;

		const load = async () => {
			const { data: cached } = await supabase
				.from('match_details')
				.select('payload, fetched_at')
				.eq('match_id', matchId)
				.maybeSingle();
			if (cancelled) return;
			if (cached && isMatchDetails(cached.payload)) {
				setState({ matchId, details: cached.payload, fetchedAt: cached.fetched_at, error: false });
				if (!isDetailsStale(status, kickoffAt, cached.fetched_at)) return;
			}

			const { data, error } = await supabase.functions.invoke<{ details: unknown; fetchedAt: string }>(
				'match-details',
				{ body: { matchId } },
			);
			if (cancelled) return;
			if (!error && data && isMatchDetails(data.details)) {
				setState({ matchId, details: data.details, fetchedAt: data.fetchedAt, error: false });
			} else if (!cached) {
				setState({ matchId, details: null, fetchedAt: null, error: true });
			}
		};

		void load();
		const interval = live ? setInterval(() => void load(), LIVE_REFRESH_MS) : undefined;
		return () => {
			cancelled = true;
			if (interval) clearInterval(interval);
		};
	}, [matchId, status, kickoffAt, live]);

	// Ignore l'état d'un match précédemment ouvert.
	const current = state.matchId === matchId ? state : EMPTY;
	return {
		details: current.details,
		fetchedAt: current.fetchedAt,
		error: current.error,
		loading: matchId !== null && current.details === null && !current.error,
	};
}
