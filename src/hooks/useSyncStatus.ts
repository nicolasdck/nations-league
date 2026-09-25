import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Tables } from '../lib/database.types';

export type SyncStatus = Tables<'sync_status'>;

// Au-delà de ce nombre d'échecs consécutifs, la synchro est signalée en panne
// (même seuil que l'e-mail d'alerte de l'Edge Function).
export const SYNC_ALERT_THRESHOLD = 3;

const REFRESH_MS = 60_000;

// État de santé de la synchronisation ESPN, relu chaque minute tant que la
// vue qui l'affiche est montée.
export function useSyncStatus() {
	const [status, setStatus] = useState<SyncStatus | null>(null);

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			const { data, error } = await supabase.from('sync_status').select('*').eq('id', 'espn').maybeSingle();
			if (!cancelled && !error) setStatus(data);
		};
		void load();
		const interval = setInterval(() => void load(), REFRESH_MS);
		return () => {
			cancelled = true;
			clearInterval(interval);
		};
	}, []);

	return status;
}
